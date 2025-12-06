import { parseProductsCSV } from './csv-parser';
import { parseField } from './field-parser';
import { ProductRow, ProductChange } from '../types';

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
 * Process products from CSV file
 */
export function processProductsFromCSV(csvFilePath: string): {
  rows: number;
  added: ProductChange[];
  removed: ProductChange[];
  modified: ProductChange[];
  moved: ProductChange[];
  all: ProductChange[];
} {
  const rows = parseProductsCSV(csvFilePath);
  const changes = processProductChanges(rows);
  return {
    rows: rows.length,
    ...changes
  };
}

