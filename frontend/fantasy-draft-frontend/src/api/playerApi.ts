import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000, // 30 second timeout for large imports
});

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  playerId: string;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tier {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  team?: string;
  rank?: number;
  customRank?: number;
  positionalRank?: string;
  projectedPoints?: number;
  vorp?: number;
  adp?: number;
  byeWeek?: number;
  tier?: string;
  isDrafted: boolean;
  aliases: string[];
  userNotes: string[];
  customTags: string[];
  playerTags: Array<{ tag: Tag }>;
  notes: Note[];
}

export const playerApi = {
  // Player CRUD operations
  importPlayers: (file: File, mergeStrategy: 'update' | 'preserve' = 'update') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mergeStrategy', mergeStrategy);
    
    return api.post('/players/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getPlayers: (scoring?: 'PPR' | 'Standard', includeDrafted: boolean = true) => {
    return api.get('/players', { 
      params: { scoring, includeDrafted } 
    });
  },

  getPlayer: (id: string) => {
    return api.get(`/players/${id}`);
  },

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
      timeout: 60000, // 60 second timeout for exports
    });
  },

  // Legacy methods for backward compatibility
  updatePlayerNotes: (id: string, notes: string[]) => {
    return api.patch(`/players/${id}/notes`, { notes });
  },

  updatePlayerTags: (id: string, tags: string[]) => {
    return api.patch(`/players/${id}/tags`, { tags });
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

  addTagToPlayer: (playerId: string, tagId: string) => {
    return api.post(`/players/${playerId}/tags/${tagId}`);
  },

  removeTagFromPlayer: (playerId: string, tagId: string) => {
    return api.delete(`/players/${playerId}/tags/${tagId}`);
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

  // Tier management
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

  // Bulk operations (for future use)
  bulkUpdatePlayers: (playerIds: string[], updates: any) => {
    return api.patch('/players/bulk/update', { playerIds, updates });
  }
};