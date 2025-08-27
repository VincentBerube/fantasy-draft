// backend/src/utils/string-utils.ts

/**
 * Normalize player name for consistent matching
 */
export function normalizePlayerName(name: string): string {
  if (!name) return '';
  
  return name
    .toString()
    .trim()
    .replace(/[^\w\s.-]/g, '') // Remove special characters except dots, hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .toLowerCase();
}

/**
 * Normalize position string
 */
export function normalizePosition(position: string): string {
  if (!position) return '';
  
  const pos = position.toString().trim().toUpperCase();
  
  // Handle common variations
  const positionMap: Record<string, string> = {
    'QUARTERBACK': 'QB',
    'RUNNINGBACK': 'RB',
    'RUNNING-BACK': 'RB',
    'RUNNING_BACK': 'RB',
    'WIDERECEIVER': 'WR',
    'WIDE-RECEIVER': 'WR',
    'WIDE_RECEIVER': 'WR',
    'TIGHTEND': 'TE',
    'TIGHT-END': 'TE',
    'TIGHT_END': 'TE',
    'DEFENSE': 'DEF',
    'DEFENCE': 'DEF',
    'D/ST': 'DEF',
    'DST': 'DEF',
    'KICKER': 'K',
    'PLACEKICKER': 'K',
    'PK': 'K'
  };
  
  return positionMap[pos] || pos;
}

/**
 * Normalize team name
 */
