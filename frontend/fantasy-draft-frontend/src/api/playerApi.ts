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
  vorp: number | null;
  adp: number | null;
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

export const playerApi = {
  // Enhanced import with smart matching
  importPlayers: (formData: FormData) => {
    return api.post('/players/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Get import preview
  getImportPreview: (formData: FormData) => {
    return api.post('/players/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Advanced import with detailed control
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

  rollbackImport: (sessionId: string) => {
    return api.post(`/players/import/rollback/${sessionId}`);
  },

  getImportHistory: (limit?: number) => {
    return api.get('/players/import/history', {
      params: { limit }
    });
  },
  
  // Enhanced player fetching with filters
  getPlayers: (filters?: {
    scoring?: 'PPR' | 'Standard';
    includeDrafted?: boolean;
    dataSource?: 'sleeper' | 'excel' | 'manual';
    position?: string;
    team?: string;
    hasSleeperId?: boolean;
  }) => {
    return api.get('/players', { params: filters });
  },

  getPlayer: (id: string) => {
    return api.get(`/players/${id}`);
  },

  // FAST UPDATE - for simple field changes (no relations loaded)
  updatePlayerQuick: (id: string, data: Partial<Pick<Player, 'customRank' | 'projectedPoints' | 'vorp' | 'adp' | 'rank' | 'byeWeek'>>) => {
    return api.patch(`/players/${id}/quick`, data);
  },

  // FULL UPDATE - for complex updates that need all relations
  updatePlayer: (id: string, data: Partial<Player>) => {
    return api.patch(`/players/${id}`, data);
  },

  deletePlayer: (id: string) => {
    return api.delete(`/players/${id}`);
  },

  updatePlayerRanking: (id: string, rank: number) => {
    return api.patch(`/players/${id}/rank`, { rank });
  },

  toggleDraftStatus: (id: string, isDrafted: boolean) => {
    return api.patch(`/players/${id}/draft`, { isDrafted });
  },

  assignPlayerToTier: (id: string, tierId: string | null) => {
    return api.patch(`/players/${id}/tier`, { tierId });
  },

  exportPlayers: () => {
    return api.get('/players/export', {
      responseType: 'blob',
      timeout: 60000,
    });
  },

  // Note management
  addNote: (playerId: string, content: string, color: string = '#6B7280') => {
    return api.post(`/players/${playerId}/notes`, { content, color });
  },

  updateNote: (noteId: string, content?: string, color?: string) => {
    return api.patch(`/players/notes/${noteId}`, { content, color });
  },

  deleteNote: (noteId: string) => {
    return api.delete(`/players/notes/${noteId}`);
  },

  // Tag management
  getTags: () => {
    return api.get('/players/tags/all');
  },

  createTag: (name: string, color: string) => {
    return api.post('/players/tags', { name, color });
  },

  updateTag: (tagId: string, name?: string, color?: string) => {
    return api.patch(`/players/tags/${tagId}`, { name, color });
  },

  deleteTag: (tagId: string) => {
    return api.delete(`/players/tags/${tagId}`);
  },

  // Tier management (assuming similar endpoints exist)
  getTiers: () => {
    return api.get('/players/tiers/all');
  },

  createTier: (name: string, color: string, order: number) => {
    return api.post('/players/tiers', { name, color, order });
  },

  updateTier: (tierId: string, name?: string, color?: string, order?: number) => {
    return api.patch(`/players/tiers/${tierId}`, { name, color, order });
  },

  deleteTier: (tierId: string) => {
    return api.delete(`/players/tiers/${tierId}`);
  },

  addTagToPlayer: (playerId: string, tagId: string) => {
    return api.post(`/players/${playerId}/tags/${tagId}`);
  },

  removeTagFromPlayer: (playerId: string, tagId: string) => {
    return api.delete(`/players/${playerId}/tags/${tagId}`);
  },

  // Bulk operations
  bulkToggleDraft: (playerIds: string[], isDrafted: boolean) => {
    return api.post('/players/bulk/draft', { playerIds, isDrafted });
  },

  bulkAssignTier: (playerIds: string[], tierId: string | null) => {
    return api.post('/players/bulk/tier', { playerIds, tierId });
  },

  // Statistics
  getPlayerStats: () => {
    return api.get('/players/stats/summary');
  },

  // Legacy methods for backward compatibility
  updatePlayerNotes: (id: string, notes: string[]) => {
    return api.patch(`/players/${id}/notes`, { notes });
  },

  updatePlayerTags: (id: string, tags: string[]) => {
    return api.patch(`/players/${id}/tags`, { tags });
  }
};