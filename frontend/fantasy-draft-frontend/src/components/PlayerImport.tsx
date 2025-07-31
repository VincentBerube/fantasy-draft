import { useState } from 'react';
import { playerApi } from '../api/playerApi';

interface ImportResult {
  total: number;
  newCount: number;
  updatedCount: number;
  duplicateCount?: number;
  mergedCount?: number;
  errorCount: number;
  errors: string[];
  duplicateWarnings?: string[];
}

export function PlayerImport({ onImportSuccess }: { onImportSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{text: string, isError: boolean} | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<'update' | 'preserve'>('update');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setIsLoading(true);
    setMessage(null);
    setImportResult(null);
    
    try {
      const response = await playerApi.importPlayers(file, mergeStrategy);
      
      // Success response
      setMessage({
        text: response.data.message,
        isError: false
      });
      
      // Store detailed results
      setImportResult(response.data);
      
      // Refresh player list
      if (onImportSuccess) onImportSuccess();
      
      // Reset form
      setFile(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      // Error response
      const errorMessage = error.response?.data?.error || 
                           error.response?.data?.details || 
                           'Import failed';
      
      setMessage({
        text: errorMessage,
        isError: true
      });
      
      // Show error details if available
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        setImportResult({
          total: 0,
          newCount: 0,
          updatedCount: 0,
          errorCount: error.response.data.errors.length,
          errors: error.response.data.errors
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    
    // Clear previous results when new file is selected
    if (selectedFile) {
      setMessage(null);
      setImportResult(null);
    }
  };

  return (
    <div className="p-6 border rounded-lg max-w-2xl mx-auto mt-8 bg-white shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Import Player Data</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Select Excel File (.xlsx, .xls):
          </label>
          <input 
            id="file-input"
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
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''} mr-1`}>▶</span>
            Advanced Import Options
          </button>
          
          {showAdvanced && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Data Merge Strategy:
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="update"
                    checked={mergeStrategy === 'update'}
                    onChange={(e) => setMergeStrategy(e.target.value as 'update')}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    <strong>Update Mode:</strong> Overwrite existing data with new values
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="preserve"
                    checked={mergeStrategy === 'preserve'}
                    onChange={(e) => setMergeStrategy(e.target.value as 'preserve')}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    <strong>Preserve Mode:</strong> Only fill in missing data, keep existing values
                  </span>
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Note: User notes, custom tags, tiers, and draft status are always preserved regardless of merge strategy.
              </p>
            </div>
          )}
        </div>
        
        <button 
          type="submit"
          disabled={!file || isLoading}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
            !file || isLoading
              ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Importing Players...
            </span>
          ) : 'Import Players'}
        </button>
      </form>
      
      {message && (
        <div className={`mt-6 p-4 rounded-lg ${message.isError ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <div className={`font-medium ${message.isError ? 'text-red-800' : 'text-green-800'}`}>
            {message.isError ? '❌ Import Failed' : '✅ Import Successful'}
          </div>
          <p className={`mt-1 ${message.isError ? 'text-red-700' : 'text-green-700'}`}>
            {message.text}
          </p>
          
          {!message.isError && importResult && (
            <div className="mt-4 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-gray-900">📊 Total</div>
                  <div className="text-2xl font-bold text-gray-800">{importResult.total}</div>
                  <div className="text-xs text-gray-600">processed</div>
                </div>
                
                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-green-900">✨ New</div>
                  <div className="text-2xl font-bold text-green-600">{importResult.newCount}</div>
                  <div className="text-xs text-gray-600">players added</div>
                </div>

                <div className="bg-white p-3 rounded border">
                  <div className="font-medium text-blue-900">🔄 Updated</div>
                  <div className="text-2xl font-bold text-blue-600">{importResult.updatedCount}</div>
                  <div className="text-xs text-gray-600">players updated</div>
                </div>

                {importResult.duplicateCount !== undefined && importResult.duplicateCount > 0 && (
                  <div className="bg-white p-3 rounded border">
                    <div className="font-medium text-orange-900">🔗 Duplicates</div>
                    <div className="text-2xl font-bold text-orange-600">{importResult.duplicateCount}</div>
                    <div className="text-xs text-gray-600">handled</div>
                  </div>
                )}
              </div>

              {/* Duplicate Warnings */}
              {importResult.duplicateWarnings && importResult.duplicateWarnings.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="font-medium text-orange-800 mb-2">🔗 Duplicate Detection</div>
                  <div className="text-sm text-orange-700 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.duplicateWarnings.map((warning, index) => (
                      <div key={index}>• {warning}</div>
                    ))}
                  </div>
                  <div className="text-xs text-orange-600 mt-2">
                    These players were detected as potential duplicates and merged automatically.
                  </div>
                </div>
              )}

              {/* Errors */}
              {importResult.errorCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="font-medium text-red-800 mb-2">⚠️ Import Errors ({importResult.errorCount})</div>
                  <div className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <div>• ... and {importResult.errors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">📋 Import Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Expected columns: RK, OVERALL PLAYER, POS, POS RK, BYE, FPS, VORP, TEAM, ADP</li>
          <li>• Player name and position are required for each row</li>
          <li>• <strong>New:</strong> Automatic duplicate detection using fuzzy matching</li>
          <li>• Similar player names (e.g., "Josh Allen" vs "J. Allen") are merged automatically</li>
          <li>• Your custom notes, tags, tiers, and draft status are always preserved</li>
          <li>• Use "Update Mode" for refreshing rankings, "Preserve Mode" for adding new data only</li>
        </ul>
      </div>
    </div>
  );
}