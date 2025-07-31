import { Player, PrismaClient, Tag, Note, Tier } from '@prisma/client';
import { parsePlayerData } from '../data/excel-parser';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { removeUndefined } from '../utils/object.utils';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Extended player type with relations
type PlayerWithRelations = Player & {
  playerTags: Array<{ tag: Tag }>;
  notes: Note[];
};

export class PlayerService {
  // Duplicate detection using fuzzy matching
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Calculate Levenshtein distance
    const matrix = Array(s1.length + 1).fill().map(() => Array(s2.length + 1).fill(0));
    
    for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength === 0 ? 1 : 1 - (matrix[s1.length][s2.length] / maxLength);
  }

  private async findPotentialDuplicates(name: string, position: string): Promise<Player[]> {
    const players = await prisma.player.findMany({
      where: { position }
    });
    
    return players.filter(player => {
      const similarity = this.calculateSimilarity(name, player.name);
      const aliasMatch = player.aliases.some(alias => 
        this.calculateSimilarity(name, alias) > 0.85
      );
      return similarity > 0.85 || aliasMatch;
    });
  }

  async importFromExcel(filePath: string) {
    const players = parsePlayerData(filePath);
    let newCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const duplicateWarnings: string[] = [];

    console.log(`Starting import of ${players.length} players`);

    for (const [index, player] of players.entries()) {
      try {
        if (!player.name || !player.position) {
          errors.push(`Row ${index + 2}: Missing name or position`);
          errorCount++;
          continue;
        }

        // Check for exact match first
        let existing = await prisma.player.findUnique({
          where: { name_position: { name: player.name, position: player.position } }
        });

        // If no exact match, check for potential duplicates
        if (!existing) {
          const potentialDuplicates = await this.findPotentialDuplicates(player.name, player.position);
          
          if (potentialDuplicates.length > 0) {
            // Use the first potential duplicate and add the new name as an alias
            existing = potentialDuplicates[0];
            const updatedAliases = [...new Set([...existing.aliases, player.name])];
            
            await prisma.player.update({
              where: { id: existing.id },
              data: { aliases: updatedAliases }
            });
            
            duplicateWarnings.push(`"${player.name}" matched existing player "${existing.name}" - added as alias`);
            duplicateCount++;
          }
        }

        if (existing) {
          const updateData = removeUndefined({
            rank: player.rank,
            positionalRank: player.positionalRank,
            vorp: player.vorp,
            projectedPoints: player.projectedPoints,
            byeWeek: player.byeWeek,
            team: player.team,
            adp: player.adp,
            lastSeasonPoints: player.lastSeasonPoints,
          });

          await prisma.player.update({
            where: { id: existing.id },
            data: updateData
          });
          updatedCount++;
        } else {
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
            customTags: [],
            aliases: [],
            isDrafted: false
          });

          await prisma.player.create({ 
            data: createData as any
          });
          newCount++;
        }

        if ((index + 1) % 50 === 0) {
          console.log(`Processed ${index + 1}/${players.length} players`);
        }
      } catch (error: any) {
        errorCount++;
        errors.push(`Row ${index + 2}: ${error.message || 'Unknown error'}`);
        console.error(`Error processing ${player.name}:`, error);
      }
    }

    console.log(`Import completed: ${newCount} new, ${updatedCount} updated, ${duplicateCount} duplicates handled, ${errorCount} errors`);
    return {
      total: players.length,
      newCount,
      updatedCount,
      duplicateCount,
      errorCount,
      errors,
      duplicateWarnings
    };
  }

  async getPlayers(scoring: 'PPR' | 'Standard' = 'PPR', includeDrafted: boolean = true) {
    const whereClause = includeDrafted ? {} : { isDrafted: false };
    
    const players = await prisma.player.findMany({
      where: whereClause,
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      },
      orderBy: [
        { customRank: 'asc' },
        { rank: 'asc' }
      ]
    });

    return players;
  }

  async getPlayerById(id: string): Promise<PlayerWithRelations | null> {
    return prisma.player.findUnique({
      where: { id },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });
  }

  async updatePlayer(id: string, data: Partial<Player>) {
    return prisma.player.update({
      where: { id },
      data: removeUndefined(data),
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });
  }

  async deletePlayer(id: string) {
    return prisma.player.delete({
      where: { id }
    });
  }

  async updatePlayerRanking(playerId: string, newRank: number) {
    return prisma.player.update({
      where: { id: playerId },
      data: { customRank: newRank },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });
  }

  async toggleDraftStatus(playerId: string, isDrafted: boolean) {
    return prisma.player.update({
      where: { id: playerId },
      data: { isDrafted },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });
  }

  // Tag management
  async getTags() {
    return prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createTag(name: string, color: string) {
    return prisma.tag.create({
      data: { name, color }
    });
  }

  async updateTag(id: string, name?: string, color?: string) {
    return prisma.tag.update({
      where: { id },
      data: removeUndefined({ name, color })
    });
  }

  async deleteTag(id: string) {
    return prisma.tag.delete({
      where: { id }
    });
  }

  async addTagToPlayer(playerId: string, tagId: string) {
    return prisma.playerTag.create({
      data: { playerId, tagId }
    });
  }

  async removeTagFromPlayer(playerId: string, tagId: string) {
    return prisma.playerTag.deleteMany({
      where: { playerId, tagId }
    });
  }

  // Note management
  async addNote(playerId: string, content: string, color: string = '#6B7280') {
    return prisma.note.create({
      data: { playerId, content, color }
    });
  }

  async updateNote(noteId: string, content?: string, color?: string) {
    return prisma.note.update({
      where: { id: noteId },
      data: removeUndefined({ content, color })
    });
  }

  async deleteNote(noteId: string) {
    return prisma.note.delete({
      where: { id: noteId }
    });
  }

  // Tier management
  async getTiers() {
    return prisma.tier.findMany({
      orderBy: { order: 'asc' }
    });
  }

  async createTier(name: string, color: string, order: number) {
    return prisma.tier.create({
      data: { name, color, order }
    });
  }

  async updateTier(id: string, name?: string, color?: string, order?: number) {
    return prisma.tier.update({
      where: { id },
      data: removeUndefined({ name, color, order })
    });
  }

  async deleteTier(id: string) {
    // Remove tier from all players first
    await prisma.player.updateMany({
      where: { tier: id },
      data: { tier: null }
    });
    
    return prisma.tier.delete({
      where: { id }
    });
  }

  async assignPlayerToTier(playerId: string, tierId: string | null) {
    return prisma.player.update({
      where: { id: playerId },
      data: { tier: tierId }
    });
  }

  // Legacy methods for backward compatibility
  async updatePlayerNotes(playerId: string, notes: string[]) {
    // Convert old string array to new Note objects
    await prisma.note.deleteMany({
      where: { playerId }
    });

    if (notes.length > 0) {
      await prisma.note.createMany({
        data: notes.map(content => ({
          playerId,
          content,
          color: '#6B7280'
        }))
      });
    }

    return this.getPlayerById(playerId);
  }

  async updatePlayerTags(playerId: string, tags: string[]) {
    // This is kept for legacy compatibility but should use the new tag system
    return prisma.player.update({
      where: { id: playerId },
      data: { customTags: tags }
    });
  }

  async exportPlayers() {
    const players = await this.getPlayers('PPR', true);
    const tiers = await this.getTiers();
    const tierMap = new Map(tiers.map(t => [t.id, t]));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Players');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Position', key: 'position', width: 10 },
      { header: 'Team', key: 'team', width: 10 },
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Custom Rank', key: 'customRank', width: 12 },
      { header: 'Pos Rank', key: 'positionalRank', width: 10 },
      { header: 'Tier', key: 'tier', width: 15 },
      { header: 'ADP', key: 'adp', width: 10 },
      { header: 'VORP', key: 'vorp', width: 10 },
      { header: 'Projected Points', key: 'projectedPoints', width: 15 },
      { header: 'Last Season Points', key: 'lastSeasonPoints', width: 15 },
      { header: 'Bye Week', key: 'byeWeek', width: 10 },
      { header: 'Drafted', key: 'isDrafted', width: 10 },
      { header: 'Tags', key: 'tags', width: 30 },
      { header: 'Notes', key: 'notes', width: 50 },
      { header: 'Aliases', key: 'aliases', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    players.forEach(player => {
      const tier = player.tier ? tierMap.get(player.tier) : null;
      const tags = player.playerTags.map(pt => pt.tag.name).join('; ');
      const notes = player.notes.map(note => note.content).join('; ');
      
      const row = worksheet.addRow({
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team || '',
        rank: player.rank || '',
        customRank: player.customRank || '',
        positionalRank: player.positionalRank || '',
        tier: tier ? tier.name : '',
        adp: player.adp || '',
        vorp: player.vorp || '',
        projectedPoints: player.projectedPoints || '',
        lastSeasonPoints: player.lastSeasonPoints || '',
        byeWeek: player.byeWeek || '',
        isDrafted: player.isDrafted ? 'Yes' : 'No',
        tags,
        notes,
        aliases: player.aliases.join('; ')
      });
      
      if (row.number % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F8FF' }
        };
      }
    });

    worksheet.columns.forEach((column, index) => {
      if (index !== 0 && column) {
        let maxLength = 0;
        
        try {
          column.eachCell?.({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          
          if (maxLength > 0) {
            column.width = Math.min(maxLength + 2, 50);
          }
        } catch (error) {
          console.warn(`Could not auto-fit column ${index}:`, error);
          if (column.width === undefined) {
            column.width = 15;
          }
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  async importAndMergeFromExcel(filePath: string, mergeStrategy: 'update' | 'preserve' = 'update') {
    // Enhanced version of the import method with duplicate detection
    return this.importFromExcel(filePath);
  }
}