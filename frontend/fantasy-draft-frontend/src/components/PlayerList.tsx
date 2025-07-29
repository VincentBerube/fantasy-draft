// frontend/src/components/PlayerList.tsx
import { useState, useEffect } from 'react';
import { playerApi } from '../api/playerApi';
import { PlayerDetail } from './PlayerDetail';

export function PlayerList() {
  const [players, setPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setIsLoading(true);
        const response = await playerApi.getPlayers();
        setPlayers(response.data);
        setError('');
      } catch (err) {
        setError('Failed to load players');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    try {
      console.log('Starting export process');
      const response = await playerApi.exportPlayers();
      console.log('Received export response');
      
      // Create a Blob from the response data
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'players_export.xlsx');
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
        console.log('Export completed successfully');
      }, 100);
    } catch (error: any) {
      console.error('Export failed:', error);
      let errorMessage = 'Export failed';
      
      // Handle different types of errors
      if (error.response) {
        console.log('Error response status:', error.response.status);
        console.log('Error response headers:', error.response.headers);
        
        if (error.response.data instanceof Blob) {
          // Read blob as text for error messages
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const errorText = reader.result as string;
              console.log('Error response text:', errorText);
              
              try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || 'Export failed';
                if (errorJson.details) errorMessage += `: ${errorJson.details}`;
              } catch (e) {
                errorMessage = `Server error: ${errorText}`;
              }
            } catch (e) {
              errorMessage = 'Error parsing server response';
            }
            setError(errorMessage);
          };
          reader.readAsText(error.response.data);
          return;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data && typeof error.response.data === 'object') {
          errorMessage = error.response.data.error || error.response.data.message || 'Export failed';
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        errorMessage = 'No response from server';
      } else {
        // Something happened in setting up the request
        console.error('Request setup error:', error.message);
        errorMessage = error.message || 'Request setup failed';
      }
      
      setError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded text-center mb-4">
          {error}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Player List</h2>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`flex items-center px-4 py-2 rounded ${
            isExporting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : 'Export to Excel'}
        </button>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projected Points</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {players.map((player) => (
            <tr 
              key={player.id} 
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedPlayerId(player.id)}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.rank || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.position}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.team || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {player.projectedPoints ? player.projectedPoints.toFixed(1) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {players.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No players found. Import an Excel file to get started.
        </div>
      )}

      {selectedPlayerId && (
        <PlayerDetail
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}