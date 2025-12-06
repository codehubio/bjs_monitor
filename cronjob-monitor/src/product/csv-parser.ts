import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { ProductRow } from '../types';

/**
 * Parse CSV file and return array of product rows
 * @param filePath Path to the CSV file
 * @returns Array of parsed product rows
 */
export function parseProductsCSV(filePath: string): ProductRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse CSV using csv-parse
  // Skip the first two header rows (from_line: 3 means start from line 3, 1-indexed)
  // Row 1: "Thursday,,,Friday,,"
  // Row 2: "Location,Category,Product,Location,Category,Product"
  const records = parse(content, {
    from_line: 3, // Start from line 3 (skip first 2 header rows)
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // Allow rows with different column counts
    columns: false // Don't use first row as column names
  }) as string[][];
  
  const rows: ProductRow[] = [];
  
  for (const record of records) {
    // Ensure we have at least 6 columns
    if (record && record.length >= 6) {
      rows.push({
        thursdayLocation: record[0] || '',
        thursdayCategory: record[1] || '',
        thursdayProduct: record[2] || '',
        fridayLocation: record[3] || '',
        fridayCategory: record[4] || '',
        fridayProduct: record[5] || ''
      });
    }
  }
  
  return rows;
}

