import * as path from 'path';
import * as fs from 'fs';
import { ProductChange } from '../types';

/**
 * Format product change for display
 */
export function formatProductChange(change: ProductChange): string {
  const thursday = change.thursday;
  const friday = change.friday;
  
  switch (change.changeType) {
    case 'added':
      return `[ADDED] ${friday.location} | ${friday.category} | ${friday.product}`;
    
    case 'removed':
      return `[REMOVED] ${thursday.location} | ${thursday.category} | ${thursday.product}`;
    
    case 'moved':
      return `[MOVED] ${thursday.product}\n  From: ${thursday.location} | ${thursday.category}\n  To: ${friday.location} | ${friday.category}`;
    
    case 'modified':
      return `[MODIFIED] ${thursday.location} | ${thursday.category}\n  Thursday: ${thursday.product}\n  Friday: ${friday.product}`;
    
    default:
      return JSON.stringify(change);
  }
}

/**
 * Generate output JSON structure
 */
export function generateOutputJSON(changes: {
  added: ProductChange[];
  removed: ProductChange[];
  modified: ProductChange[];
  moved: ProductChange[];
  all: ProductChange[];
}): any {
  return {
    summary: {
      total: changes.all.length,
      added: changes.added.length,
      removed: changes.removed.length,
      modified: changes.modified.length,
      moved: changes.moved.length
    },
    changes: {
      added: changes.added,
      removed: changes.removed,
      modified: changes.modified,
      moved: changes.moved,
      all: changes.all
    }
  };
}

/**
 * Save changes to JSON file
 */
export function saveChangesToJSON(
  changes: {
    added: ProductChange[];
    removed: ProductChange[];
    modified: ProductChange[];
    moved: ProductChange[];
    all: ProductChange[];
  },
  outputDir: string,
  filename: string = 'products-changes.json'
): string {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, filename);
  const jsonOutput = generateOutputJSON(changes);
  
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  
  return outputPath;
}

