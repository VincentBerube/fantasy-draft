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
      formData.append('updateStrategy', options.updateStrategy);
      formData.append('autoMatchThreshold', options.autoMatchThreshold.toString());
      formData.append('createNewPlayers', options.createNewPlayers.toString());
      formData.append('preserveSleeperData', options.preserveSleeperData.toString());

      const response = await playerApi.importPlayers(formData);
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
    <div className="p-6 border rounded-lg max-w-6xl mx-auto mt-8 bg-white shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Enhanced Player Import
      </h2>
      
      {/* File Upload Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Select Excel File (.xlsx, .xls):
        </label>
        <input 
          type="file" 
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
          disabled={isLoading}
        />
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Advanced Options */}
      <div className="mb-6 border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="ml-1">Advanced Options</span>
        </button>
        
        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Update Strategy
              </label>
              <select
                value={options.updateStrategy}
                onChange={(e) => setOptions(prev => ({ ...prev, updateStrategy: e.target.value as 'merge' | 'overwrite' }))}
                className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="merge">Merge (preserve existing data)</option>
                <option value="overwrite">Overwrite (replace existing data)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auto-Match Threshold: {(options.autoMatchThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={options.autoMatchThreshold}
                onChange={(e) => setOptions(prev => ({ ...prev, autoMatchThreshold: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher = more strict matching, lower = more automatic matches
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="createNewPlayers"
                checked={options.createNewPlayers}
                onChange={(e) => setOptions(prev => ({ ...prev, createNewPlayers: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="createNewPlayers" className="ml-2 text-sm text-gray-700">
                Create new players for unmatched entries
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="preserveSleeperData"
                checked={options.preserveSleeperData}
                onChange={(e) => setOptions(prev => ({ ...prev, preserveSleeperData: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="preserveSleeperData" className="ml-2 text-sm text-gray-700">
                Protect Sleeper core data (recommended)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={handlePreview}
          disabled={!file || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '🔄 Analyzing...' : '🔍 Preview Import'}
        </button>
        
        <button
          onClick={handleImport}
          disabled={!file || isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '⏳ Importing...' : '📥 Import Now'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Import Preview</h3>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{preview.summary.totalRows}</div>
              <div className="text-sm text-gray-600">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{preview.summary.recognizedColumns}</div>
              <div className="text-sm text-gray-600">Recognized Columns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{preview.summary.estimatedAutoMatches}</div>
              <div className="text-sm text-gray-600">Est. Auto Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{preview.summary.estimatedNewPlayers}</div>
              <div className="text-sm text-gray-600">Est. New Players</div>
            </div>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
              <h4 className="font-medium text-yellow-800 mb-2">⚠️ Warnings:</h4>
              <ul className="list-disc list-inside text-sm text-yellow-700">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Column Mapping */}
          <div className="mb-4">
            <h4 className="font-medium mb-2">Column Mapping:</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Excel Column</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mapped To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sample</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.columnAnalysis.map((col, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">{col.header}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{col.mappedTo || '-'}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{col.dataType}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{col.sampleValue || '-'}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          col.willBeProcessed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {col.willBeProcessed ? '✓ Recognized' : '? Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample Players */}
          <div>
            <h4 className="font-medium mb-2">Sample Players:</h4>
            <div className="space-y-2">
              {preview.playerSamples.map((sample, index) => (
                <div key={index} className="p-3 bg-white border rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{sample.name}</span>
                      {sample.position && <span className="ml-2 text-sm text-gray-500">({sample.position})</span>}
                    </div>
                    <div className="text-right">
                      {sample.potentialMatch ? (
                        <div className="text-sm">
                          <div className="text-green-600">
                            ✓ Match: {sample.potentialMatch.playerName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(sample.potentialMatch.confidence * 100).toFixed(0)}% confidence
                            {sample.potentialMatch.isSleeperPlayer && ' • Sleeper'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-yellow-600">? No clear match</div>
                      )}
                    </div>
                  </div>
                  {Object.keys(sample.additionalFields).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Additional data: {Object.keys(sample.additionalFields).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-green-800">Import Results</h3>
          
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{importResult.summary.totalProcessed}</div>
              <div className="text-sm text-gray-600">Total Processed</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{importResult.summary.autoMatched}</div>
              <div className="text-sm text-gray-600">Auto Matched</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{importResult.summary.newPlayersCreated}</div>
              <div className="text-sm text-gray-600">New Players</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">{importResult.summary.manualReviewNeeded}</div>
              <div className="text-sm text-gray-600">Need Review</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">{importResult.summary.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>

          {/* Manual Review Section */}
          {importResult.needsReview.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-2 text-yellow-800">Players Needing Manual Review:</h4>
              <div className="space-y-3">
                {importResult.needsReview.map((item, index) => (
                  <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="font-medium mb-2">
                      {item.playerName} (Row {item.excelRowIndex})
                    </div>
                    
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
        </div>
      )}
    </div>
  );
};