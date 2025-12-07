import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { SubAttributesRow } from '../types';

/**
 * Parse CSV file and return array of sub-attributes rows
 * @param filePath Path to the CSV file
 * @returns Array of parsed sub-attributes rows
 */
export function parseSubAttributesCSV(filePath: string): SubAttributesRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Parse CSV using csv-parse
  // Skip the first two header rows (from_line: 3 means start from line 3, 1-indexed)
  // Row 1: Header row (e.g., "Thursday,,,,,Friday,,,,," or similar)
  // Row 2: "Location,Category,Product,Attributes,Sub-Attributes,Location,Category,Product,Attributes,Sub-Attributes"
  // Left columns (0-4) are "before", right columns (5-9) are "after"
  const records = parse(content, {
    from_line: 3, // Start from line 3 (skip first 2 header rows)
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true, // Allow rows with different column counts
    columns: false // Don't use first row as column names
  }) as string[][];
  
  const rows: SubAttributesRow[] = [];
  
  for (const record of records) {
    // Ensure we have at least 10 columns
    // Left columns (0-4) are "before", right columns (5-9) are "after"
    if (record && record.length >= 10) {
      rows.push({
        beforeLocation: record[0] || '',
        beforeCategory: record[1] || '',
        beforeProduct: record[2] || '',
        beforeAttributes: record[3] || '',
        beforeSubAttributes: record[4] || '',
        afterLocation: record[5] || '',
        afterCategory: record[6] || '',
        afterProduct: record[7] || '',
        afterAttributes: record[8] || '',
        afterSubAttributes: record[9] || ''
      });
    }
  }
  
  return rows;
}

