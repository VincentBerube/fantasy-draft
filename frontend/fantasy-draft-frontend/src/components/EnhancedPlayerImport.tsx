// frontend/fantasy-draft-frontend/src/components/EnhancedPlayerImport.tsx
import React, { useState, useCallback } from 'react';
import { playerApi } from '../api';

interface ImportPreview {
  columnAnalysis: Array<{
    header: string;
    mappedTo: string | null;
    dataType: string;
    sampleValue: any;
    willBeProcessed: boolean;
  }>;
  playerSamples: Array<{
    name: string;
    position?: string;
    confidence: number;
    potentialMatch?: {
      playerName: string;
      confidence: number;
      isSleeperPlayer: boolean;
    };
    additionalFields: Record<string, any>;
  }>;
  summary: {
    totalRows: number;
    validPlayers: number;
    recognizedColumns: number;
    unknownColumns: number;
    estimatedAutoMatches: number;
    estimatedNewPlayers: number;
  };
  warnings: string[];
}

interface ImportResult {
  summary: {
    totalProcessed: number;
    autoMatched: number;
    manualReviewNeeded: number;
    newPlayersCreated: number;
    failed: number;
  };
  autoMatched: Array<{
    excelRowIndex: number;
    playerName: string;
    playerId: string;
    fieldsUpdated: string[];
  }>;
  needsReview: Array<{
    excelRowIndex: number;
    playerName: string;
    potentialMatches: Array<{
      playerId: string;
      playerName: string;
      confidence: number;
      reasons: string[];
    }>;
    excelData: Record<string, any>;
  }>;
  newPlayers: Array<{
    excelRowIndex: number;
    playerName: string;
    playerId: string;
    dataSource: 'excel';
  }>;
  errors: Array<{
    excelRowIndex: number;
    playerName: string;
    error: string;
  }>;
  columnMapping: Array<{
    excelColumn: string;
    mappedTo: string | null;
    processed: boolean;
  }>;
}

interface ImportOptions {
  updateStrategy: 'merge' | 'overwrite';
  autoMatchThreshold: number;
  createNewPlayers: boolean;
  preserveSleeperData: boolean;
}

