// frontend/fantasy-draft-frontend/src/components/ImportControlToggle.tsx
import React, { useState } from 'react';
import { EnhancedPlayerImport } from './EnhancedPlayerImport';
import { AdvancedPlayerImport } from './AdvancedPlayerImport';

interface ImportControlToggleProps {
  onImportComplete: () => void;
}

export const ImportControlToggle: React.FC<ImportControlToggleProps> = ({ onImportComplete }) => {
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
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🚀 Smart Import
          </button>
          <button
            onClick={() => setImportMode('advanced')}
            className={`px-4 py-2 rounded-md font-medium transition-all text-sm ${
              importMode === 'advanced'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🎛️ Advanced Control
          </button>
        </div>
      </div>

      {/* Mode Description */}
      <div className="text-center text-sm text-gray-600 max-w-2xl mx-auto">
        {importMode === 'simple' ? (
          <p>
            <strong>Smart Import:</strong> Automatic fuzzy matching and conflict resolution. 
            Perfect for most use cases with minimal setup.
          </p>
        ) : (
          <p>
            <strong>Advanced Control:</strong> Full control over column mappings, player matches, 
            and data updates. Includes rollback functionality for complete import management.
          </p>
        )}
      </div>

      {/* Import Component */}
      <div>
        {importMode === 'simple' ? (
          <EnhancedPlayerImport onImportComplete={onImportComplete} />
        ) : (
          <AdvancedPlayerImport onImportComplete={onImportComplete} />
        )}
      </div>
    </div>
  );
};