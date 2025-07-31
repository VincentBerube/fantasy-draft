// frontend/src/components/PlayerList.tsx
import { useState, useEffect } from 'react';
import { playerApi, type Player, type Tag, type Tier } from '../api/playerApi';
import { PlayerDetail } from './PlayerDetail';
import { TagManager } from './TagManager';
import { TierManager } from './TierManager';
import { NoteManager } from './NoteManager';

export function PlayerList() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingCell, setEditingCell] = useState<{playerId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // UI state
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);
  const [showNoteManager, setShowNoteManager] = useState<string | null>(null);
  
  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'projectedPoints' | 'vorp' | 'customRank'>('customRank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hideDrafted, setHideDrafted] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPlayers(),
      fetchTags(),
      fetchTiers()
    ]);
  }, [hideDrafted]);

  useEffect(() => {
    filterAndSortPlayers();
  }, [players, positionFilter, teamFilter, tierFilter, tagFilter, searchTerm, sortBy, sortOrder]);

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

  const filterAndSortPlayers = () => {
    let filtered = [...players];

    // Apply filters
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(player => player.position === positionFilter);
    }

    if (teamFilter !== 'ALL') {
      filtered = filtered.filter(player => player.team === teamFilter);
    }

    if (tierFilter !== 'ALL') {
      filtered = filtered.filter(player => player.tier === tierFilter);
    }

    if (tagFilter !== 'ALL') {
      filtered = filtered.filter(player => 
        player.playerTags.some(pt => pt.tag.id === tagFilter)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(term) ||
        player.position.toLowerCase().includes(term) ||
        player.team?.toLowerCase().includes(term) ||
        player.aliases.some(alias => alias.toLowerCase().includes(term))
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
        case 'customRank':
          aVal = a.customRank || a.rank || 999;
          bVal = b.customRank || b.rank || 999;
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

  const handleCellEdit = async (playerId: string, field: string, value: any) => {
    try {
      const updateData: any = {};
      updateData[field] = value;
      
      await playerApi.updatePlayer(playerId, updateData);
      
      // Update local state
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, [field]: value } : p
      ));
      
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update player:', error);
      setError('Failed to update player');
    }
  };

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
      await playerApi.toggleDraftStatus(playerId, isDrafted);
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, isDrafted } : p
      ));
    } catch (error) {
      console.error('Failed to update draft status:', error);
      setError('Failed to update draft status');
    }
  };

  const handleAssignTier = async (playerId: string, tierId: string | null) => {
    try {
      await playerApi.assignPlayerToTier(playerId, tierId);
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, tier: tierId } : p
      ));
    } catch (error) {
      console.error('Failed to assign tier:', error);
      setError('Failed to assign tier');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    try {
      console.log('Starting export process');
      const response = await playerApi.exportPlayers();
      console.log('Received export response');
      
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

  const renderEditableCell = (player: Player, field: string, value: any) => {
    const isEditing = editingCell?.playerId === player.id && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const newValue = typeof value === 'number' ? 
              parseFloat(editValue) || 0 : editValue;
            handleCellEdit(player.id, field, newValue);
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              const newValue = typeof value === 'number' ? 
                parseFloat(editValue) || 0 : editValue;
              handleCellEdit(player.id, field, newValue);
            }
          }}
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      );
    }
    
    return (
      <span
        onClick={() => {
          setEditingCell({ playerId: player.id, field });
          setEditValue(value?.toString() || '');
        }}
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block"
        title="Click to edit"
      >
        {value || '-'}
      </span>
    );
  };

  const getTierInfo = (tierId: string | undefined) => {
    if (!tierId) return null;
    return tiers.find(t => t.id === tierId);
  };

  const groupPlayersByTier = () => {
    const grouped = new Map<string, Player[]>();
    
    // Group players by tier
    filteredPlayers.forEach(player => {
      const tierKey = player.tier || 'no-tier';
      if (!grouped.has(tierKey)) {
        grouped.set(tierKey, []);
      }
      grouped.get(tierKey)!.push(player);
    });
    
    // Sort tiers by order
    const sortedGroups = Array.from(grouped.entries()).sort(([aTier], [bTier]) => {
      if (aTier === 'no-tier') return 1; // No tier goes last
      if (bTier === 'no-tier') return -1;
      
      const tierA = tiers.find(t => t.id === aTier);
      const tierB = tiers.find(t => t.id === bTier);
      
      return (tierA?.order || 999) - (tierB?.order || 999);
    });
    
    return sortedGroups;
  };

  // Get unique values for filter dropdowns
  const positions = [...new Set(players.map(p => p.position))].sort();
  const teams = [...new Set(players.map(p => p.team).filter(Boolean))].sort();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tierGroups = groupPlayersByTier();

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center mb-6 border border-red-200">
          {error}
        </div>
      )}
      
      {/* Header with Controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Player Database ({filteredPlayers.length} players)
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTagManager(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
            disabled={isExporting || players.length === 0}
            className={`flex items-center px-6 py-2 rounded-lg font-medium transition-all ${
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
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
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

          {/* Tier Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Tiers</option>
              {tiers.map(tier => (
                <option key={tier.id} value={tier.id}>{tier.name}</option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Tags</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
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
              <option value="customRank-asc">Custom Rank (Low to High)</option>
              <option value="customRank-desc">Custom Rank (High to Low)</option>
              <option value="rank-asc">Original Rank (Low to High)</option>
              <option value="rank-desc">Original Rank (High to Low)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="projectedPoints-desc">Projected Points (High to Low)</option>
              <option value="projectedPoints-asc">Projected Points (Low to High)</option>
              <option value="vorp-desc">VORP (High to Low)</option>
              <option value="vorp-asc">VORP (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Additional Controls */}
        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={hideDrafted}
              onChange={(e) => setHideDrafted(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Hide drafted players</span>
          </label>
          
          <div className="text-sm text-gray-600">
            {players.filter(p => p.isDrafted).length} players drafted
          </div>
        </div>
      </div>

      {/* Player Tables Grouped by Tier */}
      <div className="space-y-8">
        {tierGroups.map(([tierKey, tierPlayers]) => {
          const tierInfo = tierKey === 'no-tier' ? null : getTierInfo(tierKey);
          
          return (
            <div key={tierKey} className="bg-white rounded-lg shadow-md overflow-hidden border">
              {/* Tier Header */}
              <div 
                className="px-6 py-4 border-b"
                style={{ 
                  backgroundColor: tierInfo?.color + '20' || '#F3F4F6',
                  borderLeftColor: tierInfo?.color || '#6B7280',
                  borderLeftWidth: '4px'
                }}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  {tierInfo ? tierInfo.name : 'Unassigned Players'} 
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    ({tierPlayers.length} players)
                  </span>
                </h3>
              </div>

              {/* Player Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Drafted
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bye
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proj. Points
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
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tierPlayers.map((player, index) => (
                      <tr 
                        key={player.id} 
                        className={`hover:bg-gray-50 transition-colors ${
                          player.isDrafted ? 'bg-gray-100 opacity-75' : ''
                        }`}
                      >
                        {/* Drafted Checkbox */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={player.isDrafted}
                            onChange={(e) => handleToggleDrafted(player.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>

                        {/* Rank (Editable) */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-bold text-gray-900">
                              {renderEditableCell(player, 'customRank', player.customRank || player.rank)}
                            </div>
                            {player.positionalRank && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {player.positionalRank}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Player Name (Clickable) */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div
                            onClick={() => setSelectedPlayerId(player.id)}
                            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                          >
                            {player.name}
                            {player.aliases.length > 0 && (
                              <span className="text-xs text-gray-400 block">
                                Also: {player.aliases.join(', ')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-3 py-4 whitespace-nowrap">
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

                        {/* Team (Editable) */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderEditableCell(player, 'team', player.team)}
                        </td>

                        {/* Bye Week (Editable) */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderEditableCell(player, 'byeWeek', player.byeWeek)}
                        </td>

                        {/* Projected Points (Editable) */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderEditableCell(player, 'projectedPoints', player.projectedPoints)}
                        </td>

                        {/* VORP (Editable) */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderEditableCell(player, 'vorp', player.vorp)}
                        </td>

                        {/* Tier Selector */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <select
                            value={player.tier || ''}
                            onChange={(e) => handleAssignTier(player.id, e.target.value || null)}
                            className="text-xs p-1 border rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">No Tier</option>
                            {tiers.map(tier => (
                              <option key={tier.id} value={tier.id}>{tier.name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Tags */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
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
                        </td>

                        {/* Notes */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setShowNoteManager(player.id)}
                            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
                              player.notes.length > 0 
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>{player.notes.length}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="text-red-600 hover:text-red-900 ml-2"
                            title="Delete player"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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