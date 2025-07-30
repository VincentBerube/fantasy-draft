import { Player, PrismaClient } from '@prisma/client';
import { parsePlayerData } from '../data/excel-parser';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { removeUndefined } from '../utils/object.utils';

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
          // Prepare update data, only including defined fields
          const updateData = removeUndefined({
            rank: player.rank,
            positionalRank: player.positionalRank,
            vorp: player.vorp,
            projectedPoints: player.projectedPoints,
            byeWeek: player.byeWeek,
            team: player.team,
            adp: player.adp,
            lastSeasonPoints: player.lastSeasonPoints,
            // Preserve existing custom data
            userNotes: existing.userNotes,
            customTags: existing.customTags
          });

          await prisma.player.update({
            where: { id: existing.id },
            data: updateData
          });
          updatedCount++;
        } else {
          // Prepare create data with required fields
          const createData = removeUndefined({
            name: player.name,
            position: player.position,
            rank: player.rank,
            positionalRank: player.positionalRank,
            vorp: player.vorp,
            projectedPoints: player.projectedPoints,
            byeWeek: player.byeWeek,
            team: player.team,
            adp: player.adp,
            lastSeasonPoints: player.lastSeasonPoints,
            // Initialize with empty arrays
            userNotes: [],
            customTags: []
          });

          await prisma.player.create({ 
            data: createData as any // Type assertion to handle Prisma type complexity
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
    const players = await prisma.player.findMany({
      orderBy: { rank: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Players');

    // Define columns with proper headers
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Position', key: 'position', width: 10 },
      { header: 'Team', key: 'team', width: 10 },
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Pos Rank', key: 'positionalRank', width: 10 },
      { header: 'ADP', key: 'adp', width: 10 },
      { header: 'VORP', key: 'vorp', width: 10 },
      { header: 'Projected Points', key: 'projectedPoints', width: 15 },
      { header: 'Last Season Points', key: 'lastSeasonPoints', width: 15 },
      { header: 'Bye Week', key: 'byeWeek', width: 10 },
      { header: 'User Notes', key: 'userNotes', width: 50 },
      { header: 'Custom Tags', key: 'customTags', width: 30 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Add data rows
    players.forEach(player => {
      const row = worksheet.addRow({
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team || '',
        rank: player.rank || '',
        positionalRank: player.positionalRank || '',
        adp: player.adp || '',
        vorp: player.vorp || '',
        projectedPoints: player.projectedPoints || '',
        lastSeasonPoints: player.lastSeasonPoints || '',
        byeWeek: player.byeWeek || '',
        // Handle userNotes and customTags as string arrays
        userNotes: Array.isArray(player.userNotes) ? player.userNotes.join('; ') : '',
        customTags: Array.isArray(player.customTags) ? player.customTags.join('; ') : ''
      });
      
      // Add alternating row colors for better readability
      if (row.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F8FF' }
        };
      }
    });

    // Auto-fit columns with safe column access
    worksheet.columns.forEach((column, index) => {
      if (index !== 0 && column) { // Skip ID column and check column exists
        let maxLength = 0;
        
        // Use try-catch to handle potential undefined column issues
        try {
          column.eachCell?.({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          
          if (maxLength > 0) {
            column.width = Math.min(maxLength + 2, 50); // Cap at 50 characters
          }
        } catch (error) {
          console.warn(`Could not auto-fit column ${index}:`, error);
          // Set a default width if auto-fit fails
          if (column.width === undefined) {
            column.width = 15;
          }
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  // Enhanced import method that can handle multiple data sources
  async importAndMergeFromExcel(filePath: string, mergeStrategy: 'update' | 'preserve' = 'update') {
    const players = parsePlayerData(filePath);
    let newCount = 0;
    let updatedCount = 0;
    let mergedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`Starting enhanced import of ${players.length} players with ${mergeStrategy} strategy`);

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
          // Merge strategy: only update fields that have new data
          const updateData: any = {
            // Always preserve user-generated content
            userNotes: existing.userNotes,
            customTags: existing.customTags
          };

          // Update fields based on strategy
          if (mergeStrategy === 'update') {
            // Update all provided fields
            if (player.rank !== undefined) updateData.rank = player.rank;
            if (player.positionalRank) updateData.positionalRank = player.positionalRank;
            if (player.vorp !== undefined) updateData.vorp = player.vorp;
            if (player.projectedPoints !== undefined) updateData.projectedPoints = player.projectedPoints;
            if (player.byeWeek !== undefined) updateData.byeWeek = player.byeWeek;
            if (player.team) updateData.team = player.team;
            if (player.adp !== undefined) updateData.adp = player.adp;
            if (player.lastSeasonPoints !== undefined) updateData.lastSeasonPoints = player.lastSeasonPoints;
          } else {
            // Preserve existing data, only add missing fields
            if (player.rank !== undefined && !existing.rank) updateData.rank = player.rank;
            if (player.positionalRank && !existing.positionalRank) updateData.positionalRank = player.positionalRank;
            if (player.vorp !== undefined && !existing.vorp) updateData.vorp = player.vorp;
            if (player.projectedPoints !== undefined && !existing.projectedPoints) updateData.projectedPoints = player.projectedPoints;
            if (player.byeWeek !== undefined && !existing.byeWeek) updateData.byeWeek = player.byeWeek;
            if (player.team && !existing.team) updateData.team = player.team;
            if (player.adp !== undefined && !existing.adp) updateData.adp = player.adp;
            if (player.lastSeasonPoints !== undefined && !existing.lastSeasonPoints) updateData.lastSeasonPoints = player.lastSeasonPoints;
          }

          await prisma.player.update({
            where: { id: existing.id },
            data: removeUndefined(updateData)
          });
          
          updatedCount++;
          mergedCount++;
        } else {
          // Create new player
          const createData = removeUndefined({
            name: player.name,
            position: player.position,
            rank: player.rank,
            positionalRank: player.positionalRank,
            vorp: player.vorp,
            projectedPoints: player.projectedPoints,
            byeWeek: player.byeWeek,
            team: player.team,
            adp: player.adp,
            lastSeasonPoints: player.lastSeasonPoints,
            userNotes: [],
            customTags: []
          });

          await prisma.player.create({ 
            data: createData as any // Type assertion to handle Prisma type complexity
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

    console.log(`Enhanced import completed: ${newCount} new, ${updatedCount} updated, ${mergedCount} merged, ${errorCount} errors`);
    return {
      total: players.length,
      newCount,
      updatedCount,
      mergedCount,
      errorCount,
      errors
    };
  }
}