// frontend/fantasy-draft-frontend/src/components/EnhancedPlayerList.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerRow } from './PlayerList/PlayerRow';
import { EnhancedPlayerImport } from './EnhancedPlayerImport';
import { playerApi } from '../api/playerApi';
import { sleeperApi } from '../api/sleeperApi';
import type { Player, Tier } from '../api/playerApi';

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
  // Initialize with empty arrays to prevent filter errors
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

  // Stats - with proper default structure
  const [stats, setStats] = useState<{
    totalPlayers: number;
    draftedPlayers: number;
    undraftedPlayers: number;
    byPosition: any[];
  } | null>(null);

  // Load players with proper error handling - FIXED: Remove arbitrary limits
  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const filterParams = {
        includeDrafted: filters.includeDrafted,
        limit: 2000, // FIXED: Get all players, not just 100
        ...(filters.position && { position: filters.position }),
        ...(filters.team && { team: filters.team }),
        ...(filters.dataSource && { dataSource: filters.dataSource as any }),
        ...(filters.hasSleeperId && { hasSleeperId: filters.hasSleeperId === 'true' })
      };

      const [playersResponse, tiersResponse] = await Promise.all([
        playerApi.getPlayers(filterParams),
        playerApi.getTiers()
      ]);

      // Enhanced logging to debug the issue
      console.log('🔍 Raw API Responses:', {
        playersResponse: playersResponse,
        playersData: playersResponse.data,
        playersDataData: playersResponse.data?.data,
        playersType: typeof playersResponse.data,
        playersLength: Array.isArray(playersResponse.data?.data) ? playersResponse.data.data.length : 'Not an array',
        tiersResponse: tiersResponse,
        tiersData: tiersResponse.data
      });

      // Handle the { success: true, data: [...] } response structure
      const playersData = Array.isArray(playersResponse.data?.data) ? playersResponse.data.data : [];
      const tiersData = Array.isArray(tiersResponse.data?.data) ? tiersResponse.data.data : [];
      
      // FIXED: Normalize player data to ensure arrays are always defined
      const normalizedPlayers = playersData.map((player: any) => ({
        ...player,
        playerTags: Array.isArray(player.playerTags) ? player.playerTags : [],
        notes: Array.isArray(player.notes) ? player.notes : [],
        aliases: Array.isArray(player.aliases) ? player.aliases : []
      }));
      
      setPlayers(normalizedPlayers);
      setTiers(tiersData);
      
      console.log(`📊 Loaded ${normalizedPlayers.length} players from API`);
    } catch (error: any) {
      console.error('Error fetching players:', error);
      setError('Failed to load players: ' + (error.response?.data?.error || error.message));
      // Ensure arrays are still set on error
      setPlayers([]);
      setTiers([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load stats - make this optional and non-blocking
  const fetchStats = useCallback(async () => {
    try {
      const response = await playerApi.getPlayerStats();
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.warn('Stats not available:', error);
      // Set default stats structure if API fails
      setStats({
        totalPlayers: players.length,
        draftedPlayers: players.filter(p => p.isDrafted).length,
        undraftedPlayers: players.filter(p => !p.isDrafted).length,
        byPosition: []
      });
    }
  }, [players]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (players.length > 0) {
      fetchStats();
    }
  }, [players, fetchStats]);

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
      
      await playerApi.updatePlayer(playerId, updateData);
      
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

  // Handle cell edits
  const handleCellEdit = useCallback((playerId: string, field: string, value: any) => {
    updatePlayerOptimistically(playerId, field, value);
    debouncedUpdate(playerId, field, value);
  }, [updatePlayerOptimistically, debouncedUpdate]);

  // Handle toggle drafted
  const handleToggleDrafted = useCallback(async (playerId: string, isDrafted: boolean) => {
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
  }, []);

  // Handle assign tier
  const handleAssignTier = useCallback(async (playerId: string, tierId: string | null) => {
    try {
      // Optimistic update
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, tierId } : p
      ));
      
      await playerApi.assignPlayerToTier(playerId, tierId);
    } catch (error) {
      console.error('Failed to assign tier:', error);
      setError('Failed to assign tier');
      
      // Revert on error
      fetchPlayers();
    }
  }, [fetchPlayers]);

  // Handle delete player
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (player.dataSource === 'sleeper') {
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

  // Handle Sleeper sync - FIXED VERSION
  const handleSleeperSync = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log('🏈 Starting Sleeper sync...');
      
      // Use the correct API call
      const response = await sleeperApi.syncPlayers({
        includeProjections: true,
        onlyActive: true,
        positionsFilter: ['QB', 'WR', 'RB', 'TE', 'K'],
        topPlayersLimit: 500
      });
      
      console.log('✅ Sleeper sync response:', response.data);

      // Check if sync was successful
      if (response.data.success) {
        // Refresh all data after successful sync
        await Promise.all([
          fetchPlayers(),
          fetchStats()
        ]);
        
        const data = response.data.data;
        alert(`Sleeper sync completed successfully!\n\nNew: ${data.newCount}\nUpdated: ${data.updatedCount}\nSkipped: ${data.skippedCount}\nTotal: ${data.total}`);
      } else {
        throw new Error(response.data.message || 'Sync failed');
      }
      
    } catch (error: any) {
      console.error('❌ Sleeper sync failed:', error);
      
      let errorMessage = 'Sleeper sync failed';
      
      if (error.response?.data?.details) {
        errorMessage = `Sleeper sync failed: ${error.response.data.details}`;
      } else if (error.response?.data?.error) {
        errorMessage = `Sleeper sync failed: ${error.response.data.error}`;
      } else if (error.message) {
        errorMessage = `Sleeper sync failed: ${error.message}`;
      }
      
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPlayers, fetchStats]);

  // Handle export
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

  // Filter players based on search and filters - with null safety and debugging
  const filteredPlayers = useMemo(() => {
    if (!Array.isArray(players)) {
      console.log('⚠️ Players is not an array:', players);
      return [];
    }
    
    console.log(`🔍 Filtering ${players.length} players with filters:`, filters);
    
    const filtered = players.filter(player => {
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
    
    console.log(`✅ Filtered result: ${filtered.length} players`);
    return filtered;
  }, [players, filters.searchTerm]);

  // Update displayed players when filters change or page changes
  useEffect(() => {
    const endIndex = currentPage * PLAYERS_PER_PAGE;
    setDisplayedPlayers(filteredPlayers.slice(0, endIndex));
  }, [filteredPlayers, currentPage, PLAYERS_PER_PAGE]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Get unique values for filter dropdowns - with null safety
  const positions = useMemo(() => {
    if (!Array.isArray(players)) return [];
    return [...new Set(players.map(p => p.position))].sort();
  }, [players]);
  
  const teams = useMemo(() => {
    if (!Array.isArray(players)) return [];
    return [...new Set(players.map(p => p.team).filter(Boolean))].sort() as string[];
  }, [players]);
  
  const dataSources = useMemo(() => {
    if (!Array.isArray(players)) return [];
    return [...new Set(players.map(p => p.dataSource))].sort();
  }, [players]);

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
      {/* Header with Stats - Fixed to handle actual stats structure */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPlayers || 0}</div>
            <div className="text-sm text-gray-600">Total Players</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {players.filter(p => p.dataSource === 'sleeper').length}
            </div>
            <div className="text-sm text-gray-600">From Sleeper</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {players.filter(p => p.dataSource === 'excel').length}
            </div>
            <div className="text-sm text-gray-600">From Excel</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.draftedPlayers || 0}</div>
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
        <div className="bg-red-100 text-red-700 p-4 rounded-lg border border-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search players..."
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
            className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />

          {/* Position Filter */}
          <select
            value={filters.position}
            onChange={(e) => setFilters(prev => ({ ...prev, position: e.target.value }))}
            className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          {/* Team Filter */}
          <select
            value={filters.team}
            onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
            className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team || ''}>{team || 'No Team'}</option>
            ))}
          </select>

          {/* Data Source Filter */}
          <select
            value={filters.dataSource}
            onChange={(e) => setFilters(prev => ({ ...prev, dataSource: e.target.value }))}
            className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            {dataSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        {/* Additional Filters */}
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.includeDrafted}
              onChange={(e) => setFilters(prev => ({ ...prev, includeDrafted: e.target.checked }))}
              className="mr-2 h-4 w-4 text-blue-600 rounded"
            />
            Include Drafted Players
          </label>
        </div>
      </div>

      {/* Player Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading players...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
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
                    Proj Points
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VORP
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
        )}

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