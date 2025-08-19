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
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(field, value);
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
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={player.isDrafted}
          onChange={(e) => onToggleDrafted(player.id, e.target.checked)}
          className="rounded"
        />
      </td>

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

      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        {renderEditableCell('team', player.team)}
      </td>

      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        {renderEditableCell('byeWeek', player.byeWeek)}
      </td>

      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        {renderEditableCell('projectedPoints', player.projectedPoints)}
      </td>

      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
        {renderEditableCell('vorp', player.vorp)}
      </td>

      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={player.tier || ''}
          onChange={(e) => onAssignTier(player.id, e.target.value || null)}
          className="text-xs p-1 border rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Tier</option>
          {tiers.map(tier => (
            <option key={tier.id} value={tier.id}>{tier.name}</option>
          ))}
        </select>
      </td>

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

      <td className="px-3 py-4 whitespace-nowrap">
        <button
          onClick={() => onShowNotes(player.id)}
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

      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onDelete(player.id)}
          className="text-red-600 hover:text-red-900 ml-2"
          title="Delete player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
}