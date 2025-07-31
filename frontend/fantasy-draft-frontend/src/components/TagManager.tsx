// frontend/src/components/TagManager.tsx
import { useState } from 'react';
import { playerApi, Tag, Player } from '../api/playerApi';

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: Tag Management */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Bulk Tag Assignment</h3>
              
              {/* Tag Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a tag...</option>
                  {tags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Player Selection Controls */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={selectAllPlayers}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Clear Selection
                </button>
                <span className="text-sm text-gray-600 self-center">
                  {selectedPlayers.size} players selected
                </span>
              </div>
              
              {/* Bulk Actions */}
              {selectedTag && selectedPlayers.size > 0 && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleBulkAddTag}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                  >
                    Add Tag to Selected
                  </button>
                  <button
                    onClick={handleBulkRemoveTag}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                  >
                    Remove Tag from Selected
                  </button>
                </div>
              )}
              
              {/* Player List */}
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-medium mb-3">Players ({players.length})</h4>
                <div className="space-y-2">
                  {players.map(player => (
                    <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.has(player.id)}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium text-sm">{player.name}</div>
                          <div className="text-xs text-gray-500">
                            {player.position} - {player.team || 'No Team'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Current Tags */}
                      <div className="flex gap-1">
                        {player.playerTags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
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
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}ibold mb-4">Manage Tags</h3>
              
              {/* Create New Tag */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-medium mb-3">Create New Tag</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Tag name (e.g., Sleeper, Bust, Target)"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isLoading}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Create Tag
                  </button>
                </div>
              </div>

              {/* Existing Tags */}
              <div className="space-y-3">
                <h4 className="font-medium">Existing Tags</h4>
                {tags.length === 0 ? (
                  <p className="text-gray-500 italic">No tags created yet</p>
                ) : (
                  tags.map(tag => (
                    <div key={tag.id} className="flex items-center justify-between p-3 border rounded-lg">
                      {editingTag?.id === tag.id ? (
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="flex-1 p-1 border rounded"
                          />
                          <input
                            type="color"
                            value={editingTag.color}
                            onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                            className="w-8 h-8 border rounded"
                          />
                          <button
                            onClick={handleUpdateTag}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTag(null)}
                            className="px-3 py-1 bg-gray-400 text-white rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              ({getPlayersWithTag(tag.id)} players)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTag(tag)}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Bulk Tag Assignment */}
            <div>
              <h3 className="text-lg font-sem