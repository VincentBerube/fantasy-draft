// src/components/PlayerList/PlayerTable.tsx
import { memo, useMemo } from 'react';
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
  // Memoize chunked players to prevent recreation on every render
  const chunkedPlayers = useMemo(() => {
    const CHUNK_SIZE = 50; // Only render 50 players per tier at a time
    const chunks = [];
    for (let i = 0; i < players.length; i += CHUNK_SIZE) {
      chunks.push(players.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [players]);

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
            {/* PERFORMANCE: Only render first chunk initially, load more on scroll */}
            {chunkedPlayers[0]?.map((player) => (
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
            {chunkedPlayers.length > 1 && (
              <tr>
                <td colSpan={12} className="px-6 py-4 text-center">
                  <button
                    onClick={() => {
                      // TODO: Implement load more functionality
                      console.log('Load more players...');
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Load {Math.min(50, players.length - 50)} more players...
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