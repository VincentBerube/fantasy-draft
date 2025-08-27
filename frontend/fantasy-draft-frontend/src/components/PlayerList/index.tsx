// frontend/fantasy-draft-frontend/src/components/PlayerList/index.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { playerApi, type Player, type Tag, type Tier } from '../../api/playerApi';
import { PlayerDetail } from '../PlayerDetail';
import { TagManager } from '../TagManager';
import { TierManager } from '../TierManager';
import { NoteManager } from '../NoteManager';
import { PlayerFilters } from './PlayerFilters';
import { PlayerTable } from './PlayerTable';
import { usePlayerFilters } from './hooks/usePlayerFilters';

// Debounce utility for performance
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<number | undefined>(undefined);
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
}

export function PlayerList() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal states
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);
  const [showNoteManager, setShowNoteManager] = useState<string | null>(null);
  
  // Track pending updates for better UX
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  const filterProps = usePlayerFilters(players);
  const { filteredPlayers, hideDrafted, setHideDrafted } = filterProps;

  useEffect(() => {
    Promise.all([
      fetchPlayers(),
      fetchTags(),
      fetchTiers()
    ]);
  }, [hideDrafted]);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      // Fix: Use proper filter parameters instead of positional arguments
      const response = await playerApi.getPlayers({ 
        scoring: 'PPR', 
        includeDrafted: !hideDrafted 
      });
      setPlayers(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load players');
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await playerApi.getTags();
      setTags(response.data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const fetchTiers = async () => {
    try {
      const response = await playerApi.getTiers();
      setTiers(response.data);
    } catch (err) {
      console.error('Failed to load tiers:', err);
    }
  };

  // OPTIMISTIC UPDATE - immediate UI response
  const updatePlayerOptimistically = useCallback((playerId: string, field: string, value: any) => {
    console.log('🔄 OPTIMISTIC UPDATE:', { playerId, field, value });
    const startTime = performance.now();
    
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, [field]: value } : p
    ));
    
    // Track as pending
    setPendingUpdates(prev => new Set(prev).add(`${playerId}-${field}`));
    
    const endTime = performance.now();
    console.log(`✅ Optimistic update completed in ${endTime - startTime}ms`);
  }, []);

  // DEBOUNCED API CALL - reduce server load with fast endpoint
  const performPlayerUpdate = useCallback(async (playerId: string, field: string, value: any) => {
    console.log('💾 API UPDATE:', { playerId, field, value });
    const startTime = performance.now();
    
    try {
      const updateData: any = {};
      updateData[field] = value;
      
      // Use fast endpoint for simple field updates
      const fastUpdateFields = ['customRank', 'projectedPoints', 'vorp', 'adp', 'rank', 'byeWeek'];
      
      if (fastUpdateFields.includes(field)) {
        await playerApi.updatePlayerQuick(playerId, updateData);
      } else {
        await playerApi.updatePlayer(playerId, updateData);
      }
      
      // Remove from pending on success
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-${field}`);
        return newSet;
      });
      
      setError('');
      const endTime = performance.now();
      console.log(`✅ API update completed in ${endTime - startTime}ms`);
    } catch (error) {
      console.error('Update failed:', error);
      setError('Failed to update player');
      
      // Revert optimistic update on error
      fetchPlayers();
      
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-${field}`);
        return newSet;
      });
    }
  }, [fetchPlayers]);

  const debouncedUpdate = useDebounce(performPlayerUpdate, 500);

  // Handle cell edit with optimistic updates
  const handleCellEdit = useCallback((playerId: string, field: string, value: any) => {
    const startTime = performance.now();
    
    // Immediate UI update for instant feedback
    updatePlayerOptimistically(playerId, field, value);
    
    // DEBOUNCED API call to reduce server load (fast endpoint!)
    debouncedUpdate(playerId, field, value);
    
    const endTime = performance.now();
    console.log(`✅ handleCellEdit completed in ${endTime - startTime}ms`);
  }, [updatePlayerOptimistically, debouncedUpdate]);

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;
    
    try {
      await playerApi.deletePlayer(playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    } catch (error) {
      console.error('Failed to delete player:', error);
      setError('Failed to delete player');
    }
  };

  const handleToggleDrafted = async (playerId: string, isDrafted: boolean) => {
    try {
      // Optimistic update
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, isDrafted } : p
      ));
      
      await playerApi.toggleDraftStatus(playerId, isDrafted);
    } catch (error) {
      console.error('Failed to toggle draft status:', error);
      setError('Failed to update draft status');
      
      // Revert on error
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, isDrafted: !isDrafted } : p
      ));
    }
  };

  const handleAssignTier = async (playerId: string, tierId: string | null) => {
    try {
      // Optimistic update - fix tierId type mismatch
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, tierId: tierId } : p
      ));
      
      await playerApi.assignPlayerToTier(playerId, tierId);
    } catch (error) {
      console.error('Failed to assign tier:', error);
      setError('Failed to assign tier');
      
      // Revert on error
      fetchPlayers();
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      // Fix: Pass format parameter as required
      const response = await playerApi.exportPlayers('excel');
      const blob = response.data;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'fantasy-players.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export players:', error);
      setError('Failed to export players');
    } finally {
      setIsExporting(false);
    }
  };

  const getTierInfo = (tierId: string | null): Tier | null => {
    if (!tierId) return null;
    return tiers.find(t => t.id === tierId) || null;
  };

  const groupPlayersByTier = () => {
    const grouped = new Map<string, Player[]>();
    
    // Use 'No Tier' for players without tiers
    const noTierKey = 'no-tier';
    grouped.set(noTierKey, []);
    
    // Group tiers by their order
    tiers.forEach(tier => {
      grouped.set(tier.id, []);
    });
    
    filteredPlayers.forEach(player => {
      const key = player.tierId || noTierKey;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(player);
    });
    
    // Remove empty groups
    for (const [key, players] of grouped) {
      if (players.length === 0) {
        grouped.delete(key);
      }
    }
    
    return grouped;
  };

  const draftedCount = players.filter(p => p.isDrafted).length;
  const undraftedCount = players.filter(p => !p.isDrafted).length;
  const totalCount = players.length;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-xl">Loading players...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fantasy Draft Board</h1>
          <div className="text-sm text-gray-600 mt-1">
            {totalCount} total • {draftedCount} drafted • {undraftedCount} available
          </div>
        </div>
        
        <div className="flex space-x-3">
          {/* Export Button */}
          <button 
            onClick={handleExport}
            disabled={isExporting || totalCount === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>📥</span>
                <span>Export</span>
              </>
            )}
          </button>
          
          <button 
            onClick={() => setShowTagManager(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            🏷️ Tags
          </button>
          
          <button 
            onClick={() => setShowTierManager(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            🎯 Tiers
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Filters */}
      <PlayerFilters
        {...filterProps}
        draftedCount={draftedCount}
        tiers={tiers}
        tags={tags}
      />

      {/* Player Table */}
      <PlayerTable
        players={filteredPlayers}
        tiers={tiers}
        tags={tags}
        onCellEdit={handleCellEdit}
        onToggleDrafted={handleToggleDrafted}
        onAssignTier={handleAssignTier}
        onDeletePlayer={handleDeletePlayer}
        onPlayerClick={setSelectedPlayerId}
        onShowNotes={setShowNoteManager}
        getTierInfo={getTierInfo}
        pendingUpdates={pendingUpdates}
      />

      {/* Modals */}
      {selectedPlayerId && (
        <PlayerDetail
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {showTagManager && (
        <TagManager
          tags={tags}
          players={players}
          onClose={() => setShowTagManager(false)}
          onUpdate={() => {
            fetchTags();
            fetchPlayers();
          }}
        />
      )}

      {showTierManager && (
        <TierManager
          tiers={tiers}
          onClose={() => setShowTierManager(false)}
          onUpdate={() => {
            fetchTiers();
            fetchPlayers();
          }}
        />
      )}

      {showNoteManager && (
        <NoteManager
          playerId={showNoteManager}
          onClose={() => setShowNoteManager(null)}
          onUpdate={() => fetchPlayers()}
        />
      )}
    </div>
  );
}