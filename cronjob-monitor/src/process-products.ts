import * as path from 'path';
import { processProductsFromCSV } from './product/product-service';
import { formatProductChange, saveChangesToJSON } from './product/output-service';

/**
 * Main processing function
 */
export function processProductsFile(csvFilePath: string, outputDir?: string): void {
  console.log(`Processing products CSV: ${csvFilePath}\n`);
  
  const result = processProductsFromCSV(csvFilePath);
  console.log(`Total rows found: ${result.rows}\n`);
  
  const changes = {
    added: result.added,
    removed: result.removed,
    modified: result.modified,
    moved: result.moved,
    all: result.all
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
  processProductsFile(csvPath, resultDir);
}
