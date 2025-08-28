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
    this.validateImportOptions(finalOptions);

    try {
      console.log('🚀 Starting enhanced Excel import...');
      console.log('📋 Options:', finalOptions);

      // Parse Excel file
      const parsedData = await this.excelParser.parseExcelFile(filePath);
      console.log(`📊 Parsed ${parsedData.players.length} players from Excel`);

      // Initialize result object
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

      // Get all existing players for matching
      const allPlayers = await this.prisma.player.findMany({
        select: {
          id: true,
          name: true,
          position: true,
          team: true,
          sleeperId: true,
          aliases: true,
          dataSource: true
        }
      });

      // Process each player
      for (const excelPlayer of parsedData.players) {
        try {
          const matchResult = await this.playerMatcher.findPlayerMatch(excelPlayer, allPlayers);

          if (matchResult.exactMatch) {
            // Auto-match: update existing player
            const fieldsUpdated = await this.updatePlayerFromExcel(
              matchResult.exactMatch,
              excelPlayer,
              finalOptions
            );

            result.autoMatched.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              playerId: matchResult.exactMatch,
              fieldsUpdated
            });

            result.summary.autoMatched++;

          } else if (matchResult.potentialMatches.length > 0 && 
                     matchResult.potentialMatches[0].confidence >= finalOptions.autoMatchThreshold &&
                     !matchResult.requiresManualReview) {
            
            // High confidence fuzzy match
            const bestMatch = matchResult.potentialMatches[0];
            const fieldsUpdated = await this.updatePlayerFromExcel(
              bestMatch.playerId,
              excelPlayer,
              finalOptions
            );

            result.autoMatched.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              playerId: bestMatch.playerId,
              fieldsUpdated
            });

            result.summary.autoMatched++;

          } else if (matchResult.potentialMatches.length > 0) {
            // Needs manual review
            result.needsReview.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              potentialMatches: matchResult.potentialMatches,
              excelData: excelPlayer.additionalData
            });

            result.summary.manualReviewNeeded++;

          } else if (finalOptions.createNewPlayers) {
            // No matches found - create new player
            try {
              const newPlayerId = await this.playerMatcher.createPlayerFromExcel({
                name: excelPlayer.name,
                position: excelPlayer.position,
                team: excelPlayer.team || undefined,
                additionalData: excelPlayer.additionalData,
                rowIndex: excelPlayer.rowIndex
              });

              result.newPlayers.push({
                excelRowIndex: excelPlayer.rowIndex,
                playerName: excelPlayer.name,
                playerId: newPlayerId,
                dataSource: 'excel'
              });

              result.summary.newPlayersCreated++;
            } catch (error: any) {
              result.errors.push({
                excelRowIndex: excelPlayer.rowIndex,
                playerName: excelPlayer.name,
                error: error.message
              });
              result.summary.failed++;
            }
          } else {
            // No matches and not creating new players
            result.needsReview.push({
              excelRowIndex: excelPlayer.rowIndex,
              playerName: excelPlayer.name,
              potentialMatches: [],
              excelData: excelPlayer.additionalData
            });
            result.summary.manualReviewNeeded++;
          }

        } catch (error: any) {
          console.error(`❌ Error processing player "${excelPlayer.name}":`, error);
          result.errors.push({
            excelRowIndex: excelPlayer.rowIndex,
            playerName: excelPlayer.name,
            error: error.message
          });
          result.summary.failed++;
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
        playerName: string;
        confidence: number;
        isSleeperPlayer: boolean;
      };
      additionalFields: Record<string, any>;
    }>;
    summary: {
      totalRows: number;
      validPlayers: number;
      recognizedColumns: number;
      unknownColumns: number;
      estimatedAutoMatches: number;
      estimatedNewPlayers: number;
    };
    warnings: string[];
  }> {
    try {
      console.log('📊 Generating import preview...');

      // Parse Excel file
      const parsedData = await this.excelParser.parseExcelFile(filePath);
      
      // Get sample of players for preview
      const samplePlayers = parsedData.players.slice(0, 10);
      const playerSamples = [];

      for (const excelPlayer of samplePlayers) {
        const matchResult = await this.playerMatcher.findPlayerMatch(excelPlayer);
        
        // Find the best match for display
        let potentialMatch: {
          playerName: string;
          confidence: number;
          isSleeperPlayer: boolean;
        } | undefined;

        if (matchResult.exactMatch) {
          const exactPlayer = await this.prisma.player.findUnique({
            where: { id: matchResult.exactMatch },
            select: { name: true, sleeperId: true }
          });
          
          potentialMatch = {
            playerName: exactPlayer?.name || 'Exact match found',
            confidence: 1.0,
            isSleeperPlayer: !!exactPlayer?.sleeperId
          };
        } else if (matchResult.potentialMatches.length > 0) {
          const bestMatch = matchResult.potentialMatches[0];
          const matchedPlayer = await this.prisma.player.findUnique({
            where: { id: bestMatch.playerId },
            select: { name: true, sleeperId: true }
          });
          
          potentialMatch = {
            playerName: matchedPlayer?.name || bestMatch.playerName,
            confidence: bestMatch.confidence,
            isSleeperPlayer: !!matchedPlayer?.sleeperId
          };
        }
        
        playerSamples.push({
          name: excelPlayer.name,
          position: excelPlayer.position,
          confidence: matchResult.exactMatch ? 1.0 : 
            matchResult.potentialMatches.length > 0 ? matchResult.potentialMatches[0].confidence : 0,
          potentialMatch,
          additionalFields: excelPlayer.additionalData
        });
      }

      // Generate warnings
      const warnings: string[] = [];
      if (parsedData.columns.filter(c => c.mappedField === 'name').length === 0) {
        warnings.push('No player name column detected');
      }
      
      const recognizedColumns = parsedData.columns.filter(c => c.mappedField !== null).length;
      if (recognizedColumns < 3) {
        warnings.push('Very few columns recognized automatically - consider manual mapping');
      }

      return {
        columnAnalysis: parsedData.columns.map(col => ({
          header: col.header,
          mappedTo: col.mappedField,
          dataType: col.dataType,
          sampleValue: col.sampleValues[0] || null,
          willBeProcessed: col.mappedField !== null
        })),
        playerSamples,
        summary: {
          totalRows: parsedData.metadata.totalRows,
          validPlayers: parsedData.players.length,
          recognizedColumns,
          unknownColumns: parsedData.columns.length - recognizedColumns,
          estimatedAutoMatches: Math.floor(parsedData.players.length * 0.8),
          estimatedNewPlayers: Math.floor(parsedData.players.length * 0.2)
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
   * Resolve a manual match decision
   */
  async resolveManualMatch(data: {
    excelRowIndex: number;
    selectedPlayerId: string;
    excelData: Record<string, any>;
    options: any;
  }): Promise<void> {
    const { selectedPlayerId, excelData, options } = data;
    
    try {
      await this.playerMatcher.resolveManualMatch(
        data.excelRowIndex,
        selectedPlayerId,
        excelData,
        {
          updateStrategy: options.updateStrategy || 'merge',
          preserveSleeperData: options.preserveSleeperData !== false
        }
      );
    } catch (error: any) {
      throw new Error(`Failed to resolve manual match: ${error.message}`);
    }
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
    try {
      const sessions = await this.prisma.importSession.findMany({
        where: { rolledBack: false },
        orderBy: { createdAt: 'desc' }
      });

      const totalImports = sessions.length;
      let totalPlayersProcessed = 0;
      let totalMatches = 0;

      for (const session of sessions) {
        const summary = session.summary as any;
        totalPlayersProcessed += summary.totalProcessed || 0;
        totalMatches += summary.autoMatched || 0;
      }

      return {
        totalImports,
        totalPlayersProcessed,
        averageMatchRate: totalPlayersProcessed > 0 ? totalMatches / totalPlayersProcessed : 0,
        lastImportDate: sessions[0]?.createdAt
      };
    } catch (error: any) {
      console.error('Failed to get import stats:', error);
      return {
        totalImports: 0,
        totalPlayersProcessed: 0,
        averageMatchRate: 0
      };
    }
  }
}