export const EnhancedPlayerImport: React.FC<{
  onImportComplete: () => void;
}> = ({ onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<ImportOptions>({
    updateStrategy: 'merge',
    autoMatchThreshold: 0.85,
    createNewPlayers: true,
    preserveSleeperData: true
  });
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setPreview(null);
    setImportResult(null);
    setError(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await playerApi.getImportPreview(formData);
      setPreview(response.data.preview);
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to generate preview');
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(options));

      const response = await playerApi.executeEnhancedImport(formData);
      setImportResult(response.data.result);
      
      // If successful and no manual review needed, trigger refresh
      if (response.data.result.summary.manualReviewNeeded === 0) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.response?.data?.details || 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [file, options, onImportComplete]);

  const handleResolveMatch = useCallback(async (
    excelRowIndex: number,
    selectedPlayerId: string,
    excelData: Record<string, any>
  ) => {
    try {
      await playerApi.resolveManualMatch({
        excelRowIndex,
        selectedPlayerId,
        excelData,
        options
      });

      // Update the import result to remove resolved item
      setImportResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          needsReview: prev.needsReview.filter(item => item.excelRowIndex !== excelRowIndex),
          summary: {
            ...prev.summary,
            manualReviewNeeded: prev.summary.manualReviewNeeded - 1,
            autoMatched: prev.summary.autoMatched + 1
          }
        };
      });
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to resolve match');
    }
  }, [options]);

  return (
    <div className="p-6 border rounded-lg mb-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">🚀 Smart Player Import</h3>
          <p className="text-gray-600">Upload Excel/CSV files with automatic column detection and smart player matching</p>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          {showAdvanced ? 'Hide' : 'Show'} Options
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="text-red-600">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* File Upload */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={!file || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Preview'}
          </button>
        </div>
        {file && (
          <div className="mt-2 text-sm text-gray-600">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="bg-white p-4 rounded-lg border mb-6">
          <h4 className="font-semibold mb-3">Import Options</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Update Strategy</label>
              <select
                value={options.updateStrategy}
                onChange={(e) => setOptions(prev => ({ ...prev, updateStrategy: e.target.value as 'merge' | 'overwrite' }))}
                className="w-full p-2 border rounded"
              >
                <option value="merge">Merge (keep existing data)</option>
                <option value="overwrite">Overwrite (replace existing data)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto-Match Threshold</label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={options.autoMatchThreshold}
                onChange={(e) => setOptions(prev => ({ ...prev, autoMatchThreshold: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500">{(options.autoMatchThreshold * 100).toFixed(0)}% confidence required</div>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.createNewPlayers}
                  onChange={(e) => setOptions(prev => ({ ...prev, createNewPlayers: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">Create new players if not found</span>
              </label>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.preserveSleeperData}
                  onChange={(e) => setOptions(prev => ({ ...prev, preserveSleeperData: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm">Preserve Sleeper data</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div className="bg-white p-4 rounded-lg border mb-6">
          <h4 className="font-semibold mb-3">Import Preview</h4>
          
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{preview.summary.totalRows}</div>
              <div className="text-sm text-gray-600">Total Rows</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-green-600">{preview.summary.validPlayers}</div>
              <div className="text-sm text-gray-600">Valid Players</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-purple-600">{preview.summary.recognizedColumns}</div>
              <div className="text-sm text-gray-600">Columns Mapped</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-orange-600">{preview.summary.unknownColumns}</div>
              <div className="text-sm text-gray-600">Unknown Columns</div>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="mb-4">
            <h5 className="font-medium mb-2">Column Mapping</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {preview.columnAnalysis.map((col, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                  <span className="font-medium">{col.header}</span>
                  <span className={col.mappedTo ? 'text-green-600' : 'text-gray-400'}>
                    {col.mappedTo || 'Not mapped'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-orange-600">Warnings</h5>
              <ul className="text-sm text-orange-700 space-y-1">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Player Samples */}
          <div className="mb-4">
            <h5 className="font-medium mb-2">Sample Players</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {preview.playerSamples.slice(0, 5).map((player, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-gray-500">{player.position} - {Object.keys(player.additionalFields).length} fields</div>
                  </div>
                  <div className="text-right">
                    {player.potentialMatch ? (
                      <div className="text-green-600">
                        Match: {player.potentialMatch.playerName} ({(player.potentialMatch.confidence * 100).toFixed(0)}%)
                      </div>
                    ) : (
                      <div className="text-gray-500">New player</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={isLoading}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Execute Import'}
          </button>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-semibold mb-3">Import Results</h4>
          
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{importResult.summary.totalProcessed}</div>
              <div className="text-sm text-gray-600">Total Processed</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-green-600">{importResult.summary.autoMatched}</div>
              <div className="text-sm text-gray-600">Auto Matched</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-orange-600">{importResult.summary.manualReviewNeeded}</div>
              <div className="text-sm text-gray-600">Need Review</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-purple-600">{importResult.summary.newPlayersCreated}</div>
              <div className="text-sm text-gray-600">New Players</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-red-600">{importResult.summary.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>

          {/* Manual Review Section */}
          {importResult.needsReview.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-orange-600">Players Requiring Manual Review</h5>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {importResult.needsReview.map((item, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-orange-50">
                    <div className="font-medium mb-2">{item.playerName}</div>
                    
                    {item.potentialMatches.length > 0 ? (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Potential matches:</p>
                        <div className="space-y-2">
                          {item.potentialMatches.map((match, matchIndex) => (
                            <div key={matchIndex} className="flex justify-between items-center p-2 bg-white border rounded">
                              <div>
                                <div className="font-medium">{match.playerName}</div>
                                <div className="text-sm text-gray-500">
                                  {(match.confidence * 100).toFixed(0)}% confidence • {match.reasons.join(', ')}
                                </div>
                              </div>
                              <button
                                onClick={() => handleResolveMatch(item.excelRowIndex, match.playerId, item.excelData)}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                              >
                                Select
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No potential matches found. This will create a new player if enabled.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          {importResult.summary.manualReviewNeeded === 0 && (
            <div className="text-center p-4 bg-green-100 border border-green-300 rounded">
              <p className="text-green-700 font-medium">
                ✅ Import completed successfully! All players processed automatically.
              </p>
            </div>
          )}

          {/* Auto Matched Players */}
          {importResult.autoMatched.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-green-600">Successfully Auto-Matched Players</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {importResult.autoMatched.map((match, index) => (
                  <div key={index} className="text-sm p-2 bg-green-50 rounded">
                    <span className="font-medium">{match.playerName}</span>
                    <span className="text-gray-600"> - Updated: {match.fieldsUpdated.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Players */}
          {importResult.newPlayers.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-purple-600">New Players Created</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {importResult.newPlayers.map((newPlayer, index) => (
                  <div key={index} className="text-sm p-2 bg-purple-50 rounded">
                    <span className="font-medium">{newPlayer.playerName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {importResult.errors.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-red-600">Errors</h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {importResult.errors.map((error, index) => (
                  <div key={index} className="text-sm p-2 bg-red-50 rounded">
                    <span className="font-medium">{error.playerName}</span>
                    <span className="text-gray-600"> - {error.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};