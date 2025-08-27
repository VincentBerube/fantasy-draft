// frontend/fantasy-draft-frontend/src/api/playerApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 60000, // 60 second timeout for imports
});

export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  projectedPoints: number | null;
  byeWeek: number | null;
  rank: number | null;
  customRank: number | null;
  positionalRank: string | null;  // Added missing field
  vorp: number | null;
  adp: number | null;
  lastSeasonPoints: number | null;  // Added missing field
  aliases: string[];
  isDrafted: boolean;
  tierId: string | null;
  tier?: Tier;
  playerTags: PlayerTag[];
  notes: Note[];
  sleeperId: string | null;
  dataSource: string;
  lastSyncAt: string | null;
  depthChartPosition?: string;
  depthChartOrder?: number;
  importSessionId?: string | null;
}

export interface Tier {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface PlayerTag {
  id: string;
  tag: Tag;
}

export interface Note {
  id: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportOptions {
  updateStrategy?: 'merge' | 'overwrite';
  autoMatchThreshold?: number;
  createNewPlayers?: boolean;
  preserveSleeperData?: boolean;
}

export interface ColumnMapping {
  excelColumn: string;
  mappedTo: string | null;
  dataType: string;
  sampleValue: any;
  willImport: boolean;
  customMapping?: string;
}

export interface PlayerPreview {
  excelRowIndex: number;
  name: string;
  position?: string;
  team?: string;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'new';
  matchedPlayer?: {
    id: string;
    name: string;
    currentData: Record<string, any>;
  };
  newData: Record<string, any>;
  willImport: boolean;
  conflicts: string[];
}

export interface ImportSession {
  id: string;
  timestamp: string;
  summary: {
    totalProcessed: number;
    playersModified: number;
    playersCreated: number;
    fieldsChanged: number;
  };
  changes: Array<{
    playerId: string;
    playerName: string;
    action: 'create' | 'update';
    oldData?: Record<string, any>;
    newData: Record<string, any>;
    fieldsChanged: string[];
  }>;
}

export const playerApi = {
  // Basic player operations
  getPlayers: (filters?: {
    scoring?: 'PPR' | 'Standard';
    includeDrafted?: boolean;
    dataSource?: 'sleeper' | 'excel' | 'manual';
    position?: string;
    team?: string;
    hasSleeperId?: boolean;
    search?: string;
  }) => {
    return api.get('/players', { params: filters });
  },

  getPlayer: (id: string) => {
    return api.get(`/players/${id}`);
  },

  updatePlayer: (id: string, data: Partial<Player>) => {
    return api.put(`/players/${id}`, data);
  },

  // Add missing updatePlayerQuick method
  updatePlayerQuick: (id: string, data: Partial<Player>) => {
    return api.put(`/players/${id}`, data);
  },

  deletePlayer: (id: string) => {
    return api.delete(`/players/${id}`);
  },

  // Draft operations
  toggleDraftStatus: (playerId: string, isDrafted: boolean) => {
    return api.put(`/players/${playerId}`, { isDrafted });
  },

  draftPlayer: (playerId: string, data?: { position?: number; round?: number }) => {
    return api.post(`/players/${playerId}/draft`, data);
  },

  undraftPlayer: (playerId: string) => {
    return api.post(`/players/${playerId}/undraft`);
  },

  // Enhanced import with smart matching (Simple mode)
  importPlayers: (formData: FormData) => {
    return api.post('/players/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Get import preview (Simple mode)
  getImportPreview: (formData: FormData) => {
    return api.post('/players/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Execute enhanced import (Simple mode)
  executeEnhancedImport: (formData: FormData) => {
    return api.post('/players/import/enhanced-execute', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Advanced import with detailed control (Advanced mode)
  getAdvancedImportPreview: (formData: FormData) => {
    return api.post('/players/import/advanced-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  executeAdvancedImport: (formData: FormData) => {
    return api.post('/players/import/advanced-execute', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Manual matching resolution
  resolveManualMatch: (data: {
    excelRowIndex: number;
    selectedPlayerId: string;
    excelData: Record<string, any>;
    options: any;
  }) => {
    return api.post('/players/resolve-manual-match', data);
  },

  // Import management
  rollbackImport: (sessionId: string) => {
    return api.post(`/players/import/rollback/${sessionId}`);
  },

  getImportHistory: (limit?: number) => {
    return api.get('/players/import/history', {
      params: { limit }
    });
  },

  getImportStats: () => {
    return api.get('/players/import/stats');
  },

  // Player tiers
  getTiers: () => {
    return api.get('/tiers');
  },

  createTier: (data: { name: string; color: string; order: number }) => {
    return api.post('/tiers', data);
  },

  updateTier: (id: string, data: Partial<Tier>) => {
    return api.put(`/tiers/${id}`, data);
  },

  deleteTier: (id: string) => {
    return api.delete(`/tiers/${id}`);
  },

  // Add missing assignPlayerToTier method
  assignPlayerToTier: (playerId: string, tierId: string | null) => {
    return api.put(`/players/${playerId}`, { tierId });
  },

  // Player tags
  getTags: () => {
    return api.get('/tags');
  },

  createTag: (data: { name: string; color: string }) => {
    return api.post('/tags', data);
  },

  updateTag: (id: string, data: Partial<Tag>) => {
    return api.put(`/tags/${id}`, data);
  },

  deleteTag: (id: string) => {
    return api.delete(`/tags/${id}`);
  },

  // Player tag associations
  addPlayerTag: (playerId: string, tagId: string) => {
    return api.post(`/players/${playerId}/tags`, { tagId });
  },

  removePlayerTag: (playerId: string, tagId: string) => {
    return api.delete(`/players/${playerId}/tags/${tagId}`);
  },

  // Player notes
  addPlayerNote: (playerId: string, data: { content: string; color?: string }) => {
    return api.post(`/players/${playerId}/notes`, data);
  },

  updatePlayerNote: (playerId: string, noteId: string, data: { content: string; color?: string }) => {
    return api.put(`/players/${playerId}/notes/${noteId}`, data);
  },

  deletePlayerNote: (playerId: string, noteId: string) => {
    return api.delete(`/players/${playerId}/notes/${noteId}`);
  },

  // Bulk operations
  bulkUpdatePlayers: (playerIds: string[], data: Partial<Player>) => {
    return api.post('/players/bulk-update', { playerIds, data });
  },

  bulkDeletePlayers: (playerIds: string[]) => {
    return api.post('/players/bulk-delete', { playerIds });
  },

  bulkDraftPlayers: (playerIds: string[]) => {
    return api.post('/players/bulk-draft', { playerIds });
  },

  // Search and filtering
  searchPlayers: (query: string, filters?: {
    position?: string;
    team?: string;
    isDrafted?: boolean;
    limit?: number;
  }) => {
    return api.get('/players/search', { 
      params: { q: query, ...filters }
    });
  },

  // Statistics and analytics
  getPlayerStats: () => {
    return api.get('/players/stats');
  },

  getPositionStats: (position: string) => {
    return api.get(`/players/position-stats/${position}`);
  },

  getDraftAnalytics: () => {
    return api.get('/players/draft-analytics');
  },

  // Sleeper integration
  syncWithSleeper: (options?: {
    sport?: string;
    season?: string;
    week?: string;
    positions?: string[];
  }) => {
    return api.post('/players/sleeper-sync', options);
  },

  // Export functionality - fix the missing format parameter
  exportPlayers: (format: 'csv' | 'excel' | 'json' = 'excel', filters?: any) => {
    return api.get('/players/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  },

  // Custom rankings
  updateCustomRankings: (rankings: Array<{ playerId: string; rank: number }>) => {
    return api.post('/players/custom-rankings', { rankings });
  },

  clearCustomRankings: () => {
    return api.delete('/players/custom-rankings');
  },

  // Comparison tools
  comparePlayers: (playerIds: string[]) => {
    return api.post('/players/compare', { playerIds });
  },

  // Player suggestions
  getSimilarPlayers: (playerId: string, limit?: number) => {
    return api.get(`/players/${playerId}/similar`, {
      params: { limit }
    });
  },

  getRecommendations: (filters?: {
    position?: string;
    team?: string;
    maxAdp?: number;
    minProjection?: number;
  }) => {
    return api.get('/players/recommendations', { params: filters });
  }
};