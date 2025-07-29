import * as XLSX from 'xlsx';
import { Player } from '@prisma/client';

const safeNumber = (value: any): number | null => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

const safeString = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
};

export function parsePlayerData(filePath: string): Omit<Player, 'id'>[] {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData.map((row: any) => {
      // Map column names based on your example format
      const playerName = safeString(row['PLAYER'] || row['OVERALL PLAYER'] || row['Player Name']);
      const positionRank = safeString(row['POS RK'] || row['Position Rank']);
      const byeWeek = safeNumber(row['BYE'] || row['Bye Week']);
      const projectedPoints = safeNumber(row['FPS'] || row['Projected Points'] || row['FPTS']);
      const vorp = safeNumber(row['VORP'] || row['Value Over Replacement']);
      
      // Extract position from POS RK (e.g., "RB1" → "RB")
      let position = 'UNK';
      if (positionRank) {
        const positionMatch = positionRank.match(/^([A-Za-z]+)/);
        if (positionMatch) position = positionMatch[1].toUpperCase();
      }

      return {
        name: playerName || 'Unknown Player',
        position,
        team: null, // Not in your example file
        rank: safeNumber(row['RK'] || row['Rank']),
        positionalRank: positionRank,
        adp: null, // Not in your example file
        vorp: vorp,
        projectedPoints: projectedPoints,
        lastSeasonPoints: null, // Not in your example file
        byeWeek: byeWeek,
        userNotes: [],
        customTags: []
      } as unknown as Omit<Player, 'id'>;
    });
  } catch (error) {
    console.error('Excel parsing failed:', error);
    throw new Error('Failed to parse Excel file');
  }
}