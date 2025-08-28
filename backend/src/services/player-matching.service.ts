// backend/src/services/player-matching.service.ts
import { PrismaClient } from '@prisma/client';
import { normalizePlayerName, calculateStringSimilarity } from '../utils/string.utils';

export interface ExcelPlayerData {
  name: string;
  position?: string | undefined;
  team?: string | undefined;
  additionalData: Record<string, any>;
  rowIndex: number;
}

export interface DatabasePlayer {
  id: string;
  name: string;
  position: string;
  team?: string | null;
  sleeperId?: string | null;
  aliases: string[];
  dataSource: string;
}

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

export class PlayerMatchingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find matching players in database for an Excel player
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
        team: team?.toUpperCase() || null,
        dataSource: 'excel',
        sleeperId: null,
        // Map additional data to player fields with proper validation
        rank: this.safeParseNumber(additionalData.rank),
        customRank: this.safeParseNumber(additionalData.customRank),
        projectedPoints: this.safeParseFloat(additionalData.projectedPoints),
        vorp: this.safeParseFloat(additionalData.vorp),
        adp: this.safeParseFloat(additionalData.adp),
        byeWeek: this.safeParseNumber(additionalData.byeWeek),
        lastSeasonPoints: this.safeParseFloat(additionalData.lastSeasonPoints),
        positionalRank: additionalData.positionalRank || null,
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
      ['rank', 'customRank', 'projectedPoints', 'vorp', 'adp', 'byeWeek', 'team', 'positionalRank', 'lastSeasonPoints'];

    for (const field of updatableFields) {
      const newValue = excelData[field];
      const currentValue = (player as any)[field];

      if (newValue != null && newValue !== currentValue) {
        if (options.updateStrategy === 'overwrite' || currentValue == null) {
          // Use safe parsing for numeric fields
          updateData[field] = this.safeParseFieldValue(field, newValue);
          fieldsChanged.push(field);
        } else if (options.updateStrategy === 'merge') {
          // For merge, only update if current value is null/empty
          if (currentValue == null || currentValue === '' || currentValue === 0) {
            updateData[field] = this.safeParseFieldValue(field, newValue);
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

  /**
   * Safely parse field values based on their expected types
   */
  private safeParseFieldValue(fieldName: string, value: any): any {
    const numericFields = ['rank', 'customRank', 'byeWeek'];
    const floatFields = ['projectedPoints', 'vorp', 'adp', 'lastSeasonPoints'];
    
    if (numericFields.includes(fieldName)) {
      return this.safeParseNumber(value);
    } else if (floatFields.includes(fieldName)) {
      return this.safeParseFloat(value);
    } else {
      return value;
    }
  }

  /**
   * Safely parse integer values
   */
  private safeParseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Safely parse float values
   */
  private safeParseFloat(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Extract player data for comparison
   */
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

  /**
   * Detect conflicts between existing and new data
   */
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

  /**
   * Resolve a manual match decision
   */
  async resolveManualMatch(
    excelRowIndex: number,
    selectedPlayerId: string,
    excelData: Record<string, any>,
    options: {
      updateStrategy: 'merge' | 'overwrite';
      preserveSleeperData: boolean;
    }
  ): Promise<void> {
    try {
      await this.updatePlayerWithExcelData(selectedPlayerId, excelData, options);
      console.log(`✅ Manual match resolved: Row ${excelRowIndex} → Player ${selectedPlayerId}`);
    } catch (error: any) {
      console.error(`❌ Failed to resolve manual match for row ${excelRowIndex}:`, error);
      throw new Error(`Failed to resolve manual match: ${error.message}`);
    }
  }
}