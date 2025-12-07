import { parseSubAttributesCSV } from './csv-parser';
import { parseField } from './field-parser';
import { SubAttributesRow, SubAttributesChange } from '../types';

/**
 * Check if a product field is empty (product is the key field)
 */
function isProductEmpty(product: string): boolean {
  return !product || product.trim() === '';
}

/**
 * Determine the type of change between before and after entries
 */
function determineChangeType(row: SubAttributesRow): SubAttributesChange['changeType'] {
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
      row.beforeAttributes !== row.afterAttributes ||
      row.beforeSubAttributes !== row.afterSubAttributes
    ) {
      // Same location/category but different product/attributes/sub-attributes
      return 'modified';
    }
  }
  
  // Both empty or no change detected
  return 'modified'; // Default fallback
}

/**
 * Process sub-attributes rows and categorize changes
 */
export function processSubAttributesChanges(rows: SubAttributesRow[]): {
  added: SubAttributesChange[];
  removed: SubAttributesChange[];
  modified: SubAttributesChange[];
  moved: SubAttributesChange[];
  all: SubAttributesChange[];
} {
  const added: SubAttributesChange[] = [];
  const removed: SubAttributesChange[] = [];
  const modified: SubAttributesChange[] = [];
  const moved: SubAttributesChange[] = [];
  const all: SubAttributesChange[] = [];
  
  for (const row of rows) {
    const change: SubAttributesChange = {
      before: {
        location: row.beforeLocation,
        category: row.beforeCategory,
        product: row.beforeProduct,
        attributes: row.beforeAttributes,
        subAttributes: row.beforeSubAttributes,
        locationParsed: parseField(row.beforeLocation),
        categoryParsed: parseField(row.beforeCategory),
        productParsed: parseField(row.beforeProduct),
        attributesParsed: parseField(row.beforeAttributes),
        subAttributesParsed: parseField(row.beforeSubAttributes)
      },
      after: {
        location: row.afterLocation,
        category: row.afterCategory,
        product: row.afterProduct,
        attributes: row.afterAttributes,
        subAttributes: row.afterSubAttributes,
        locationParsed: parseField(row.afterLocation),
        categoryParsed: parseField(row.afterCategory),
        productParsed: parseField(row.afterProduct),
        attributesParsed: parseField(row.afterAttributes),
        subAttributesParsed: parseField(row.afterSubAttributes)
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
 * Process sub-attributes from CSV file
 */
export function processSubAttributesFromCSV(csvFilePath: string): {
  rows: number;
  added: SubAttributesChange[];
  removed: SubAttributesChange[];
  modified: SubAttributesChange[];
  moved: SubAttributesChange[];
  all: SubAttributesChange[];
} {
  const rows = parseSubAttributesCSV(csvFilePath);
  const changes = processSubAttributesChanges(rows);
  return {
    rows: rows.length,
    ...changes
  };
}

