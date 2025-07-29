export function validatePlayerRow(row: any): boolean {
  const requiredFields = ['name', 'position'];
  return requiredFields.every(field => 
    row[field] !== undefined && 
    row[field] !== null && 
    String(row[field]).trim() !== ''
  );
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}