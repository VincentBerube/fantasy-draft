// backend/src/services/enhanced-player-import.service.ts
import { PrismaClient } from '@prisma/client';
import { DynamicExcelParserService } from './dynamic-excel-parser.service';
import { PlayerMatchingService } from './player-matching.service';
import * as fs from 'fs';

export interface ImportOptions {
  updateStrategy: 'merge' | 'overwrite';
  autoMatchThreshold: number; // Confidence threshold for auto-matching (0-1)
  createNewPlayers: boolean; // Whether to create players not found in Sleeper
  preserveSleeperData: boolean; // Whether to protect Sleeper core data
}

export interface ImportResult {
  summary: {
    totalProcessed: number;
    autoMatched: number;
    manualReviewNeeded: number;
    newPlayersCreated: number;
    failed: number;
  };
  autoMatched: Array<{
    excelRowIndex: number;
    playerName: string;
    playerId: string;
    fieldsUpdated: string[];
  }>;
  needsReview: Array<{
    excelRowIndex: number;
    playerName: string;
    potentialMatches: Array<{
      playerId: string;
      playerName: string;
      confidence: number;
      reasons: string[];
    }>;
    excelData: Record<string, any>;
  }>;
  newPlayers: Array<{
    excelRowIndex: number;
    playerName: string;
    playerId: string;
    dataSource: 'excel';
  }>;
  errors: Array<{
    excelRowIndex: number;
    playerName: string;
    error: string;
  }>;
  columnMapping: Array<{
    excelColumn: string;
    mappedTo: string | null;
    processed: boolean;
  }>;
}

export class EnhancedPlayerImportService {
  private excelParser: DynamicExcelParserService;
  private playerMatcher: PlayerMatchingService;

  constructor(private prisma: PrismaClient) {
    this.excelParser = new DynamicExcelParserService();
    this.playerMatcher = new PlayerMatchingService(prisma);
  }