export function normalizeTeam(team: string): string {
  if (!team) return '';
  
  const teamStr = team.toString().trim().toUpperCase();
  
  // Handle common team name variations
  const teamMap: Record<string, string> = {
    'ARIZONA': 'ARI',
    'CARDINALS': 'ARI',
    'ARIZONA CARDINALS': 'ARI',
    'ATLANTA': 'ATL',
    'FALCONS': 'ATL',
    'ATLANTA FALCONS': 'ATL',
    'BALTIMORE': 'BAL',
    'RAVENS': 'BAL',
    'BALTIMORE RAVENS': 'BAL',
    'BUFFALO': 'BUF',
    'BILLS': 'BUF',
    'BUFFALO BILLS': 'BUF',
    'CAROLINA': 'CAR',
    'PANTHERS': 'CAR',
    'CAROLINA PANTHERS': 'CAR',
    'CHICAGO': 'CHI',
    'BEARS': 'CHI',
    'CHICAGO BEARS': 'CHI',
    'CINCINNATI': 'CIN',
    'BENGALS': 'CIN',
    'CINCINNATI BENGALS': 'CIN',
    'CLEVELAND': 'CLE',
    'BROWNS': 'CLE',
    'CLEVELAND BROWNS': 'CLE',
    'DALLAS': 'DAL',
    'COWBOYS': 'DAL',
    'DALLAS COWBOYS': 'DAL',
    'DENVER': 'DEN',
    'BRONCOS': 'DEN',
    'DENVER BRONCOS': 'DEN',
    'DETROIT': 'DET',
    'LIONS': 'DET',
    'DETROIT LIONS': 'DET',
    'GREEN BAY': 'GB',
    'PACKERS': 'GB',
    'GREEN BAY PACKERS': 'GB',
    'HOUSTON': 'HOU',
    'TEXANS': 'HOU',
    'HOUSTON TEXANS': 'HOU',
    'INDIANAPOLIS': 'IND',
    'COLTS': 'IND',
    'INDIANAPOLIS COLTS': 'IND',
    'JACKSONVILLE': 'JAX',
    'JAGUARS': 'JAX',
    'JACKSONVILLE JAGUARS': 'JAX',
    'KANSAS CITY': 'KC',
    'CHIEFS': 'KC',
    'KANSAS CITY CHIEFS': 'KC',
    'LAS VEGAS': 'LV',
    'RAIDERS': 'LV',
    'LAS VEGAS RAIDERS': 'LV',
    'LOS ANGELES CHARGERS': 'LAC',
    'LA CHARGERS': 'LAC',
    'CHARGERS': 'LAC',
    'LOS ANGELES RAMS': 'LAR',
    'LA RAMS': 'LAR',
    'RAMS': 'LAR',
    'MIAMI': 'MIA',
    'DOLPHINS': 'MIA',
    'MIAMI DOLPHINS': 'MIA',
    'MINNESOTA': 'MIN',
    'VIKINGS': 'MIN',
    'MINNESOTA VIKINGS': 'MIN',
    'NEW ENGLAND': 'NE',
    'PATRIOTS': 'NE',
    'NEW ENGLAND PATRIOTS': 'NE',
    'NEW ORLEANS': 'NO',
    'SAINTS': 'NO',
    'NEW ORLEANS SAINTS': 'NO',
    'NEW YORK GIANTS': 'NYG',
    'NY GIANTS': 'NYG',
    'GIANTS': 'NYG',
    'NEW YORK JETS': 'NYJ',
    'NY JETS': 'NYJ',
    'JETS': 'NYJ',
    'PHILADELPHIA': 'PHI',
    'EAGLES': 'PHI',
    'PHILADELPHIA EAGLES': 'PHI',
    'PITTSBURGH': 'PIT',
    'STEELERS': 'PIT',
    'PITTSBURGH STEELERS': 'PIT',
    'SAN FRANCISCO': 'SF',
    '49ERS': 'SF',
    'SAN FRANCISCO 49ERS': 'SF',
    'SEATTLE': 'SEA',
    'SEAHAWKS': 'SEA',
    'SEATTLE SEAHAWKS': 'SEA',
    'TAMPA BAY': 'TB',
    'BUCCANEERS': 'TB',
    'TAMPA BAY BUCCANEERS': 'TB',
    'TENNESSEE': 'TEN',
    'TITANS': 'TEN',
    'TENNESSEE TITANS': 'TEN',
    'WASHINGTON': 'WAS',
    'COMMANDERS': 'WAS',
    'WASHINGTON COMMANDERS': 'WAS'
  };
  
  return teamMap[teamStr] || teamStr;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extract first and last name from full name
 */
export function parsePlayerName(fullName: string): { first: string; last: string; suffix?: string } {
  const normalized = normalizePlayerName(fullName);
  const parts = normalized.split(' ').filter(p => p.length > 0);
  
  if (parts.length === 0) {
    return { first: '', last: '' };
  }
  
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  
  // Check for suffix (Jr, Sr, II, III, etc.)
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v'];
  const lastPart = parts[parts.length - 1].replace('.', '');
  
  if (suffixes.includes(lastPart)) {
    return {
      first: parts[0],
      last: parts.slice(1, -1).join(' '),
      suffix: lastPart
    };
  }
  
  return {
    first: parts[0],
    last: parts.slice(1).join(' ')
  };
}

/**
 * Check if a string contains any of the specified substrings (case insensitive)
 */
export function containsAny(str: string, substrings: string[]): boolean {
  const lowerStr = str.toLowerCase();
  return substrings.some(substring => lowerStr.includes(substring.toLowerCase()));
}

/**
 * Clean and standardize a string for comparison
 */
export function cleanString(str: string): string {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check if two strings are approximately equal (ignoring case, spaces, punctuation)
 */
export function approximatelyEqual(str1: string, str2: string, threshold: number = 0.8): boolean {
  const clean1 = cleanString(str1);
  const clean2 = cleanString(str2);
  
  if (clean1 === clean2) return true;
  
  const similarity = calculateStringSimilarity(clean1, clean2);
  return similarity >= threshold;
}

/**
 * Generate common name variations for better matching
 */
export function generateNameVariations(name: string): string[] {
  const variations = [name];
  const normalized = normalizePlayerName(name);
  const parts = normalized.split(' ');
  
  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    
    // Add "First Last" format
    variations.push(`${firstName} ${lastName}`);
    
    // Add "Last, First" format
    variations.push(`${lastName}, ${firstName}`);
    
    // Add variations with middle initials removed
    if (parts.length > 2) {
      variations.push(`${firstName} ${lastName}`);
    }
    
    // Add common nickname variations
    const nicknames = getCommonNicknames(firstName);
    nicknames.forEach(nickname => {
      variations.push(`${nickname} ${lastName}`);
    });
  }
  
  // Remove duplicates and return
  return [...new Set(variations)];
}

/**
 * Get common nicknames for a given first name
 */
function getCommonNicknames(firstName: string): string[] {
  const nicknameMap: Record<string, string[]> = {
    'alexander': ['alex', 'al', 'xander'],
    'anthony': ['tony', 'ant'],
    'benjamin': ['ben', 'benny'],
    'christopher': ['chris', 'christy'],
    'daniel': ['dan', 'danny'],
    'david': ['dave', 'davey'],
    'edward': ['ed', 'eddie'],
    'gregory': ['greg'],
    'jonathan': ['jon', 'johnny'],
    'joseph': ['joe', 'joey'],
    'matthew': ['matt'],
    'michael': ['mike', 'mikey'],
    'nicholas': ['nick', 'nicky'],
    'patrick': ['pat', 'patty'],
    'richard': ['rick', 'dick', 'richie'],
    'robert': ['rob', 'bob', 'bobby'],
    'stephen': ['steve', 'stevie'],
    'thomas': ['tom', 'tommy'],
    'william': ['will', 'bill', 'billy'],
    'zachary': ['zach', 'zack']
  };
  
  const normalized = firstName.toLowerCase();
  return nicknameMap[normalized] || [];
}