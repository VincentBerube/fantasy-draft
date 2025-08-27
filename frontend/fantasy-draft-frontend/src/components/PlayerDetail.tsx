// frontend/fantasy-draft-frontend/src/components/PlayerDetail.tsx
import { useState, useEffect } from 'react';
import { playerApi, type Player } from '../api/playerApi';

export function PlayerDetail({ playerId, onClose }: { 
  playerId: string; 
  onClose: () => void 
}) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const response = await playerApi.getPlayer(playerId);
        setPlayer(response.data);
      } catch (error) {
        console.error('Failed to fetch player:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPlayer();
  }, [playerId]);

  const handleAddNote = async () => {
    if (!player || !newNote.trim()) return;
    
    try {
      await playerApi.addPlayerNote(playerId, { content: newNote.trim() });
      // Refresh player data
      const response = await playerApi.getPlayer(playerId);
      setPlayer(response.data);
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleRemoveNote = async (noteId: string) => {
    if (!player) return;
    
    try {
      await playerApi.deletePlayerNote(playerId, noteId);
      // Refresh player data
      const response = await playerApi.getPlayer(playerId);
      setPlayer(response.data);
    } catch (error) {
      console.error('Failed to remove note:', error);
    }
  };

  const handleAddTag = async () => {
    if (!player || !newTag.trim()) return;
    
    try {
      // First create the tag if it doesn't exist
      await playerApi.createTag({ name: newTag.trim(), color: '#3B82F6' });
      // Then add it to the player (this would need the tag ID, so this is simplified)
      // In a real implementation, you'd search for the tag by name to get its ID
      setNewTag('');
      // Refresh player data
      const response = await playerApi.getPlayer(playerId);
      setPlayer(response.data);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Player Not Found</h2>
            <button 
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{player.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-700">
            {player.position} | {player.team || 'No Team'} | 
            Rank: {player.rank || 'N/A'} | 
            Points: {player.projectedPoints?.toFixed(1) || 'N/A'}
          </p>
        </div>
        
        {/* Player Tags (using new tag system) */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {player.playerTags?.map((playerTag) => (
              <span 
                key={playerTag.id} 
                className="text-white px-2 py-1 rounded text-sm flex items-center"
                style={{ backgroundColor: playerTag.tag.color }}
              >
                {playerTag.tag.name}
                <button 
                  onClick={() => playerApi.removePlayerTag(playerId, playerTag.tag.id)}
                  className="ml-1 text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag"
              className="flex-1 p-2 border rounded-l focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleAddTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Player Notes (using new notes system) */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Notes</h3>
          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
            {player.notes?.map((note) => (
              <div 
                key={note.id} 
                className="flex items-center justify-between p-2 rounded text-sm"
                style={{ backgroundColor: note.color + '20', borderLeft: `3px solid ${note.color}` }}
              >
                <span>{note.content}</span>
                <button 
                  onClick={() => handleRemoveNote(note.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note"
              className="flex-1 p-2 border rounded-l focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleAddNote}
              className="px-4 py-2 bg-green-600 text-white rounded-r hover:bg-green-700"
            >
              Add
            </button>
          </div>
        </div>

        {/* Additional player stats */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Stats</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">ADP:</span> {player.adp || 'N/A'}
            </div>
            <div>
              <span className="text-gray-600">VORP:</span> {player.vorp || 'N/A'}
            </div>
            <div>
              <span className="text-gray-600">Bye Week:</span> {player.byeWeek || 'N/A'}
            </div>
            <div>
              <span className="text-gray-600">Last Season:</span> {player.lastSeasonPoints || 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}