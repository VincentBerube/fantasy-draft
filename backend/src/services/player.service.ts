import { Player, PrismaClient } from '@prisma/client';
import { parsePlayerData } from '../data/excel-parser';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export class PlayerService {
  async importFromExcel(filePath: string) {
    const players = parsePlayerData(filePath);
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    console.log(`Starting import of ${players.length} players from ${filePath}`);
    
    // Batch processing for better performance
    const batchSize = 50;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(player => this.processPlayer(player))
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value === 'created') newCount++;
          if (result.value === 'updated') updatedCount++;
        } else {
          skippedCount++;
          console.error('Player processing failed:', result.reason);
        }
      });
      
      console.log(`Processed ${Math.min(i + batchSize, players.length)}/${players.length} players`);
    }
    
    console.log(`Import completed: ${newCount} new, ${updatedCount} updated, ${skippedCount} failed`);
    return { 
      total: players.length,
      newCount,
      updatedCount,
      skippedCount
    };
  }

  private async processPlayer(player: Omit<Player, 'id'>): Promise<'created' | 'updated'> {
    try {
      // Find existing player
      const existing = await prisma.player.findUnique({
        where: { 
          name_position: {
            name: player.name,
            position: player.position
          }
        }
      });

      if (existing) {
        // Merge data - preserve existing notes/tags
        await prisma.player.update({
          where: { id: existing.id },
          data: {
            // Update stats but preserve custom data
            team: player.team || existing.team,
            rank: player.rank ?? existing.rank,
            adp: player.adp ?? existing.adp,
            vorp: player.vorp ?? existing.vorp,
            projectedPoints: player.projectedPoints ?? existing.projectedPoints,
            lastSeasonPoints: player.lastSeasonPoints ?? existing.lastSeasonPoints,
            byeWeek: player.byeWeek ?? existing.byeWeek,
            positionalRank: player.positionalRank || existing.positionalRank,
            // Preserve existing notes/tags
            userNotes: existing.userNotes,
            customTags: existing.customTags
          }
        });
        return 'updated';
      } else {
        // Create new player with empty notes/tags
        await prisma.player.create({ 
          data: {
            ...player,
            userNotes: [],
            customTags: []
          }
        });
        return 'created';
      }
    } catch (error) {
      console.error(`Error processing ${player.name}:`, error);
      throw error;
    }
  }
  
  // Add to PlayerService class
  async updatePlayerNotes(playerId: string, notes: string[]) {
    return prisma.player.update({
      where: { id: playerId },
      data: { userNotes: notes }
    });
  }

  async updatePlayerTags(playerId: string, tags: string[]) {
    return prisma.player.update({
      where: { id: playerId },
      data: { customTags: tags }
    });
  }
  
  async getPlayers(scoring: 'PPR' | 'Standard' = 'PPR') {
    return prisma.player.findMany({
      orderBy: scoring === 'PPR' ? { rank: 'asc' } : { adp: 'asc' }
    });
  }
}