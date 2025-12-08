import { parseAttributesCSV } from './csv-parser';
import { parseField } from './field-parser';
import { AttributesRow, AttributesChange } from '../types';

/**
 * Check if a product field is empty (product is the key field)
 */
function isProductEmpty(product: string): boolean {
  return !product || product.trim() === '';
}

/**
 * Determine the type of change between before and after entries
 */
function determineChangeType(row: AttributesRow): AttributesChange['changeType'] {
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
    } else if (
      row.beforeProduct !== row.afterProduct ||
      row.beforeAttributes !== row.afterAttributes
    ) {
      // Same location/category but different product/attributes
      return 'modified';
    }
  }
  
  // Both empty or no change detected
  return 'modified'; // Default fallback
}

/**
 * Process attributes rows and categorize changes
 */
export function processAttributesChanges(rows: AttributesRow[]): {
  added: AttributesChange[];
  removed: AttributesChange[];
  modified: AttributesChange[];
  moved: AttributesChange[];
  all: AttributesChange[];
} {
  const added: AttributesChange[] = [];
  const removed: AttributesChange[] = [];
  const modified: AttributesChange[] = [];
  const moved: AttributesChange[] = [];
  const all: AttributesChange[] = [];
  
  for (const row of rows) {
    const change: AttributesChange = {
      before: {
        location: row.beforeLocation,
        category: row.beforeCategory,
        product: row.beforeProduct,
        attributes: row.beforeAttributes,
        locationParsed: parseField(row.beforeLocation),
        categoryParsed: parseField(row.beforeCategory),
        productParsed: parseField(row.beforeProduct),
        attributesParsed: parseField(row.beforeAttributes)
      },
      after: {
        location: row.afterLocation,
        category: row.afterCategory,
        product: row.afterProduct,
        attributes: row.afterAttributes,
        locationParsed: parseField(row.afterLocation),
        categoryParsed: parseField(row.afterCategory),
        productParsed: parseField(row.afterProduct),
        attributesParsed: parseField(row.afterAttributes)
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
 * Process attributes from CSV file
 */
export function processAttributesFromCSV(csvFilePath: string): {
  rows: number;
  added: AttributesChange[];
  removed: AttributesChange[];
  modified: AttributesChange[];
  moved: AttributesChange[];
  all: AttributesChange[];
} {
  const rows = parseAttributesCSV(csvFilePath);
  const changes = processAttributesChanges(rows);
  return {
    rows: rows.length,
    ...changes
  };
}

