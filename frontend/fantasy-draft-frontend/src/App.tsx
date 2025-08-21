// frontend/fantasy-draft-frontend/src/App.tsx
import { useState } from 'react';
import './index.css';
import { PlayerImport } from './components/PlayerImport';
import { SleeperSync } from './components/SleeperSync';
import { PlayerList } from './components/PlayerList/';

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
                Advanced player management with real-time data, tiers, tags, and notes
              </p>
            </div>
            <div className="text-right">
              <div className="text-blue-100 text-sm">
                ✨ Sleeper Integration • Excel Import • Custom Tiers • Inline Editing
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
                📊 Excel Import
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {activeTab === 'sleeper' 
                ? 'Sync with Sleeper\'s live player database and trending data'
                : 'Import additional data from Excel files (rankings, custom stats, etc.)'
              }
            </p>
          </div>

          {/* Data Source Components */}
          <div className="mb-8">
            {activeTab === 'sleeper' ? (
              <SleeperSync onSyncSuccess={handleDataUpdate} />
            ) : (
              <PlayerImport onImportSuccess={handleDataUpdate} />
            )}
          </div>

          {/* Player List */}
          <PlayerList key={refreshKey} />
        </div>
      </main>
      
      <footer className="bg-gray-100 border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <div className="mb-2">
            <span className="font-semibold">Fantasy Draft Assistant</span> - 
            Powered by Sleeper API for real-time data
          </div>
          <div className="text-sm text-gray-500 space-x-2">
            <span>© {new Date().getFullYear()}</span>
            <span>•</span>
            <span>Built with React, TypeScript, Prisma, and Sleeper API</span>
            <span>•</span>
            <span>Your data is protected and preserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;