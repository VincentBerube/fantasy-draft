// frontend/fantasy-draft-frontend/src/components/PlayerList/PlayerRow.tsx
import { useState, memo, useCallback } from 'react';
import type { Player, Tier } from '../../api/playerApi';

interface PlayerRowProps {
  player: Player;
  tiers: Tier[];
  onToggleDrafted: (id: string, isDrafted: boolean) => void;
  onAssignTier: (id: string, tierId: string | null) => void;
  onEditCell: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onShowDetail: (id: string) => void;
  onShowNotes: (id: string) => void;
  isPending?: boolean; // Show loading state for pending updates
}

// PERFORMANCE: Memoize PlayerRow to prevent unnecessary re-renders
export const PlayerRow = memo(function PlayerRow({
  player,
  tiers,
  onToggleDrafted,
  onAssignTier,
  onEditCell,
  onDelete,
  onShowDetail,
  onShowNotes,
  isPending = false
}: PlayerRowProps) {
  const [editingCell, setEditingCell] = useState<{ field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellEdit = useCallback((field: string, value: any) => {
    const newValue = typeof value === 'number' ? 
      parseFloat(editValue) || 0 : editValue;
    onEditCell(player.id, field, newValue);
    setEditingCell(null);
    setEditValue('');
  }, [editValue, onEditCell, player.id]);

  const handleStartEdit = useCallback((field: string, currentValue: any) => {
    setEditingCell({ field });
    setEditValue(currentValue?.toString() || '');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, field: string, value: any) => {
    if (e.key === 'Enter') {
      handleCellEdit(field, value);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  }, [handleCellEdit]);

  const renderEditableCell = useCallback((field: string, value: any, isNumeric: boolean = false) => {
    const isEditing = editingCell?.field === field;
    
    if (isEditing) {
      return (
        <input
          type={isNumeric ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleCellEdit(field, value)}
          onKeyDown={(e) => handleKeyDown(e, field, value)}
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
          autoFocus
          step={isNumeric ? "0.1" : undefined}
        />
      );
    }
    
    return (
      <span
        onClick={() => handleStartEdit(field, value)}
        className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block transition-colors ${
          isPending ? 'opacity-50' : ''
        }`}
        title="Click to edit"
      >
        {isNumeric && value !== null && value !== undefined ? 
          Number(value).toFixed(1) : 
          (value || '-')
        }
      </span>
    );
  }, [editingCell, editValue, handleCellEdit, handleKeyDown, handleStartEdit, isPending]);

  // Memoize tier options to prevent recreation on every render
  const tierOptions = tiers.map(tier => (
    <option key={tier.id} value={tier.id}>
      {tier.name}
    </option>
  ));

  // Data source indicator
  const getDataSourceColor = (dataSource: string) => {
    switch (dataSource) {
      case 'sleeper': return 'bg-green-100 text-green-800';
      case 'excel': return 'bg-blue-100 text-blue-800';
      case 'manual': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${
      player.isDrafted ? 
        'bg-red-50 opacity-60' : 
        ''
    } ${isPending ? 'bg-yellow-50' : ''}`}>
      
      {/* Draft Status Checkbox */}
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={player.isDrafted}
          onChange={(e) => onToggleDrafted(player.id, e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={isPending}
        />
      </td>

      {/* Rank - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
        {renderEditableCell('rank', player.rank, true)}
      </td>

      {/* Custom Rank - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
        {renderEditableCell('customRank', player.customRank, true)}
      </td>

      {/* Player Name */}
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {player.name}
            </div>
            <div className="flex items-center space-x-1 mt-1">
              {/* Data source indicator */}
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                getDataSourceColor(player.dataSource || 'manual')
              }`}>
                {player.dataSource === 'sleeper' ? '🏈' : 
                 player.dataSource === 'excel' ? '📊' : '✏️'}
                {player.dataSource || 'manual'}
              </span>
              
              {/* Sleeper ID indicator */}
              {player.sleeperId && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Sleeper
                </span>
              )}
              
              {/* Last sync indicator */}
              {player.lastSyncAt && (
                <span className="text-xs text-gray-500" title={`Last synced: ${new Date(player.lastSyncAt).toLocaleDateString()}`}>
                  📅
                </span>
              )}
            </div>
          </div>
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

      {/* Team - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('team', player.team)}
      </td>

      {/* Bye Week - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('byeWeek', player.byeWeek, true)}
      </td>

      {/* Projected Points - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('projectedPoints', player.projectedPoints, true)}
      </td>

      {/* VORP - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('vorp', player.vorp, true)}
      </td>

      {/* ADP - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('adp', player.adp, true)}
      </td>

      {/* Tier dropdown */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        <select
          value={player.tierId || ''}
          onChange={(e) => onAssignTier(player.id, e.target.value || null)}
          className="text-xs border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          disabled={isPending}
        >
          <option value="">No Tier</option>
          {tierOptions}
        </select>
      </td>

      {/* Tags */}
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {player.playerTags && player.playerTags.map(pt => (
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

      {/* Notes */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        <button
          onClick={() => onShowNotes(player.id)}
          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
          title={player.notes && player.notes.length > 0 ? `${player.notes.length} note(s)` : 'Add notes'}
          disabled={isPending}
        >
          {player.notes && player.notes.length > 0 ? 
            `📝 ${player.notes.length}` : 
            '📝 Add'
          }
        </button>
      </td>

      {/* Actions */}
      <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex space-x-2">
          <button
            onClick={() => onShowDetail(player.id)}
            className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
            title="View details"
            disabled={isPending}
          >
            👁️
          </button>
          <button
            onClick={() => onDelete(player.id)}
            className="text-red-600 hover:text-red-900 disabled:opacity-50"
            title={player.sleeperId ? "Cannot delete Sleeper players" : "Delete player"}
            disabled={isPending || !!player.sleeperId}
          >
            {player.sleeperId ? '🔒' : '🗑️'}
          </button>
        </div>
      </td>
    </tr>
  );
});