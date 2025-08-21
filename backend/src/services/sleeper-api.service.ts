// backend/src/services/sleeper-api.service.ts
import axios from 'axios';

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team: string;
  age: number;
  years_exp: number;
  height: string;
  weight: string;
  birth_date: string;
  college: string;
  injury_status?: string;
  search_full_name: string;
  fantasy_positions: string[];
  number?: number;
  depth_chart_position?: number;
  status: string;
}

export interface SleeperProjections {
  [playerId: string]: {
    pts_half_ppr?: number;
    pts_ppr?: number;
    pts_std?: number;
    gp?: number;
    pass_yd?: number;
    pass_td?: number;
    rush_yd?: number;
    rush_td?: number;
    rec?: number;
    rec_yd?: number;
    rec_td?: number;
    // Many more stats available
  };
}

export interface SleeperTrendingPlayer {
  player_id: string;
  count: number;
  player?: SleeperPlayer;
}

class SleeperAPIService {
  private baseURL = 'https://api.sleeper.app/v1';
  private axiosInstance = axios.create({
    baseURL: this.baseURL,
    timeout: 30000,
  });

  // Rate limiting - Sleeper allows up to 1000 calls per minute
  private lastCallTime = 0;
  private callCount = 0;
  private windowStart = Date.now();

  private async rateLimit() {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.callCount = 0;
    }
    
