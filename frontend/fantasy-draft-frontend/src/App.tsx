import { useState } from 'react';
import './index.css';
import { PlayerImport } from './components/PlayerImport';
import { PlayerList } from './components/PlayerList';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportSuccess = () => {
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
                Advanced player management with tiers, tags, and notes
              </p>
            </div>
            <div className="text-right">
              <div className="text-blue-100 text-sm">
                ✨ Features: Duplicate Detection • Inline Editing • Custom Tiers
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <PlayerImport onImportSuccess={handleImportSuccess} />
          <PlayerList key={refreshKey} />
        </div>
      </main>
      
      <footer className="bg-gray-100 border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <div className="mb-2">
            <span className="font-semibold">Fantasy Draft Assistant</span> - 
            Advanced fantasy football draft preparation tool
          </div>
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} • Built with React, TypeScript, and Prisma
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;