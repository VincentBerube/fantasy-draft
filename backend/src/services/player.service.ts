import { Player, PrismaClient } from '@prisma/client';
import { parsePlayerData } from '../data/excel-parser';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export class PlayerService {
  async importFromExcel(filePath: string) {
    const players = parsePlayerData(filePath);
    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`Starting import of ${players.length} players`);

    for (const [index, player] of players.entries()) {
      try {
        if (!player.name || !player.position) {
          errors.push(`Row ${index + 2}: Missing name or position`);
          errorCount++;
          continue;
        }

        const existing = await prisma.player.findUnique({
          where: { name_position: { name: player.name, position: player.position } }
        });

        if (existing) {
          await prisma.player.update({
            where: { id: existing.id },
            data: {
              rank: player.rank ?? existing.rank,
              positionalRank: player.positionalRank || existing.positionalRank,
              vorp: player.vorp ?? existing.vorp,
              projectedPoints: player.projectedPoints ?? existing.projectedPoints,
              byeWeek: player.byeWeek ?? existing.byeWeek,
              // Preserve existing custom data
              userNotes: existing.userNotes,
              customTags: existing.customTags
            }
          });
          updatedCount++;
        } else {
          await prisma.player.create({ 
            data: {
              ...player,
              // Initialize with empty arrays
              userNotes: [],
              customTags: []
            }
          });
          newCount++;
        }

        // Log progress every 50 players
        if ((index + 1) % 50 === 0) {
          console.log(`Processed ${index + 1}/${players.length} players`);
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`Row ${index + 2}: ${error.message || 'Unknown error'}`);
        console.error(`Error processing ${player.name}:`, error);
      }
    }

    console.log(`Import completed: ${newCount} new, ${updatedCount} updated, ${errorCount} errors`);
    return {
      total: players.length,
      newCount,
      updatedCount,
      errorCount,
      errors
    };
  }

  async getPlayers(scoring: 'PPR' | 'Standard' = 'PPR') {
    return prisma.player.findMany({
      orderBy: scoring === 'PPR' ? { rank: 'asc' } : { adp: 'asc' }
    });
  }

  async getPlayerById(id: string) {
    return prisma.player.findUnique({
      where: { id }
    });
  }

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

  async exportPlayers() {
    console.log('Exporting players data - START');
    try {
      const players = await prisma.player.findMany({
        select: {
          id: true,
          name: true,
          position: true,
          team: true,
          rank: true,
          positionalRank: true,
          adp: true,
          vorp: true,
          projectedPoints: true,
          lastSeasonPoints: true,
          byeWeek: true,
          userNotes: true,
          customTags: true
        }
      });

      console.log(`Found ${players.length} players for export`);
      
      if (players.length === 0) {
        console.warn('No players found for export');
        throw new Error('No players found in database');
      }
      
      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(players);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Players");
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      console.log(`Generated Excel file - Size: ${buffer.length} bytes`);
      
      return buffer;
    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw new Error('Failed to generate Excel file');
    } finally {
      console.log('Exporting players data - END');
    }
  }
}