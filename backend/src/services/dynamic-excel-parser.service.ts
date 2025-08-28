// backend/src/services/dynamic-excel-parser.service.ts
import * as XLSX from 'xlsx';
import { normalizePlayerName, normalizePosition, normalizeTeam } from '../utils/string.utils';

export interface DynamicExcelColumn {
  index: number;
  header: string;
  normalizedHeader: string;
  mappedField: string | null;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  sampleValues: any[];
}

export interface ParsedExcelData {
  columns: DynamicExcelColumn[];
  players: Array<{
    name: string;
    position?: string | undefined;
    team?: string | undefined;
    rowIndex: number;
    additionalData: Record<string, any>;
    confidence: number; // How confident we are in the parsing
  }>;
  metadata: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
    recognizedColumns: number;
    unknownColumns: string[];
  };
}

export class DynamicExcelParserService {
  private readonly CORE_FIELD_MAPPINGS: Record<string, string> = {
    // Name variations
    'name': 'name',
    'player': 'name',
    'playername': 'name',
    'overallplayer': 'name',
    'full name': 'name',
    'fullname': 'name',
    
    // Position variations
    'pos': 'position',
    'position': 'position',
    
    // Team variations
    'team': 'team',
    'tm': 'team',
    'nfl team': 'team',
    'nflteam': 'team',
    
    // Ranking variations
    'rank': 'rank',
    'rk': 'rank',
    'overall': 'rank',
    'overallrank': 'rank',
    'overall rank': 'rank',
    'customrank': 'customRank',
    'custom rank': 'customRank',
    
    // Position ranking
    'posrank': 'positionalRank',
    'positionrank': 'positionalRank',
    'pos rank': 'positionalRank',
    'position rank': 'positionalRank',
    'posrk': 'positionalRank',
    'pos rk': 'positionalRank',
    
    // Points and projections
    'points': 'projectedPoints',
    'projectedpoints': 'projectedPoints',
    'projected points': 'projectedPoints',
    'fpts': 'projectedPoints',
    'fps': 'projectedPoints',
    'proj': 'projectedPoints',
    'projection': 'projectedPoints',
    'proj pts': 'projectedPoints',
    'projpts': 'projectedPoints',
    
    // Advanced metrics
    'vorp': 'vorp',
    'value': 'vorp',
    'value over replacement': 'vorp',
    'valueoverreplacement': 'vorp',
    'adp': 'adp',
    'avgdraftposition': 'adp',
    'avg draft position': 'adp',
    'average draft position': 'adp',
    'averagedraftposition': 'adp',
    
    // Schedule
    'bye': 'byeWeek',
    'byeweek': 'byeWeek',
    'bye week': 'byeWeek',
    
    // Historical
    'lastseason': 'lastSeasonPoints',
    'last season': 'lastSeasonPoints',
    'lastyear': 'lastSeasonPoints',
    'last year': 'lastSeasonPoints',
    '2023': 'lastSeasonPoints',
    '2023points': 'lastSeasonPoints',
    '2023 points': 'lastSeasonPoints',
    'prev season': 'lastSeasonPoints',
    'previous season': 'lastSeasonPoints',
    'prevseason': 'lastSeasonPoints',
    'previousseason': 'lastSeasonPoints'
  };

  /**
   * Parse Excel file with dynamic column detection
   */
  async parseExcelFile(filePath: string, customMappings?: Record<string, string>): Promise<ParsedExcelData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      if (jsonData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Analyze columns
      const headers = (jsonData[0] as string[]).map(h => h?.toString().trim() || '');
      const dataRows = (jsonData.slice(1) as any[][]).filter((row: any[]) => 
        row && Array.isArray(row) && row.some(cell => cell != null && cell !== '')
      );
      
      const columns = this.analyzeColumns(headers, dataRows, customMappings);

      // Parse players
      const players = [];
      const skippedRows = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        try {
          const player = this.parsePlayerFromRow(row, columns, i);
          if (player) {
            players.push(player);
          } else {
            skippedRows.push(i);
          }
        } catch (error) {
          console.warn(`Failed to parse row ${i + 1}:`, error);
          skippedRows.push(i);
        }
      }

