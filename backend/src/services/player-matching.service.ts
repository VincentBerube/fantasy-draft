// backend/src/services/player-matching.service.ts
import { PrismaClient } from '@prisma/client';
import { levenshteinDistance } from '../utils/string-utils';

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

export class PlayerMatchingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Smart player matching that handles variations in names
   * Prioritizes Sleeper data but allows Excel supplements
   */
  async findPlayerMatch(excelPlayer: ExcelPlayerData): Promise<PlayerMatchResult> {
    const { name, position, team } = excelPlayer;
    
    // Get all players from database
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

    // Step 1: Try exact match first
    const exactMatch = allPlayers.find(p => 
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
    const aliasMatch = allPlayers.find(p => 
      p.aliases.some(alias => this.normalizedNamesMatch(alias, name))
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
    const potentialMatches = allPlayers
      .map(player => {
        const nameScore = this.calculateNameSimilarity(player.name, name);
        const reasons: string[] = [];
        let confidence = nameScore;

        // Boost confidence for position match
        if (position && player.position === position.toUpperCase()) {
          confidence += 0.2;
          reasons.push('Position matches');
        }

        // Boost confidence for team match
        if (team && player.team === team.toUpperCase()) {
          confidence += 0.1;
          reasons.push('Team matches');
        }

        // Boost confidence for Sleeper players (source of truth)
        if (player.sleeperId) {
          confidence += 0.05;
          reasons.push('From Sleeper API');
        }

        // Handle common name variations
        if (this.checkCommonVariations(player.name, name)) {
          confidence += 0.3;
          reasons.push('Common name variation');
        }

        return {
          playerId: player.id,
          playerName: player.name,
          confidence,
          reasons
        };
      })
      .filter(match => match.confidence > 0.6) // Only show reasonable matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 matches

    // Determine if manual review is needed
    const topMatch = potentialMatches[0];
    const isAmbiguous = potentialMatches.length > 1 && 
      topMatch && 
      potentialMatches[1].confidence > topMatch.confidence - 0.2;

    const requiresManualReview = !topMatch || 
      topMatch.confidence < 0.85 || 
      isAmbiguous;

    return {
      exactMatch: topMatch && topMatch.confidence > 0.9 ? topMatch.playerId : undefined,
      potentialMatches,
      isAmbiguous,
      requiresManualReview
    };
  }

  /**
   * Batch process Excel data with smart matching
   */
  async batchMatchPlayers(excelData: ExcelPlayerData[]): Promise<{
    autoMatched: Array<{ excelIndex: number; playerId: string; confidence: number }>;
    needsReview: Array<{ excelIndex: number; player: ExcelPlayerData; matches: PlayerMatchResult }>;
    noMatches: Array<{ excelIndex: number; player: ExcelPlayerData }>;
  }> {
    const autoMatched: Array<{ excelIndex: number; playerId: string; confidence: number }> = [];
    const needsReview: Array<{ excelIndex: number; player: ExcelPlayerData; matches: PlayerMatchResult }> = [];
    const noMatches: Array<{ excelIndex: number; player: ExcelPlayerData }> = [];

    for (let i = 0; i < excelData.length; i++) {
      const player = excelData[i];
      const matchResult = await this.findPlayerMatch(player);

      if (matchResult.exactMatch) {
        autoMatched.push({
          excelIndex: i,
          playerId: matchResult.exactMatch,
          confidence: 1.0
        });
      } else if (matchResult.potentialMatches.length > 0) {
        needsReview.push({
          excelIndex: i,
          player,
          matches: matchResult
        });
      } else {
        noMatches.push({
          excelIndex: i,
          player
        });
      }
    }

    return { autoMatched, needsReview, noMatches };
  }

  /**
   * Apply Excel data to matched players
   * Only updates non-core fields to preserve Sleeper data integrity
   */
  async applyExcelDataToPlayer(
    playerId: string, 
    excelData: ExcelPlayerData,
    updateStrategy: 'merge' | 'overwrite' = 'merge'
  ): Promise<void> {
    const existingPlayer = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { notes: true, playerTags: true }
    });

    if (!existingPlayer) {
      throw new Error(`Player with ID ${playerId} not found`);
    }

    // Define which fields can be updated from Excel
    const allowedUpdates: Record<string, any> = {};
    const { additionalData } = excelData;

    // Handle dynamic additional data
    Object.entries(additionalData).forEach(([key, value]) => {
      if (this.isAllowedField(key) && value !== null && value !== undefined) {
        const fieldName = this.mapExcelFieldToPlayerField(key);
        if (fieldName) {
          allowedUpdates[fieldName] = value;
        }
      }
    });

    // Always preserve Sleeper core data if it exists
    if (existingPlayer.sleeperId && updateStrategy === 'merge') {
      // Only allow supplemental fields for Sleeper players
      const supplementalFields = ['customRank', 'vorp', 'adp'];
      Object.keys(allowedUpdates).forEach(key => {
        if (!supplementalFields.includes(key)) {
          delete allowedUpdates[key];
        }
      });
    }

    // Update the player
    if (Object.keys(allowedUpdates).length > 0) {
      await this.prisma.player.update({
        where: { id: playerId },
        data: {
          ...allowedUpdates,
          lastSyncAt: new Date()
        }
      });
    }

    // Add name to aliases if it's different
    if (!this.normalizedNamesMatch(existingPlayer.name, excelData.name)) {
      const newAliases = [...existingPlayer.aliases, excelData.name];
      await this.prisma.player.update({
        where: { id: playerId },
        data: { aliases: newAliases }
      });
    }
  }

  /**
   * Create new player from Excel data (for unmatched players)
   */
  async createPlayerFromExcel(excelData: ExcelPlayerData): Promise<string> {
    const { name, position, team, additionalData } = excelData;

    const playerData: any = {
      name: name.trim(),
      position: position?.toUpperCase() || 'UNKNOWN',
      team: team?.toUpperCase() || null,
      dataSource: 'excel',
      lastSyncAt: new Date(),
      aliases: []
    };

    // Map additional data to player fields
    Object.entries(additionalData).forEach(([key, value]) => {
      if (this.isAllowedField(key) && value !== null && value !== undefined) {
        const fieldName = this.mapExcelFieldToPlayerField(key);
        if (fieldName) {
          playerData[fieldName] = value;
        }
      }
    });

    const newPlayer = await this.prisma.player.create({
      data: playerData
    });

    return newPlayer.id;
  }

  // Helper methods
  private normalizedNamesMatch(name1: string, name2: string): boolean {
    return this.normalizeName(name1) === this.normalizeName(name2);
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeName(name1);
    const norm2 = this.normalizeName(name2);

    if (norm1 === norm2) return 1.0;

    // Use Levenshtein distance for similarity
    const maxLength = Math.max(norm1.length, norm2.length);
    const distance = levenshteinDistance(norm1, norm2);
    return 1 - (distance / maxLength);
  }

  private checkCommonVariations(dbName: string, excelName: string): boolean {
    const variations = [
      // Jr/Junior variations
      [/\s+jr\.?$/i, /\s+junior$/i],
      [/\s+sr\.?$/i, /\s+senior$/i],
      // Roman numerals
      [/\s+ii$/i, /\s+2$/],
      [/\s+iii$/i, /\s+3$/],
      // Common nicknames would go here
      // This could be expanded with a nickname dictionary
    ];

    return variations.some(([pattern1, pattern2]) => {
      const name1Clean = dbName.replace(pattern1, '').trim();
      const name2Clean = excelName.replace(pattern2, '').trim();
      return this.normalizedNamesMatch(name1Clean, name2Clean) ||
             this.normalizedNamesMatch(name2Clean, name1Clean);
    });
  }

  private isAllowedField(excelFieldName: string): boolean {
    // Define which Excel fields are allowed to update player data
    const allowedFields = [
      'rank', 'customrank', 'projected', 'projectedpoints', 'points',
      'vorp', 'adp', 'byeweek', 'bye', 'lastseason', 'notes', 'tier'
    ];
    
    return allowedFields.some(field => 
      excelFieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  private mapExcelFieldToPlayerField(excelFieldName: string): string | null {
    const fieldMap: Record<string, string> = {
      'rank': 'customRank',
      'customrank': 'customRank',
      'projected': 'projectedPoints',
      'projectedpoints': 'projectedPoints',
      'points': 'projectedPoints',
      'vorp': 'vorp',
      'adp': 'adp',
      'byeweek': 'byeWeek',
      'bye': 'byeWeek',
      'lastseason': 'lastSeasonPoints'
    };

    const normalizedField = excelFieldName.toLowerCase().replace(/[^a-z]/g, '');
    return fieldMap[normalizedField] || null;
  }
}