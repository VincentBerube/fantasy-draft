// src/components/PlayerList/PlayerTable.tsx
import type { Player, Tier } from '../../api/playerApi';
import { PlayerRow } from './PlayerRow';

interface PlayerTableProps {
  tierInfo: Tier | null;
  players: Player[];
  tiers: Tier[];
  onToggleDrafted: (id: string, isDrafted: boolean) => void;
  onAssignTier: (id: string, tierId: string | null) => void;
  onEditCell: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onShowDetail: (id: string) => void;
  onShowNotes: (id: string) => void;
}

export function PlayerTable({
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
            {players.map((player) => (
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
          </tbody>
        </table>
      </div>
    </div>
  );
}