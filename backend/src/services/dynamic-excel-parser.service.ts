// backend/src/services/dynamic-excel-parser.service.ts
import * as XLSX from 'xlsx';
import { normalizePlayerName, normalizePosition, normalizeTeam } from '../utils/string-utils';

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
    
    // Position variations
    'pos': 'position',
    'position': 'position',
    
    // Team variations
    'team': 'team',
    'tm': 'team',
    
    // Ranking variations
    'rank': 'rank',
    'rk': 'rank',
    'overall': 'rank',
    'overallrank': 'rank',
    'customrank': 'customRank',
    
    // Position ranking
    'posrank': 'positionalRank',
    'positionrank': 'positionalRank',
    'posrk': 'positionalRank',
    
    // Points and projections
    'points': 'projectedPoints',
    'projectedpoints': 'projectedPoints',
    'fpts': 'projectedPoints',
    'fps': 'projectedPoints',
    'proj': 'projectedPoints',
    'projection': 'projectedPoints',
    
    // Advanced metrics
    'vorp': 'vorp',
    'value': 'vorp',
    'adp': 'adp',
    'avgdraftposition': 'adp',
    
    // Schedule
    'bye': 'byeWeek',
    'byeweek': 'byeWeek',
    
    // Historical
    'lastseason': 'lastSeasonPoints',
    'lastyear': 'lastSeasonPoints',
    '2023': 'lastSeasonPoints',
    '2023points': 'lastSeasonPoints'
  };

  /**
   * Parse Excel file with dynamic column detection
   */
  async parseExcelFile(filePath: string): Promise<ParsedExcelData> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to raw array data
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (rawData.length < 2) {
        throw new Error('Excel file must contain at least header and one data row');
      }

      // Analyze columns
      const columns = this.analyzeColumns(rawData);
      
      // Parse player data
      const { players, metadata } = this.parsePlayerData(rawData, columns);
      
      return {
        columns,
        players,
        metadata: {
          ...metadata,
          recognizedColumns: columns.filter(c => c.mappedField).length,
          unknownColumns: columns.filter(c => !c.mappedField).map(c => c.header)
        }
      };

    } catch (error: any) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Analyze columns to detect their purpose and data types
   */
  private analyzeColumns(rawData: any[][]): DynamicExcelColumn[] {
    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1, 6); // Sample first 5 rows for analysis
    
    return headers.map((header, index) => {
      const normalizedHeader = this.normalizeHeader(header);
      const sampleValues = dataRows
        .map(row => row[index])
        .filter(val => val !== null && val !== undefined && val !== '');
      
      return {
        index,
        header: header || `Column_${index}`,
        normalizedHeader,
        mappedField: this.mapHeaderToField(normalizedHeader),
        dataType: this.detectDataType(sampleValues),
        sampleValues: sampleValues.slice(0, 3) // Keep first 3 samples
      };
    });
  }

  /**
   * Parse player data using column analysis
   */
  private parsePlayerData(
    rawData: any[][],
    columns: DynamicExcelColumn[]
  ): { 
    players: ParsedExcelData['players'], 
    metadata: Pick<ParsedExcelData['metadata'], 'totalRows' | 'validRows' | 'skippedRows'> 
  } {
    const dataRows = rawData.slice(1);
    const players: ParsedExcelData['players'] = [];
    let validRows = 0;
    let skippedRows = 0;

    // Find core columns
    const nameColumn = columns.find(c => c.mappedField === 'name');
    const positionColumn = columns.find(c => c.mappedField === 'position');
    const teamColumn = columns.find(c => c.mappedField === 'team');

    if (!nameColumn) {
      throw new Error('Could not identify player name column');
    }

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell)) {
        skippedRows++;
        continue;
      }

      const name = this.cleanValue(row[nameColumn.index]);
      if (!name) {
        skippedRows++;
        continue;
      }

      // Extract core data
      const position = positionColumn ? 
        normalizePosition(this.cleanValue(row[positionColumn.index])) || undefined : undefined;
      const team = teamColumn ? 
        normalizeTeam(this.cleanValue(row[teamColumn.index])) || undefined : undefined;

      // Extract additional data from all other columns
      const additionalData: Record<string, any> = {};
      let confidence = 0.8; // Base confidence

      columns.forEach(column => {
        const value = this.cleanValue(row[column.index]);
        if (value === null || value === undefined) return;

        if (column.mappedField && column.mappedField !== 'name') {
          // This is a recognized field
          additionalData[column.mappedField] = this.convertValue(value, column.dataType);
          confidence += 0.02; // Boost confidence for recognized fields
        } else if (column.header !== name) {
          // Store unknown columns with their original header names
          const key = `custom_${column.normalizedHeader}`;
          additionalData[key] = this.convertValue(value, column.dataType);
        }
      });

      players.push({
        name: normalizePlayerName(name),
        position,
        team,
        rowIndex: rowIndex + 2, // +2 for 1-based indexing and header row
        additionalData,
        confidence: Math.min(confidence, 1.0)
      });

      validRows++;
    }

    return {
      players,
      metadata: {
        totalRows: dataRows.length,
        validRows,
        skippedRows
      }
    };
  }

  /**
   * Normalize header names for consistent mapping
   */
  private normalizeHeader(header: string): string {
    if (!header) return '';
    
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
      .trim();
  }

  /**
   * Map normalized header to known field
   */
  private mapHeaderToField(normalizedHeader: string): string | null {
    // Direct match
    if (this.CORE_FIELD_MAPPINGS[normalizedHeader]) {
      return this.CORE_FIELD_MAPPINGS[normalizedHeader];
    }

    // Partial matches for flexibility
    for (const [key, field] of Object.entries(this.CORE_FIELD_MAPPINGS)) {
      if (normalizedHeader.includes(key) || key.includes(normalizedHeader)) {
        return field;
      }
    }

    return null;
  }

  /**
   * Detect data type from sample values
   */
  private detectDataType(values: any[]): 'string' | 'number' | 'boolean' | 'date' {
    if (values.length === 0) return 'string';

    let numberCount = 0;
    let booleanCount = 0;
    let dateCount = 0;

    for (const value of values) {
      if (this.isNumber(value)) numberCount++;
      else if (this.isBoolean(value)) booleanCount++;
      else if (this.isDate(value)) dateCount++;
    }

    const total = values.length;
    
    // If 80% or more are numbers, consider it numeric
    if (numberCount / total >= 0.8) return 'number';
    
    // If 80% or more are booleans, consider it boolean
    if (booleanCount / total >= 0.8) return 'boolean';
    
    // If 60% or more are dates, consider it date
    if (dateCount / total >= 0.6) return 'date';
    
    return 'string';
  }

  /**
   * Check if value is a number
   */
  private isNumber(value: any): boolean {
    if (typeof value === 'number') return !isNaN(value);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed !== '' && !isNaN(Number(trimmed));
    }
    return false;
  }

  /**
   * Check if value is a boolean
   */
  private isBoolean(value: any): boolean {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return ['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(lower);
    }
    return false;
  }

  /**
   * Check if value is a date
   */
  private isDate(value: any): boolean {
    if (value instanceof Date) return !isNaN(value.getTime());
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * Clean and normalize cell values
   */
  private cleanValue(value: any): any {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '-' || trimmed === 'N/A') return null;
      return trimmed;
    }
    
    return value;
  }

  /**
   * Convert value to appropriate type
   */
  private convertValue(value: any, dataType: string): any {
    if (value === null || value === undefined) return null;

    switch (dataType) {
      case 'number':
        const num = typeof value === 'number' ? value : parseFloat(value.toString());
        return isNaN(num) ? null : num;
        
      case 'boolean':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase().trim();
          if (['true', 'yes', 'y', '1'].includes(lower)) return true;
          if (['false', 'no', 'n', '0'].includes(lower)) return false;
        }
        return null;
        
      case 'date':
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
        
      default:
        return value.toString();
    }
  }

  /**
   * Generate a preview of what will be imported
   */
  async generateImportPreview(filePath: string): Promise<{
    summary: {
      totalRows: number;
      validPlayers: number;
      recognizedColumns: number;
      unknownColumns: number;
    };
    columnMapping: Array<{
      header: string;
      mappedTo: string | null;
      dataType: string;
      sampleValue: any;
    }>;
    samplePlayers: Array<{
      name: string;
      position?: string;
      recognizedFields: Record<string, any>;
      unknownFields: Record<string, any>;
    }>;
    warnings: string[];
  }> {
    const parsed = await this.parseExcelFile(filePath);
    
    const warnings: string[] = [];
    
    // Check for common issues
    if (parsed.metadata.unknownColumns.length > parsed.metadata.recognizedColumns) {
      warnings.push('More unknown columns than recognized ones - check column headers');
    }
    
    if (parsed.players.some(p => p.confidence < 0.7)) {
      warnings.push('Some rows have low confidence parsing - manual review recommended');
    }
    
    const nameColumn = parsed.columns.find(c => c.mappedField === 'name');
    if (!nameColumn) {
      warnings.push('Could not identify player name column');
    }

    return {
      summary: {
        totalRows: parsed.metadata.totalRows,
        validPlayers: parsed.metadata.validRows,
        recognizedColumns: parsed.metadata.recognizedColumns,
        unknownColumns: parsed.metadata.unknownColumns.length
      },
      columnMapping: parsed.columns.map(col => ({
        header: col.header,
        mappedTo: col.mappedField,
        dataType: col.dataType,
        sampleValue: col.sampleValues[0] || null
      })),
      samplePlayers: parsed.players.slice(0, 5).map(player => {
        const recognizedFields: Record<string, any> = {};
        const unknownFields: Record<string, any> = {};
        
        Object.entries(player.additionalData).forEach(([key, value]) => {
          if (key.startsWith('custom_')) {
            unknownFields[key.replace('custom_', '')] = value;
          } else {
            recognizedFields[key] = value;
          }
        });
        
        return {
          name: player.name,
          position: player.position,
          recognizedFields,
          unknownFields
        };
      }),
      warnings
    };
  }
}