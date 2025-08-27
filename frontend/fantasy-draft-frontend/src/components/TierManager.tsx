// frontend/fantasy-draft-frontend/src/components/TierManager.tsx
import { useState } from 'react';
import { playerApi, type Tier } from '../api/playerApi';

interface TierManagerProps {
  tiers: Tier[];
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

export function TierManager({ tiers, onClose, onUpdate }: TierManagerProps) {
  const [newTierName, setNewTierName] = useState('');
  const [newTierColor, setNewTierColor] = useState('#8B5CF6');
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateTier = async () => {
    if (!newTierName.trim()) return;
    
    setIsLoading(true);
    try {
      // Get the next order number
      const maxOrder = Math.max(...tiers.map(t => t.order), 0);
      await playerApi.createTier(newTierName.trim(), newTierColor, maxOrder + 1);
      setNewTierName('');
      setNewTierColor('#8B5CF6');
      onUpdate();
    } catch (error) {
      console.error('Failed to create tier:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier) return;
    
    setIsLoading(true);
    try {
      await playerApi.updateTier(editingTier.id, editingTier.name, editingTier.color, editingTier.order);
      setEditingTier(null);
      onUpdate();
    } catch (error) {
      console.error('Failed to update tier:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier? Players in this tier will be moved to "Unassigned".')) return;
    
    setIsLoading(true);
    try {
      await playerApi.deleteTier(tierId);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete tier:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveUp = async (tier: Tier) => {
    const currentIndex = tiers.findIndex(t => t.id === tier.id);
    if (currentIndex <= 0) return;
    
    const prevTier = tiers[currentIndex - 1];
    
    setIsLoading(true);
    try {
      // Swap the orders
      await Promise.all([
        playerApi.updateTier(tier.id, tier.name, tier.color, prevTier.order),
        playerApi.updateTier(prevTier.id, prevTier.name, prevTier.color, tier.order)
      ]);
      onUpdate();
    } catch (error) {
      console.error('Failed to move tier up:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveDown = async (tier: Tier) => {
    const currentIndex = tiers.findIndex(t => t.id === tier.id);
    if (currentIndex >= tiers.length - 1) return;
    
    const nextTier = tiers[currentIndex + 1];
    
    setIsLoading(true);
    try {
      // Swap the orders
      await Promise.all([
        playerApi.updateTier(tier.id, tier.name, tier.color, nextTier.order),
        playerApi.updateTier(nextTier.id, nextTier.name, nextTier.color, tier.order)
      ]);
      onUpdate();
    } catch (error) {
      console.error('Failed to move tier down:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sort tiers by order for display
  const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Tier Manager</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Create New Tier */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">Create New Tier</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Tier name..."
                value={newTierName}
                onChange={(e) => setNewTierName(e.target.value)}
                className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
              
              <div>
                <div className="flex gap-1 mb-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTierColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newTierColor === color ? 'border-gray-800' : 'border-gray-300'
                      } transition-colors`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateTier}
                disabled={!newTierName.trim() || isLoading}
                className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating...' : 'Create Tier'}
              </button>
            </div>
          </div>

          {/* Existing Tiers */}
          <div>
            <h3 className="font-semibold mb-3">Existing Tiers ({tiers.length})</h3>
            <div className="space-y-2">
              {sortedTiers.map((tier, index) => (
                <div 
                  key={tier.id} 
                  className="border rounded-lg p-4"
                  style={{ 
                    backgroundColor: tier.color + '10', 
                    borderColor: tier.color + '40'
                  }}
                >
                  {editingTier?.id === tier.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingTier.name}
                        onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                        <div className="flex gap-1">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => setEditingTier({ ...editingTier, color })}
                              className={`w-8 h-8 rounded-full border-2 ${
                                editingTier.color === color ? 'border-gray-800' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateTier}
                          disabled={isLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {isLoading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingTier(null)}
                          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: tier.color }}
                        />
                        <span className="font-medium text-lg">{tier.name}</span>
                        <span className="ml-3 text-sm text-gray-500">
                          Order: {tier.order}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveUp(tier)}
                          disabled={index === 0 || isLoading}
                          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={() => handleMoveDown(tier)}
                          disabled={index === sortedTiers.length - 1 || isLoading}
                          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ⬇️
                        </button>
                        <button
                          onClick={() => setEditingTier(tier)}
                          className="p-2 text-blue-600 hover:text-blue-800"
                          title="Edit tier"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTier(tier.id)}
                          className="p-2 text-red-600 hover:text-red-800"
                          title="Delete tier"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}