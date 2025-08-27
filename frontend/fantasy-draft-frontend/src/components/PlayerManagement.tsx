// frontend/fantasy-draft-frontend/src/components/PlayerManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ImportControlToggle } from './ImportControlToggle';
import { playerApi, type Player } from '../api/playerApi';

interface PlayerFilters {
  position?: string;
  team?: string;
  isDrafted?: boolean;
  dataSource?: 'sleeper' | 'excel' | 'manual';
  search?: string;
}

export const PlayerManagement: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlayerFilters>({});
  const [showImport, setShowImport] = useState(false);

  // Fetch players with current filters
  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await playerApi.getPlayers(filters);
      setPlayers(response.data.data || []);
    } catch (err: any) {
      setError('Failed to load players: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Load players on component mount and when filters change
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Handle import completion
  const handleImportComplete = useCallback(() => {
    fetchPlayers(); // Refresh the player list
    setShowImport(false); // Optionally close import modal
  }, [fetchPlayers]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof PlayerFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined // Remove empty string filters
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Get filter summary for display
  const getFilterSummary = () => {
    const activeFilters = Object.entries(filters).filter(([, value]) => 
      value !== undefined && value !== ''
    );
    return activeFilters.length;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">🏈 Player Management</h1>
            <p className="text-blue-100">
              Manage your fantasy football player database with powerful import and sync tools
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{players.length}</div>
            <div className="text-blue-100 text-sm">Total Players</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowImport(!showImport)}
              className={`px-4 py-2 rounded font-medium transition-all ${
                showImport 
                  ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
            >
              {showImport ? '✕ Close Import' : '📤 Import Players'}
            </button>
            
            <button
              onClick={fetchPlayers}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoading ? '🔄' : '↻'} Refresh
            </button>

            {getFilterSummary() > 0 && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Clear Filters ({getFilterSummary()})
              </button>
            )}
          </div>

          <div className="text-sm text-gray-600">
            {isLoading ? 'Loading...' : `Showing ${players.length} players`}
            {getFilterSummary() > 0 && ' (filtered)'}
          </div>
        </div>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="bg-white rounded-lg border p-6">
          <div className="border-b pb-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Import Player Data</h2>
            <p className="text-gray-600 text-sm mt-1">
              Choose between Smart Import for quick uploads or Advanced Control for detailed management
            </p>
          </div>
          
          <ImportControlToggle onImportComplete={handleImportComplete} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-medium mb-3">🔍 Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Player name..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <select
              value={filters.position || ''}
              onChange={(e) => handleFilterChange('position', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="K">K</option>
              <option value="DEF">DEF</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
            <select
              value={filters.team || ''}
              onChange={(e) => handleFilterChange('team', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">All Teams</option>
              <option value="ARI">Arizona</option>
              <option value="ATL">Atlanta</option>
              <option value="BAL">Baltimore</option>
              <option value="BUF">Buffalo</option>
              <option value="CAR">Carolina</option>
              <option value="CHI">Chicago</option>
              <option value="CIN">Cincinnati</option>
              <option value="CLE">Cleveland</option>
              <option value="DAL">Dallas</option>
              <option value="DEN">Denver</option>
              <option value="DET">Detroit</option>
              <option value="GB">Green Bay</option>
              <option value="HOU">Houston</option>
              <option value="IND">Indianapolis</option>
              <option value="JAX">Jacksonville</option>
              <option value="KC">Kansas City</option>
              <option value="LV">Las Vegas</option>
              <option value="LAC">LA Chargers</option>
              <option value="LAR">LA Rams</option>
              <option value="MIA">Miami</option>
              <option value="MIN">Minnesota</option>
              <option value="NE">New England</option>
              <option value="NO">New Orleans</option>
              <option value="NYG">NY Giants</option>
              <option value="NYJ">NY Jets</option>
              <option value="PHI">Philadelphia</option>
              <option value="PIT">Pittsburgh</option>
              <option value="SF">San Francisco</option>
              <option value="SEA">Seattle</option>
              <option value="TB">Tampa Bay</option>
              <option value="TEN">Tennessee</option>
              <option value="WAS">Washington</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Draft Status</label>
            <select
              value={filters.isDrafted !== undefined ? filters.isDrafted.toString() : ''}
              onChange={(e) => handleFilterChange('isDrafted', 
                e.target.value === '' ? undefined : e.target.value === 'true'
              )}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">All Players</option>
              <option value="false">Available</option>
              <option value="true">Drafted</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
            <select
              value={filters.dataSource || ''}
              onChange={(e) => handleFilterChange('dataSource', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">All Sources</option>
              <option value="sleeper">Sleeper</option>
              <option value="excel">Excel Import</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Players Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-800">Player List</h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">🔄 Loading players...</div>
          </div>
        ) : players.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-2">No players found</div>
            <div className="text-sm text-gray-400">
              {getFilterSummary() > 0 ? 'Try adjusting your filters' : 'Import some players to get started'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proj. Points
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ADP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {players.map((player) => (
                  <tr key={player.id} className={player.isDrafted ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {player.name}
                          </div>
                          {player.aliases && player.aliases.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Aliases: {player.aliases.slice(0, 2).join(', ')}
                              {player.aliases.length > 2 && ` +${player.aliases.length - 2} more`}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        player.position === 'QB' ? 'bg-red-100 text-red-800' :
                        player.position === 'RB' ? 'bg-green-100 text-green-800' :
                        player.position === 'WR' ? 'bg-blue-100 text-blue-800' :
                        player.position === 'TE' ? 'bg-purple-100 text-purple-800' :
                        player.position === 'K' ? 'bg-yellow-100 text-yellow-800' :
                        player.position === 'DEF' ? 'bg-gray-100 text-gray-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {player.position}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.team || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {player.rank && (
                          <div>Overall: #{player.rank}</div>
                        )}
                        {player.customRank && (
                          <div className="text-xs text-blue-600">Custom: #{player.customRank}</div>
                        )}
                        {!player.rank && !player.customRank && '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.projectedPoints ? player.projectedPoints.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.adp ? player.adp.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        player.isDrafted 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {player.isDrafted ? 'Drafted' : 'Available'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          player.dataSource === 'sleeper' ? 'bg-blue-100 text-blue-800' :
                          player.dataSource === 'excel' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {player.dataSource === 'sleeper' ? '🏈 Sleeper' :
                           player.dataSource === 'excel' ? '📊 Excel' : '✏️ Manual'}
                        </span>
                        {player.sleeperId && (
                          <span className="text-xs text-gray-500" title="Has Sleeper ID">⚡</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {players.filter(p => !p.isDrafted).length}
          </div>
          <div className="text-sm text-gray-600">Available</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {players.filter(p => p.isDrafted).length}
          </div>
          <div className="text-sm text-gray-600">Drafted</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {players.filter(p => p.dataSource === 'excel').length}
          </div>
          <div className="text-sm text-gray-600">Excel Imports</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {players.filter(p => p.sleeperId).length}
          </div>
          <div className="text-sm text-gray-600">Sleeper Synced</div>
        </div>
      </div>

      {/* Footer Help */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <div className="flex items-start space-x-2">
          <div className="text-blue-500 mt-0.5">💡</div>
          <div>
            <div className="font-medium text-blue-900 mb-1">Quick Start Guide:</div>
            <div className="text-blue-800 space-y-1">
              <div>1. Click "Import Players" to upload Excel files or CSV data</div>
              <div>2. Use Smart Import for automatic processing or Advanced Control for detailed management</div>
              <div>3. Filter and search your player database using the controls above</div>
              <div>4. All imports can be rolled back in Advanced mode if you need to undo changes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};