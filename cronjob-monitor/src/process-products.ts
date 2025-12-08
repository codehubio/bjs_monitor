import * as path from 'path';
import { processProductsFromCSV } from './product/product-service';
import { formatProductChange, saveChangesToJSON } from './product/output-service';
import { enrichAddedProductsWithMenuItems } from './product/menu-item-enricher';
import { ProductChange } from './types';

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
export async function processProductsFile(csvFilePath: string, outputDir?: string): Promise<void> {
  console.log(`Processing products CSV: ${csvFilePath}\n`);
  
  const result = processProductsFromCSV(csvFilePath);
  console.log(`Total rows found: ${result.rows}\n`);
  
  // Check if non-removed items exceed 10, if so randomly sample 10 before enrichment
  const nonRemovedCount = result.added.length + result.modified.length + result.moved.length;
  let itemsToProcess = {
    added: result.added,
    removed: result.removed,
    modified: result.modified,
    moved: result.moved
  };
  
  if (nonRemovedCount > 10) {
    console.log(`Found ${nonRemovedCount} non-removed items. Randomly sampling 10 items (excluding ${result.removed.length} removed items) before enrichment.\n`);
    
    // Combine all non-removed items
    const allNonRemoved = [...result.added, ...result.modified, ...result.moved];
    const sampled = randomSample(allNonRemoved, 10);
    
    // Separate sampled items back into their categories
    const sampledAdded: ProductChange[] = [];
    const sampledModified: ProductChange[] = [];
    const sampledMoved: ProductChange[] = [];
    
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
  
  // Enrich added products with menu item information (only the sampled items if sampling occurred)
  console.log('Enriching added products with menu item details...\n');
  const enrichedAdded = await enrichAddedProductsWithMenuItems(itemsToProcess.added);
  
  const changes = {
    added: enrichedAdded,
    removed: itemsToProcess.removed,
    modified: itemsToProcess.modified,
    moved: itemsToProcess.moved
  };
  
  const total = changes.added.length + changes.removed.length + changes.modified.length + changes.moved.length;
  
  console.log('=== PRODUCT CHANGES SUMMARY ===\n');
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
    console.log('\n=== ADDED PRODUCTS ===');
    changes.added.forEach(change => {
      console.log(formatProductChange(change));
    });
  }
  
  if (changes.removed.length > 0) {
    console.log('\n=== REMOVED PRODUCTS ===');
    changes.removed.forEach(change => {
      console.log(formatProductChange(change));
    });
  }
  
  if (changes.moved.length > 0) {
    console.log('\n=== MOVED PRODUCTS ===');
    changes.moved.forEach(change => {
      console.log(formatProductChange(change));
    });
  }
  
  if (changes.modified.length > 0) {
    console.log('\n=== MODIFIED PRODUCTS ===');
    changes.modified.forEach(change => {
      console.log(formatProductChange(change));
    });
  }
}

// Main execution
if (require.main === module) {
  const csvPath = path.resolve(__dirname, '../csv/products.csv');
  const resultDir = path.resolve(__dirname, '../result');
  processProductsFile(csvPath, resultDir).catch(error => {
    console.error('Error processing products:', error);
    process.exit(1);
  });
}
