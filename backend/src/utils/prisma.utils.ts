// src/utils/prisma.utils.ts
import { Player } from '@prisma/client';

// Create a type that matches Prisma's Player model but makes all fields optional
export type PartialPlayer = Partial<Player> & {
  name: string;
  position: string;
};