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
    const preview = await this.excelParser.generateImportPreview(filePath);
    
    // Sample a few players for match preview
    const samplePlayers = preview.samplePlayers.slice(0, 3);
    const playerSamples = [];

    for (const sample of samplePlayers) {
      const matchResult = await this.playerMatcher.findPlayerMatch({
        name: sample.name,
        position: sample.position,
        additionalData: { ...sample.recognizedFields, ...sample.unknownFields }
      });

      const potentialMatch = matchResult.potentialMatches[0];
      
      playerSamples.push({
        name: sample.name,
        position: sample.position,
        confidence: 0.8, // Base confidence from parsing
        potentialMatch: potentialMatch ? {
          playerName: potentialMatch.playerName,
          confidence: potentialMatch.confidence,
          isSleeperPlayer: potentialMatch.reasons.includes('From Sleeper API')
        } : undefined,
        additionalFields: { ...sample.recognizedFields, ...sample.unknownFields }
      });
    }

    return {
      columnAnalysis: preview.columnMapping.map(col => ({
        header: col.header,
        mappedTo: col.mappedTo,
        dataType: col.dataType,
        sampleValue: col.sampleValue,
        willBeProcessed: col.mappedTo !== null
      })),
      playerSamples,
      summary: {
        ...preview.summary,
        estimatedAutoMatches: Math.floor(preview.summary.validPlayers * 0.7), // Rough estimate
        estimatedNewPlayers: Math.floor(preview.summary.validPlayers * 0.2)
      },
      warnings: preview.warnings
    };
  }

  /**
   * Resolve manual matches
   */
  async resolveManualMatch(
    excelRowIndex: number,
    selectedPlayerId: string,
    excelData: Record<string, any>,
    options: Partial<ImportOptions> = {}
  ): Promise<{ success: boolean; fieldsUpdated: string[]; error?: string }> {
    try {
      const defaultOptions: ImportOptions = {
        updateStrategy: 'merge',
        autoMatchThreshold: 0.85,
        createNewPlayers: true,
        preserveSleeperData: true
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Create a mock excel player for the matching service
      const mockExcelPlayer = {
        name: 'Manual Match',
        additionalData: excelData
      };

      const fieldsUpdated = await this.updatePlayerFromExcel(
        selectedPlayerId,
        mockExcelPlayer as any,
        finalOptions
      );

      return { success: true, fieldsUpdated };
    } catch (error: any) {
      return { success: false, fieldsUpdated: [], error: error.message };
    }
  }

  /**
   * Update player with Excel data
   */
  private async updatePlayerFromExcel(
    playerId: string,
    excelPlayer: any,
    options: ImportOptions
  ): Promise<string[]> {
    const fieldsUpdated: string[] = [];

    // Apply Excel data to player
    await this.playerMatcher.applyExcelDataToPlayer(
      playerId,
      {
        name: excelPlayer.name,
        position: excelPlayer.position,
        team: excelPlayer.team,
        additionalData: excelPlayer.additionalData
      },
      options.updateStrategy
    );

    // Track which fields were updated
    Object.keys(excelPlayer.additionalData).forEach(key => {
      if (excelPlayer.additionalData[key] !== null && excelPlayer.additionalData[key] !== undefined) {
        fieldsUpdated.push(key);
      }
    });

    return fieldsUpdated;
  }
}