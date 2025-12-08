import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PriceRow } from '../types';

/**
 * Parse CSV file and return array of price rows
 * @param filePath Path to the CSV file
 * @returns Array of parsed price rows
 */
export function parsePriceCSV(filePath: string): PriceRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse CSV using csv-parse
  // Skip the first two header rows (from_line: 3 means start from line 3, 1-indexed)
  // Row 1: Header row (e.g., "Sunday,,,,Monday,,," or similar)
  // Row 2: "Location,Category,Product,Price,Location,Category,Product,Price"
  // Left columns (0-3) are "before", right columns (4-7) are "after"
  const records = parse(content, {
    from_line: 3, // Start from line 3 (skip first 2 header rows)
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // Allow rows with different column counts
    columns: false // Don't use first row as column names
  }) as string[][];
  
  const rows: PriceRow[] = [];
  
  for (const record of records) {
    // Ensure we have at least 8 columns
    // Left columns (0-3) are "before", right columns (4-7) are "after"
    if (record && record.length >= 8) {
      rows.push({
        beforeLocation: record[0] || '',
        beforeCategory: record[1] || '',
        beforeProduct: record[2] || '',
        beforePrice: record[3] || '',
        afterLocation: record[4] || '',
        afterCategory: record[5] || '',
        afterProduct: record[6] || '',
        afterPrice: record[7] || ''
      });
    }
  }
  
  return rows;
}

