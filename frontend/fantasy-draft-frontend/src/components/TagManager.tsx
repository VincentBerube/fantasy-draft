// frontend/fantasy-draft-frontend/src/components/TagManager.tsx
import { useState } from 'react';
import { playerApi, type Tag, type Player } from '../api/playerApi';

interface TagManagerProps {
  tags: Tag[];
  players: Player[];
  onClose: () => void;
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#059669', // Emerald
  '#DC2626', // Dark Red
  '#7C2D12', // Brown
  '#1E40AF', // Dark Blue
];

export function TagManager({ tags, players, onClose, onUpdate }: TagManagerProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    setIsLoading(true);
    try {
      await playerApi.createTag(newTagName.trim(), newTagColor);
      setNewTagName('');
      setNewTagColor('#3B82F6');
      onUpdate();
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag) return;
    
    setIsLoading(true);
    try {
      await playerApi.updateTag(editingTag.id, editingTag.name, editingTag.color);
      setEditingTag(null);
      onUpdate();
    } catch (error) {
      console.error('Failed to update tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all players.')) return;
    
    setIsLoading(true);
    try {
      await playerApi.deleteTag(tagId);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAddTag = async () => {
    if (!selectedTag || selectedPlayers.size === 0) return;
    
    setIsLoading(true);
    try {
      await Promise.all(
        Array.from(selectedPlayers).map(playerId => 
          playerApi.addTagToPlayer(playerId, selectedTag)
        )
      );
      setSelectedPlayers(new Set());
      setSelectedTag('');
      onUpdate();
    } catch (error) {
      console.error('Failed to add tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkRemoveTag = async () => {
    if (!selectedTag || selectedPlayers.size === 0) return;
    
    setIsLoading(true);
    try {
      await Promise.all(
        Array.from(selectedPlayers).map(playerId => 
          playerApi.removeTagFromPlayer(playerId, selectedTag)
        )
      );
      setSelectedPlayers(new Set());
      setSelectedTag('');
      onUpdate();
    } catch (error) {
      console.error('Failed to remove tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  const selectAllPlayers = () => {
    setSelectedPlayers(new Set(players.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedPlayers(new Set());
  };

  const getPlayersWithTag = (tagId: string) => {
    return players.filter(player => 
      player.playerTags.some(pt => pt.tag.id === tagId)
    ).length;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Tag Manager</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column - Tag Management */}
            <div>
              {/* Create New Tag */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-3">Create New Tag</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Tag name..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    maxLength={50}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="flex gap-2 mb-2">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newTagColor === color ? 'border-gray-800' : 'border-gray-300'
                          } transition-colors`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isLoading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Creating...' : 'Create Tag'}
                  </button>
                </div>
              </div>

              {/* Existing Tags */}
              <div>
                <h3 className="font-semibold mb-3">Existing Tags ({tags.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                      {editingTag?.id === tag.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-1">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditingTag({ ...editingTag, color })}
                                className={`w-6 h-6 rounded-full border ${
                                  editingTag.color === color ? 'border-gray-800' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateTag}
                              disabled={isLoading}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTag(null)}
                              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="font-medium">{tag.name}</span>
                            <span className="ml-2 text-sm text-gray-500">
                              ({getPlayersWithTag(tag.id)} players)
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingTag(tag)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Edit tag"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Delete tag"
                            >
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Bulk Operations */}
            <div>
              {/* Bulk Tag Operations */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-3">Bulk Tag Operations</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Tag</label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a tag...</option>
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={selectAllPlayers}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Select All ({players.length})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Clear ({selectedPlayers.size})
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkAddTag}
                      disabled={!selectedTag || selectedPlayers.size === 0 || isLoading}
                      className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Add to Selected
                    </button>
                    <button
                      onClick={handleBulkRemoveTag}
                      disabled={!selectedTag || selectedPlayers.size === 0 || isLoading}
                      className="flex-1 bg-red-600 text-white py-2 px-3 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Remove from Selected
                    </button>
                  </div>
                </div>
              </div>

              {/* Player Selection */}
              <div>
                <h3 className="font-semibold mb-3">
                  Select Players ({selectedPlayers.size}/{players.length})
                </h3>
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-2 border-b last:border-b-0 cursor-pointer transition-colors ${
                        selectedPlayers.has(player.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => togglePlayerSelection(player.id)}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.has(player.id)}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="mr-3 h-4 w-4 text-blue-600 rounded"
                        />
                        <div>
                          <div className="font-medium text-sm">{player.name}</div>
                          <div className="text-xs text-gray-500">
                            {player.position} - {player.team || 'No Team'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {player.playerTags.map((pt) => (
                          <span
                            key={pt.id}
                            className="text-white px-2 py-1 rounded text-xs"
                            style={{ backgroundColor: pt.tag.color }}
                            title={pt.tag.name}
                          >
                            {pt.tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}