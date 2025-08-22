// frontend/fantasy-draft-frontend/src/api/sleeperApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/sleeper',
  timeout: 60000, // 60 second timeout for syncing operations
});

export interface SyncOptions {
  includeProjections?: boolean;
  season?: string;
  week?: number;
  onlyActive?: boolean;
  positionsFilter?: string[];
  topPlayersLimit?: number;
}

export interface SyncPreview {
  sleeper: {
    totalPlayers: number;
    activeFantasyPlayers: number;
  };
  current: {
    totalPlayers: number;
    draftedPlayers: number;
    playersWithNotes: number;
  };
  message: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  data: {
    total: number;
    newCount: number;
    updatedCount: number;
    skippedCount: number;
    message: string;
  };
}

export interface TrendingPlayer {
  player_id: string;
  count: number;
  player?: {
    first_name: string;
    last_name: string;
    position: string;
    team: string;
    full_name?: string;
  };
}

export interface NFLState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
  leg: number;
  previous_season: string;
}

export const sleeperApi = {
  // Sync players from Sleeper to database
  syncPlayers: (options: SyncOptions = {}) => {
    return api.post<SyncResult>('/sync', options);
  },

  // Get preview of what would be synced
  getSyncPreview: (onlyActive: boolean = true) => {
    return api.get<SyncPreview>('/sync-preview', {
      params: { onlyActive }
    });
  },

  // Get trending players (adds/drops)
  getTrendingPlayers: (
    type: 'add' | 'drop',
    hours: 24 | 168 = 24,
    limit: number = 25
  ) => {
    return api.get<TrendingPlayer[]>(`/trending/${type}`, {
      params: { hours, limit }
    });
  },

  // Get current NFL state
  getNFLState: () => {
    return api.get<NFLState>('/nfl-state');
  },

  // Get projections for specific week/season
  getProjections: (season: string = '2024', week?: number) => {
    return api.get('/projections', {
      params: { season, week }
    });
  },
};