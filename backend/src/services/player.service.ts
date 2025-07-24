import { Player } from '../models/player.model';
import { parsePlayerData } from '../data/excel-parser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PlayerService {
  async importFromExcel(filePath: string) {
    const players = parsePlayerData(filePath);
    
    for (const player of players) {
      await prisma.player.upsert({
        where: { name: player.name },
        update: player,
        create: player
      });
    }
    
    return { count: players.length };
  }

  async getPlayers(scoring: 'PPR' | 'Standard' = 'PPR') {
    return prisma.player.findMany({
      orderBy: scoring === 'PPR' ? { rank: 'asc' } : { adp: 'asc' }
    });
  }
}