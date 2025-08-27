// frontend/fantasy-draft-frontend/src/components/NoteManager.tsx
import { useState, useEffect } from 'react';
import { playerApi, type Note, type Player } from '../api/playerApi';

interface NoteManagerProps {
  playerId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#059669', // Emerald
  '#DC2626', // Dark Red
];

export function NoteManager({ playerId, onClose, onUpdate }: NoteManagerProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('#6B7280');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPlayer();
  }, [playerId]);

  const fetchPlayer = async () => {
    try {
      setIsLoading(true);
      const response = await playerApi.getPlayer(playerId);
      setPlayer(response.data);
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Failed to fetch player:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    
    setIsSaving(true);
    try {
      // Use existing addPlayerNote method
      const response = await playerApi.addPlayerNote(playerId, { 
        content: newNoteContent.trim(), 
        color: newNoteColor 
      });
      setNotes(prev => [...prev, response.data]);
      setNewNoteContent('');
      setNewNoteColor('#6B7280');
      onUpdate();
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote) return;
    
    setIsSaving(true);
    try {
      // Use existing updatePlayerNote method
      const response = await playerApi.updatePlayerNote(
        playerId,
        editingNote.id, 
        { 
          content: editingNote.content, 
          color: editingNote.color 
        }
      );
      setNotes(prev => prev.map(note => 
        note.id === editingNote.id ? response.data : note
      ));
      setEditingNote(null);
      onUpdate();
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    setIsSaving(true);
    try {
      // Use existing deletePlayerNote method
      await playerApi.deletePlayerNote(playerId, noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));
      onUpdate();
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Notes</h2>
            <p className="text-gray-600">
              {player?.name} ({player?.position} - {player?.team || 'No Team'})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          
          {/* Add New Note */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">Add New Note</h3>
            <div className="space-y-3">
              <textarea
                placeholder="Enter your note about this player..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-vertical"
                rows={3}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Color</label>
                <div className="flex gap-2 mb-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewNoteColor(color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        newNoteColor === color ? 'border-gray-800' : 'border-gray-300'
                      } transition-colors`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || isSaving}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Adding...
                  </>
                ) : (
                  'Add Note'
                )}
              </button>
            </div>
          </div>

          {/* Existing Notes */}
          <div>
            <h3 className="font-semibold mb-3">
              Existing Notes ({notes.length})
            </h3>
            
            {notes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No notes yet for this player</p>
                <p className="text-sm mt-1">Add your first note above!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="border rounded-lg p-4 transition-colors"
                    style={{ 
                      backgroundColor: note.color + '10', 
                      borderColor: note.color + '40'
                    }}
                  >
                    {editingNote?.id === note.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingNote.content}
                          onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                          rows={3}
                        />
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                          <div className="flex gap-2 mb-3">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditingNote({ ...editingNote, color })}
                                className={`w-6 h-6 rounded-full border ${
                                  editingNote.color === color ? 'border-gray-800' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateNote}
                            disabled={isSaving}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-xs text-gray-500">
                            {formatDate(note.createdAt)}
                            {note.updatedAt !== note.createdAt && (
                              <span className="ml-2">(edited {formatDate(note.updatedAt)})</span>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => setEditingNote(note)}
                              className="text-blue-600 hover:text-blue-800 text-xs p-1"
                              title="Edit note"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-red-600 hover:text-red-800 text-xs p-1"
                              title="Delete note"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}