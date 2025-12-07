import * as path from 'path';
import * as fs from 'fs';
import { SubAttributesChange } from '../types';

/**
 * Format sub-attributes change for display
 */
export function formatSubAttributesChange(change: SubAttributesChange): string {
  const before = change.before;
  const after = change.after;
  
  switch (change.changeType) {
    case 'added':
      return `[ADDED] ${after.location} | ${after.category} | ${after.product} | ${after.attributes} | ${after.subAttributes}`;
    
    case 'removed':
      return `[REMOVED] ${before.location} | ${before.category} | ${before.product} | ${before.attributes} | ${before.subAttributes}`;
    
    case 'moved':
      return `[MOVED] ${before.product}\n  From: ${before.location} | ${before.category}\n  To: ${after.location} | ${after.category}`;
    
    case 'modified':
      return `[MODIFIED] ${before.location} | ${before.category} | ${before.product}\n  Before: ${before.attributes} | ${before.subAttributes}\n  After: ${after.attributes} | ${after.subAttributes}`;
    
    default:
      return JSON.stringify(change);
  }
}

/**
 * Generate output JSON structure
 */
export function generateOutputJSON(changes: {
  added: SubAttributesChange[];
  removed: SubAttributesChange[];
  modified: SubAttributesChange[];
  moved: SubAttributesChange[];
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
    added: SubAttributesChange[];
    removed: SubAttributesChange[];
    modified: SubAttributesChange[];
    moved: SubAttributesChange[];
  },
  outputDir: string,
  filename: string = 'sub-attributes-changes.json'
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

