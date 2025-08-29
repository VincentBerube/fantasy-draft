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
      const response = await playerApi.getPlayers('PPR', !hideDrafted);
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
    console.log(`✅ Optimistic update took ${endTime - startTime}ms`);
  }, []);

  // ACTUAL API CALL - with error handling and fast endpoint
  const performPlayerUpdate = useCallback(async (playerId: string, field: string, value: any) => {
    console.log('🚀 STARTING API CALL:', { playerId, field, value });
    const startTime = performance.now();
    
    try {
      const updateData: any = {};
      updateData[field] = value;
      
      // Use fast endpoint for simple field updates (MAJOR PERFORMANCE IMPROVEMENT)
      const fastUpdateFields = ['customRank', 'projectedPoints', 'vorp', 'adp', 'rank'];
      
      if (fastUpdateFields.includes(field)) {
        console.log('🏃‍♂️ Using FAST endpoint for field:', field);
        await playerApi.updatePlayerQuick(playerId, updateData);
      } else {
        console.log('🐌 Using SLOW endpoint for field:', field);
        await playerApi.updatePlayer(playerId, updateData);
      }
      
      const endTime = performance.now();
      console.log(`✅ API call completed in ${endTime - startTime}ms`);
      
      // Remove from pending on success
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-${field}`);
        return newSet;
      });
      
      setError('');
    } catch (error) {
      const endTime = performance.now();
      console.error(`❌ API call failed after ${endTime - startTime}ms:`, error);
      setError('Failed to update player');
      
      // Revert optimistic update on error
      fetchPlayers();
      
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-${field}`);
        return newSet;
      });
    }
  }, []);

  // DEBOUNCED VERSION - reduces API calls dramatically
  const debouncedUpdate = useDebounce(performPlayerUpdate, 500); // 500ms delay

  // OPTIMIZED HANDLE CELL EDIT - this replaces your slow version
  const handleCellEdit = useCallback((playerId: string, field: string, value: any) => {
    console.log('🎯 HANDLE CELL EDIT CALLED:', { playerId, field, value });
    const startTime = performance.now();
    
    // IMMEDIATE UI update for instant feedback (no lag!)
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
      // Optimistic update - use correct field name
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, tierId: tierId || undefined } : p
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
      const response = await playerApi.exportPlayers();
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

  const getTierInfo = (tierId: string | undefined): Tier | null => {
    if (!tierId) return null;
    return tiers.find(t => t.id === tierId) || null;
  };

  const groupPlayersByTier = () => {
    const grouped = new Map<string, Player[]>();
    
    // Use tierId for grouping (the foreign key field)
    filteredPlayers.forEach(player => {
      const tierKey = player.tierId || 'no-tier';
      if (!grouped.has(tierKey)) {
        grouped.set(tierKey, []);
      }
      grouped.get(tierKey)!.push(player);
    });
    
    const sortedGroups = Array.from(grouped.entries()).sort(([aTier], [bTier]) => {
      if (aTier === 'no-tier') return 1;
      if (bTier === 'no-tier') return -1;
      
      const tierA = tiers.find(t => t.id === aTier);
      const tierB = tiers.find(t => t.id === bTier);
      
      return (tierA?.order || 999) - (tierB?.order || 999);
    });
    
    return sortedGroups;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tierGroups = groupPlayersByTier();
  const draftedCount = players.filter(p => p.isDrafted).length;

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center mb-6 border border-red-200">
          {error}
        </div>
      )}

      {/* Show pending updates indicator */}
      {pendingUpdates.size > 0 && (
        <div className="bg-blue-100 text-blue-700 p-2 rounded-lg text-center mb-4 border border-blue-200">
          💾 Saving {pendingUpdates.size} update(s)...
        </div>
      )}

      {/* Header controls */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Fantasy Draft Players ({filteredPlayers.length})
        </h2>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setShowTagManager(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Manage Tags
          </button>
          
          <button
            onClick={() => setShowTierManager(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Manage Tiers
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <PlayerFilters 
        {...filterProps}
        tags={tags}
        tiers={tiers}
        draftedCount={draftedCount}
      />

      {/* Player Tables - uses existing PlayerTable component */}
      <div className="space-y-8">
        {tierGroups.map(([tierKey, tierPlayers]) => {
          const tierInfo = getTierInfo(tierKey === 'no-tier' ? undefined : tierKey);
          
          return (
            <PlayerTable
              key={tierKey}
              tierInfo={tierInfo}
              players={tierPlayers}
              tiers={tiers}
              onToggleDrafted={handleToggleDrafted}
              onAssignTier={handleAssignTier}
              onEditCell={handleCellEdit}
              onDelete={handleDeletePlayer}
              onShowDetail={setSelectedPlayerId}
              onShowNotes={setShowNoteManager}
            />
          );
        })}
      </div>

      {/* Show message when no players match filters */}
      {filteredPlayers.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          {players.length === 0 ? (
            <div>
              <p className="text-lg mb-4">No players found</p>
              <p className="text-sm">Import some players to get started!</p>
            </div>
          ) : (
            <div>
              <p className="text-lg mb-4">No players match your current filters</p>
              <p className="text-sm">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      )}

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
          onUpdate={fetchPlayers}
        />
      )}
    </div>
  );
}