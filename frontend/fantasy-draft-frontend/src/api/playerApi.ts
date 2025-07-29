import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

export const playerApi = {
  importPlayers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/players/import', formData, {
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
    });
  }
};