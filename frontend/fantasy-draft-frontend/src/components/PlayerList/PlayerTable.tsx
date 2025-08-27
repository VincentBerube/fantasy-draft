// frontend/fantasy-draft-frontend/src/components/PlayerList/PlayerTable.tsx
import { memo, useMemo, useState } from 'react';
import type { Player, Tier, Tag } from '../../api/playerApi';
import { PlayerRow } from './PlayerRow';

interface PlayerTableProps {
  tierInfo?: Tier | null;
  players: Player[];
  tiers: Tier[];
  tags: Tag[]; // Add tags prop
  onToggleDrafted: (id: string, isDrafted: boolean) => void;
  onAssignTier: (id: string, tierId: string | null) => void;
  onCellEdit: (id: string, field: string, value: any) => void;
  onDeletePlayer: (id: string) => void;
  onPlayerClick: (id: string) => void;
  onShowNotes: (id: string) => void;
  getTierInfo: (tierId: string | null) => Tier | null;
  pendingUpdates: Set<string>;
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
  tags,
  onToggleDrafted,
  onAssignTier,
  onCellEdit,
  onDeletePlayer,
  onPlayerClick,
  onShowNotes,
  getTierInfo,
  pendingUpdates
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
          {tierInfo ? `${tierInfo.name} (${players.length} players)` : `All Players (${players.length})`}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">Draft</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Pos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Team</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Rank</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Proj</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Depth</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Tier</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Tags</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Notes</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visiblePlayers.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                tiers={tiers}
                onToggleDrafted={onToggleDrafted}
                onAssignTier={onAssignTier}
                onEditCell={onCellEdit}
                onDelete={onDeletePlayer}
                onShowDetail={onPlayerClick}
                onShowNotes={onShowNotes}
                isPending={pendingUpdates.has(player.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMorePlayers && (
        <div className="p-4 text-center border-t bg-gray-50">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load More ({remainingPlayers} remaining)
          </button>
        </div>
      )}
    </div>
  );
});