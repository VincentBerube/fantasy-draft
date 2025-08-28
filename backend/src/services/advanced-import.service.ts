// backend/src/services/advanced-import.service.ts
import { PrismaClient } from '@prisma/client';
import { DynamicExcelParserService } from './dynamic-excel-parser.service';
import { PlayerMatchingService } from './player-matching.service';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface AdvancedColumnMapping {
  excelColumn: string;
  playerField: string | null;
  willImport: boolean;
  dataType: 'string' | 'number' | 'float' | 'boolean' | 'date';
}

export interface AdvancedPlayerPreview {
  excelRowIndex: number;
  name: string;
  position?: string;
  team?: string;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'new';
  matchedPlayer?: {
    id: string;
    name: string;
    currentData: Record<string, any>;
  };
  newData: Record<string, any>;
  willImport: boolean;
  conflicts: string[];
}

export interface AdvancedImportSession {
  id: string;
  timestamp: string;
  summary: {
    totalProcessed: number;
    playersModified: number;
    playersCreated: number;
    fieldsChanged: number;
  };
  changes: Array<{
    playerId: string;
    playerName: string;
    action: 'create' | 'update';
    oldData?: Record<string, any>;
    newData: Record<string, any>;
    fieldsChanged: string[];
  }>;
}

export interface AdvancedImportData {
  columnMappings: AdvancedColumnMapping[];
  playerSelections: AdvancedPlayerPreview[];
  settings: {
    updateStrategy: 'merge' | 'overwrite';
    preserveSleeperData: boolean;
  };
}

export class AdvancedImportService {
  private excelParser: DynamicExcelParserService;
  private playerMatcher: PlayerMatchingService;

  constructor(private prisma: PrismaClient) {
    this.excelParser = new DynamicExcelParserService();
    this.playerMatcher = new PlayerMatchingService(prisma);
  }

  /**
   * Generate advanced preview with detailed control
   */
  async generateAdvancedPreview(
    filePath: string,
    columnMappings: AdvancedColumnMapping[],
    settings: any = {}
  ): Promise<AdvancedPlayerPreview[]> {
    try {
      console.log('📊 Generating advanced import preview...');

      // Parse Excel file
      const parsedData = await this.excelParser.parseExcelFile(filePath);
      
      // Apply user-defined column mappings
      const mappedPlayers = this.applyColumnMappings(parsedData, columnMappings);
      
      // Generate previews for each player
      const previews: AdvancedPlayerPreview[] = [];
      
      for (let i = 0; i < mappedPlayers.length; i++) {
        const playerData = mappedPlayers[i];
        
        // Find potential matches
        const matches = await this.playerMatcher.findPlayerMatch(playerData);

        let preview: AdvancedPlayerPreview;

        if (matches.exactMatch) {
          // Exact match found - get the player data
          const existingPlayer = await this.prisma.player.findUnique({
            where: { id: matches.exactMatch },
            include: {
              tier: true,
              playerTags: { include: { tag: true } },
              notes: true
            }
          });

          preview = {
            excelRowIndex: playerData.rowIndex,
            name: playerData.name,
            position: playerData.position,
            team: playerData.team || undefined,
            matchType: 'exact',
            matchedPlayer: existingPlayer ? {
              id: existingPlayer.id,
              name: existingPlayer.name,
              currentData: this.extractPlayerData(existingPlayer)
            } : undefined,
            newData: playerData.additionalData,
            willImport: true, // Auto-select exact matches
            conflicts: existingPlayer ? this.detectConflicts(existingPlayer, playerData.additionalData) : []
          };
        } else if (matches.potentialMatches.length > 0) {
          // Fuzzy matches found
          const bestMatch = matches.potentialMatches[0];
          const existingPlayer = await this.prisma.player.findUnique({
            where: { id: bestMatch.playerId },
            include: {
              tier: true,
              playerTags: { include: { tag: true } },
              notes: true
            }
          });

          preview = {
            excelRowIndex: playerData.rowIndex,
            name: playerData.name,
            position: playerData.position,
            team: playerData.team || undefined,
            matchType: 'fuzzy',
            matchedPlayer: existingPlayer ? {
              id: existingPlayer.id,
              name: existingPlayer.name,
              currentData: this.extractPlayerData(existingPlayer)
            } : undefined,
            newData: playerData.additionalData,
            willImport: false, // Require user confirmation for fuzzy matches
            conflicts: existingPlayer ? this.detectConflicts(existingPlayer, playerData.additionalData) : []
          };
        } else {
          // No matches - would create new player
          preview = {
            excelRowIndex: playerData.rowIndex,
            name: playerData.name,
            position: playerData.position,
            team: playerData.team || undefined,
            matchType: 'new',
            newData: playerData.additionalData,
            willImport: false, // Require user confirmation for new players
            conflicts: []
          };
        }

        previews.push(preview);
      }

      console.log(`✅ Generated ${previews.length} player previews`);
      return previews;

    } catch (error: any) {
      console.error('❌ Advanced preview failed:', error);
      throw new Error(`Advanced preview failed: ${error.message}`);
    }
  }

