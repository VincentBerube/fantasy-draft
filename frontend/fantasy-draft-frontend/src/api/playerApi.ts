// frontend/fantasy-draft-frontend/src/api/playerApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
});

// Add request interceptor for debugging
api.interceptors.request.use((config) => {
  console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`, config.params);
  return config;
});

// Types - Fixed to match actual API responses
export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  rank: number | null;
  customRank: number | null;
  positionalRank: string | null;
  projectedPoints: number | null;
  vorp: number | null;
  adp: number | null;
  byeWeek: number | null;
  lastSeasonPoints: number | null;
  sleeperId: string | null;
  dataSource: string;
  lastSyncAt: Date | null;
  isDrafted: boolean;
  tierId: string | null;
  aliases: string[];
  depthChartPosition: string | null;
  depthChartOrder: number | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional relations - properly typed as optional
  tier?: Tier | null;
  playerTags?: PlayerTag[] | null;
  notes?: Note[] | null;
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
  playerId: string;
  tagId: string;
  tag: Tag;
}

export interface Note {
  id: string;
  content: string;
  color: string;
  playerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportOptions {
  updateStrategy: 'merge' | 'overwrite';
  autoMatchThreshold: number;
  createNewPlayers: boolean;
  preserveSleeperData: boolean;
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

// Main API object
export const playerApi = {
  // Basic CRUD operations - FIXED: Added limit parameter support
  getPlayers: (filters?: {
    scoring?: 'PPR' | 'Standard';
    includeDrafted?: boolean;
    dataSource?: 'sleeper' | 'excel' | 'manual';
    position?: string;
    team?: string;
    hasSleeperId?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    // Set default limit to 2000 to get all players
    const params = {
      limit: 2000,
      ...filters
    };
    return api.get('/players', { params });
  },

  getPlayer: (id: string) => {
    return api.get(`/players/${id}`);
  },

  updatePlayer: (id: string, data: Partial<Player>) => {
    return api.put(`/players/${id}`, data);
  },

  updatePlayerQuick: (id: string, data: Partial<Player>) => {
    return api.put(`/players/${id}`, data);
  },

  deletePlayer: (id: string) => {
    return api.delete(`/players/${id}`);
  },

  createPlayer: (data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) => {
    return api.post('/players', data);
  },

  // Draft management
  toggleDraft: (id: string, isDrafted: boolean) => {
    return api.put(`/players/${id}`, { isDrafted });
  },

  toggleDraftStatus: (playerId: string, isDrafted: boolean) => {
    return api.put(`/players/${playerId}`, { isDrafted });
  },

  draftPlayer: (playerId: string, data?: { position?: number; round?: number }) => {
    return api.post(`/players/${playerId}/draft`, data);
  },

  undraftPlayer: (playerId: string) => {
    return api.post(`/players/${playerId}/undraft`);
  },

  // Import/Export operations
  importFromExcel: (formData: FormData, mergeStrategy: "update" | "preserve" = "update") => {
    return api.post('/players/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: { mergeStrategy },
      timeout: 60000,
    });
  },

  // Enhanced import methods
  importPlayers: (file: File, mergeStrategy: "update" | "preserve" = "update") => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/players/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { mergeStrategy },
      timeout: 60000,
    });
  },

  getImportPreview: (formData: FormData) => {
    return api.post('/players/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  executeEnhancedImport: (formData: FormData) => {
    return api.post('/players/import/enhanced-execute', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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

  resolveConflict: (data: {
    excelRowIndex: number;
    selectedPlayerId: string;
    excelData: Record<string, any>;
    options: any;
  }) => {
    return api.post('/players/import/resolve', data);
  },

  // Import management
  rollbackImport: (sessionId: string) => {
    return api.post(`/players/import/rollback/${sessionId}`);
  },

  exportToExcel: () => {
    return api.get('/players/export', {
      params: { format: 'excel' },
      responseType: 'blob'
    });
  },

  exportPlayers: (format: string = 'excel') => {
    return api.get('/players/export', {
      params: { format },
      responseType: 'blob'
    });
  },

  // Sleeper integration
  syncWithSleeper: (options?: {
    sport?: string;
    season?: string;
    week?: string;
    positions?: string[];
    mergeStrategy?: "update" | "preserve";
  }) => {
    return api.post('/sleeper/sync', options || {}, {
      timeout: 120000,
    });
  },

  getSleeperPlayers: (options?: {
    sport?: string;
    season?: string;
    week?: string;
    positions?: string[];
  }) => {
    return api.get('/sleeper/players', { params: options });
  },

  // Import history and stats
  getImportHistory: (limit: number) => {
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

  // Alternative note methods (for compatibility)
  addNote: (playerId: string, content: string, color: string = '#6B7280') => {
    return api.post(`/players/${playerId}/notes`, { content, color });
  },

  updateNote: (noteId: string, content?: string, color?: string) => {
    const data: any = {};
    if (content !== undefined) data.content = content;
    if (color !== undefined) data.color = color;
    return api.put(`/notes/${noteId}`, data);
  },

  deleteNote: (noteId: string) => {
    return api.delete(`/notes/${noteId}`);
  },

  // Alternative tag methods (for compatibility)
  addTagToPlayer: (playerId: string, tagId: string) => {
    return api.post(`/players/${playerId}/tags`, { tagId });
  },

  removeTagFromPlayer: (playerId: string, tagId: string) => {
    return api.delete(`/players/${playerId}/tags/${tagId}`);
  },

  // Statistics and analytics - with proper error handling
  getPlayerStats: () => {
    return api.get('/players/stats').catch((error) => {
      console.warn('Stats endpoint not available:', error);
      // Return default stats structure if endpoint doesn't exist
      return {
        data: {
          totalPlayers: 0,
          draftedPlayers: 0,
          undraftedPlayers: 0,
          byPosition: []
        }
      };
    });
  },

  getPositionStats: (position: string) => {
    return api.get(`/players/stats/position/${position}`);
  },

  getDraftAnalytics: () => {
    return api.get('/players/stats/draft');
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
  }
};