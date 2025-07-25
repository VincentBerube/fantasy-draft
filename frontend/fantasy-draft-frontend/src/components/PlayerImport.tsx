import { useState } from 'react';
import { playerApi } from '../api/playerApi';

export function PlayerImport({ onImportSuccess }: { onImportSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await playerApi.importPlayers(file);
      setMessage(response.data.message);
      if (onImportSuccess) onImportSuccess();
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto mt-8 bg-white shadow-md">
      <h2 className="text-xl font-bold mb-4 text-center">Import Player Data</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Select Excel File:
          </label>
          <input 
            type="file" 
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        
        <button 
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded font-medium transition ${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Importing...
            </span>
          ) : 'Import Players'}
        </button>
      </form>
      
      {message && (
        <div className={`mt-4 p-3 rounded text-center ${
          message.includes('Imported') 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}