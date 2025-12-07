import * as path from 'path';
import { processSubAttributesFromCSV } from './sub-attributes/sub-attributes-service';
import { formatSubAttributesChange, saveChangesToJSON } from './sub-attributes/output-service';
import { enrichAddedSubAttributesWithMenuItems } from './sub-attributes/menu-item-enricher';

/**
 * Main processing function
 */
export async function processSubAttributesFile(csvFilePath: string, outputDir?: string): Promise<void> {
  console.log(`Processing sub-attributes CSV: ${csvFilePath}\n`);
  
  const result = processSubAttributesFromCSV(csvFilePath);
  console.log(`Total rows found: ${result.rows}\n`);
  
  // Enrich added and modified sub-attributes with menu item information
  console.log('Enriching added and modified sub-attributes with menu item details...\n');
  const itemsToEnrich = [...result.added, ...result.modified];
  const enrichedItems = await enrichAddedSubAttributesWithMenuItems(itemsToEnrich);
  
  // Separate enriched items back into added and modified
  const enrichedAdded = enrichedItems.filter(item => item.changeType === 'added');
  const enrichedModified = enrichedItems.filter(item => item.changeType === 'modified');
  
  const changes = {
    added: enrichedAdded,
    removed: result.removed,
    modified: enrichedModified,
    moved: result.moved
  };
  
  const total = changes.added.length + changes.removed.length + changes.modified.length + changes.moved.length;
  
  console.log('=== SUB-ATTRIBUTES CHANGES SUMMARY ===\n');
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
    console.log('\n=== ADDED SUB-ATTRIBUTES ===');
    changes.added.forEach(change => {
      console.log(formatSubAttributesChange(change));
    });
  }
  
  if (changes.removed.length > 0) {
    console.log('\n=== REMOVED SUB-ATTRIBUTES ===');
    changes.removed.forEach(change => {
      console.log(formatSubAttributesChange(change));
    });
  }
  
  if (changes.moved.length > 0) {
    console.log('\n=== MOVED SUB-ATTRIBUTES ===');
    changes.moved.forEach(change => {
      console.log(formatSubAttributesChange(change));
    });
  }
  
  if (changes.modified.length > 0) {
    console.log('\n=== MODIFIED SUB-ATTRIBUTES ===');
    changes.modified.forEach(change => {
      console.log(formatSubAttributesChange(change));
    });
  }
}

// Main execution
if (require.main === module) {
  const csvPath = path.resolve(__dirname, '../csv/sub-attributes.csv');
  const resultDir = path.resolve(__dirname, '../result');
  processSubAttributesFile(csvPath, resultDir).catch(error => {
    console.error('Error processing sub-attributes:', error);
    process.exit(1);
  });
}

