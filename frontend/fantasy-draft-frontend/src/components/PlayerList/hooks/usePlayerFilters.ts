// src/components/PlayerList/hooks/usePlayerFilters.ts
import { useState, useMemo } from 'react';
import type { Player } from '../../../api/playerApi';

export function usePlayerFilters(players: Player[]) {
  // Filter states
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'name' | 'projectedPoints' | 'vorp' | 'customRank'>('customRank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [hideDrafted, setHideDrafted] = useState(false);

  // Get unique values for filter dropdowns
  const positions = useMemo(() => [...new Set(players.map(p => p.position))].sort(), [players]);
  const teams = useMemo(() => [...new Set(players.map(p => p.team).filter(Boolean))].sort() as string[], [players]);

  // Filtered and sorted players
  const filteredPlayers = useMemo(() => {
    let filtered = [...players];

    // Apply filters
    if (positionFilter !== 'ALL') {
      filtered = filtered.filter(player => player.position === positionFilter);
    }

    if (teamFilter !== 'ALL') {
      filtered = filtered.filter(player => player.team === teamFilter);
    }

    if (tierFilter !== 'ALL') {
      filtered = filtered.filter(player => player.tierId === tierFilter);
    }

    if (tagFilter !== 'ALL') {
      filtered = filtered.filter(player => 
        player.playerTags.some(pt => pt.tag.id === tagFilter)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(term) ||
        player.position.toLowerCase().includes(term) ||
        player.team?.toLowerCase().includes(term) ||
        player.aliases.some(alias => alias.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'projectedPoints':
          aVal = a.projectedPoints || 0;
          bVal = b.projectedPoints || 0;
          break;
        case 'vorp':
          aVal = a.vorp || 0;
          bVal = b.vorp || 0;
          break;
        case 'customRank':
          aVal = a.customRank || a.rank || 999;
          bVal = b.customRank || b.rank || 999;
          break;
        case 'rank':
        default:
          aVal = a.rank || 999;
          bVal = b.rank || 999;
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return filtered;
  }, [players, positionFilter, teamFilter, tierFilter, tagFilter, searchTerm, sortBy, sortOrder]);

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy as typeof sortBy);
    setSortOrder(newSortOrder as 'asc' | 'desc');
  };

  return {
    // Filter values
    positionFilter,
    teamFilter,
    tierFilter,
    tagFilter,
    searchTerm,
    sortBy,
    sortOrder,
    hideDrafted,
    
    // Filter options
    positions,
    teams,
    
    // Filtered results
    filteredPlayers,
    
    // Setters
    setPositionFilter,
    setTeamFilter,
    setTierFilter,
    setTagFilter,
    setSearchTerm,
    handleSortChange,
    setHideDrafted,
  };
}