import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Enhanced field mapping configuration
const FIELD_MAPPINGS: Record<string, string> = {
  // Rankings
  'RK': 'rank',
  'RANK': 'rank',
  'OVERALL': 'rank',
  'OVERALL RANK': 'rank',
  
  // Player info
  'OVERALL PLAYER': 'name',
  'PLAYER': 'name',
  'PLAYER NAME': 'name',
  'NAME': 'name',
  
  // Position info
  'POS RK': 'positionalRank',
  'POSITION RANK': 'positionalRank',
  'POS RANK': 'positionalRank',
  'POS': 'position',
  'POSITION': 'position',
  
  // Team and schedule
  'TEAM': 'team',
  'TM': 'team',
  'BYE': 'byeWeek',
  'BYE WEEK': 'byeWeek',
  
  // Projections and stats
  'FPS': 'projectedPoints',
  'FPTS': 'projectedPoints',
  'PROJECTED POINTS': 'projectedPoints',
  'PROJ PTS': 'projectedPoints',
  'POINTS': 'projectedPoints',
  
  // Advanced metrics
  'VORP': 'vorp',
  'VALUE': 'vorp',
  'ADP': 'adp',
  'AVG DRAFT POSITION': 'adp',
  
  // Historical data
  'LAST SEASON': 'lastSeasonPoints',
  'LAST SEASON POINTS': 'lastSeasonPoints',
  '2023 POINTS': 'lastSeasonPoints',
  'PREV SEASON': 'lastSeasonPoints'
};

// Interface for parsed player data
interface ParsedPlayer {
  name: string;
  position: string;
  rank?: number;
  positionalRank?: string;
  team?: string;
  byeWeek?: number;
  projectedPoints?: number;
  vorp?: number;
  adp?: number;
  lastSeasonPoints?: number;
}

export function parsePlayerData(filePath: string): ParsedPlayer[] {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      throw new Error('Excel file must contain at least a header row and one data row');
    }
    
    // Get headers and normalize them
    const headers = (jsonData[0] as string[]).map(header => 
      header?.toString().trim().toUpperCase() || ''
    );
    
    console.log('Found headers:', headers);
    
    // Create mapping from column index to field name
    const columnMapping: Record<number, string> = {};
    headers.forEach((header, index) => {
      if (FIELD_MAPPINGS[header]) {
        columnMapping[index] = FIELD_MAPPINGS[header];
        console.log(`Mapped column ${index} (${header}) to ${FIELD_MAPPINGS[header]}`);
      }
    });
    
    if (Object.keys(columnMapping).length === 0) {
      throw new Error('No recognized columns found. Expected columns like: RK, OVERALL PLAYER, POS, etc.');
    }
    
    // Parse data rows
    const players: ParsedPlayer[] = [];
    const dataRows = jsonData.slice(1) as any[][];
    
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        continue;
      }
      
      const player: any = {};
      
      // Map each column to the corresponding field
      Object.entries(columnMapping).forEach(([colIndex, fieldName]) => {
        const value = row[parseInt(colIndex)];
        if (value !== undefined && value !== null && value !== '') {
          player[fieldName] = value;
        }
      });
      
      // Data cleaning and validation
      if (!player.name || !player.position) {
        console.warn(`Row ${rowIndex + 2}: Missing name or position, skipping`);
        continue;
      }
      
      // Clean and convert data types
      const cleanedPlayer: ParsedPlayer = {
        name: cleanName(player.name),
        position: cleanPosition(player.position),
        rank: cleanNumber(player.rank),
        positionalRank: cleanPositionalRank(player.positionalRank),
        team: cleanTeam(player.team),
        byeWeek: cleanNumber(player.byeWeek),
        projectedPoints: cleanFloat(player.projectedPoints),
        vorp: cleanFloat(player.vorp),
        adp: cleanFloat(player.adp),
        lastSeasonPoints: cleanFloat(player.lastSeasonPoints)
      };
      
      players.push(cleanedPlayer);
    }
    
    console.log(`Successfully parsed ${players.length} players from Excel file`);
    return players;
    
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Data cleaning functions
function cleanName(name: any): string {
  if (!name) return '';
  return name.toString().trim().replace(/\s+/g, ' ');
}

function cleanPosition(position: any): string {
  if (!position) return '';
  const pos = position.toString().trim().toUpperCase();
  
  // Handle position with rank (e.g., "RB1" -> "RB")
  const match = pos.match(/^([A-Z]+)/);
  return match ? match[1] : pos;
}

function cleanPositionalRank(posRank: any): string | undefined {
  if (!posRank) return undefined;
  return posRank.toString().trim();
}

function cleanTeam(team: any): string | undefined {
  if (!team) return undefined;
  return team.toString().trim().toUpperCase();
}

function cleanNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  
  const num = typeof value === 'number' ? value : parseFloat(value.toString());
  return isNaN(num) ? undefined : Math.round(num);
}

function cleanFloat(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  
  const num = typeof value === 'number' ? value : parseFloat(value.toString());
  return isNaN(num) ? undefined : num;
}

// Export function for backward compatibility
export const ExcelParser = {
  async parseAndImport(fileBuffer: Buffer) {
    // This is the old implementation - keeping for compatibility
    // but the new parsePlayerData function above is preferred
    throw new Error('This method is deprecated. Use parsePlayerData instead.');
  }
};