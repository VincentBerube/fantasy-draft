// frontend/fantasy-draft-frontend/src/components/PlayerList/PlayerTable.tsx
import { memo, useMemo, useState } from 'react';
import type { Player, Tier } from '../../api/playerApi';
import { PlayerRow } from './PlayerRow';

interface PlayerTableProps {
  tierInfo: Tier | null | undefined;
  players: Player[];
  tiers: Tier[];
  onToggleDrafted: (id: string, isDrafted: boolean) => void;
  onAssignTier: (id: string, tierId: string | null) => void;
  onEditCell: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onShowDetail: (id: string) => void;
  onShowNotes: (id: string) => void;
}

// Helper function to format depth chart information
const formatDepthChart = (depthChartPosition?: string, depthChartOrder?: number) => {
  if (!depthChartPosition) return '';
  
  // Map Sleeper's depth chart positions to more readable formats
  const positionMap: Record<string, string> = {
    'QB': 'QB',
    'RB': 'RB', 
    '3RB': '3rd Down RB',
    'WR': 'WR',
    'SWR': 'Slot WR',
    'TE': 'TE',
    'K': 'K',
    'DEF': 'DEF'
  };
  
  const basePosition = positionMap[depthChartPosition] || depthChartPosition;
  
  // Add order number if available (WR1, WR2, etc.)
  if (depthChartOrder && depthChartOrder > 1) {
    return `${basePosition} ${depthChartOrder}`;
  }
  
  return basePosition;
};

// Helper function to get depth chart color based on position and order
const getDepthChartColor = (depthChartPosition?: string, depthChartOrder?: number) => {
  if (!depthChartPosition) return 'text-gray-400';
  
  // Special highlighting for valuable fantasy positions
  if (depthChartPosition === 'SWR') return 'text-purple-600 font-semibold'; // Slot receivers are gold!
  if (depthChartPosition === '3RB') return 'text-blue-600 font-semibold'; // 3rd down backs get targets
  
  // Color based on depth chart order
  if (!depthChartOrder || depthChartOrder === 1) {
    return 'text-green-600 font-semibold'; // Starter
  } else if (depthChartOrder === 2) {
    return 'text-yellow-600'; // Backup  
  } else if (depthChartOrder === 3) {
    return 'text-orange-600'; // 3rd string
  } else {
    return 'text-red-600'; // Deep backup
  }
};

// PERFORMANCE: Memoize the table to prevent unnecessary re-renders
export const PlayerTable = memo(function PlayerTable({
  tierInfo,
  players,
  tiers,
  onToggleDrafted,
  onAssignTier,
  onEditCell,
  onDelete,
  onShowDetail,
  onShowNotes
}: PlayerTableProps) {
  const CHUNK_SIZE = 50;
  const [visibleChunks, setVisibleChunks] = useState(1); // Start by showing 1 chunk

  // Memoize chunked players to prevent recreation on every render
  const chunkedPlayers = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < players.length; i += CHUNK_SIZE) {
      chunks.push(players.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [players]);

  // Get currently visible players
  const visiblePlayers = useMemo(() => {
    return chunkedPlayers
      .slice(0, visibleChunks)
      .flat();
  }, [chunkedPlayers, visibleChunks]);

  const handleLoadMore = () => {
    setVisibleChunks(prev => Math.min(prev + 1, chunkedPlayers.length));
  };

  const remainingPlayers = players.length - visiblePlayers.length;
  const hasMorePlayers = visibleChunks < chunkedPlayers.length;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border">
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
            ({players.length} players)
            {hasMorePlayers && (
              <span className="text-blue-600"> - Showing {visiblePlayers.length}</span>
            )}
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
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
                Depth Chart
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
            {/* Render visible players */}
            {visiblePlayers.map((player) => (
              <tr
                key={player.id}
                className={`hover:bg-gray-50 ${player.isDrafted ? 'bg-gray-100 opacity-60' : ''}`}
              >
                {/* Existing columns... */}
                <td className="px-3 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onToggleDrafted(player.id, !player.isDrafted)}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      player.isDrafted 
                        ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {player.isDrafted ? '✓ Drafted' : 'Available'}
                  </button>
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.customRank || player.rank || '-'}
                </td>

                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{player.name}</div>
                </td>

                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
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

                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.team || '-'}
                </td>

                {/* NEW: Depth Chart Column */}
                <td className="px-3 py-4 whitespace-nowrap text-sm">
                  {player.depthChartPosition ? (
                    <span 
                      className={`text-xs ${getDepthChartColor(player.depthChartPosition, player.depthChartOrder)}`}
                      title={`Depth Chart: ${player.depthChartPosition}${player.depthChartOrder ? ` #${player.depthChartOrder}` : ''}`}
                    >
                      {formatDepthChart(player.depthChartPosition, player.depthChartOrder)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                  {player.byeWeek || '-'}
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.projectedPoints ? player.projectedPoints.toFixed(1) : '-'}
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.vorp ? player.vorp.toFixed(1) : '-'}
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm">
                  <select
                    value={player.tierId || ''}
                    onChange={(e) => onAssignTier(player.id, e.target.value || null)}
                    className="text-xs border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Tier</option>
                    {tiers.map(tier => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-3 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {player.playerTags.map(pt => (
                      <span
                        key={pt.tag.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: pt.tag.color + '20',
                          color: pt.tag.color,
                          borderColor: pt.tag.color,
                          borderWidth: '1px'
                        }}
                      >
                        {pt.tag.name}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => onShowNotes(player.id)}
                    className="text-blue-600 hover:text-blue-900"
                    title={player.notes.length > 0 ? `${player.notes.length} note(s)` : 'Add notes'}
                  >
                    {player.notes.length > 0 ? 
                      `📝 ${player.notes.length}` : 
                      '📝 Add'
                    }
                  </button>
                </td>

                <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onShowDetail(player.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="View details"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => onDelete(player.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete player"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMorePlayers && (
        <div className="px-6 py-4 bg-gray-50 border-t text-center">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load More ({remainingPlayers} remaining)
          </button>
        </div>
      )}
    </div>
  );
});