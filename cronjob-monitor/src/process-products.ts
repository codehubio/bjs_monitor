import * as path from 'path';
import { processProductsFromCSV } from './product/product-service';
import { formatProductChange, saveChangesToJSON } from './product/output-service';
import { enrichAddedProductsWithMenuItems } from './product/menu-item-enricher';
import { ProductChange } from './types';

/**
 * Main processing function
 */
export async function processProductsFile(csvFilePath: string, outputDir?: string): Promise<void> {
  console.log(`Processing products CSV: ${csvFilePath}\n`);
  
  const result = processProductsFromCSV(csvFilePath);
  console.log(`Total rows found: ${result.rows}\n`);
  
  // Enrich added products with menu item information
  console.log('Enriching added products with menu item details...\n');
  const enrichedAdded = await enrichAddedProductsWithMenuItems(result.added);
  
  // Create a map of enriched added products for quick lookup
  const enrichedMap = new Map<string, ProductChange>();
  enrichedAdded.forEach(change => {
    const key = `${change.friday.locationParsed?.id}-${change.friday.categoryParsed?.id}-${change.friday.productParsed?.id}`;
    enrichedMap.set(key, change);
  });
  
  // Update the all array with enriched added products
  const allChanges: ProductChange[] = result.all.map(change => {
    if (change.changeType === 'added') {
      const key = `${change.friday.locationParsed?.id}-${change.friday.categoryParsed?.id}-${change.friday.productParsed?.id}`;
      const enriched = enrichedMap.get(key);
      return enriched || change;
    }
    return change;
  });
  
  const changes = {
    added: enrichedAdded,
    removed: result.removed,
    modified: result.modified,
    moved: result.moved,
    all: allChanges
  };
  
  console.log('=== PRODUCT CHANGES SUMMARY ===\n');
  console.log(`Added: ${changes.added.length}`);
  console.log(`Removed: ${changes.removed.length}`);
  console.log(`Modified: ${changes.modified.length}`);
  console.log(`Moved: ${changes.moved.length}`);
  console.log(`Total changes: ${changes.all.length}\n`);
  
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
