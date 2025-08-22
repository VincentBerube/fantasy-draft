// backend/src/utils/string-utils.ts

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Normalize player names for matching
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Extract first and last name components
 */
export function extractNameComponents(fullName: string): { first: string; last: string; middle?: string } {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  
  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] };
  }
  
  // Handle middle names, suffixes, etc.
  const last = parts[parts.length - 1];
  const first = parts[0];
  const middle = parts.slice(1, -1).join(' ');
  
  return { first, last, middle };
}

/**
 * Check if names are similar enough to be considered a match
 */
export function areNamesSimilar(name1: string, name2: string, threshold: number = 0.8): boolean {
  const norm1 = normalizePlayerName(name1);
  const norm2 = normalizePlayerName(name2);
  
  if (norm1 === norm2) return true;
  
  const maxLength = Math.max(norm1.length, norm2.length);
  if (maxLength === 0) return false;
  
  const distance = levenshteinDistance(norm1, norm2);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

/**
 * Common name variations and nicknames
 */
export const NAME_VARIATIONS: Record<string, string[]> = {
  'alexander': ['alex', 'al'],
  'anthony': ['tony'],
  'benjamin': ['ben'],
  'christopher': ['chris'],
  'daniel': ['dan', 'danny'],
  'david': ['dave'],
  'elizabeth': ['liz', 'beth'],
  'james': ['jim', 'jimmy'],
  'john': ['johnny'],
  'joseph': ['joe', 'joey'],
  'joshua': ['josh'],
  'matthew': ['matt'],
  'michael': ['mike'],
  'nicholas': ['nick'],
  'robert': ['rob', 'bob', 'bobby'],
  'samuel': ['sam'],
  'thomas': ['tom', 'tommy'],
  'william': ['will', 'bill', 'billy']
};

/**
 * Check if two names could be nickname variations
 */
export function checkNicknameMatch(name1: string, name2: string): boolean {
  const norm1 = normalizePlayerName(name1);
  const norm2 = normalizePlayerName(name2);
  
  // Extract first names
  const first1 = norm1.split(' ')[0];
  const first2 = norm2.split(' ')[0];
  
  // Check if one is a known nickname of the other
  for (const [fullName, nicknames] of Object.entries(NAME_VARIATIONS)) {
    if ((first1 === fullName && nicknames.includes(first2)) ||
        (first2 === fullName && nicknames.includes(first1)) ||
        (nicknames.includes(first1) && nicknames.includes(first2))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Clean and standardize team abbreviations
 */
export function normalizeTeam(team: string | null | undefined): string | null {
  if (!team) return null;
  
  const teamMap: Record<string, string> = {
    'SF': 'SF', 'SAN FRANCISCO': 'SF',
    'KC': 'KC', 'KANSAS CITY': 'KC',
    'BUF': 'BUF', 'BUFFALO': 'BUF',
    'TB': 'TB', 'TAMPA BAY': 'TB',
    'GB': 'GB', 'GREEN BAY': 'GB',
    'NE': 'NE', 'NEW ENGLAND': 'NE',
    'NO': 'NO', 'NEW ORLEANS': 'NO',
    'LAR': 'LAR', 'LA RAMS': 'LAR', 'LOS ANGELES RAMS': 'LAR',
    'LAC': 'LAC', 'LA CHARGERS': 'LAC', 'LOS ANGELES CHARGERS': 'LAC',
    'LV': 'LV', 'LAS VEGAS': 'LV', 'RAIDERS': 'LV',
    'WSH': 'WSH', 'WASHINGTON': 'WSH',
    // Add more as needed
  };
  
  const normalized = team.toUpperCase().trim();
  return teamMap[normalized] || normalized;
}

/**
 * Parse and clean position strings
 */
export function normalizePosition(position: string | null | undefined): string | null {
  if (!position) return null;
  
  const pos = position.toString().trim().toUpperCase();
  
  // Handle position with rank (e.g., "RB1" -> "RB")
  const match = pos.match(/^([A-Z]+)/);
  const cleanPos = match ? match[1] : pos;
  
  // Standardize position names
  const positionMap: Record<string, string> = {
    'QB': 'QB',
    'RB': 'RB',
    'WR': 'WR', 
    'TE': 'TE',
    'K': 'K',
    'DST': 'DST',
    'DEF': 'DST', // Defense -> DST
    'FLEX': 'FLEX'
  };
  
  return positionMap[cleanPos] || cleanPos;
}