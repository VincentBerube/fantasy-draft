// backend/src/services/player-matching.service.ts
import { PrismaClient } from '@prisma/client';
import { normalizePlayerName, calculateStringSimilarity } from '../utils/string-utils';

export interface PlayerMatchResult {
  exactMatch?: string; // Player ID
  potentialMatches: Array<{
    playerId: string;
    playerName: string;
    confidence: number;
    reasons: string[];
  }>;
  isAmbiguous: boolean;
  requiresManualReview: boolean;
}

export interface ExcelPlayerData {
  name: string;
  position?: string | undefined;
  team?: string | undefined;
  additionalData: Record<string, any>; // Dynamic columns
}

export interface BatchMatchResult {
  autoMatched: Array<{
    excelIndex: number;
    playerId: string;
    confidence: number;
  }>;
  needsReview: Array<{
    excelIndex: number;
    matches: PlayerMatchResult;
  }>;
  noMatches: Array<{
    excelIndex: number;
  }>;
}

interface DatabasePlayer {
  id: string;
  name: string;
  position: string;
  team: string | null;
  sleeperId: string | null;
  aliases: string[];
  dataSource: string;
}

export class PlayerMatchingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Batch match multiple players efficiently
   */
  async batchMatchPlayers(excelPlayers: ExcelPlayerData[]): Promise<BatchMatchResult> {
    // Get all players once for efficiency
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

    const result: BatchMatchResult = {
      autoMatched: [],
      needsReview: [],
      noMatches: []
    };

    for (let i = 0; i < excelPlayers.length; i++) {
      const matchResult = await this.findPlayerMatch(excelPlayers[i], allPlayers);
      
      if (matchResult.exactMatch) {
        result.autoMatched.push({
          excelIndex: i,
          playerId: matchResult.exactMatch,
          confidence: 1.0
        });
      } else if (matchResult.potentialMatches.length > 0) {
        // Check if top match is highly confident
        const topMatch = matchResult.potentialMatches[0];
        if (topMatch.confidence >= 0.9) {
          result.autoMatched.push({
            excelIndex: i,
            playerId: topMatch.playerId,
            confidence: topMatch.confidence
          });
        } else {
          result.needsReview.push({
            excelIndex: i,
            matches: matchResult
          });
        }
      } else {
        result.noMatches.push({
          excelIndex: i
        });
      }
    }

    return result;
  }

  /**
   * Smart player matching that handles variations in names
   * Prioritizes Sleeper data but allows Excel supplements
   */
  async findPlayerMatch(
    excelPlayer: ExcelPlayerData, 
    allPlayers?: DatabasePlayer[]
  ): Promise<PlayerMatchResult> {
    const { name, position, team } = excelPlayer;
    
    // Get all players from database if not provided
    const players = allPlayers || await this.prisma.player.findMany({
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

    // Step 1: Try exact match first
    const exactMatch = players.find(p => 
      this.normalizedNamesMatch(p.name, name) &&
      (!position || p.position === position?.toUpperCase())
    );

    if (exactMatch) {
      return {
        exactMatch: exactMatch.id,
        potentialMatches: [],
        isAmbiguous: false,
        requiresManualReview: false
      };
    }

    // Step 2: Check aliases
    const aliasMatch = players.find(p => 
      p.aliases.some((alias: string) => this.normalizedNamesMatch(alias, name))
    );

    if (aliasMatch) {
      return {
        exactMatch: aliasMatch.id,
        potentialMatches: [],
        isAmbiguous: false,
        requiresManualReview: false
      };
    }

    // Step 3: Fuzzy matching with confidence scoring
    const potentialMatches = players
      .map(player => {
        const nameScore = calculateStringSimilarity(
          normalizePlayerName(player.name), 
          normalizePlayerName(name)
        );
        const reasons: string[] = [];
        let confidence = nameScore;

        // Must have decent name similarity to be considered
        if (nameScore < 0.6) return null;

        // Boost confidence for position match
        if (position && player.position === position.toUpperCase()) {
          confidence += 0.2;
          reasons.push('Position matches');
        } else if (position && player.position !== position.toUpperCase()) {
          confidence -= 0.1;
          reasons.push('Position differs');
        }

        // Boost confidence for team match
        if (team && player.team === team.toUpperCase()) {
          confidence += 0.1;
          reasons.push('Team matches');
        } else if (team && player.team && player.team !== team.toUpperCase()) {
          confidence -= 0.05;
          reasons.push('Team differs');
        }

        // Boost confidence for Sleeper players (more trusted)
        if (player.sleeperId) {
          confidence += 0.05;
          reasons.push('Has Sleeper data');
        }

        // Penalty for Excel-only players when matching Excel data
        if (player.dataSource === 'excel') {
          confidence -= 0.05;
          reasons.push('Excel-sourced player');
        }

        reasons.push(`Name similarity: ${Math.round(nameScore * 100)}%`);

        return {
          playerId: player.id,
          playerName: player.name,
          confidence: Math.min(1, Math.max(0, confidence)),
          reasons
        };
      })
      .filter(match => match !== null)
      .sort((a, b) => b!.confidence - a!.confidence)
      .slice(0, 5) // Top 5 matches
      .filter((match): match is NonNullable<typeof match> => match !== null);

    // Determine if manual review is needed
    const requiresManualReview = potentialMatches.length > 1 && 
      (potentialMatches[0].confidence - potentialMatches[1].confidence) < 0.2;

    const isAmbiguous = potentialMatches.length > 1 && 
      potentialMatches.filter(m => m.confidence > 0.8).length > 1;

    return {
      potentialMatches,
      isAmbiguous,
      requiresManualReview
    };
  }

  /**
   * Create a new player from Excel data
   */
  async createPlayerFromExcel(playerData: ExcelPlayerData): Promise<string> {
    const { name, position, team, additionalData } = playerData;

    // Basic validation
    if (!name?.trim()) {
      throw new Error('Player name is required');
    }

    const player = await this.prisma.player.create({
      data: {
        name: normalizePlayerName(name),
        position: position?.toUpperCase() || 'UNKNOWN',
        team: team?.toUpperCase(),
        dataSource: 'excel',
        sleeperId: null,
        // Map additional data to player fields
        rank: additionalData.rank ? Number(additionalData.rank) : null,
        customRank: additionalData.customRank ? Number(additionalData.customRank) : null,
        projectedPoints: additionalData.projectedPoints ? Number(additionalData.projectedPoints) : null,
        vorp: additionalData.vorp ? Number(additionalData.vorp) : null,
        adp: additionalData.adp ? Number(additionalData.adp) : null,
        byeWeek: additionalData.byeWeek ? Number(additionalData.byeWeek) : null,
        isDrafted: false,
        aliases: [],
        lastSyncAt: new Date()
      }
    });

    return player.id;
  }

  /**
   * Check if two normalized names match
   */
  private normalizedNamesMatch(name1: string, name2: string): boolean {
    const norm1 = normalizePlayerName(name1);
    const norm2 = normalizePlayerName(name2);
    
    // Exact match
    if (norm1 === norm2) return true;
    
    // Handle common variations (Jr., Sr., II, III, etc.)
    const clean1 = norm1.replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '');
    const clean2 = norm2.replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '');
    
    if (clean1 === clean2) return true;
    
    // Handle first name variations (e.g., "Chris" vs "Christopher")
    const parts1 = norm1.split(' ');
    const parts2 = norm2.split(' ');
    
    if (parts1.length >= 2 && parts2.length >= 2) {
      // Same last name and similar first names
      if (parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
        const firstName1 = parts1[0];
        const firstName2 = parts2[0];
        
        // One name starts with the other (e.g., "Chris" and "Christopher")
        if (firstName1.startsWith(firstName2) || firstName2.startsWith(firstName1)) {
          return Math.min(firstName1.length, firstName2.length) >= 3;
        }
      }
    }
    
    return false;
  }

  /**
   * Update player with Excel data
   */
  async updatePlayerWithExcelData(
    playerId: string,
    excelData: Record<string, any>,
    options: {
      updateStrategy: 'merge' | 'overwrite';
      preserveSleeperData: boolean;
    }
  ): Promise<string[]> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId }
    });

    if (!player) {
      throw new Error('Player not found');
    }

    const updateData: any = {};
    const fieldsChanged: string[] = [];

    // Define which fields can be updated based on settings
    const updatableFields = options.preserveSleeperData && player.sleeperId ? 
      ['customRank', 'vorp'] : // Only custom fields if preserving Sleeper data
      ['rank', 'customRank', 'projectedPoints', 'vorp', 'adp', 'byeWeek', 'team'];

    for (const field of updatableFields) {
      const newValue = excelData[field];
      const currentValue = (player as any)[field];

      if (newValue != null && newValue !== currentValue) {
        if (options.updateStrategy === 'overwrite' || currentValue == null) {
          updateData[field] = typeof newValue === 'string' && !isNaN(Number(newValue)) ? 
            Number(newValue) : newValue;
          fieldsChanged.push(field);
        } else if (options.updateStrategy === 'merge') {
          // For merge, only update if current value is null/empty
          if (currentValue == null || currentValue === '' || currentValue === 0) {
            updateData[field] = typeof newValue === 'string' && !isNaN(Number(newValue)) ? 
              Number(newValue) : newValue;
            fieldsChanged.push(field);
          }
        }
      }
    }

    if (fieldsChanged.length > 0) {
      updateData.lastSyncAt = new Date();
      
      await this.prisma.player.update({
        where: { id: playerId },
        data: updateData
      });
    }

    return fieldsChanged;
  }
}