  /**
   * Import players from Excel with smart matching and dynamic column handling
   */
  async importFromExcel(
    filePath: string, 
    options: Partial<ImportOptions> = {}
  ): Promise<ImportResult> {
    const defaultOptions: ImportOptions = {
      updateStrategy: 'merge',
      autoMatchThreshold: 0.85,
      createNewPlayers: true,
      preserveSleeperData: true
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Step 1: Parse Excel file with dynamic column detection
      console.log('📊 Parsing Excel file with dynamic column detection...');
      const parsedData = await this.excelParser.parseExcelFile(filePath);
      
      // Step 2: Batch match players
      console.log('🔍 Matching players with existing database...');
      const matchResults = await this.playerMatcher.batchMatchPlayers(
        parsedData.players.map(p => ({
          name: p.name,
          position: p.position,
          team: p.team,
          additionalData: p.additionalData
        }))
      );

      // Step 3: Process results
      const result: ImportResult = {
        summary: {
          totalProcessed: parsedData.players.length,
          autoMatched: 0,
          manualReviewNeeded: 0,
          newPlayersCreated: 0,
          failed: 0
        },
        autoMatched: [],
        needsReview: [],
        newPlayers: [],
        errors: [],
        columnMapping: parsedData.columns.map(col => ({
          excelColumn: col.header,
          mappedTo: col.mappedField,
          processed: col.mappedField !== null
        }))
      };

      // Process auto-matched players
      for (const match of matchResults.autoMatched) {
        try {
          const excelPlayer = parsedData.players[match.excelIndex];
          const fieldsUpdated = await this.updatePlayerFromExcel(
            match.playerId,
            excelPlayer,
            finalOptions
          );

          result.autoMatched.push({
            excelRowIndex: excelPlayer.rowIndex,
            playerName: excelPlayer.name,
            playerId: match.playerId,
            fieldsUpdated
          });

          result.summary.autoMatched++;
        } catch (error: any) {
          const excelPlayer = parsedData.players[match.excelIndex];
          result.errors.push({
            excelRowIndex: excelPlayer.rowIndex,
            playerName: excelPlayer.name,
            error: error.message
          });
          result.summary.failed++;
        }
      }

      // Process players needing review
      for (const reviewItem of matchResults.needsReview) {
        const excelPlayer = parsedData.players[reviewItem.excelIndex];
        
        // Check if top match exceeds auto-match threshold
        const topMatch = reviewItem.matches.potentialMatches[0];
        if (topMatch && topMatch.confidence >= finalOptions.autoMatchThreshold) {
          try {
            const fieldsUpdated = await this.updatePlayerFromExcel(
              topMatch.playerId,
              excelPlayer,
              finalOptions
            );

            result.autoMatched.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              playerId: topMatch.playerId,
              fieldsUpdated
            });

            result.summary.autoMatched++;
          } catch (error: any) {
            result.errors.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              error: error.message
            });
            result.summary.failed++;
          }
        } else {
          result.needsReview.push({
            excelRowIndex: excelPlayer.rowIndex,
            playerName: excelPlayer.name,
            potentialMatches: reviewItem.matches.potentialMatches,
            excelData: excelPlayer.additionalData
          });

          result.summary.manualReviewNeeded++;
        }
      }

      // Process unmatched players (create new if enabled)
      if (finalOptions.createNewPlayers) {
        for (const noMatch of matchResults.noMatches) {
          try {
            const excelPlayer = parsedData.players[noMatch.excelIndex];
            const newPlayerId = await this.playerMatcher.createPlayerFromExcel({
              name: excelPlayer.name,
              position: excelPlayer.position,
              team: excelPlayer.team,
              additionalData: excelPlayer.additionalData
            });

            result.newPlayers.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              playerId: newPlayerId,
              dataSource: 'excel'
            });

            result.summary.newPlayersCreated++;
          } catch (error: any) {
            const excelPlayer = parsedData.players[noMatch.excelIndex];
            result.errors.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              error: error.message
            });
            result.summary.failed++;
          }
        }
      } else {
        // Add unmatched to review list
        for (const noMatch of matchResults.noMatches) {
          const excelPlayer = parsedData.players[noMatch.excelIndex];
          result.needsReview.push({
            excelRowIndex: excelPlayer.rowIndex,
            playerName: excelPlayer.name,
            potentialMatches: [],
            excelData: excelPlayer.additionalData
          });
          result.summary.manualReviewNeeded++;
        }
      }

      console.log('✅ Import completed:', result.summary);
      return result;

    } catch (error: any) {
      console.error('❌ Import failed:', error);
      throw new Error(`Import failed: ${error.message}`);
    } finally {
      // Cleanup uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }
    }
  }

  /**
   * Get preview of import without actually importing
   */
  async getImportPreview(filePath: string): Promise<{
    columnAnalysis: Array<{
      header: string;
      mappedTo: string | null;
      dataType: string;
      sampleValue: any;
      willBeProcessed: boolean;
    }>;
    playerSamples: Array<{
      name: string;
      position?: string;
      confidence: number;
      potentialMatch?: {
        name: string;
        confidence: number;
      };
    }>;
    summary: {
      totalRows: number;
      recognizedColumns: number;
      estimatedMatches: number;
      estimatedNewPlayers: number;
    };
    warnings: string[];
  }> {
    try {
      // Get column analysis
      const columnAnalysis = await this.excelParser.getColumnAnalysis(filePath);
      
      // Parse a sample of players for preview
      const sampleData = await this.excelParser.parseExcelFile(filePath);
      const samplePlayers = sampleData.players.slice(0, 10); // First 10 players
      
      // Quick match for preview
      const playerSamples = [];
      for (const player of samplePlayers) {
        const matchResult = await this.playerMatcher.findPlayerMatch({
          name: player.name,
          position: player.position,
          team: player.team,
          additionalData: player.additionalData
        });

        playerSamples.push({
          name: player.name,
          position: player.position,
          confidence: player.confidence,
          potentialMatch: matchResult.exactMatch ? {
            name: 'Exact match found',
            confidence: 1.0
          } : matchResult.potentialMatches[0] ? {
            name: matchResult.potentialMatches[0].playerName,
            confidence: matchResult.potentialMatches[0].confidence
          } : undefined
        });
      }

      // Generate warnings
      const warnings: string[] = [];
      if (columnAnalysis.columns.filter(c => c.mappedField === 'name').length === 0) {
        warnings.push('No player name column detected');
      }
      
      const recognizedColumns = columnAnalysis.columns.filter(c => c.mappedField !== null).length;
      if (recognizedColumns < 3) {
        warnings.push('Very few columns recognized automatically - consider manual mapping');
      }

      return {
        columnAnalysis: columnAnalysis.columns.map(col => ({
          header: col.header,
          mappedTo: col.mappedField,
          dataType: col.dataType,
          sampleValue: col.sampleValues[0] || null,
          willBeProcessed: col.mappedField !== null
        })),
        playerSamples,
        summary: {
          totalRows: sampleData.metadata.totalRows,
          recognizedColumns,
          estimatedMatches: Math.floor(sampleData.metadata.validRows * 0.8),
          estimatedNewPlayers: Math.floor(sampleData.metadata.validRows * 0.2)
        },
        warnings
      };

    } catch (error: any) {
      throw new Error(`Preview generation failed: ${error.message}`);
    }
  }

  /**
   * Update a player with Excel data
   */
  private async updatePlayerFromExcel(
    playerId: string,
    excelPlayer: any,
    options: ImportOptions
  ): Promise<string[]> {
    return await this.playerMatcher.updatePlayerWithExcelData(
      playerId,
      excelPlayer.additionalData,
      {
        updateStrategy: options.updateStrategy,
        preserveSleeperData: options.preserveSleeperData
      }
    );
  }

  /**
   * Validate import options
   */
  private validateImportOptions(options: ImportOptions): void {
    if (options.autoMatchThreshold < 0 || options.autoMatchThreshold > 1) {
      throw new Error('Auto-match threshold must be between 0 and 1');
    }

    if (!['merge', 'overwrite'].includes(options.updateStrategy)) {
      throw new Error('Update strategy must be either "merge" or "overwrite"');
    }
  }

  /**
   * Get import statistics for reporting
   */
  async getImportStats(): Promise<{
    totalImports: number;
    totalPlayersProcessed: number;
    averageMatchRate: number;
    lastImportDate?: Date;
  }> {
    const importSessions = await this.prisma.importSession.findMany({
      select: {
        summary: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (importSessions.length === 0) {
      return {
        totalImports: 0,
        totalPlayersProcessed: 0,
        averageMatchRate: 0
      };
    }

    const totalProcessed = importSessions.reduce((sum, session) => {
      const summary = session.summary as any;
      return sum + (summary.totalProcessed || 0);
    }, 0);

    const totalMatched = importSessions.reduce((sum, session) => {
      const summary = session.summary as any;
      return sum + (summary.playersModified || 0) + (summary.playersCreated || 0);
    }, 0);

    return {
      totalImports: importSessions.length,
      totalPlayersProcessed: totalProcessed,
      averageMatchRate: totalProcessed > 0 ? totalMatched / totalProcessed : 0,
      lastImportDate: importSessions[0]?.createdAt
    };
  }
}