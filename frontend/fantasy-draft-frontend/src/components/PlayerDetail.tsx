import { useState, useEffect } from 'react';
import { playerApi } from '../api/playerApi';

interface Player {
  id: string;
  name: string;
  position: string;
  team?: string;
  rank?: number;
  projectedPoints?: number;
  userNotes: string[];
  customTags: string[];
}

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
      const updatedNotes = [...player.userNotes, newNote.trim()];
      await playerApi.updatePlayerNotes(playerId, updatedNotes);
      setPlayer({ ...player, userNotes: updatedNotes });
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleAddTag = async () => {
    if (!player || !newTag.trim()) return;
    
    try {
      const updatedTags = [...player.customTags, newTag.trim()];
      await playerApi.updatePlayerTags(playerId, updatedTags);
      setPlayer({ ...player, customTags: updatedTags });
      setNewTag('');
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveNote = async (index: number) => {
    if (!player) return;
    
    try {
      const updatedNotes = [...player.userNotes];
      updatedNotes.splice(index, 1);
      await playerApi.updatePlayerNotes(playerId, updatedNotes);
      setPlayer({ ...player, userNotes: updatedNotes });
    } catch (error) {
      console.error('Failed to remove note:', error);
    }
  };

  const handleRemoveTag = async (index: number) => {
    if (!player) return;
    
    try {
      const updatedTags = [...player.customTags];
      updatedTags.splice(index, 1);
      await playerApi.updatePlayerTags(playerId, updatedTags);
      setPlayer({ ...player, customTags: updatedTags });
    } catch (error) {
      console.error('Failed to remove tag:', error);
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
        
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Custom Tags</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {player.customTags.map((tag, index) => (
              <span 
                key={index} 
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center"
              >
                {tag}
                <button 
                  onClick={() => handleRemoveTag(index)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
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
              placeholder="Add a tag (e.g., Sleeper)"
              className="flex-1 p-2 border rounded-l focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddTag}
              className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Player Notes</h3>
          <ul className="mb-4 max-h-40 overflow-y-auto">
            {player.userNotes.map((note, index) => (
              <li 
                key={index} 
                className="mb-2 p-2 bg-gray-50 rounded flex justify-between"
              >
                <span>{note}</span>
                <button 
                  onClick={() => handleRemoveNote(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
            {player.userNotes.length === 0 && (
              <li className="text-gray-500 italic">No notes yet</li>
            )}
          </ul>
          <div className="flex">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this player"
              className="flex-1 p-2 border rounded-l focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button
              onClick={handleAddNote}
              className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}