// src/components/PlayerList/PlayerFilters.tsx
import type { Tag, Tier } from '../../api/playerApi';

interface PlayerFiltersProps {
  // Filter values
  searchTerm: string;
  positionFilter: string;
  teamFilter: string;
  tierFilter: string;
  tagFilter: string;
  sortBy: string;
  sortOrder: string;
  hideDrafted: boolean;
  
  // Filter options
  positions: string[];
  teams: string[];
  tiers: Tier[];
  tags: Tag[];
  
  // Player counts
  draftedCount: number;
  
  // Handlers
  setSearchTerm: (value: string) => void;
  setPositionFilter: (value: string) => void;
  setTeamFilter: (value: string) => void;
  setTierFilter: (value: string) => void;
  setTagFilter: (value: string) => void;
  handleSortChange: (sortBy: string, sortOrder: string) => void;
  setHideDrafted: (value: boolean) => void;
}

export function PlayerFilters({
  searchTerm,
  positionFilter,
  teamFilter,
  tierFilter,
  tagFilter,
  sortBy,
  sortOrder,
  hideDrafted,
  positions,
  teams,
  tiers,
  tags,
  draftedCount,
  setSearchTerm,
  setPositionFilter,
  setTeamFilter,
  setTierFilter,
  setTagFilter,
  handleSortChange,
  setHideDrafted
}: PlayerFiltersProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6 border">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
          <input
            type="text"
            placeholder="Search by name, position, or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Position Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Positions</option>
            {positions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        {/* Team Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        {/* Tier Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Tiers</option>
            {tiers.map(tier => (
              <option key={tier.id} value={tier.id}>{tier.name}</option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tag</label>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Tags</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              handleSortChange(field, order);
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="customRank-asc">Custom Rank (Low to High)</option>
            <option value="customRank-desc">Custom Rank (High to Low)</option>
            <option value="rank-asc">Original Rank (Low to High)</option>
            <option value="rank-desc">Original Rank (High to Low)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="projectedPoints-desc">Projected Points (High to Low)</option>
            <option value="projectedPoints-asc">Projected Points (Low to High)</option>
            <option value="vorp-desc">VORP (High to Low)</option>
            <option value="vorp-asc">VORP (Low to High)</option>
          </select>
        </div>
      </div>

      {/* Additional Controls */}
      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={hideDrafted}
            onChange={(e) => setHideDrafted(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">Hide drafted players</span>
        </label>
        
        <div className="text-sm text-gray-600">
          {draftedCount} players drafted
        </div>
      </div>
    </div>
  );
}