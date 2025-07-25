// src/data/excel-parser.ts
import { Player } from '../models/player.model';
import * as XLSX from 'xlsx';

export function parsePlayerData(filePath: string): Omit<Player, 'id'>[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
  
  return jsonData.map((p: any) => {
    // Safely extract position
    let position = 'UNK';
    if (p['POS RK']) {
      const positionMatch = p['POS RK'].toString().match(/^([A-Z]+)/);
      if (positionMatch) position = positionMatch[1];
    }
    
    // Helper function to safely parse values
    const safeNumber = (value: any): number | null => {
      if (value === undefined || value === null) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };
    
    // Return with all fields matching Player type
    return {
      name: p.PLAYER || p.NAME || p.Player || 'Unknown Player',
      position,
      team: p.TEAM || null,
      rank: safeNumber(p.RK),
      positionalRank: p['POS RK'] || null,
      adp: safeNumber(p.ADP),
      vorp: safeNumber(p.VORP),
      projectedPoints: safeNumber(p.FPS),
      lastSeasonPoints: safeNumber(p['LAST SEASON']),
      byeWeek: safeNumber(p.BYE),
      userNotes: [],
      customTags: []
    } as Omit<Player, 'id'>;
  });
}