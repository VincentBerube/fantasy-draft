// frontend/src/components/NoteManager.tsx
import { useState, useEffect } from 'react';
import { playerApi, Player, Note } from '../api/playerApi';

interface NoteManagerProps {
  playerId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const PRESET_COLORS = [
  { color: '#6B7280', name: 'Gray' },
  { color: '#EF4444', name: 'Red' },
  { color: '#F97316', name: 'Orange' },
  { color: '#EAB308', name: 'Yellow' },
  { color: '#22C55E', name: 'Green' },
  { color: '#3B82F6', name: 'Blue' },
  { color: '#8B5CF6', name: 'Purple' },
  { color: '#EC4899', name: 'Pink' },
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
      const response = await playerApi.updateNote(editingNote.id, editingNote.content, editingNote.color);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getColorName = (color: string) => {
    const preset = PRESET_COLORS.find(p => p.color === color);
    return preset ? preset.name : 'Custom';
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Player Not Found</h2>
            <button 
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Notes for {player.name}</h2>
            <p className="text-sm text-gray-600">
              {player.position} | {player.team || 'No Team'} | Rank: {player.rank || 'N/A'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          
          {/* Add New Note */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3">Add New Note</h3>
            <div className="space-y-3">
              <textarea
                placeholder="Enter your note about this player..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Color</label>
                <div className="flex gap-2 mb-2">
                  {PRESET_COLORS.map(({ color, name }) => (
                    <button
                      key={color}
                      onClick={() => setNewNoteColor(color)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        newNoteColor === color ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={name}
                    >
                      {newNoteColor === color && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  value={newNoteColor}
                  onChange={(e) => setNewNoteColor(e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {getColorName(newNoteColor)}
                </p>
              </div>
              
              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || isSaving}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Adding Note...' : 'Add Note'}
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
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="text-lg font-medium mb-1">No notes yet</p>
                <p className="text-sm">Add your first note about this player above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(note => (
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
                            rows={3}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          
                          <div className="flex gap-2 mb-3">
                            {PRESET_COLORS.map(({ color, name }) => (
                              <button
                                key={color}
                                onClick={() => setEditingNote({ ...editingNote, color })}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  editingNote.color === color ? 'border-gray-800' : 'border-gray-300'
                                }`}
                                style={{ backgroundColor: color }}
                                title={name}
                              >
                                {editingNote.color === color && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateNote}
                              disabled={isSaving}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingNote(null)}
                              disabled={isSaving}
                              className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div 
                              className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: note.color }}
                            >
                              {getColorName(note.color)}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingNote(note)}
                                disabled={isSaving}
                                className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                disabled={isSaving}
                                className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-gray-800 mb-2 whitespace-pre-wrap">
                            {note.content}
                          </p>
                          
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>Created: {formatDate(note.createdAt)}</span>
                            {note.updatedAt !== note.createdAt && (
                              <span>Updated: {formatDate(note.updatedAt)}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 Use colored notes to categorize your thoughts (red for concerns, green for positives, etc.)
            </div>
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