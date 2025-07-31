// frontend/src/components/NoteManager.tsx
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
      const response = await playerApi.addNote(playerId, newNoteContent.trim(), newNoteColor);
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
      const response = await playerApi.updateNote(
        editingNote.id, 
        editingNote.content, 
        editingNote.color
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
      await playerApi.deleteNote(noteId);
      setNotes(prev => prev.filter(note => note.id !== noteId));
      onUpdate();
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={newNoteColor}
                  onChange={(e) => setNewNoteColor(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md"
                />
              </div>
              
              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || isSaving}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isSaving ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Existing Notes */}
          <div>
            <h3 className="font-semibold mb-4">
              Existing Notes ({notes.length})
            </h3>
            
            {notes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📝</div>
                <p>No notes yet. Add your first note above!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div 
                    key={note.id} 
                    className="border rounded-lg p-4"
                    style={{ 
                      borderLeftColor: note.color,
                      borderLeftWidth: '4px',
                      backgroundColor: note.color + '10'
                    }}
                  >
                    {editingNote?.id === note.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingNote.content}
                          onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                          className="w-full p-3 border rounded-md min-h-[80px] resize-vertical"
                          rows={3}
                        />
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                          <div className="flex gap-2 mb-2">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditingNote({ ...editingNote, color })}
                                className={`w-6 h-6 rounded-full border-2 ${
                                  editingNote.color === color ? 'border-gray-800' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <input
                            type="color"
                            value={editingNote.color}
                            onChange={(e) => setEditingNote({ ...editingNote, color: e.target.value })}
                            className="w-20 h-8 border rounded"
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateNote}
                            disabled={isSaving}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: note.color }}
                            />
                            <span className="text-sm text-gray-500">
                              {formatDate(note.createdAt)}
                              {note.updatedAt !== note.createdAt && ' (edited)'}
                            </span>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingNote(note)}
                              disabled={isSaving}
                              className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={isSaving}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-gray-800 whitespace-pre-wrap">
                          {note.content}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}