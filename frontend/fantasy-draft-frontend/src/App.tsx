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
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Fantasy Draft Assistant</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <PlayerImport onImportSuccess={handleImportSuccess} />
          <PlayerList key={refreshKey} />
        </div>
      </main>
      
      <footer className="bg-gray-100 border-t mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-gray-600">
          © {new Date().getFullYear()} Fantasy Draft Assistant
        </div>
      </footer>
    </div>
  );
}

export default App;