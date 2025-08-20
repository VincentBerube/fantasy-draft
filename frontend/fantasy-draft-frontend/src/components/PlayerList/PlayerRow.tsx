// src/components/PlayerList/PlayerRow.tsx
import { useState } from 'react';
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
}

export function PlayerRow({
  player,
  tiers,
  onToggleDrafted,
  onAssignTier,
  onEditCell,
  onDelete,
  onShowDetail,
  onShowNotes
}: PlayerRowProps) {
  const [editingCell, setEditingCell] = useState<{ field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellEdit = (field: string, value: any) => {
    const newValue = typeof value === 'number' ? 
      parseFloat(editValue) || 0 : editValue;
    onEditCell(player.id, field, newValue);
    setEditingCell(null);
    setEditValue('');
  };

  const renderEditableCell = (field: string, value: any) => {
    const isEditing = editingCell?.field === field;
    
    if (isEditing) {
      return (
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleCellEdit(field, value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(field, value);
            } else if (e.key === 'Escape') {
              setEditingCell(null);
              setEditValue('');
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
          setEditingCell({ field });
          setEditValue(value?.toString() || '');
        }}
        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded block"
        title="Click to edit"
      >
        {value || '-'}
      </span>
    );
  };

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${
      player.isDrafted ? 'bg-gray-100 opacity-75' : ''
    }`}>
      {/* Drafted checkbox */}
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={player.isDrafted}
          onChange={(e) => onToggleDrafted(player.id, e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>

      {/* Rank - editable */}
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <div className="text-sm font-bold text-gray-900">
            {renderEditableCell('customRank', player.customRank || player.rank)}
          </div>
          {player.positionalRank && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {player.positionalRank}
            </span>
          )}
        </div>
      </td>

      {/* Player name */}
      <td className="px-3 py-4 whitespace-nowrap">
        <div
          onClick={() => onShowDetail(player.id)}
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

      {/* Team */}
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {player.team}
      </td>

      {/* Bye Week */}
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {player.byeWeek}
      </td>

      {/* Projected Points - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('projectedPoints', player.projectedPoints)}
      </td>

      {/* VORP - editable */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        {renderEditableCell('vorp', player.vorp)}
      </td>

      {/* Tier dropdown */}
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

      {/* Tags */}
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

      {/* Notes */}
      <td className="px-3 py-4 whitespace-nowrap text-sm">
        <button
          onClick={() => onShowNotes(player.id)}
          className="text-blue-600 hover:text-blue-900"
          title={player.notes.length > 0 ? `${player.notes.length} note(s)` : 'Add notes'}
        >
          {player.notes.length > 0 ? '📝' : '➕'}
        </button>
      </td>

      {/* Actions */}
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <button
            onClick={() => onShowDetail(player.id)}
            className="text-blue-600 hover:text-blue-900"
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
  );
}