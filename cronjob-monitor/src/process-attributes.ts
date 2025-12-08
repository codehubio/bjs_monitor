import * as path from 'path';
import { processAttributesFromCSV } from './attributes/attributes-service';
import { formatAttributesChange, saveChangesToJSON } from './attributes/output-service';
import { enrichAddedAttributesWithMenuItems } from './attributes/menu-item-enricher';
import { AttributesChange } from './types';

/**
 * Randomly sample items from an array using Fisher-Yates shuffle
 * @param array The array to sample from
 * @param count The number of items to sample
 * @returns Sampled array
 */
function randomSample<T>(array: T[], count: number): T[] {
  if (array.length <= count) {
    return array;
  }
  
  // Create a copy of the array
  const shuffled = [...array];
  
  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Return first count items
  return shuffled.slice(0, count);
}

/**
 * Main processing function
 */
export async function processAttributesFile(csvFilePath: string, outputDir?: string): Promise<void> {
  console.log(`Processing attributes CSV: ${csvFilePath}\n`);
  
  const result = processAttributesFromCSV(csvFilePath);
  console.log(`Total rows found: ${result.rows}\n`);
  
  // Check if non-removed items exceed 15, if so randomly sample 15 before enrichment
  const nonRemovedCount = result.added.length + result.modified.length + result.moved.length;
  let itemsToProcess = {
    added: result.added,
    removed: result.removed,
    modified: result.modified,
    moved: result.moved
  };
  
  if (nonRemovedCount > 15) {
    console.log(`Found ${nonRemovedCount} non-removed items. Randomly sampling 15 items (excluding ${result.removed.length} removed items) before enrichment.\n`);
    
    // Combine all non-removed items
    const allNonRemoved = [...result.added, ...result.modified, ...result.moved];
    const sampled = randomSample(allNonRemoved, 15);
    
    // Separate sampled items back into their categories
    const sampledAdded: AttributesChange[] = [];
    const sampledModified: AttributesChange[] = [];
    const sampledMoved: AttributesChange[] = [];
    
    sampled.forEach(item => {
      if (item.changeType === 'added') {
        sampledAdded.push(item);
      } else if (item.changeType === 'modified') {
        sampledModified.push(item);
      } else if (item.changeType === 'moved') {
        sampledMoved.push(item);
      }
    });
    
    itemsToProcess = {
      added: sampledAdded,
      removed: result.removed, // Keep all removed items
      modified: sampledModified,
      moved: sampledMoved
    };
  }
  
  // Enrich added and modified attributes with menu item information (only the sampled items if sampling occurred)
  console.log('Enriching added and modified attributes with menu item details...\n');
  const itemsToEnrich = [...itemsToProcess.added, ...itemsToProcess.modified];
  const enrichedItems = await enrichAddedAttributesWithMenuItems(itemsToEnrich);
  
  // Separate enriched items back into added and modified
  const enrichedAdded = enrichedItems.filter(item => item.changeType === 'added');
  const enrichedModified = enrichedItems.filter(item => item.changeType === 'modified');
  
  const changes = {
    added: enrichedAdded,
    removed: itemsToProcess.removed,
    modified: enrichedModified,
    moved: itemsToProcess.moved
  };
  
  const total = changes.added.length + changes.removed.length + changes.modified.length + changes.moved.length;
  
  console.log('=== ATTRIBUTES CHANGES SUMMARY ===\n');
  console.log(`Added: ${changes.added.length}`);
  console.log(`Removed: ${changes.removed.length}`);
  console.log(`Modified: ${changes.modified.length}`);
  console.log(`Moved: ${changes.moved.length}`);
  console.log(`Total changes: ${total}\n`);
  
  // Save to JSON file
  if (outputDir) {
    const jsonPath = saveChangesToJSON(changes, outputDir);
    console.log(`\n✅ Changes saved to: ${jsonPath}\n`);
  }
  
  if (changes.added.length > 0) {
    console.log('\n=== ADDED ATTRIBUTES ===');
    changes.added.forEach(change => {
      console.log(formatAttributesChange(change));
    });
  }
  
  if (changes.removed.length > 0) {
    console.log('\n=== REMOVED ATTRIBUTES ===');
    changes.removed.forEach(change => {
      console.log(formatAttributesChange(change));
    });
  }
  
  if (changes.moved.length > 0) {
    console.log('\n=== MOVED ATTRIBUTES ===');
    changes.moved.forEach(change => {
      console.log(formatAttributesChange(change));
    });
  }
  
  if (changes.modified.length > 0) {
    console.log('\n=== MODIFIED ATTRIBUTES ===');
    changes.modified.forEach(change => {
      console.log(formatAttributesChange(change));
    });
  }
}

// Main execution
if (require.main === module) {
  const csvPath = path.resolve(__dirname, '../csv/attributes.csv');
  const resultDir = path.resolve(__dirname, '../result');
  processAttributesFile(csvPath, resultDir).catch(error => {
    console.error('Error processing attributes:', error);
    process.exit(1);
  });
}

