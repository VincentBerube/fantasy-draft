// frontend/fantasy-draft-frontend/src/components/AdvancedPlayerImport.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { playerApi } from '../api';

interface ColumnMapping {
  excelColumn: string;
  mappedTo: string | null;
  dataType: string;
  sampleValue: any;
  willImport: boolean;
  customMapping?: string;
}

interface PlayerPreview {
  excelRowIndex: number;
  name: string;
  position?: string;
  team?: string;
  matchType: 'exact' | 'fuzzy' | 'manual' | 'new';
  matchedPlayer?: {
    id: string;
    name: string;
    currentData: Record<string, any>;
  };
  newData: Record<string, any>;
  willImport: boolean;
  conflicts: string[];
}

interface ImportSession {
  id: string;
  timestamp: string;
  summary: {
    totalProcessed: number;
    playersModified: number;
    playersCreated: number;
    fieldsChanged: number;
  };
  changes: Array<{
    playerId: string;
    playerName: string;
    action: 'create' | 'update';
    oldData?: Record<string, any>;
    newData: Record<string, any>;
    fieldsChanged: string[];
  }>;
}

export const AdvancedPlayerImport: React.FC<{
  onImportComplete: () => void;
}> = ({ onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'file' | 'columns' | 'players' | 'confirm' | 'results'>('file');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import control state
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [playerPreviews, setPlayerPreviews] = useState<PlayerPreview[]>([]);
  const [importSettings, setImportSettings] = useState({
    updateStrategy: 'merge' as 'merge' | 'overwrite',
    autoMatchThreshold: 0.85,
    createNewPlayers: true,
    preserveSleeperData: true,
    onlyImportSelected: false
  });

  // Rollback state
  const [importHistory, setImportHistory] = useState<ImportSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ImportSession | null>(null);

  // Step 1: File upload and initial analysis
  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await playerApi.getImportPreview(formData);
      const preview = response.data.preview;

      // Convert to our enhanced column mapping format
      const mappings: ColumnMapping[] = preview.columnAnalysis.map(col => ({
        excelColumn: col.header,
        mappedTo: col.mappedTo,
        dataType: col.dataType,
        sampleValue: col.sampleValue,
        willImport: col.mappedTo !== null, // Only import recognized columns by default
        customMapping: undefined
      }));

      setColumnMappings(mappings);
      setStep('columns');
    } catch (err: any) {
      setError('Failed to analyze file: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Step 2: Column mapping configuration
  const handleColumnMappingChange = useCallback((index: number, field: keyof ColumnMapping, value: any) => {
    setColumnMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, [field]: value } : mapping
    ));
  }, []);

  // Step 3: Generate player previews with the configured mappings
  const generatePlayerPreviews = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Send the configured column mappings along with the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('columnMappings', JSON.stringify(columnMappings));
      formData.append('settings', JSON.stringify(importSettings));

      const response = await playerApi.getAdvancedImportPreview(formData);
      const previews: PlayerPreview[] = response.data.playerPreviews;

      setPlayerPreviews(previews);
      setStep('players');
    } catch (err: any) {
      setError('Failed to generate player previews: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, [file, columnMappings, importSettings]);

  // Step 4: Execute the import with user selections
  const executeImport = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const importData = {
        columnMappings: columnMappings.filter(m => m.willImport),
        playerSelections: playerPreviews.filter(p => p.willImport),
        settings: importSettings
      };

      const formData = new FormData();
      formData.append('file', file);
      formData.append('importData', JSON.stringify(importData));

      const response = await playerApi.executeAdvancedImport(formData);
      const session: ImportSession = response.data.session;

      setCurrentSession(session);
      setImportHistory(prev => [session, ...prev].slice(0, 10)); // Keep last 10 imports
      setStep('results');
      onImportComplete();
    } catch (err: any) {
      setError('Import failed: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, [file, columnMappings, playerPreviews, importSettings, onImportComplete]);

  // Rollback functionality
  const rollbackImport = useCallback(async (sessionId: string) => {
    if (!confirm('Are you sure you want to rollback this import? This will revert all changes made during this import session.')) {
      return;
    }

    setIsLoading(true);
    try {
      await playerApi.rollbackImport(sessionId);
      
      // Remove the session from history
      setImportHistory(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      
      onImportComplete(); // Refresh the player list
      alert('Import successfully rolled back!');
    } catch (err: any) {
      setError('Rollback failed: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, onImportComplete]);

  // Helper functions
  const selectedColumnsCount = useMemo(() => 
    columnMappings.filter(m => m.willImport).length
  , [columnMappings]);

  const selectedPlayersCount = useMemo(() => 
    playerPreviews.filter(p => p.willImport).length
  , [playerPreviews]);

  const conflictsCount = useMemo(() => 
    playerPreviews.filter(p => p.conflicts.length > 0).length
  , [playerPreviews]);

  // Reset to start over
  const resetImport = useCallback(() => {
    setFile(null);
    setStep('file');
    setColumnMappings([]);
    setPlayerPreviews([]);
    setCurrentSession(null);
    setError(null);
  }, []);

  return (
    <div className="p-6 border rounded-lg max-w-7xl mx-auto mt-8 bg-white shadow-lg">
      {/* Header with Steps */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">
          Advanced Player Import with Control & Rollback
        </h2>
        
        {/* Step Progress */}
        <div className="flex justify-between items-center mb-6">
          {[
            { key: 'file', label: '1. File Upload', icon: '📁' },
            { key: 'columns', label: '2. Configure Columns', icon: '📊' },
            { key: 'players', label: '3. Review Players', icon: '👥' },
            { key: 'confirm', label: '4. Confirm Import', icon: '✅' },
            { key: 'results', label: '5. Results', icon: '📈' }
          ].map(({ key, label, icon }) => (
            <div 
              key={key}
              className={`flex items-center px-3 py-2 rounded-lg ${
                step === key ? 'bg-blue-100 text-blue-800 font-medium' :
                ['columns', 'players', 'confirm', 'results'].indexOf(step) > ['columns', 'players', 'confirm', 'results'].indexOf(key) ? 
                'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span className="mr-2">{icon}</span>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: File Upload */}
      {step === 'file' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Select Excel File (.xlsx, .xls):
            </label>
            <input 
              type="file" 
              accept=".xlsx,.xls"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  handleFileUpload(selectedFile);
                }
              }}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              disabled={isLoading}
            />
          </div>

          {/* Import History */}
          {importHistory.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Recent Import Sessions</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {importHistory.map(session => (
                  <div key={session.id} className="flex justify-between items-center p-3 bg-white rounded border">
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(session.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.summary.playersModified} updated, {session.summary.playersCreated} created
                      </div>
                    </div>
                    <button
                      onClick={() => rollbackImport(session.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                      disabled={isLoading}
                    >
                      🔄 Rollback
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Configuration */}
      {step === 'columns' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Configure Column Mappings</h3>
            <div className="text-sm text-gray-600">
              {selectedColumnsCount} of {columnMappings.length} columns selected for import
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Import</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Excel Column</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample Value</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maps To</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custom Mapping</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {columnMappings.map((mapping, index) => (
                  <tr key={index} className={mapping.willImport ? 'bg-blue-50' : 'bg-gray-50'}>
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={mapping.willImport}
                        onChange={(e) => handleColumnMappingChange(index, 'willImport', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-4 font-medium">{mapping.excelColumn}</td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {mapping.sampleValue || '-'}
                    </td>
                    <td className="px-3 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mapping.mappedTo ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {mapping.mappedTo || 'Not Recognized'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm">{mapping.dataType}</td>
                    <td className="px-3 py-4">
                      <select
                        value={mapping.customMapping || ''}
                        onChange={(e) => handleColumnMappingChange(index, 'customMapping', e.target.value || undefined)}
                        className="text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        disabled={!mapping.willImport}
                      >
                        <option value="">Use Auto-Detection</option>
                        <option value="customRank">Custom Rank</option>
                        <option value="projectedPoints">Projected Points</option>
                        <option value="vorp">VORP</option>
                        <option value="adp">ADP</option>
                        <option value="byeWeek">Bye Week</option>
                        <option value="team">Team</option>
                        <option value="notes">Notes</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('file')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ← Back
            </button>
            <button
              onClick={generatePlayerPreviews}
              disabled={selectedColumnsCount === 0 || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Analyzing...' : 'Next: Review Players →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Player Review */}
      {step === 'players' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Review Player Matches</h3>
            <div className="text-sm text-gray-600">
              {selectedPlayersCount} of {playerPreviews.length} players selected • {conflictsCount} conflicts
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {playerPreviews.filter(p => p.matchType === 'exact').length}
              </div>
              <div className="text-sm text-gray-600">Exact Matches</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">
                {playerPreviews.filter(p => p.matchType === 'fuzzy').length}
              </div>
              <div className="text-sm text-gray-600">Fuzzy Matches</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">
                {playerPreviews.filter(p => p.matchType === 'new').length}
              </div>
              <div className="text-sm text-gray-600">New Players</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{conflictsCount}</div>
              <div className="text-sm text-gray-600">Conflicts</div>
            </div>
          </div>

          {/* Player List */}
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {playerPreviews.map((preview, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${
                    preview.willImport ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={preview.willImport}
                        onChange={(e) => {
                          setPlayerPreviews(prev => prev.map((p, i) => 
                            i === index ? { ...p, willImport: e.target.checked } : p
                          ));
                        }}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div>
                        <div className="font-medium">{preview.name}</div>
                        {preview.position && (
                          <div className="text-sm text-gray-600">
                            {preview.position} {preview.team && `• ${preview.team}`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        preview.matchType === 'exact' ? 'bg-green-100 text-green-800' :
                        preview.matchType === 'fuzzy' ? 'bg-yellow-100 text-yellow-800' :
                        preview.matchType === 'new' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {preview.matchType === 'exact' ? '✓ Exact Match' :
                         preview.matchType === 'fuzzy' ? '≈ Fuzzy Match' :
                         preview.matchType === 'new' ? '+ New Player' :
                         '? Manual Review'}
                      </span>
                    </div>
                  </div>

                  {preview.matchedPlayer && (
                    <div className="mt-3 pl-7 text-sm text-gray-600">
                      Matches: <span className="font-medium">{preview.matchedPlayer.name}</span>
                    </div>
                  )}

                  {preview.conflicts.length > 0 && (
                    <div className="mt-3 pl-7">
                      <div className="text-sm text-red-600 font-medium">⚠️ Conflicts:</div>
                      <ul className="text-sm text-red-600 list-disc list-inside">
                        {preview.conflicts.map((conflict, i) => (
                          <li key={i}>{conflict}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Object.keys(preview.newData).length > 0 && (
                    <div className="mt-3 pl-7">
                      <div className="text-sm text-gray-600">
                        New data: {Object.keys(preview.newData).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('columns')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={selectedPlayersCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Next: Confirm Import →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Confirm Import Settings</h3>

          <div className="grid grid-cols-2 gap-6">
            {/* Import Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-3">Import Summary</h4>
              <div className="space-y-2 text-sm">
                <div>Columns to import: {selectedColumnsCount}</div>
                <div>Players to process: {selectedPlayersCount}</div>
                <div>New players: {playerPreviews.filter(p => p.willImport && p.matchType === 'new').length}</div>
                <div>Players to update: {playerPreviews.filter(p => p.willImport && p.matchType !== 'new').length}</div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Strategy
                </label>
                <select
                  value={importSettings.updateStrategy}
                  onChange={(e) => setImportSettings(prev => ({ 
                    ...prev, 
                    updateStrategy: e.target.value as 'merge' | 'overwrite' 
                  }))}
                  className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="merge">Merge (keep existing data)</option>
                  <option value="overwrite">Overwrite (replace existing data)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importSettings.preserveSleeperData}
                    onChange={(e) => setImportSettings(prev => ({ 
                      ...prev, 
                      preserveSleeperData: e.target.checked 
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Protect Sleeper core data (recommended)
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importSettings.createNewPlayers}
                    onChange={(e) => setImportSettings(prev => ({ 
                      ...prev, 
                      createNewPlayers: e.target.checked 
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Create new players for unmatched entries
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <div className="flex items-start">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Import will modify your data</p>
                <p>This import will modify {selectedPlayersCount} players in your database. 
                You can rollback this import later if needed.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('players')}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              ← Back
            </button>
            <button
              onClick={executeImport}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Importing...' : '✅ Execute Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Results */}
      {step === 'results' && currentSession && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-green-800">Import Completed Successfully!</h3>
            <p className="text-sm text-gray-600 mt-1">
              Session ID: {currentSession.id}
            </p>
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{currentSession.summary.totalProcessed}</div>
              <div className="text-sm text-gray-600">Total Processed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{currentSession.summary.playersModified}</div>
              <div className="text-sm text-gray-600">Players Modified</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{currentSession.summary.playersCreated}</div>
              <div className="text-sm text-gray-600">Players Created</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-600">{currentSession.summary.fieldsChanged}</div>
              <div className="text-sm text-gray-600">Fields Changed</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={resetImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Import Another File
            </button>
            <button
              onClick={() => rollbackImport(currentSession.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              🔄 Rollback This Import
            </button>
          </div>

          {/* Detailed Changes */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3">Detailed Changes</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {currentSession.changes.map((change, index) => (
                <div key={index} className="text-sm p-2 bg-white rounded border">
                  <div className="font-medium">
                    {change.action === 'create' ? '+ Created' : '✏️ Updated'}: {change.playerName}
                  </div>
                  <div className="text-gray-600">
                    Fields: {change.fieldsChanged.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
};