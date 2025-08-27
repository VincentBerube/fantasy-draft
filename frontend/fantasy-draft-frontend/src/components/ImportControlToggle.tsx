// frontend/fantasy-draft-frontend/src/components/ImportControlToggle.tsx
import React, { useState } from 'react';
import { EnhancedPlayerImport } from './EnhancedPlayerImport';
import { AdvancedPlayerImport } from './AdvancedPlayerImport';

interface ImportControlToggleProps {
  onImportComplete: () => void;
}

export const ImportControlToggle: React.FC<ImportControlToggleProps> = ({ 
  onImportComplete 
}) => {
  const [importMode, setImportMode] = useState<'simple' | 'advanced'>('simple');

  return (
    <div className="space-y-4">
      {/* Import Mode Toggle */}
      <div className="flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-1 inline-flex">
          <button
            onClick={() => setImportMode('simple')}
            className={`px-4 py-2 rounded-md font-medium transition-all text-sm ${
              importMode === 'simple'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            🚀 Smart Import
          </button>
          <button
            onClick={() => setImportMode('advanced')}
            className={`px-4 py-2 rounded-md font-medium transition-all text-sm ${
              importMode === 'advanced'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            🎛️ Advanced Control
          </button>
        </div>
      </div>

      {/* Mode Description */}
      <div className="text-center text-sm text-gray-600 max-w-2xl mx-auto">
        {importMode === 'simple' ? (
          <div className="space-y-2">
            <p>
              <strong>Smart Import:</strong> Automatic fuzzy matching and conflict resolution. 
              Perfect for most use cases with minimal setup.
            </p>
            <div className="text-xs text-gray-500">
              ✨ Features: Auto-detection • Fuzzy matching • Conflict resolution • Quick setup
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p>
              <strong>Advanced Control:</strong> Full control over column mappings, player matches, 
              and data updates. Includes rollback functionality for complete import management.
            </p>
            <div className="text-xs text-gray-500">
              🎛️ Features: Column mapping • Player review • Rollback support • Detailed control
            </div>
          </div>
        )}
      </div>

      {/* Feature Comparison */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className={`p-3 rounded border-2 transition-all ${
            importMode === 'simple' 
              ? 'border-blue-200 bg-blue-50' 
              : 'border-gray-200 bg-white cursor-pointer hover:border-blue-200'
          }`} onClick={() => setImportMode('simple')}>
            <h4 className="font-medium text-blue-900 mb-2">🚀 Smart Import</h4>
            <ul className="space-y-1 text-gray-700 text-xs">
              <li>• Automatic column detection</li>
              <li>• Intelligent player matching</li>
              <li>• Conflict resolution</li>
              <li>• One-click import</li>
              <li>• Best for: Quick imports, trusted data</li>
            </ul>
          </div>
          
          <div className={`p-3 rounded border-2 transition-all ${
            importMode === 'advanced' 
              ? 'border-purple-200 bg-purple-50' 
              : 'border-gray-200 bg-white cursor-pointer hover:border-purple-200'
          }`} onClick={() => setImportMode('advanced')}>
            <h4 className="font-medium text-purple-900 mb-2">🎛️ Advanced Control</h4>
            <ul className="space-y-1 text-gray-700 text-xs">
              <li>• Manual column mapping</li>
              <li>• Player-by-player review</li>
              <li>• Import rollback support</li>
              <li>• Granular control</li>
              <li>• Best for: Complex data, verification needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Import Component */}
      <div className="min-h-96">
        {importMode === 'simple' ? (
          <EnhancedPlayerImport onImportComplete={onImportComplete} />
        ) : (
          <AdvancedPlayerImport onImportComplete={onImportComplete} />
        )}
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <div className="flex items-start space-x-2">
          <div className="text-blue-500 mt-0.5">💡</div>
          <div>
            <div className="font-medium text-blue-900 mb-1">Pro Tips:</div>
            <div className="text-blue-800 space-y-1">
              <div>• Start with Smart Import for most Excel/CSV files - it handles common formats automatically</div>
              <div>• Use Advanced Control when you need to verify each change or have complex data mappings</div>
              <div>• Both modes preserve your existing Sleeper data by default - only custom fields get updated</div>
              <div>• You can always rollback imports in Advanced mode if something goes wrong</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};