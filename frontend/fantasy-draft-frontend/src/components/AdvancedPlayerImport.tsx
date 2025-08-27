// frontend/fantasy-draft-frontend/src/components/AdvancedPlayerImport.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { playerApi } from '../api/playerApi';

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

interface ColumnAnalysis {
  header: string;
  mappedTo: string | null;
  dataType: string;
  sampleValue: any;
  willBeProcessed: boolean;
}

interface ImportPreviewResponse {
  preview: {
    columnAnalysis: ColumnAnalysis[];
    playerSamples: Array<{
      name: string;
      position?: string;
      confidence: number;
      potentialMatch?: {
        name: string;
        confidence: number;
      };
    }>;
    summary: {
      totalRows: number;
      recognizedColumns: number;
      estimatedMatches: number;
      estimatedNewPlayers: number;
    };
    warnings: string[];
  };
}

const AVAILABLE_FIELDS = [
  { value: 'name', label: 'Player Name' },
  { value: 'position', label: 'Position' },
  { value: 'team', label: 'Team' },
  { value: 'rank', label: 'Overall Rank' },
  { value: 'customRank', label: 'Custom Rank' },
  { value: 'positionalRank', label: 'Position Rank' },
  { value: 'projectedPoints', label: 'Projected Points' },
  { value: 'vorp', label: 'VORP/Value' },
  { value: 'adp', label: 'ADP' },
  { value: 'byeWeek', label: 'Bye Week' },
  { value: 'lastSeasonPoints', label: 'Last Season Points' }
];

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

  // Load import history on component mount
  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = useCallback(async () => {
    try {
      const response = await playerApi.getImportHistory(5);
      setImportHistory(response.data.history || []);
    } catch (error) {
      console.warn('Failed to load import history:', error);
    }
  }, []);

  // Computed values
  const selectedColumnsCount = useMemo(() => 
    columnMappings.filter(m => m.willImport).length, 
    [columnMappings]
  );

  const selectedPlayersCount = useMemo(() => 
    playerPreviews.filter(p => p.willImport).length, 
    [playerPreviews]
  );

  // Step 1: File upload and initial analysis
  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await playerApi.getImportPreview(formData);
      const preview = (response.data as ImportPreviewResponse).preview;

      // Convert to our enhanced column mapping format
      const mappings: ColumnMapping[] = preview.columnAnalysis.map((col: ColumnAnalysis) => ({
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
      alert('Rollback failed: ' + (err.response?.data?.details || err.message));
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, onImportComplete]);

  // Reset to start over
  const resetImport = useCallback(() => {
    setFile(null);
    setStep('file');
    setError(null);
    setColumnMappings([]);
    setPlayerPreviews([]);
    setCurrentSession(null);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">🎛️ Advanced Player Import</h2>
            <p className="text-purple-100">
              Full control over column mapping, player matching, and data updates
            </p>
          </div>
          <div className="text-right">
            <div className="text-purple-100 text-sm">
              ✨ Features: Column Control • Player Matching • Rollback Support
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-600">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Step Progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          {['file', 'columns', 'players', 'confirm', 'results'].map((stepName, index) => (
            <div key={stepName} className={`flex items-center ${index < 4 ? 'flex-1' : ''}`}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step === stepName ? 'bg-purple-500 text-white' : 
                  ['file', 'columns', 'players', 'confirm', 'results'].indexOf(step) > index ? 
                  'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}
              `}>
                {index + 1}
              </div>
              <div className="ml-2 text-sm font-medium capitalize">{stepName}</div>
              {index < 4 && <div className="flex-1 h-0.5 bg-gray-200 mx-4"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Import History */}
      {importHistory.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">📈 Recent Imports</h3>
          <div className="space-y-2">
            {importHistory.slice(0, 3).map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {new Date(session.timestamp).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
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

      {/* Step 1: File Upload */}
      {step === 'file' && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Step 1: Upload Excel File</h3>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="file-upload"
              disabled={isLoading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-gray-400 text-4xl mb-4">📊</div>
              <div className="text-lg font-medium text-gray-700 mb-2">
                Choose Excel File or CSV
              </div>
              <div className="text-sm text-gray-500">
                Click to browse or drag and drop your player data file
              </div>
            </label>
          </div>

          {isLoading && (
            <div className="mt-4 text-center">
              <div className="text-blue-600">🔄 Analyzing file structure...</div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Configuration */}
      {step === 'columns' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Step 2: Configure Column Mappings</h3>
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
                        {mapping.mappedTo || 'Unmapped'}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">{mapping.dataType}</td>
                    <td className="px-3 py-4">
                      {!mapping.mappedTo && (
                        <select
                          value={mapping.customMapping || ''}
                          onChange={(e) => {
                            handleColumnMappingChange(index, 'customMapping', e.target.value);
                            handleColumnMappingChange(index, 'mappedTo', e.target.value);
                          }}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">Select field...</option>
                          {AVAILABLE_FIELDS.map(field => (
                            <option key={field.value} value={field.value}>{field.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Import Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Update Strategy
                </label>
                <select
                  value={importSettings.updateStrategy}
                  onChange={(e) => setImportSettings(prev => ({ 
                    ...prev, 
                    updateStrategy: e.target.value as 'merge' | 'overwrite'
                  }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="merge">Merge (fill empty fields only)</option>
                  <option value="overwrite">Overwrite (replace all values)</option>
                </select>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importSettings.preserveSleeperData}
                    onChange={(e) => setImportSettings(prev => ({ 
                      ...prev, 
                      preserveSleeperData: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Preserve Sleeper core data</span>
                </label>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importSettings.createNewPlayers}
                    onChange={(e) => setImportSettings(prev => ({ 
                      ...prev, 
                      createNewPlayers: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Create new players if not found</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={resetImport}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              ← Start Over
            </button>
            <button
              onClick={generatePlayerPreviews}
              disabled={isLoading || selectedColumnsCount === 0}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              {isLoading ? 'Generating...' : `Preview ${selectedColumnsCount} Columns →`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Player Review */}
      {step === 'players' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Step 3: Review Player Matches</h3>
            <div className="text-sm text-gray-600">
              {selectedPlayersCount} of {playerPreviews.length} players selected for import
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {playerPreviews.filter(p => p.matchType === 'exact').length}
              </div>
              <div className="text-sm text-green-700">Exact Matches</div>
            </div>
            <div className="bg-yellow-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {playerPreviews.filter(p => p.matchType === 'fuzzy').length}
              </div>
              <div className="text-sm text-yellow-700">Fuzzy Matches</div>
            </div>
            <div className="bg-blue-100 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {playerPreviews.filter(p => p.matchType === 'new').length}
              </div>
              <div className="text-sm text-blue-700">New Players</div>
            </div>
          </div>

          {/* Player List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {playerPreviews.map((player, index) => (
              <div key={index} className={`
                border rounded-lg p-4 ${player.willImport ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
              `}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={player.willImport}
                      onChange={(e) => {
                        setPlayerPreviews(prev => prev.map((p, i) => 
                          i === index ? { ...p, willImport: e.target.checked } : p
                        ));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{player.name}</span>
                        {player.position && (
                          <span className="px-2 py-1 bg-gray-200 text-xs rounded">{player.position}</span>
                        )}
                        {player.team && (
                          <span className="px-2 py-1 bg-gray-200 text-xs rounded">{player.team}</span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded ${
                          player.matchType === 'exact' ? 'bg-green-100 text-green-800' :
                          player.matchType === 'fuzzy' ? 'bg-yellow-100 text-yellow-800' :
                          player.matchType === 'new' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {player.matchType === 'exact' ? '✓ Exact Match' :
                           player.matchType === 'fuzzy' ? '≈ Fuzzy Match' :
                           player.matchType === 'new' ? '+ New Player' : '? Manual Review'}
                        </span>
                      </div>
                      
                      {player.matchedPlayer && (
                        <div className="text-sm text-gray-600 mt-1">
                          Matches: {player.matchedPlayer.name}
                        </div>
                      )}
                      
                      {player.conflicts.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-orange-800 mb-1">⚠️ Conflicts:</div>
                          <div className="text-xs text-orange-700">
                            {player.conflicts.join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {Object.keys(player.newData).length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <strong>New data:</strong> {Object.entries(player.newData)
                            .filter(([, value]) => value != null && value !== '')
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('columns')}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              ← Back to Columns
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={selectedPlayersCount === 0}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              Review Import ({selectedPlayersCount} players) →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 4: Confirm Import</h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="font-medium text-blue-900 mb-4">📋 Import Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Players to Import:</strong> {selectedPlayersCount}
              </div>
              <div>
                <strong>Columns to Import:</strong> {selectedColumnsCount}
              </div>
              <div>
                <strong>Update Strategy:</strong> {importSettings.updateStrategy}
              </div>
              <div>
                <strong>Create New Players:</strong> {importSettings.createNewPlayers ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Preserve Sleeper Data:</strong> {importSettings.preserveSleeperData ? 'Yes' : 'No'}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>⚠️ Important:</strong> This import will modify your player database. 
              You can rollback changes using the rollback feature if needed.
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep('players')}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              ← Back to Players
            </button>
            <button
              onClick={executeImport}
              disabled={isLoading}
              className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              {isLoading ? '🔄 Importing...' : '✅ Execute Import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Results */}
      {step === 'results' && currentSession && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Step 5: Import Complete</h3>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h4 className="font-medium text-green-900 mb-4">✅ Import Successful</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{currentSession.summary.totalProcessed}</div>
                <div className="text-green-700">Total Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{currentSession.summary.playersModified}</div>
                <div className="text-blue-700">Players Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{currentSession.summary.playersCreated}</div>
                <div className="text-purple-700">Players Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{currentSession.summary.fieldsChanged}</div>
                <div className="text-orange-700">Fields Changed</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Session ID: {currentSession.id.slice(0, 8)}...
              </div>
              <button
                onClick={() => rollbackImport(currentSession.id)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                disabled={isLoading}
              >
                🔄 Rollback This Import
              </button>
            </div>
          </div>

          {/* Change Details */}
          {currentSession.changes.length > 0 && (
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium mb-3">📝 Change Details</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {currentSession.changes.slice(0, 10).map((change, index) => (
                  <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{change.playerName}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        change.action === 'create' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {change.action === 'create' ? 'Created' : 'Updated'}
                      </span>
                    </div>
                    {change.fieldsChanged.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        Fields: {change.fieldsChanged.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
                {currentSession.changes.length > 10 && (
                  <div className="text-sm text-gray-500 text-center">
                    ... and {currentSession.changes.length - 10} more changes
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={resetImport}
              className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              🚀 Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};