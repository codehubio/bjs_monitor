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
  // Row 1: Header row (e.g., "Thursday,,,Friday,," or similar)
  // Row 2: "Location,Category,Product,Location,Category,Product"
  // Left columns (0-2) are "before", right columns (3-5) are "after"
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
    // Left columns (0-2) are "before", right columns (3-5) are "after"
    if (record && record.length >= 6) {
      rows.push({
        beforeLocation: record[0] || '',
        beforeCategory: record[1] || '',
        beforeProduct: record[2] || '',
        afterLocation: record[3] || '',
        afterCategory: record[4] || '',
        afterProduct: record[5] || ''
      });
    }
  }
  
  return rows;
}

