// src/models/player.model.ts
import { Player as PrismaPlayer } from '@prisma/client';

// Match the Prisma model exactly
export interface Player extends PrismaPlayer {
  // No changes needed - just ensures we match Prisma's types
}