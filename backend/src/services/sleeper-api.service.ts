// backend/src/services/sleeper-api.service.ts
import axios from 'axios';

export interface SleeperSyncOptions {
  includeProjections?: boolean;
  season?: string;
  week?: number;
  onlyActive?: boolean;
  positionsFilter?: string[];
  topPlayersLimit?: number;
}

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
  depth_chart_position?: string;
  depth_chart_order?: number;
  status: string;
  search_rank?: number;
  search_first_name?: string;
  search_last_name?: string;
  hashtag?: string;
  fantasy_data_id?: number;
  stats_id?: string;
  sportradar_id?: string;
  espn_id?: string;
  yahoo_id?: string;
  rotowire_id?: number;
  rotoworld_id?: number;
  practice_participation?: string;
  injury_start_date?: string;
  birth_country?: string;
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
  };
}

export interface SleeperTrendingPlayer {
  player_id: string;
  count: number;
  player?: SleeperPlayer;
}

export interface ConvertedPlayerData {
  name: string;
  position: string;
  team: string | null;
  projectedPoints: number | null;
  byeWeek: number | null;
  aliases: string[];
  tierId: string | null;
  isDrafted: boolean;
  customRank: number | null;
  sleeperId: string;
  dataSource: string;
  lastSyncAt: Date;
  rank?: number | null; // FIXED: Allow null values
  depthChartPosition?: string | null; // FIXED: Allow null values
  depthChartOrder?: number | null; // FIXED: Allow null values
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
   * Get weekly stats for players
   */
  async getWeeklyStats(season: string, week: number): Promise<any> {
    await this.rateLimit();
    
    try {
      const response = await this.axiosInstance.get(`/stats/nfl/regular/${season}/${week}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching weekly stats:', error.message);
      throw new Error(`Failed to fetch weekly stats: ${error.message}`);
    }
  }

  /**
   * Get season stats for players
   */
  async getSeasonStats(season: string): Promise<any> {
    await this.rateLimit();
    
    try {
      const response = await this.axiosInstance.get(`/stats/nfl/regular/${season}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching season stats:', error.message);
      throw new Error(`Failed to fetch season stats: ${error.message}`);
    }
  }

  /**
   * Get current NFL state (week, season, etc.)
   */
  async getNFLState(): Promise<any> {
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
   * Convert Sleeper player data to our database format
   */
  private convertToPlayerFormat(sleeperPlayer: SleeperPlayer, projections?: any): ConvertedPlayerData {
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
      rank: sleeperPlayer.search_rank && sleeperPlayer.search_rank < 9999 ? sleeperPlayer.search_rank : null, // FIXED: Don't assign huge placeholder ranks
      depthChartPosition: sleeperPlayer.depth_chart_position || null,
      depthChartOrder: sleeperPlayer.depth_chart_order || null,
      aliases: [
        sleeperPlayer.search_full_name,
        `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`,
        ...(sleeperPlayer.full_name ? [sleeperPlayer.full_name] : [])
      ].filter((alias): alias is string => Boolean(alias)),
      // Fields that match Prisma schema
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
  async syncPlayersToDatabase(prisma: any, options: SleeperSyncOptions = {}) {
    const { 
      includeProjections = true, 
      season = '2024', 
      onlyActive = true,
      positionsFilter = ['QB', 'WR', 'RB', 'TE', 'K'],
      topPlayersLimit = 500
    } = options;

    try {
      console.log('🔄 Starting Sleeper data sync...');
      console.log(`📋 Settings: ${positionsFilter.join(', ')} positions, top ${topPlayersLimit} players`);
      
      // Get all players from Sleeper
      const sleeperPlayers = await this.getAllPlayers();
      console.log(`📥 Fetched ${Object.keys(sleeperPlayers).length} total players from Sleeper`);

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

      // Filter and convert players with better ranking logic
      const filteredPlayers = Object.entries(sleeperPlayers)
        .filter(([_, player]) => {
          // Filter by active status
          if (onlyActive && player.status !== 'Active') return false;
          
          // Filter by fantasy positions
          if (!player.fantasy_positions || player.fantasy_positions.length === 0) return false;
          
          // Check if player has any of our desired positions
          const hasDesiredPosition = player.fantasy_positions.some(pos => 
            positionsFilter.includes(pos)
          );
          if (!hasDesiredPosition) return false;
          
          return true;
        })
        .map(([playerId, sleeperPlayer]) => {
          const playerData = this.convertToPlayerFormat(sleeperPlayer, projections[playerId]);
          return {
            ...playerData,
            // FIXED: Better ranking for sorting - use projections as primary sort
            projectionScore: projections[playerId]?.pts_ppr || 0,
            sleeperRank: sleeperPlayer.search_rank || null, // FIXED: Keep as null, don't use 9999
            hasProjections: Boolean(projections[playerId])
          };
        })
        // FIXED: Better sorting logic
        .sort((a, b) => {
          // First priority: Players with projections (sorted by projection score, descending)
          if (a.hasProjections && b.hasProjections) {
            return (b.projectionScore || 0) - (a.projectionScore || 0);
          }
          if (a.hasProjections && !b.hasProjections) return -1;
          if (!a.hasProjections && b.hasProjections) return 1;
          
          // Second priority: Players with Sleeper ranks (sorted by rank, ascending)
          if (a.sleeperRank !== null && b.sleeperRank !== null) {
            return a.sleeperRank - b.sleeperRank;
          }
          if (a.sleeperRank !== null && b.sleeperRank === null) return -1;
          if (a.sleeperRank === null && b.sleeperRank !== null) return 1;
          
          // Final priority: Alphabetical by name
          return a.name.localeCompare(b.name);
        })
        // Take only the top N players
        .slice(0, topPlayersLimit)
        .map(({ projectionScore, sleeperRank, hasProjections, ...player }) => player); // Remove the sorting fields

      console.log(`🎯 Filtered to ${filteredPlayers.length} top fantasy players (positions: ${positionsFilter.join(', ')})`);

      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Process players in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < filteredPlayers.length; i += batchSize) {
        const batch = filteredPlayers.slice(i, i + batchSize);
        
        for (const playerData of batch) {
          try {
            // FIXED: Check if player already exists using findFirst instead of findUnique
            // First try to find by sleeperId (most reliable)
            let existingPlayer = await prisma.player.findFirst({
              where: {
                sleeperId: playerData.sleeperId
              }
            });

            // If not found by sleeperId, try by name and position
            if (!existingPlayer) {
              existingPlayer = await prisma.player.findFirst({
                where: {
                  name: playerData.name,
                  position: playerData.position
                }
              });
            }

            if (existingPlayer) {
              // Update existing player but preserve user data
              await prisma.player.update({
                where: { id: existingPlayer.id },
                data: {
                  // Only update base stats, preserve user customizations
                  team: playerData.team,
                  projectedPoints: playerData.projectedPoints,
                  aliases: playerData.aliases,
                  sleeperId: playerData.sleeperId,
                  lastSyncAt: playerData.lastSyncAt,
                  dataSource: 'sleeper',
                  rank: playerData.rank,
                  depthChartPosition: playerData.depthChartPosition,
                  depthChartOrder: playerData.depthChartOrder,
                  // DO NOT update: customRank, tierId, isDrafted, userNotes, customTags
                }
              });
              updatedCount++;
            } else {
              // Create new player - only include fields that exist in schema
              await prisma.player.create({
                data: {
                  name: playerData.name,
                  position: playerData.position,
                  team: playerData.team,
                  projectedPoints: playerData.projectedPoints,
                  byeWeek: playerData.byeWeek,
                  rank: playerData.rank,
                  customRank: playerData.customRank,
                  aliases: playerData.aliases,
                  sleeperId: playerData.sleeperId,
                  dataSource: playerData.dataSource,
                  lastSyncAt: playerData.lastSyncAt,
                  isDrafted: playerData.isDrafted,
                  tierId: playerData.tierId,
                  depthChartPosition: playerData.depthChartPosition,
                  depthChartOrder: playerData.depthChartOrder
                }
              });
              newCount++;
            }
          } catch (error: any) {
            console.error(`❌ Error processing player ${playerData.name}:`, error.message);
            skippedCount++;
          }
        }

        // Small delay between batches
        if (i + batchSize < filteredPlayers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const summary = {
        total: filteredPlayers.length,
        newCount,
        updatedCount,
        skippedCount,
        message: `Sleeper sync complete: ${newCount} new players, ${updatedCount} updated, ${skippedCount} skipped (Top ${topPlayersLimit} ${positionsFilter.join('/')}-only players)`
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