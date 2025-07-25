// backend/src/types/express.d.ts
import { Player } from '../models/player.model';

declare global {
  namespace Express {
    interface Request {
      // Add custom properties here if needed
      player?: Player;
    }
  }
}