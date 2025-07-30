import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000, // 30 second timeout for large imports
});

export const playerApi = {
  importPlayers: (file: File, mergeStrategy: 'update' | 'preserve' = 'update') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mergeStrategy', mergeStrategy);
    
    return api.post('/players/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Legacy import method (for backward compatibility)
  importPlayersLegacy: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/players/import/legacy', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getPlayers: (scoring?: 'PPR' | 'Standard') => {
    return api.get('/players', { params: { scoring } });
  },

  getPlayer: (id: string) => {
    return api.get(`/players/${id}`);
  },

  updatePlayerNotes: (id: string, notes: string[]) => {
    return api.patch(`/players/${id}/notes`, { notes });
  },

  updatePlayerTags: (id: string, tags: string[]) => {
    return api.patch(`/players/${id}/tags`, { tags });
  },

  exportPlayers: () => {
    return api.get('/players/export', {
      responseType: 'blob',
      timeout: 60000, // 60 second timeout for exports
    });
  },

  // Bulk operations (for future use)
  bulkUpdatePlayers: (playerIds: string[], updates: any) => {
    return api.patch('/players/bulk/update', { playerIds, updates });
  }
};