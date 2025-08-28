// backend/src/utils/string.utils.ts

/**
 * Normalize player names for consistent matching
 */
export function normalizePlayerName(name: string): string {
  if (!name) return '';
  
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1, // deletion
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  
  return 1 - (distance / maxLength);
}

/**
 * Extract and clean player name from various formats
 */
export function extractPlayerName(rawName: string): string {
  if (!rawName) return '';
  
  // Remove common prefixes/suffixes and clean up
  return rawName
    .replace(/^\d+[\.\)]\s*/, '') // Remove rank numbers like "1. " or "1) "
    .replace(/\([^)]*\)/g, '') // Remove parenthetical content
    .replace(/,.*$/, '') // Remove everything after comma
    .trim();
}

/**
 * Normalize team abbreviations
 */
export function normalizeTeam(team: string): string | null {
  if (!team) return null;
  
  const teamMap: Record<string, string> = {
    'JAX': 'JAC',
    'JAC': 'JAC',
    'LV': 'LV',
    'LAS': 'LV',
    'TB': 'TB',
    'TBB': 'TB',
    'WSH': 'WAS',
    'WAS': 'WAS',
    'NE': 'NE',
    'NEP': 'NE'
  };
  
  const normalized = team.toUpperCase().trim();
  return teamMap[normalized] || normalized;
}

/**
 * Normalize position abbreviations
 */
export function normalizePosition(position: string): string {
  if (!position) return '';
  
  const positionMap: Record<string, string> = {
    'QB': 'QB',
    'RB': 'RB', 
    'WR': 'WR',
    'TE': 'TE',
    'K': 'K',
    'DST': 'DST',
    'D/ST': 'DST',
    'DEF': 'DST',
    'DEFENSE': 'DST',
    'KICKER': 'K',
    'QUARTERBACK': 'QB',
    'RUNNINGBACK': 'RB',
    'RUNNING BACK': 'RB',
    'WIDE RECEIVER': 'WR',
    'WIDERECEIVER': 'WR',
    'TIGHT END': 'TE',
    'TIGHTEND': 'TE'
  };
  
  const normalized = position.toUpperCase().trim();
  return positionMap[normalized] || normalized;
}

/**
 * Clean and validate numeric values
 */
export function cleanNumericValue(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Convert to string and remove any non-numeric characters except decimal point
  const cleanedValue = String(value).replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanedValue);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Clean and validate integer values
 */
export function cleanIntegerValue(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const cleanedValue = String(value).replace(/[^\d-]/g, '');
  const parsed = parseInt(cleanedValue, 10);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Check if a string looks like a player name
 */
export function looksLikePlayerName(value: string): boolean {
  if (!value || value.trim().length < 2) return false;
  
  // Should contain at least one letter
  if (!/[a-zA-Z]/.test(value)) return false;
  
  // Should not be all numbers
  if (/^\d+$/.test(value.trim())) return false;
  
  // Should not contain too many special characters
  const specialCharCount = (value.match(/[^a-zA-Z0-9\s.'/-]/g) || []).length;
  if (specialCharCount > value.length * 0.3) return false;
  
  return true;
}

/**
 * Extract positional rank from mixed strings (e.g., "RB12" → "12")
 */
export function extractPositionalRank(value: string): string | null {
  if (!value) return null;
  
  const match = value.match(/([A-Z]+)(\d+)/);
  return match ? match[2] : null;
}