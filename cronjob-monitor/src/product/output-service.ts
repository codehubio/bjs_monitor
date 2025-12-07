import * as path from 'path';
import * as fs from 'fs';
import { ProductChange } from '../types';

/**
 * Format product change for display
 */
export function formatProductChange(change: ProductChange): string {
  const before = change.before;
  const after = change.after;
  
  switch (change.changeType) {
    case 'added':
      return `[ADDED] ${after.location} | ${after.category} | ${after.product}`;
    
    case 'removed':
      return `[REMOVED] ${before.location} | ${before.category} | ${before.product}`;
    
    case 'moved':
      return `[MOVED] ${before.product}\n  From: ${before.location} | ${before.category}\n  To: ${after.location} | ${after.category}`;
    
    case 'modified':
      return `[MODIFIED] ${before.location} | ${before.category}\n  Before: ${before.product}\n  After: ${after.product}`;
    
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
}): any {
  const total = changes.added.length + changes.removed.length + changes.modified.length + changes.moved.length;
  
  return {
    summary: {
      total: total,
      added: changes.added.length,
      removed: changes.removed.length,
      modified: changes.modified.length,
      moved: changes.moved.length
    },
    changes: {
      added: changes.added,
      removed: changes.removed,
      modified: changes.modified,
      moved: changes.moved
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

