// frontend/fantasy-draft-frontend/src/components/SleeperSync.tsx
import { useState, useEffect } from 'react';
import { sleeperApi } from '../api/sleeperApi';

interface SyncPreview {
  sleeper: {
    totalPlayers: number;
    activeFantasyPlayers: number;
  };
  current: {
    totalPlayers: number;
    draftedPlayers: number;
    playersWithNotes: number;
  };
  message: string;
}

interface SyncResult {
  total: number;
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  message: string;
}

interface TrendingPlayer {
  player_id: string;
  count: number;
  player?: {
    first_name: string;
    last_name: string;
    position: string;
    team: string;
  };
}

export function SleeperSync({ onSyncSuccess }: { onSyncSuccess?: () => void }) {
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [trendingAdds, setTrendingAdds] = useState<TrendingPlayer[]>([]);
  const [trendingDrops, setTrendingDrops] = useState<TrendingPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    includeProjections: true,
    season: '2024',
    week: '',
    onlyActive: true,
    positionsFilter: ['QB', 'WR', 'RB', 'TE', 'K'],
    topPlayersLimit: 500
  });

  useEffect(() => {
    loadPreview();
    loadTrendingData();
  }, []);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await sleeperApi.getSyncPreview();
      setPreview(response.data);
    } catch (error: any) {
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const loadTrendingData = async () => {
    try {
      const [addsResponse, dropsResponse] = await Promise.all([
        sleeperApi.getTrendingPlayers('add', 24, 10),
        sleeperApi.getTrendingPlayers('drop', 24, 10)
      ]);
      setTrendingAdds(addsResponse.data);
      setTrendingDrops(dropsResponse.data);
    } catch (error: any) {
      console.error('Failed to load trending data:', error);
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    setSyncResult(null);
    
    try {
      const response = await sleeperApi.syncPlayers({
        ...syncOptions,
        week: syncOptions.week ? parseInt(syncOptions.week) : undefined
      });
      
      setSyncResult(response.data.data);
      
      // Refresh preview data
      await loadPreview();
      
      // Notify parent component
      if (onSyncSuccess) onSyncSuccess();
      
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncResult({
        total: 0,
        newCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        message: `Sync failed: ${error.response?.data?.details || error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">🏈 Sleeper Data Integration</h2>
            <p className="text-emerald-100">
              Sync with Sleeper's comprehensive player database while preserving your custom data
            </p>
          </div>
          <div className="text-right">
            <div className="text-emerald-100 text-sm">
              ✨ Features: Live Data • Projections • Trending Players
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Section */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">📊 Data Sync</h3>
          
          {/* Preview Stats */}
          {isLoadingPreview ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : preview && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Sleeper Players:</div>
                  <div className="font-semibold text-emerald-600">
                    {preview.sleeper.activeFantasyPlayers.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Your Database:</div>
                  <div className="font-semibold text-blue-600">
                    {preview.current.totalPlayers.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Your Drafted:</div>
                  <div className="font-semibold text-purple-600">
                    {preview.current.draftedPlayers} protected
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">With Notes:</div>
                  <div className="font-semibold text-orange-600">
                    {preview.current.playersWithNotes} protected
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                {preview.message}
              </p>
            </div>
          )}

          {/* Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-gray-600 hover:text-gray-800 font-medium mb-4"
          >
            <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''} mr-1`}>▶</span>
            Sync Options
          </button>
          
          {showAdvanced && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Season:
                  </label>
                  <input
                    type="text"
                    value={syncOptions.season}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, season: e.target.value }))}
                    className="w-full text-sm px-2 py-1 border rounded focus:ring-1 focus:ring-emerald-500"
                    placeholder="2024"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Week (optional):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="18"
                    value={syncOptions.week}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, week: e.target.value }))}
                    className="w-full text-sm px-2 py-1 border rounded focus:ring-1 focus:ring-emerald-500"
                    placeholder="All weeks"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Top Players Limit:
                </label>
                <input
                  type="number"
                  min="100"
                  max="1000"
                  step="50"
                  value={syncOptions.topPlayersLimit}
                  onChange={(e) => setSyncOptions(prev => ({ ...prev, topPlayersLimit: parseInt(e.target.value) || 500 }))}
                  className="w-full text-sm px-2 py-1 border rounded focus:ring-1 focus:ring-emerald-500"
                  placeholder="500"
                />
                <p className="text-xs text-gray-500 mt-1">Number of top fantasy players to sync</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Positions to Include:
                </label>
                <div className="flex flex-wrap gap-2">
                  {['QB', 'WR', 'RB', 'TE', 'K', 'DEF'].map(position => (
                    <label key={position} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={syncOptions.positionsFilter.includes(position)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSyncOptions(prev => ({
                              ...prev,
                              positionsFilter: [...prev.positionsFilter, position]
                            }));
                          } else {
                            setSyncOptions(prev => ({
                              ...prev,
                              positionsFilter: prev.positionsFilter.filter(p => p !== position)
                            }));
                          }
                        }}
                        className="mr-1"
                      />
                      {position}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {syncOptions.positionsFilter.length} positions
                </p>
              </div>
              
              <div className="space-y-2 pt-2 border-t">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={syncOptions.includeProjections}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, includeProjections: e.target.checked }))}
                    className="mr-2"
                  />
                  Include player projections
                </label>
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={syncOptions.onlyActive}
                    onChange={(e) => setSyncOptions(prev => ({ ...prev, onlyActive: e.target.checked }))}
                    className="mr-2"
                  />
                  Only active players
                </label>
              </div>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing with Sleeper...
              </span>
            ) : '🔄 Sync with Sleeper'}
          </button>

          {/* Sync Results */}
          {syncResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              syncResult.message.includes('failed') || syncResult.message.includes('error')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              <div className="font-medium mb-2">
                {syncResult.message.includes('failed') ? '❌' : '✅'} Sync Results
              </div>
              <div className="text-sm space-y-1">
                <div>• {syncResult.newCount} new players added</div>
                <div>• {syncResult.updatedCount} players updated</div>
                {syncResult.skippedCount > 0 && (
                  <div>• {syncResult.skippedCount} players skipped</div>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                {syncResult.message}
              </div>
            </div>
          )}
        </div>

        {/* Trending Players Section */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">📈 Trending Players</h3>
          
          <div className="space-y-4">
            {/* Most Added */}
            <div>
              <h4 className="text-sm font-medium text-green-600 mb-2">🔥 Most Added (24h)</h4>
              <div className="space-y-1">
                {trendingAdds.slice(0, 5).map((player, index) => (
                  <div key={player.player_id} className="flex justify-between items-center text-sm">
                    <span className="truncate">
                      {player.player?.first_name} {player.player?.last_name} 
                      <span className="text-gray-500 ml-1">
                        ({player.player?.position} - {player.player?.team})
                      </span>
                    </span>
                    <span className="text-green-600 font-medium">+{player.count}</span>
                  </div>
                ))}
                {trendingAdds.length === 0 && (
                  <div className="text-gray-500 text-sm">No trending data available</div>
                )}
              </div>
            </div>

            {/* Most Dropped */}
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2">📉 Most Dropped (24h)</h4>
              <div className="space-y-1">
                {trendingDrops.slice(0, 5).map((player, index) => (
                  <div key={player.player_id} className="flex justify-between items-center text-sm">
                    <span className="truncate">
                      {player.player?.first_name} {player.player?.last_name}
                      <span className="text-gray-500 ml-1">
                        ({player.player?.position} - {player.player?.team})
                      </span>
                    </span>
                    <span className="text-red-600 font-medium">-{player.count}</span>
                  </div>
                ))}
                {trendingDrops.length === 0 && (
                  <div className="text-gray-500 text-sm">No trending data available</div>
                )}
              </div>
            </div>

            {/* Refresh Button */}
            <div className="pt-2 border-t">
              <button
                onClick={loadTrendingData}
                className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                🔄 Refresh Trending Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
        <h3 className="font-medium text-emerald-900 mb-2">🛡️ Data Protection</h3>
        <ul className="text-sm text-emerald-800 space-y-1">
          <li>• Your custom notes, tags, tiers, and draft status are always preserved</li>
          <li>• Only base player stats (projections, team info) are updated from Sleeper</li>
          <li>• You can still use Excel import to add data from other sources</li>
          <li>• Sleeper sync provides real-time player data and trending insights</li>
          <li>• Rate limited to stay within Sleeper's API guidelines (1000 calls/min)</li>
        </ul>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="font-medium text-gray-800 mb-3">⚡ Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadPreview}
            disabled={isLoadingPreview}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            🔄 Refresh Preview
          </button>
          <button
            onClick={loadTrendingData}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            📈 Update Trending
          </button>
          <button
            onClick={() => setSyncOptions({
              includeProjections: true,
              season: '2024',
              week: '',
              onlyActive: true,
              positionsFilter: ['QB', 'WR', 'RB', 'TE', 'K'],
              topPlayersLimit: 500
            })}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            🔧 Reset Options
          </button>
        </div>
      </div>
    </div>
  );
}