      return {
        columns,
        players,
        metadata: {
          totalRows: dataRows.length,
          validRows: players.length,
          skippedRows: skippedRows.length,
          recognizedColumns: columns.filter(c => c.mappedField !== null).length,
          unknownColumns: columns.filter(c => c.mappedField === null).map(c => c.header)
        }
      };

    } catch (error: any) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Get column analysis for preview without full parsing
   */
  async getColumnAnalysis(filePath: string): Promise<{
    columns: DynamicExcelColumn[];
    sampleRows: any[][];
  }> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      if (jsonData.length < 1) {
        throw new Error('Excel file appears to be empty');
      }

      const headers = (jsonData[0] as string[]).map(h => h?.toString().trim() || '');
      const allDataRows = jsonData.slice(1).filter((row: any) => 
        row && Array.isArray(row) && (row as any[]).some(cell => cell != null && cell !== '')
      ) as any[][];
      
      const dataRows = allDataRows.slice(0, Math.min(10, allDataRows.length)); // First 10 data rows
      
      const columns = this.analyzeColumns(headers, dataRows);

      return {
        columns,
        sampleRows: allDataRows.slice(0, 5) // First 5 rows for preview
      };

    } catch (error: any) {
      throw new Error(`Failed to analyze Excel file: ${error.message}`);
    }
  }

  /**
   * Analyze columns and detect their types and mappings
   */
  private analyzeColumns(
    headers: string[], 
    dataRows: any[][],
    customMappings?: Record<string, string>
  ): DynamicExcelColumn[] {
    return headers.map((header, index) => {
      const normalizedHeader = this.normalizeHeader(header);
      
      // Get sample values for type detection
      const sampleValues = dataRows
        .slice(0, Math.min(10, dataRows.length))
        .map(row => row[index])
        .filter(val => val != null && val !== '');

      // Determine field mapping
      let mappedField = null;
      
      // Check custom mappings first
      if (customMappings && customMappings[header]) {
        mappedField = customMappings[header];
      } else if (this.CORE_FIELD_MAPPINGS[normalizedHeader]) {
        mappedField = this.CORE_FIELD_MAPPINGS[normalizedHeader];
      }

      return {
        index,
        header,
        normalizedHeader,
        mappedField,
        dataType: this.detectDataType(sampleValues),
        sampleValues: sampleValues.slice(0, 3) // Keep only first 3 samples
      };
    });
  }

  /**
   * Parse a single player from a row
   */
  private parsePlayerFromRow(
    row: any[], 
    columns: DynamicExcelColumn[], 
    rowIndex: number
  ): ParsedExcelData['players'][0] | null {
    const additionalData: Record<string, any> = {};
    let name = '';
    let position: string | undefined;
    let team: string | undefined;
    let confidence = 0.5; // Base confidence

    // Extract data based on column mappings
    columns.forEach(col => {
      const value = row[col.index];
      if (value == null || value === '') return;

      if (col.mappedField === 'name') {
        name = normalizePlayerName(value.toString());
        confidence += 0.3; // Having a name increases confidence
      } else if (col.mappedField === 'position') {
        position = normalizePosition(value.toString());
        confidence += 0.1;
      } else if (col.mappedField === 'team') {
        team = normalizeTeam(value.toString());
        confidence += 0.1;
      } else if (col.mappedField) {
        // Store mapped field
        additionalData[col.mappedField] = this.parseValue(value, col.dataType);
        confidence += 0.05; // Each additional field increases confidence slightly
      } else {
        // Store unmapped column for potential future use
        additionalData[col.header] = value;
      }
    });

    // Must have a name to be valid
    if (!name.trim()) {
      return null;
    }

    return {
      name,
      position,
      team,
      rowIndex: rowIndex + 1, // +1 because we removed header row
      additionalData,
      confidence: Math.min(1, confidence)
    };
  }

  /**
   * Normalize header for mapping lookup
   */
  private normalizeHeader(header: string): string {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Detect the data type of column values
   */
  private detectDataType(sampleValues: any[]): 'string' | 'number' | 'boolean' | 'date' {
    if (sampleValues.length === 0) return 'string';

    const numericCount = sampleValues.filter(val => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    }).length;
    
    const dateCount = sampleValues.filter(val => {
      const dateVal = new Date(val);
      return !isNaN(dateVal.getTime()) && val.toString().match(/\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/);
    }).length;
    
    const booleanCount = sampleValues.filter(val => 
      ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(val.toString().toLowerCase())
    ).length;

    const total = sampleValues.length;
    
    if (booleanCount / total > 0.8) return 'boolean';
    if (numericCount / total > 0.7) return 'number';
    if (dateCount / total > 0.7) return 'date';
    
    return 'string';
  }

  /**
   * Parse value according to detected type
   */
  private parseValue(value: any, dataType: string): any {
    if (value == null || value === '') return null;

    switch (dataType) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        const str = value.toString().toLowerCase();
        return ['true', '1', 'yes', 'y'].includes(str);
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      default:
        return value.toString().trim();
    }
  }

  /**
   * Get available field options for mapping
   */
  getAvailableFields(): Array<{ value: string; label: string; description?: string }> {
    return [
      { value: 'name', label: 'Player Name', description: 'Full player name' },
      { value: 'position', label: 'Position', description: 'QB, RB, WR, TE, K, DEF' },
      { value: 'team', label: 'Team', description: 'NFL team abbreviation' },
      { value: 'rank', label: 'Overall Rank', description: 'Overall fantasy ranking' },
      { value: 'customRank', label: 'Custom Rank', description: 'Your custom ranking' },
      { value: 'positionalRank', label: 'Position Rank', description: 'Rank within position' },
      { value: 'projectedPoints', label: 'Projected Points', description: 'Fantasy points projection' },
      { value: 'vorp', label: 'VORP/Value', description: 'Value over replacement player' },
      { value: 'adp', label: 'ADP', description: 'Average draft position' },
      { value: 'byeWeek', label: 'Bye Week', description: 'Week number for bye' },
      { value: 'lastSeasonPoints', label: 'Last Season Points', description: 'Previous season fantasy points' }
    ];
  }
}