    // If we're approaching the limit, wait
    if (this.callCount >= 950) {
      const waitTime = 60000 - (now - this.windowStart);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.windowStart = Date.now();
        this.callCount = 0;
      }
    }
    
    this.callCount++;
  }

  /**
   * Get all NFL players from Sleeper
   * Note: This is a large dataset (~3000+ players), use sparingly
   */
  async getAllPlayers(): Promise<{ [playerId: string]: SleeperPlayer }> {
    await this.rateLimit();
    
    try {
      const response = await this.axiosInstance.get('/players/nfl');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching Sleeper players:', error.message);
      throw new Error(`Failed to fetch players from Sleeper: ${error.message}`);
    }
  }

  /**
   * Get trending players (adds/drops)
   */
  async getTrendingPlayers(type: 'add' | 'drop', hours: 24 | 168 = 24, limit: number = 25): Promise<SleeperTrendingPlayer[]> {
    await this.rateLimit();
    
    try {
      const response = await this.axiosInstance.get(`/players/nfl/trending/${type}`, {
        params: { lookback_hours: hours, limit }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching trending players:', error.message);
      throw new Error(`Failed to fetch trending players: ${error.message}`);
    }
  }

  /**
   * Get player projections for a specific week/season
   */
  async getProjections(season: string = '2024', week?: number): Promise<SleeperProjections> {
    await this.rateLimit();
    
    try {
      const endpoint = week 
        ? `/projections/nfl/${season}/${week}`
        : `/projections/nfl/${season}`;
      
      const response = await this.axiosInstance.get(endpoint);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching projections:', error.message);
      throw new Error(`Failed to fetch projections: ${error.message}`);
    }
  }

  /**
   * Get NFL state (current week, season, etc.)
   */
  async getNFLState() {
    await this.rateLimit();
    
    try {
      const response = await this.axiosInstance.get('/state/nfl');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching NFL state:', error.message);
      throw new Error(`Failed to fetch NFL state: ${error.message}`);
    }
  }

  /**
   * Convert Sleeper player data to our Player model format
   */
  convertToPlayerFormat(sleeperPlayer: SleeperPlayer, projections?: any): {
    name: string;
    position: string;
    team: string | null;
    projectedPoints: number | null;
    byeWeek: number | null;
    aliases: string[];
    userNotes: string[];
    customTags: string[];
    tierId: string | null;
    isDrafted: boolean;
    customRank: number | null;
    sleeperId: string;
    dataSource: string;
    lastSyncAt: Date;
  } {
    const fullName = sleeperPlayer.full_name || 
                     `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`.trim();
    
    // Map fantasy positions to primary position
    const position = sleeperPlayer.fantasy_positions?.[0] || sleeperPlayer.position || 'UNKNOWN';
    
    // Calculate projected points based on available scoring formats
    let projectedPoints: number | null = null;
    if (projections) {
      // Prefer PPR, fall back to half-PPR, then standard
      projectedPoints = projections.pts_ppr || 
                       projections.pts_half_ppr || 
                       projections.pts_std || null;
    }

    return {
      name: fullName,
      position: position,
      team: sleeperPlayer.team || null,
      projectedPoints,
      byeWeek: null, // Would need to get this from another source
      aliases: [
        sleeperPlayer.search_full_name,
        `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`,
        ...(sleeperPlayer.full_name ? [sleeperPlayer.full_name] : [])
      ].filter((alias): alias is string => Boolean(alias)),
      // Preserve existing user data
      userNotes: [],
      customTags: [],
      tierId: null,
      isDrafted: false,
      customRank: null,
      // Sleeper-specific fields
      sleeperId: sleeperPlayer.player_id,
      dataSource: 'sleeper',
      lastSyncAt: new Date()
    };
  }

  /**
   * Sync players from Sleeper API to our database
   * This method respects existing user data (notes, tags, tiers, draft status)
   */
  async syncPlayersToDatabase(prisma: any, options: {
    includeProjections?: boolean;
    season?: string;
    week?: number;
    onlyActive?: boolean;
  } = {}) {
    const { 
      includeProjections = true, 
      season = '2024', 
      onlyActive = true 
    } = options;

    try {
      console.log('🔄 Starting Sleeper data sync...');
      
      // Get all players from Sleeper
      const sleeperPlayers = await this.getAllPlayers();
      console.log(`📥 Fetched ${Object.keys(sleeperPlayers).length} players from Sleeper`);

      // Get projections if requested
      let projections: SleeperProjections = {};
      if (includeProjections) {
        try {
          projections = await this.getProjections(season, options.week);
          console.log(`📊 Fetched projections for ${Object.keys(projections).length} players`);
        } catch (error) {
          console.warn('⚠️ Could not fetch projections, continuing without them');
        }
      }

      // Filter and convert players
      const playersToSync = Object.entries(sleeperPlayers)
        .filter(([_, player]) => {
          if (onlyActive && player.status !== 'Active') return false;
          if (!player.fantasy_positions || player.fantasy_positions.length === 0) return false;
          return true;
        })
        .map(([playerId, sleeperPlayer]) => 
          this.convertToPlayerFormat(sleeperPlayer, projections[playerId])
        );

      console.log(`🔄 Processing ${playersToSync.length} active fantasy players...`);

      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Process players in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < playersToSync.length; i += batchSize) {
        const batch = playersToSync.slice(i, i + batchSize);
        
        for (const playerData of batch) {
          try {
            // Check if player already exists (by name and position)
            const existingPlayer = await prisma.player.findUnique({
              where: {
                name_position: {
                  name: playerData.name,
                  position: playerData.position
                }
              }
            });

            if (existingPlayer) {
              // Update existing player but preserve user data
              await prisma.player.update({
                where: { id: existingPlayer.id },
                data: {
                  // Only update base stats, preserve user customizations
                  team: playerData.team,
                  projectedPoints: playerData.projectedPoints,
                  aliases: playerData.aliases,
                  // DO NOT update: customRank, tierId, isDrafted, userNotes, customTags
                }
              });
              updatedCount++;
            } else {
              // Create new player
              await prisma.player.create({
                data: playerData
              });
              newCount++;
            }
          } catch (error: any) {
            console.error(`❌ Error processing player ${playerData.name}:`, error.message);
            skippedCount++;
          }
        }

        // Small delay between batches
        if (i + batchSize < playersToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const summary = {
        total: playersToSync.length,
        newCount,
        updatedCount,
        skippedCount,
        message: `Sleeper sync complete: ${newCount} new players, ${updatedCount} updated, ${skippedCount} skipped`
      };

      console.log('✅ Sleeper sync completed:', summary);
      return summary;

    } catch (error: any) {
      console.error('❌ Sleeper sync failed:', error.message);
      throw new Error(`Sleeper sync failed: ${error.message}`);
    }
  }
}

export const sleeperAPIService = new SleeperAPIService();