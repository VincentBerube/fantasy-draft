// frontend/src/components/PlayerList.tsx
import { useState, useEffect } from 'react';
import { playerApi } from '../api/playerApi';
import { PlayerDetail } from './PlayerDetail';

interface Player {
  id: string;
  name: string;
  position: string;
  team?: string;
  rank?: number;
  positionalRank?: string;
  projectedPoints?: number;
  vorp?: number;
  adp?: number;
  byeWeek?: number;
  userNotes: string[];
  customTags: string[];
}

export function PlayerList() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'projectedPoints' | 'vorp'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    filterAndSortPlayers();
  }, [players, positionFilter, teamFilter, searchTerm, sortBy, sortOrder]);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      const response = await playerApi.getPlayers();
      setPlayers(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load players');
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortPlayers = () => {
    let filtered = [...players];

    // Apply filters
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(player => player.position === positionFilter);
    }

    if (teamFilter !== 'ALL') {
      filtered = filtered.filter(player => player.team === teamFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(term) ||
        player.position.toLowerCase().includes(term) ||
        player.team?.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'projectedPoints':
          aVal = a.projectedPoints || 0;
          bVal = b.projectedPoints || 0;
          break;
        case 'vorp':
          aVal = a.vorp || 0;
          bVal = b.vorp || 0;
          break;
        case 'rank':
        default:
          aVal = a.rank || 999;
          bVal = b.rank || 999;
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    setFilteredPlayers(filtered);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    try {
      console.log('Starting export process');
      const response = await playerApi.exportPlayers();
      console.log('Received export response');
      
      // Create a Blob from the response data
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `fantasy_players_${timestamp}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        console.log('Export completed successfully');
      }, 100);
    } catch (error: any) {
      console.error('Export failed:', error);
      let errorMessage = 'Export failed';
      
      if (error.response?.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorText = reader.result as string;
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.message || 'Export failed';
            if (errorJson.details) errorMessage += `: ${errorJson.details}`;
          } catch (e) {
            errorMessage = 'Server error occurred';
          }
          setError(errorMessage);
        };
        reader.readAsText(error.response.data);
        return;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Get unique positions and teams for filter dropdowns
  const positions = [...new Set(players.map(p => p.position))].sort();
  const teams = [...new Set(players.map(p => p.team).filter(Boolean))].sort();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center mb-6 border border-red-200">
          {error}
        </div>
      )}
      
      {/* Header with Export Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Player Database ({filteredPlayers.length} players)
        </h2>
        <button
          onClick={handleExport}
          disabled={isExporting || players.length === 0}
          className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
            isExporting || players.length === 0
              ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
              : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
            <input
              type="text"
              placeholder="Search by name, position, or team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Position Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Positions</option>
              {positions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Teams</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as typeof sortBy);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="rank-asc">Rank (Low to High)</option>
              <option value="rank-desc">Rank (High to Low)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="projectedPoints-desc">Projected Points (High to Low)</option>
              <option value="projectedPoints-asc">Projected Points (Low to High)</option>
              <option value="vorp-desc">VORP (High to Low)</option>
              <option value="vorp-asc">VORP (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Player Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bye
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proj. Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VORP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes/Tags
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlayers.map((player, index) => (
                <tr 
                  key={player.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-bold text-gray-900">
                        {player.rank || '-'}
                      </span>
                      {player.positionalRank && (
                        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {player.positionalRank}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      player.position === 'QB' ? 'bg-red-100 text-red-800' :
                      player.position === 'RB' ? 'bg-green-100 text-green-800' :
                      player.position === 'WR' ? 'bg-blue-100 text-blue-800' :
                      player.position === 'TE' ? 'bg-purple-100 text-purple-800' :
                      player.position === 'K' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {player.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.team || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.byeWeek || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.projectedPoints ? player.projectedPoints.toFixed(1) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {player.vorp ? player.vorp.toFixed(1) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {player.userNotes.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          📝 {player.userNotes.length}
                        </span>
                      )}
                      {player.customTags.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          🏷️ {player.customTags.length}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredPlayers.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            {players.length === 0 ? (
              <div>
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-medium mb-2">No players found</h3>
                <p>Import an Excel file to get started with your fantasy draft analysis.</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-medium mb-2">No players match your filters</h3>
                <p>Try adjusting your search terms or filters.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedPlayerId && (
        <PlayerDetail
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}