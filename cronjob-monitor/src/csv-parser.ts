import * as fs from 'fs';
import * as path from 'path';
import { ProductRow } from './types';

/**
 * Parse CSV file and return array of product rows
 * @param filePath Path to the CSV file
 * @returns Array of parsed product rows
 */
export function parseProductsCSV(filePath: string): ProductRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Skip the first two header rows
  // Row 1: "Thursday,,,Friday,,"
  // Row 2: "Location,Category,Product,Location,Category,Product"
  const dataLines = lines.slice(2);
  
  const rows: ProductRow[] = [];
  
  for (const line of dataLines) {
    // Parse CSV line (handling quoted values if needed)
    const columns = parseCSVLine(line);
    
    if (columns.length >= 6) {
      rows.push({
        thursdayLocation: columns[0] || '',
        thursdayCategory: columns[1] || '',
        thursdayProduct: columns[2] || '',
        fridayLocation: columns[3] || '',
        fridayCategory: columns[4] || '',
        fridayProduct: columns[5] || ''
      });
    }
  }
  
  return rows;
}

/**
 * Parse a CSV line, handling quoted values
 * @param line CSV line to parse
 * @returns Array of column values
 */
function parseCSVLine(line: string): string[] {
  const columns: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last column
  columns.push(current.trim());
  
  return columns;
}

