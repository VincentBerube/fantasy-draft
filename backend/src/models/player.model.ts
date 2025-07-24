export interface Player {
  id?: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  team: string;
  rank: number;
  positionalRank: string;  // e.g., "RB12"
  adp: number;             // Average Draft Position
  vorp: number;            // Value Over Replacement Player
  projectedPoints: number;
  lastSeasonPoints: number;
  byeWeek: number;
  // Custom annotations
  userNotes: string[];
  expertRating?: number;
  customTags: string[];
}