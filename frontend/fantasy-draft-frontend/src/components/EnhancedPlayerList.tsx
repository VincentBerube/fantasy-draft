// frontend/fantasy-draft-frontend/src/components/EnhancedPlayerList.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerRow } from './PlayerList/PlayerRow';
import { EnhancedPlayerImport } from './EnhancedPlayerImport';
import { playerApi, sleeperApi } from '../api';
import type { Player, Tier } from '../api';

// Custom hook for debouncing
function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const [debounceTimer, setDebounceTimer] = useState<number | null>(null);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const newTimer = window.setTimeout(() => {
      callback(...args);
    }, delay);

    setDebounceTimer(newTimer);
  }, [callback, delay, debounceTimer]);

  return debouncedCallback;
}

export const EnhancedPlayerList: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  
  // Pagination state
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PLAYERS_PER_PAGE = 50;
  
  // Filters
  const [filters, setFilters] = useState({
    position: '',
    team: '',
    dataSource: '',
    includeDrafted: true,
    hasSleeperId: '',
    searchTerm: ''
  });

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Load players
  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const filterParams = {
        includeDrafted: filters.includeDrafted,
        ...(filters.position && { position: filters.position }),
        ...(filters.team && { team: filters.team }),
        ...(filters.dataSource && { dataSource: filters.dataSource as any }),
        ...(filters.hasSleeperId && { hasSleeperId: filters.hasSleeperId === 'true' })
      };

      const [playersResponse, tiersResponse] = await Promise.all([
        playerApi.getPlayers(filterParams),
        playerApi.getTiers() // Use getTiers instead of getTags for tiers
      ]);

      setPlayers(playersResponse.data);
      setTiers(tiersResponse.data);
    } catch (error: any) {
      console.error('Error fetching players:', error);
      setError('Failed to load players');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await playerApi.getPlayerStats();
      setStats(response.data);
    } catch (error) {
      console.warn('Failed to load stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchStats();
  }, [fetchPlayers, fetchStats]);

  // Optimistic update for immediate UI feedback
  const updatePlayerOptimistically = useCallback((playerId: string, field: string, value: any) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, [field]: value } : p
    ));
    
    // Track as pending
    setPendingUpdates(prev => new Set(prev).add(`${playerId}-${field}`));
  }, []);

  // Debounced API call for player updates
  const performPlayerUpdate = useCallback(async (playerId: string, field: string, value: any) => {
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
    // Immediate UI update for instant feedback
    updatePlayerOptimistically(playerId, field, value);
    
    // Debounced API call
    debouncedUpdate(playerId, field, value);
  }, [updatePlayerOptimistically, debouncedUpdate]);

  const handleToggleDrafted = useCallback(async (playerId: string, isDrafted: boolean) => {
    try {
      updatePlayerOptimistically(playerId, 'isDrafted', isDrafted);
      await playerApi.toggleDraftStatus(playerId, isDrafted);
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-isDrafted`);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to update draft status:', error);
      setError('Failed to update draft status');
      fetchPlayers(); // Revert on error
    }
  }, [updatePlayerOptimistically, fetchPlayers]);

  const handleAssignTier = useCallback(async (playerId: string, tierId: string | null) => {
    try {
      updatePlayerOptimistically(playerId, 'tierId', tierId);
      await playerApi.assignPlayerToTier(playerId, tierId);
      setPendingUpdates(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${playerId}-tierId`);
        return newSet;
      });
    } catch (error) {
      console.error('Failed to assign tier:', error);
      setError('Failed to assign tier');
      fetchPlayers(); // Revert on error
    }
  }, [updatePlayerOptimistically, fetchPlayers]);

  const handleDeletePlayer = useCallback(async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (player.sleeperId) {
      alert('Cannot delete Sleeper players. They will be restored on next sync.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${player.name}?`)) {
      return;
    }

    try {
      await playerApi.deletePlayer(playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    } catch (error) {
      console.error('Failed to delete player:', error);
      setError('Failed to delete player');
    }
  }, [players]);

  const handleSleeperSync = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const syncOptions = {
        includeProjections: true,
        onlyActive: true,
        positionsFilter: ['QB', 'WR', 'RB', 'TE', 'K'],
        topPlayersLimit: 500
      };

      await sleeperApi.syncPlayers(syncOptions);
      await fetchPlayers();
      await fetchStats();
      
      alert('Sleeper sync completed successfully!');
    } catch (error: any) {
      console.error('Sleeper sync failed:', error);
      setError('Sleeper sync failed: ' + (error.response?.data?.details || error.message));
    } finally {
      setIsLoading(false);
    }
  }, [fetchPlayers, fetchStats]);

  const handleExport = useCallback(async () => {
    try {
      setError('');
      const response = await playerApi.exportPlayers();
      
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `fantasy_players_${timestamp}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (error: any) {
      console.error('Export failed:', error);
      setError('Export failed: ' + (error.response?.data?.details || error.message));
    }
  }, []);

  // Filter players based on search and filters
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!player.name.toLowerCase().includes(searchLower) &&
            !player.position.toLowerCase().includes(searchLower) &&
            !(player.team?.toLowerCase().includes(searchLower))) {
          return false;
        }
      }
      return true;
    });
  }, [players, filters.searchTerm]);

  // Get unique values for filter dropdowns
  const positions = useMemo(() => [...new Set(players.map(p => p.position))].sort(), [players]);
  const teams = useMemo(() => [...new Set(players.map(p => p.team).filter(Boolean))].sort(), [players]);
  const dataSources = useMemo(() => [...new Set(players.map(p => p.dataSource))].sort(), [players]);

  // Load more players
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    
    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setCurrentPage(prev => prev + 1);
    setIsLoadingMore(false);
  }, []);

  // Check if there are more players to load
  const hasMorePlayers = useMemo(() => {
    return displayedPlayers.length < filteredPlayers.length;
  }, [displayedPlayers.length, filteredPlayers.length]);

  const remainingPlayers = useMemo(() => {
    return filteredPlayers.length - displayedPlayers.length;
  }, [filteredPlayers.length, displayedPlayers.length]);

  if (isLoading && players.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPlayers}</div>
            <div className="text-sm text-gray-600">Total Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.bySource.sleeper}</div>
            <div className="text-sm text-gray-600">From Sleeper</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.bySource.excel}</div>
            <div className="text-sm text-gray-600">From Excel</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.draftedPlayers}</div>
            <div className="text-sm text-gray-600">Drafted</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          📥 {showImport ? 'Hide Import' : 'Import Excel'}
        </button>
        
        <button
          onClick={handleSleeperSync}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          🏈 Sync Sleeper
        </button>
        
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          📊 Export Excel
        </button>
        
        <button
          onClick={fetchPlayers}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Import Component */}
      {showImport && (
        <EnhancedPlayerImport 
          onImportComplete={() => {
            fetchPlayers();
            fetchStats();
            setShowImport(false);
          }}
        />
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center border border-red-200">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-white border rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            placeholder="Search players..."
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
          <select
            value={filters.position}
            onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
          <select
            value={filters.team}
            onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team || ''}>{team}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
          <select
            value={filters.dataSource}
            onChange={(e) => setFilters(prev => ({ ...prev, dataSource: e.target.value }))}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Sources</option>
            {dataSources.map(source => (
              <option key={source} value={source || ''}>
                {source === 'sleeper' ? '🏈 Sleeper' : 
                 source === 'excel' ? '📊 Excel' : '✏️ Manual'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sleeper Data</label>
          <select
            value={filters.hasSleeperId}
            onChange={(e) => setFilters(prev => ({ ...prev, hasSleeperId: e.target.value }))}
            className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Players</option>
            <option value="true">Sleeper Players Only</option>
            <option value="false">Non-Sleeper Only</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.includeDrafted}
              onChange={(e) => setFilters(prev => ({ ...prev, includeDrafted: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Include Drafted</span>
          </label>
        </div>
      </div>

      {/* Player Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Draft
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Custom
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pos
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bye
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proj
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VORP
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ADP
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedPlayers.map(player => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  tiers={tiers}
                  onToggleDrafted={handleToggleDrafted}
                  onAssignTier={handleAssignTier}
                  onEditCell={handleCellEdit}
                  onDelete={handleDeletePlayer}
                  onShowDetail={(id) => console.log('Show detail for', id)}
                  onShowNotes={(id) => console.log('Show notes for', id)}
                  isPending={Array.from(pendingUpdates).some(update => update.startsWith(player.id))}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {hasMorePlayers && (
          <div className="px-6 py-4 bg-gray-50 border-t text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoadingMore ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                `Load More (${remainingPlayers} remaining)`
              )}
            </button>
          </div>
        )}

        {filteredPlayers.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No players found matching current filters.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-500">
        Showing {displayedPlayers.length} of {filteredPlayers.length} players
        {filteredPlayers.length !== players.length && (
          <span className="text-blue-600"> (filtered from {players.length} total)</span>
        )}
        {pendingUpdates.size > 0 && (
          <span className="ml-2 text-yellow-600">
            • {pendingUpdates.size} pending update{pendingUpdates.size !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};