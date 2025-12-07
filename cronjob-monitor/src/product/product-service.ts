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
 * Determine the type of change between before and after entries
 */
function determineChangeType(row: ProductRow): ProductChange['changeType'] {
  const beforeHasProduct = !isProductEmpty(row.beforeProduct);
  const afterHasProduct = !isProductEmpty(row.afterProduct);
  
  // Product was added (before has no product, after has product)
  if (!beforeHasProduct && afterHasProduct) {
    return 'added';
  }
  
  // Product was removed (before has product, after has no product)
  if (beforeHasProduct && !afterHasProduct) {
    return 'removed';
  }
  
  // Both have products - check for changes
  if (beforeHasProduct && afterHasProduct) {
    // Check if location or category changed (product moved to different location/category)
    if (
      row.beforeLocation !== row.afterLocation ||
      row.beforeCategory !== row.afterCategory
    ) {
      return 'moved';
    } else if (row.beforeProduct !== row.afterProduct) {
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
      before: {
        location: row.beforeLocation,
        category: row.beforeCategory,
        product: row.beforeProduct,
        locationParsed: parseField(row.beforeLocation),
        categoryParsed: parseField(row.beforeCategory),
        productParsed: parseField(row.beforeProduct)
      },
      after: {
        location: row.afterLocation,
        category: row.afterCategory,
        product: row.afterProduct,
        locationParsed: parseField(row.afterLocation),
        categoryParsed: parseField(row.afterCategory),
        productParsed: parseField(row.afterProduct)
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

