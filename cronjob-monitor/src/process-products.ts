import * as path from 'path';
import * as fs from 'fs';
import { parseProductsCSV } from './csv-parser';
import { parseField } from './field-parser';
import { ProductRow, ProductChange } from './types';

/**
 * Check if a product field is empty (product is the key field)
 */
function isProductEmpty(product: string): boolean {
  return !product || product.trim() === '';
}

/**
 * Determine the type of change between Thursday and Friday entries
 */
function determineChangeType(row: ProductRow): ProductChange['changeType'] {
  const thursdayHasProduct = !isProductEmpty(row.thursdayProduct);
  const fridayHasProduct = !isProductEmpty(row.fridayProduct);
  
  // Product was added (Thursday has no product, Friday has product)
  if (!thursdayHasProduct && fridayHasProduct) {
    return 'added';
  }
  
  // Product was removed (Thursday has product, Friday has no product)
  if (thursdayHasProduct && !fridayHasProduct) {
    return 'removed';
  }
  
  // Both have products - check for changes
  if (thursdayHasProduct && fridayHasProduct) {
    // Check if location or category changed (product moved to different location/category)
    if (
      row.thursdayLocation !== row.fridayLocation ||
      row.thursdayCategory !== row.fridayCategory
    ) {
      return 'moved';
    } else if (row.thursdayProduct !== row.fridayProduct) {
      // Same location/category but different product ID
      return 'modified';
    }
  }
  
  // Both empty or no change detected
  return 'modified'; // Default fallback
}

/**
 * Process product rows and categorize changes
 */
export function processProductChanges(rows: ProductRow[]): {
  added: ProductChange[];
  removed: ProductChange[];
  modified: ProductChange[];
  moved: ProductChange[];
  all: ProductChange[];
} {
  const added: ProductChange[] = [];
  const removed: ProductChange[] = [];
  const modified: ProductChange[] = [];
  const moved: ProductChange[] = [];
  const all: ProductChange[] = [];
  
  for (const row of rows) {
    const change: ProductChange = {
      thursday: {
        location: row.thursdayLocation,
        category: row.thursdayCategory,
        product: row.thursdayProduct,
        locationParsed: parseField(row.thursdayLocation),
        categoryParsed: parseField(row.thursdayCategory),
        productParsed: parseField(row.thursdayProduct)
      },
      friday: {
        location: row.fridayLocation,
        category: row.fridayCategory,
        product: row.fridayProduct,
        locationParsed: parseField(row.fridayLocation),
        categoryParsed: parseField(row.fridayCategory),
        productParsed: parseField(row.fridayProduct)
      },
      changeType: determineChangeType(row)
    };
    
    all.push(change);
    
    switch (change.changeType) {
      case 'added':
        added.push(change);
        break;
      case 'removed':
        removed.push(change);
        break;
      case 'moved':
        moved.push(change);
        break;
      case 'modified':
        modified.push(change);
        break;
    }
  }
  
  return { added, removed, modified, moved, all };
}

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

/**
 * Main processing function
 */
export function processProductsFile(csvFilePath: string, outputDir?: string): void {
  console.log(`Processing products CSV: ${csvFilePath}\n`);
  
  const rows = parseProductsCSV(csvFilePath);
  console.log(`Total rows found: ${rows.length}\n`);
  
  const changes = processProductChanges(rows);
  
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

