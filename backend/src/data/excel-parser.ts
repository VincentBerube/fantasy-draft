import * as XLSX from 'xlsx';
import { Player } from '../models/player.model';

interface ExcelPlayer {
  RK: number;
  PLAYER: string;
  'POS RK': string;
  BYE: number;
  FPS: number;
  VORP: number;
}

export function parsePlayerData(filePath: string): Player[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData: ExcelPlayer[] = XLSX.utils.sheet_to_json(worksheet);
  
  return jsonData.map(player => {
    // Extract position from POS RK (e.g., "RB12" → position: "RB")
    const positionMatch = player['POS RK'].match(/^([A-Z]+)/);
    const position = positionMatch ? positionMatch[1] : 'UNK';
    
    return {
      name: player.PLAYER,
      position: position as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF',
      rank: player.RK,
      positionalRank: player['POS RK'],
      byeWeek: player.BYE,
      projectedPoints: player.FPS,
      vorp: player.VORP,
      // ESPN-specific data to be added later
      team: '',
      adp: 0,
      lastSeasonPoints: 0
    };
  });
}