// backend/src/services/player.service.ts
import { PrismaClient, Player, Tier, Tag, PlayerTag, Note } from '@prisma/client';
import * as ExcelJS from 'exceljs';

type PlayerWithRelations = Player & {
  tier: Tier | null;
  playerTags: (PlayerTag & { tag: Tag })[];
  notes: Note[];
};

function removeUndefined(obj: any): any {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export class PlayerService {
  constructor(private prisma: PrismaClient) {}

  async findPotentialDuplicates(name: string, position: string, excludeId?: string) {
    const normalizedName = name.toLowerCase().trim();
    
    const whereClause: any = {
      position,
      OR: [
        {
          name: {
            contains: normalizedName,
            mode: 'insensitive'
          }
        },
        {
          aliases: {
            hasSome: [name]
          }
        }
      ]
    };

    if (excludeId) {
      whereClause.NOT = { id: excludeId };
    }

    return this.prisma.player.findMany({
      where: whereClause,
      include: {
        tier: true,
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true
      }
    });
  }

  async importPlayers(players: any[]): Promise<any> {
    let newCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const duplicateWarnings: string[] = [];

    for (let index = 0; index < players.length; index++) {
      const player = players[index];
      
      try {
        // Look for exact match by name and position (FIXED: use proper where clause)
        let existing = await this.prisma.player.findFirst({
          where: {
            name: player.name,
            position: player.position
          },
          include: {
            tier: true,
            playerTags: {
              include: {
                tag: true
              }
            },
            notes: true
          }
        });

        // If no exact match, check for potential duplicates
        if (!existing) {
          const potentialDuplicates = await this.findPotentialDuplicates(player.name, player.position);
          
          if (potentialDuplicates.length > 0) {
            // FIXED: Add null check for existing
            existing = potentialDuplicates[0];
            const updatedAliases = [...new Set([...existing.aliases, player.name])];
            
            await this.prisma.player.update({
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

          await this.prisma.player.update({
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
            aliases: [],
            isDrafted: false,
            dataSource: 'excel'
          });

          await this.prisma.player.create({ 
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
    
    const players = await this.prisma.player.findMany({
      where: whereClause,
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      },
      orderBy: [
        { customRank: 'asc' },
        { rank: 'asc' }
      ]
    });

    return players;
  }

  async getPlayerById(id: string): Promise<PlayerWithRelations | null> {
    return this.prisma.player.findUnique({
      where: { id },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  async updatePlayer(id: string, data: Partial<Player>) {
    return this.prisma.player.update({
      where: { id },
      data: removeUndefined(data),
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  async updatePlayerQuick(id: string, data: Partial<Player>) {
    return this.prisma.player.update({
      where: { id },
      data: removeUndefined(data),
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  async deletePlayer(id: string) {
    return this.prisma.player.delete({
      where: { id }
    });
  }

  async updatePlayerRanking(playerId: string, newRank: number) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { customRank: newRank },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  async toggleDraftStatus(playerId: string, isDrafted: boolean) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { isDrafted },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  // Tag management
  async getTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createTag(name: string, color: string) {
    return this.prisma.tag.create({
      data: { name, color }
    });
  }

  async updateTag(id: string, name?: string, color?: string) {
    return this.prisma.tag.update({
      where: { id },
      data: removeUndefined({ name, color })
    });
  }

  async deleteTag(id: string) {
    return this.prisma.tag.delete({
      where: { id }
    });
  }

  async addTagToPlayer(playerId: string, tagId: string) {
    return this.prisma.playerTag.create({
      data: { playerId, tagId }
    });
  }

  async removeTagFromPlayer(playerId: string, tagId: string) {
    return this.prisma.playerTag.deleteMany({
      where: { playerId, tagId }
    });
  }

  // Note management
  async addNote(playerId: string, content: string, color: string = '#6B7280') {
    return this.prisma.note.create({
      data: { playerId, content, color }
    });
  }

  async updateNote(noteId: string, content?: string, color?: string) {
    return this.prisma.note.update({
      where: { id: noteId },
      data: removeUndefined({ content, color })
    });
  }

  async deleteNote(noteId: string) {
    return this.prisma.note.delete({
      where: { id: noteId }
    });
  }

  // Tier management
  async getTiers() {
    return this.prisma.tier.findMany({
      orderBy: { order: 'asc' }
    });
  }

  async createTier(name: string, color: string, order: number) {
    return this.prisma.tier.create({
      data: { name, color, order }
    });
  }

  async updateTier(id: string, name?: string, color?: string, order?: number) {
    return this.prisma.tier.update({
      where: { id },
      data: removeUndefined({ name, color, order })
    });
  }

  async deleteTier(id: string) {
    await this.prisma.player.updateMany({
      where: { tierId: id },
      data: { tierId: null }
    });
    
    return this.prisma.tier.delete({
      where: { id }
    });
  }

  async assignPlayerToTier(playerId: string, tierId: string | null) {
    return this.prisma.player.update({
      where: { id: playerId },
      data: { tierId: tierId },
      include: {
        playerTags: {
          include: {
            tag: true
          }
        },
        notes: true,
        tier: true
      }
    });
  }

  // Manual matching for import resolution
  async resolveManualMatch(data: {
    excelRowIndex: number;
    selectedPlayerId: string;
    excelData: Record<string, any>;
    options: any;
  }) {
    try {
      const updateData = removeUndefined({
        ...data.excelData,
        lastSyncAt: new Date()
      });

      return this.prisma.player.update({
        where: { id: data.selectedPlayerId },
        data: updateData,
        include: {
          playerTags: {
            include: {
              tag: true
            }
          },
          notes: true,
          tier: true
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to resolve manual match: ${error.message}`);
    }
  }

  // Legacy methods for backward compatibility
  async updatePlayerNotes(playerId: string, notes: string[]) {
    await this.prisma.note.deleteMany({
      where: { playerId }
    });

    if (notes.length > 0) {
      await this.prisma.note.createMany({
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
    return this.prisma.player.update({
      where: { id: playerId },
      data: { aliases: tags }
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
      const tier = player.tierId ? tierMap.get(player.tierId) : null;
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
            const columnLength = cell.value ? cell.value.toString().length : 0;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          
          column.width = Math.min(Math.max(maxLength + 2, 10), 50);
        } catch (error) {
          console.warn(`Failed to auto-size column ${index}:`, error);
        }
      }
    });

    return workbook;
  }
}