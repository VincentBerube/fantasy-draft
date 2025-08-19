// src/components/PlayerList/index.tsx
import { useState, useEffect } from 'react';
import { playerApi, type Player, type Tag, type Tier } from '../../api/playerApi';
import { PlayerDetail } from '../PlayerDetail';
import { TagManager } from '../TagManager';
import { TierManager } from '../TierManager';
import { NoteManager } from '../NoteManager';
import { PlayerFilters } from './PlayerFilters';
import { PlayerTable } from './PlayerTable';
import { usePlayerFilters } from './hooks/usePlayerFilters';

export function PlayerList() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal states
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTierManager, setShowTierManager] = useState(false);
  const [showNoteManager, setShowNoteManager] = useState<string | null>(null);

  const filterProps = usePlayerFilters(players);
  const { filteredPlayers, hideDrafted, setHideDrafted } = filterProps;

  useEffect(() => {
    Promise.all([
      fetchPlayers(),
      fetchTags(),
      fetchTiers()
    ]);
  }, [hideDrafted]);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      const response = await playerApi.getPlayers('PPR', !hideDrafted);
      setPlayers(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load players');
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await playerApi.getTags();
      setTags(response.data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const fetchTiers = async () => {
    try {
      const response = await playerApi.getTiers();
      setTiers(response.data);
    } catch (err) {
      console.error('Failed to load tiers:', err);
    }
  };

  const handleCellEdit = async (playerId: string, field: string, value: any) => {
    try {
      const updateData: any = {};
      updateData[field] = value;
      
      await playerApi.updatePlayer(playerId, updateData);
      
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, [field]: value } : p
      ));
    } catch (error) {
      console.error('Failed to update player:', error);
      setError('Failed to update player');
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;
    
    try {
      await playerApi.deletePlayer(playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    } catch (error) {
      console.error('Failed to delete player:', error);
      setError('Failed to delete player');
    }
  };

  const handleToggleDrafted = async (playerId: string, isDrafted: boolean) => {
    try {
      await playerApi.toggleDraftStatus(playerId, isDrafted);
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, isDrafted } : p
      ));
    } catch (error) {
      console.error('Failed to update draft status:', error);
      setError('Failed to update draft status');
    }
  };

  const handleAssignTier = async (playerId: string, tierId: string | null) => {
    try {
      await playerApi.assignPlayerToTier(playerId, tierId);
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, tier: tierId || undefined } : p
      ));
    } catch (error) {
      console.error('Failed to assign tier:', error);
      setError('Failed to assign tier');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError('');
    try {
      const response = await playerApi.exportPlayers();
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.setAttribute('download', `fantasy_players_${timestamp}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
    } catch (error: any) {
      console.error('Export failed:', error);
      setError('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getTierInfo = (tierId: string | undefined) => {
    if (!tierId) return null;
    return tiers.find(t => t.id === tierId);
  };

  const groupPlayersByTier = () => {
    const grouped = new Map<string, typeof filteredPlayers>();
    
    filteredPlayers.forEach(player => {
      const tierKey = player.tier || 'no-tier';
      if (!grouped.has(tierKey)) {
        grouped.set(tierKey, []);
      }
      grouped.get(tierKey)!.push(player);
    });
    
    const sortedGroups = Array.from(grouped.entries()).sort(([aTier], [bTier]) => {
      if (aTier === 'no-tier') return 1;
      if (bTier === 'no-tier') return -1;
      
      const tierA = tiers.find(t => t.id === aTier);
      const tierB = tiers.find(t => t.id === bTier);
      
      return (tierA?.order || 999) - (tierB?.order || 999);
    });
    
    return sortedGroups;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tierGroups = groupPlayersByTier();

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center mb-6 border border-red-200">
          {error}
        </div>
      )}
      
      {/* Header with Controls */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Player Database ({filteredPlayers.length} players)
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTagManager(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Tags
          </button>
          <button
            onClick={() => setShowTierManager(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Manage Tiers
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || players.length === 0}
            className={`flex items-center px-6 py-2 rounded-lg font-medium transition-all ${
              isExporting || players.length === 0
                ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
            }`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <PlayerFilters 
        {...filterProps}
        tags={tags}
        tiers={tiers}
        draftedCount={players.filter(p => p.isDrafted).length}
      />

      {/* Player Tables Grouped by Tier */}
      <div className="space-y-8">
        {tierGroups.map(([tierKey, tierPlayers]) => {
          const tierInfo = tierKey === 'no-tier' ? null : getTierInfo(tierKey);
          
          return (
            <PlayerTable
              key={tierKey}
              tierInfo={tierInfo}
              players={tierPlayers}
              tiers={tiers}
              onToggleDrafted={handleToggleDrafted}
              onAssignTier={handleAssignTier}
              onEditCell={handleCellEdit}
              onDelete={handleDeletePlayer}
              onShowDetail={setSelectedPlayerId}
              onShowNotes={setShowNoteManager}
            />
          );
        })}
      </div>

      {filteredPlayers.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          {players.length === 0 ? (
            <div>
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">No players found</h3>
              <p>Import an Excel file to get started with your fantasy draft analysis.</p>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium mb-2">No players match your filters</h3>
              <p>Try adjusting your search terms or filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedPlayerId && (
        <PlayerDetail
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {showTagManager && (
        <TagManager
          tags={tags}
          players={players}
          onClose={() => setShowTagManager(false)}
          onUpdate={() => {
            fetchTags();
            fetchPlayers();
          }}
        />
      )}

      {showTierManager && (
        <TierManager
          tiers={tiers}
          onClose={() => setShowTierManager(false)}
          onUpdate={() => {
            fetchTiers();
            fetchPlayers();
          }}
        />
      )}

      {showNoteManager && (
        <NoteManager
          playerId={showNoteManager}
          onClose={() => setShowNoteManager(null)}
          onUpdate={() => fetchPlayers()}
        />
      )}
    </div>
  );
}