  /**
   * Execute controlled import with session tracking
   */
  async executeControlledImport(importData: AdvancedImportData): Promise<AdvancedImportSession> {
    const sessionId = this.generateSessionId();
    const timestamp = new Date().toISOString();

    try {
      console.log('🚀 Starting advanced import session:', sessionId);

      const session: AdvancedImportSession = {
        id: sessionId,
        timestamp,
        summary: {
          totalProcessed: 0,
          playersModified: 0,
          playersCreated: 0,
          fieldsChanged: 0
        },
        changes: []
      };

      // Filter only players marked for import
      const playersToImport = importData.playerSelections.filter(p => p.willImport);
      session.summary.totalProcessed = playersToImport.length;

      // Process each player
      for (const playerSelection of playersToImport) {
        try {
          if (playerSelection.matchedPlayer) {
            // Update existing player
            const oldData = this.extractPlayerData(playerSelection.matchedPlayer);
            const fieldsChanged = await this.playerMatcher.updatePlayerWithExcelData(
              playerSelection.matchedPlayer.id,
              playerSelection.newData,
              {
                updateStrategy: importData.settings.updateStrategy,
                preserveSleeperData: importData.settings.preserveSleeperData
              }
            );

            if (fieldsChanged.length > 0) {
              session.changes.push({
                playerId: playerSelection.matchedPlayer.id,
                playerName: playerSelection.name,
                action: 'update',
                oldData,
                newData: playerSelection.newData,
                fieldsChanged
              });

              session.summary.playersModified++;
              session.summary.fieldsChanged += fieldsChanged.length;
            }
          } else {
            // Create new player
            const newPlayerId = await this.playerMatcher.createPlayerFromExcel({
              name: playerSelection.name,
              position: playerSelection.position,
              team: playerSelection.team,
              additionalData: playerSelection.newData,
              rowIndex: playerSelection.excelRowIndex
            });

            const newPlayer = await this.prisma.player.findUnique({
              where: { id: newPlayerId }
            });

            session.changes.push({
              playerId: newPlayerId,
              playerName: newPlayer?.name || playerSelection.name,
              action: 'create',
              newData: playerSelection.newData,
              fieldsChanged: Object.keys(playerSelection.newData)
            });

            session.summary.playersCreated++;
            session.summary.fieldsChanged += Object.keys(playerSelection.newData).length;
          }

        } catch (error: any) {
          console.error(`Failed to process ${playerSelection.name}:`, error);
          // Continue with other players instead of failing the entire import
        }
      }

      // Save import session for rollback capability
      await this.prisma.importSession.create({
        data: {
          id: sessionId,
          summary: session.summary as any,
          changes: session.changes as any,
          rolledBack: false
        }
      });

      console.log('✅ Advanced import completed:', session.summary);
      return session;

    } catch (error: any) {
      console.error('❌ Advanced import failed:', error);
      throw new Error(`Advanced import failed: ${error.message}`);
    }
  }

  /**
   * Rollback an import session
   */
  async rollbackImport(sessionId: string): Promise<void> {
    try {
      console.log('🔄 Rolling back import session:', sessionId);

      // Get the import session
      const session = await this.prisma.importSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error('Import session not found');
      }

      if (session.rolledBack) {
        throw new Error('Import session has already been rolled back');
      }

      const changes = session.changes as any[];

      // Reverse the changes
      for (const change of changes.reverse()) {
        try {
          if (change.action === 'create') {
            // Delete created player
            await this.prisma.player.delete({
              where: { id: change.playerId }
            });
          } else if (change.action === 'update') {
            // Restore old data
            await this.prisma.player.update({
              where: { id: change.playerId },
              data: {
                ...change.oldData,
                importSessionId: null // Clear import session ID
              }
            });
          }
        } catch (error: any) {
          console.error(`Failed to rollback change for ${change.playerName}:`, error);
          // Continue with other rollbacks
        }
      }

      // Mark session as rolled back
      await this.prisma.importSession.update({
        where: { id: sessionId },
        data: { rolledBack: true }
      });

      console.log('✅ Import successfully rolled back');

    } catch (error: any) {
      console.error('❌ Rollback failed:', error);
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Get import history
   */
  async getImportHistory(limit: number = 10): Promise<AdvancedImportSession[]> {
    const sessions = await this.prisma.importSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return sessions.map(session => ({
      id: session.id,
      timestamp: session.createdAt.toISOString(),
      summary: session.summary as any,
      changes: session.changes as any
    }));
  }

  // Private helper methods
  private applyColumnMappings(parsedData: any, columnMappings: AdvancedColumnMapping[]): any[] {
    // Apply user-defined column mappings to parsed data
    return parsedData.players.map((player: any) => {
      const mappedData: any = {
        ...player,
        additionalData: {}
      };

      // Apply column mappings
      for (const mapping of columnMappings) {
        if (mapping.willImport && mapping.playerField) {
          const value = player.additionalData[mapping.excelColumn];
          if (value !== undefined && value !== null) {
            mappedData.additionalData[mapping.playerField] = value;
          }
        }
      }

      return mappedData;
    });
  }

  private extractPlayerData(player: any): Record<string, any> {
    return {
      name: player.name,
      position: player.position,
      team: player.team,
      rank: player.rank,
      customRank: player.customRank,
      projectedPoints: player.projectedPoints,
      vorp: player.vorp,
      adp: player.adp,
      byeWeek: player.byeWeek,
      lastSeasonPoints: player.lastSeasonPoints,
      positionalRank: player.positionalRank,
      isDrafted: player.isDrafted,
      dataSource: player.dataSource,
      sleeperId: player.sleeperId
    };
  }

  private detectConflicts(existingPlayer: any, newData: Record<string, any>): string[] {
    const conflicts: string[] = [];
    const fieldsToCheck = ['position', 'team', 'rank', 'projectedPoints', 'adp'];

    for (const field of fieldsToCheck) {
      const existing = existingPlayer[field];
      const newValue = newData[field];

      if (existing != null && newValue != null && existing !== newValue) {
        conflicts.push(`${field}: ${existing} → ${newValue}`);
      }
    }

    return conflicts;
  }

  private generateSessionId(): string {
    return uuidv4();
  }
}