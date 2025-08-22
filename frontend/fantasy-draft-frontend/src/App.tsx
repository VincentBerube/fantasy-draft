// frontend/fantasy-draft-frontend/src/App.tsx
import { useState } from 'react';
import './index.css';
import { EnhancedPlayerImport } from './components/EnhancedPlayerImport';
import { SleeperSync } from './components/SleeperSync';
import { EnhancedPlayerList } from './components/EnhancedPlayerList';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'sleeper' | 'import'>('sleeper');

  const handleDataUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fantasy Draft Assistant</h1>
              <p className="text-blue-100 mt-1">
                Advanced player management with smart matching, real-time data, tiers, tags, and notes
              </p>
            </div>
            <div className="text-right">
              <div className="text-blue-100 text-sm">
                ✨ Smart Import • Sleeper Integration • Custom Tiers • Inline Editing
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Data Sources Tabs */}
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-1 inline-flex">
              <button
                onClick={() => setActiveTab('sleeper')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  activeTab === 'sleeper'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🏈 Sleeper Integration
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${
                  activeTab === 'import'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🧠 Smart Excel Import
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {activeTab === 'sleeper' 
                ? 'Sync with Sleeper\'s live player database and trending data'
                : 'Smart Excel import with fuzzy matching, dynamic columns, and conflict resolution'
              }
            </p>
          </div>

          {/* Data Source Components */}
          <div className="mb-8">
            {activeTab === 'sleeper' ? (
              <SleeperSync onSyncSuccess={handleDataUpdate} />
            ) : (
              <EnhancedPlayerImport onImportComplete={handleDataUpdate} />
            )}
          </div>

          {/* Enhanced Player List */}
          <EnhancedPlayerList key={refreshKey} />
        </div>
      </main>
      
      <footer className="bg-gray-100 border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <div className="mb-2">
            <span className="font-semibold">Fantasy Draft Assistant</span> - 
            Powered by Sleeper API with Smart Matching Technology
          </div>
          <div className="text-sm text-gray-500 space-x-2">
            <span>© {new Date().getFullYear()}</span>
            <span>•</span>
            <span>Built with React, TypeScript, Prisma, and Sleeper API</span>
            <span>•</span>
            <span>Smart matching protects your data integrity</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;