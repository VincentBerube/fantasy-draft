// frontend/src/components/TierManager.tsx
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
    const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);
    const currentIndex = sortedTiers.findIndex(t => t.id === tier.id);
    
    if (currentIndex > 0) {
      const prevTier = sortedTiers[currentIndex - 1];
      setIsLoading(true);
      try {
        // Swap the orders
        await Promise.all([
          playerApi.updateTier(tier.id, undefined, undefined, prevTier.order),
          playerApi.updateTier(prevTier.id, undefined, undefined, tier.order)
        ]);
        onUpdate();
      } catch (error) {
        console.error('Failed to reorder tiers:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleMoveDown = async (tier: Tier) => {
    const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);
    const currentIndex = sortedTiers.findIndex(t => t.id === tier.id);
    
    if (currentIndex < sortedTiers.length - 1) {
      const nextTier = sortedTiers[currentIndex + 1];
      setIsLoading(true);
      try {
        // Swap the orders
        await Promise.all([
          playerApi.updateTier(tier.id, undefined, undefined, nextTier.order),
          playerApi.updateTier(nextTier.id, undefined, undefined, tier.order)
        ]);
        onUpdate();
      } catch (error) {
        console.error('Failed to reorder tiers:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Sort tiers by order for display
  const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
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
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tier name (e.g., Elite, High-End RB1, etc.)"
                value={newTierName}
                onChange={(e) => setNewTierName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateTier()}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2 mb-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTierColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newTierColor === color ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={newTierColor}
                  onChange={(e) => setNewTierColor(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md"
                />
              </div>
              
              <button
                onClick={handleCreateTier}
                disabled={!newTierName.trim() || isLoading}
                className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
              >
                {isLoading ? 'Creating...' : 'Create Tier'}
              </button>
            </div>
          </div>

          {/* Existing Tiers */}
          <div>
            <h3 className="font-semibold mb-4">Existing Tiers</h3>
            {sortedTiers.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">
                No tiers created yet. Create your first tier above.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedTiers.map((tier, index) => (
                  <div 
                    key={tier.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    style={{ 
                      borderLeftColor: tier.color,
                      borderLeftWidth: '4px',
                      backgroundColor: tier.color + '10'
                    }}
                  >
                    {editingTier?.id === tier.id ? (
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-sm text-gray-500 font-mono w-8">
                          #{tier.order}
                        </span>
                        <input
                          type="text"
                          value={editingTier.name}
                          onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                          className="flex-1 p-2 border rounded-md"
                        />
                        <input
                          type="color"
                          value={editingTier.color}
                          onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                          className="w-12 h-10 border rounded-md"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateTier}
                            disabled={isLoading}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTier(null)}
                            className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500 font-mono w-8">
                            #{tier.order}
                          </span>
                          <div
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: tier.color }}
                          />
                          <span className="font-medium text-gray-800">
                            {tier.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Move Up/Down Buttons */}
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleMoveUp(tier)}
                              disabled={index === 0 || isLoading}
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveDown(tier)}
                              disabled={index === sortedTiers.length - 1 || isLoading}
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Edit/Delete Buttons */}
                          <button
                            onClick={() => setEditingTier(tier)}
                            disabled={isLoading}
                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTier(tier.id)}
                            disabled={isLoading}
                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 How Tiers Work</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Tiers help you group players by value/skill level</li>
              <li>• Players are displayed grouped by their assigned tier</li>
              <li>• Use the arrows to reorder tiers - higher tiers appear first</li>
              <li>• Players without a tier will appear in "Unassigned Players"</li>
            </ul>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}