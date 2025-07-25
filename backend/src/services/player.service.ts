// src/services/player.service.ts
import { Player, PrismaClient } from '@prisma/client';
import { parsePlayerData } from '../data/excel-parser';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export class PlayerService {
  async importFromExcel(filePath: string) {
    const players = parsePlayerData(filePath);
    
    for (const player of players) {
      await prisma.player.upsert({
        where: {
          name_position: {
            name: player.name,
            position: player.position
          }
        },
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