// src/components/PlayerList/PlayerTable.tsx
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
              <PlayerRow
                key={player.id}
                player={player}
                tiers={tiers}
                onToggleDrafted={onToggleDrafted}
                onAssignTier={onAssignTier}
                onEditCell={onEditCell}
                onDelete={onDelete}
                onShowDetail={onShowDetail}
                onShowNotes={onShowNotes}
              />
            ))}
            
            {/* Load more button */}
            {hasMorePlayers && (
              <tr>
                <td colSpan={12} className="px-6 py-6 text-center bg-gray-50">
                  <button
                    onClick={handleLoadMore}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Load {Math.min(CHUNK_SIZE, remainingPlayers)} more players
                    <span className="ml-2 text-xs text-gray-500">
                      ({remainingPlayers} remaining)
                    </span>
                  </button>
                </td>
              </tr>
            )}

            {/* Show all button for convenience */}
            {hasMorePlayers && chunkedPlayers.length > 2 && (
              <tr>
                <td colSpan={12} className="px-6 py-2 text-center">
                  <button
                    onClick={() => setVisibleChunks(chunkedPlayers.length)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Show all {players.length} players
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});