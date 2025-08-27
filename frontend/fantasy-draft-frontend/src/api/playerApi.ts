// frontend/fantasy-draft-frontend/src/api/playerApi.ts
import axios from 'axios';

// Configure axios
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`🌐 ${config.method?.toUpperCase()} ${config.url}`, config.data || config.params);
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Type definitions
export interface Player {
  id: string;
  name: string;
  position: string;
  team: string | null;
  byeWeek: number | null;
  rank: number | null;
  customRank: number | null;
  projectedPoints: number | null;
  adp: number | null;
  isDrafted: boolean;
  draftedAt: Date | null;
  sleeperId: string | null;
  dataSource: 'sleeper' | 'excel' | 'manual';
  lastSyncAt: Date | null;
  depthChartPosition: string | null;
  depthChartOrder: number | null;
  tierId: string | null;
  tier?: Tier | null;
  playerTags: PlayerTag[];
  notes: Note[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Tier {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerTag {
  id: string;
  playerId: string;
  tagId: string;
  tag: Tag;
  createdAt: Date;
}

export interface Note {
  id: string;
  playerId: string;
  content: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportResult {
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: Array<{
    excelData: Record<string, any>;
    potentialMatches: Player[];
  }>;
}

// Main API object
export const playerApi = {
  // Basic CRUD operations
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

  // Import/Export operations
  importFromExcel: (formData: FormData, mergeStrategy: "update" | "preserve" = "update") => {
    return api.post('/players/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: { mergeStrategy }, // Pass as query parameter
      timeout: 60000, // 1 minute for large files
    });
  },

  resolveConflict: (data: {
    excelRowIndex: number;
    selectedPlayerId: string;
    excelData: Record<string, any>;
    options: any;
  }) => {
    return api.post('/players/import/resolve', data);
  },

  exportToExcel: () => {
    return api.get('/players/export/excel', {
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
    return api.post('/players/sync/sleeper', options || {}, {
      timeout: 120000, // 2 minutes for sync
    });
  },

  getSleeperPlayers: (options?: {
    sport?: string;
    season?: string;
    week?: string;
    positions?: string[];
  }) => {
    return api.get('/players/sleeper', { params: options });
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

  createTier: (name: string, color: string, order: number) => {
    return api.post('/tiers', { name, color, order });
  },

  updateTier: (id: string, name?: string, color?: string, order?: number) => {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (order !== undefined) data.order = order;
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

  createTag: (name: string, color: string) => {
    return api.post('/tags', { name, color });
  },

  updateTag: (id: string, name?: string, color?: string) => {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    return api.put(`/tags/${id}`, data);
  },

  deleteTag: (id: string) => {
    return api.delete(`/tags/${id}`);
  },

  // Player tag associations - Fixed method names to match backend
  addTagToPlayer: (playerId: string, tagId: string) => {
    return api.post(`/players/${playerId}/tags`, { tagId });
  },

  removeTagFromPlayer: (playerId: string, tagId: string) => {
    return api.delete(`/players/${playerId}/tags/${tagId}`);
  },

  // Player notes - Fixed method names to match backend
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
  }
};