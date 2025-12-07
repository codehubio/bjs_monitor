/**
 * Parsed ID and name from a field like "418: West Covina"
 */
export interface ParsedField {
  id: string;
  name: string;
  raw: string; // Original raw value
}

/**
 * Product entry for a specific time period (before or after)
 */
export interface ProductEntry {
  location: string;
  category: string;
  product: string;
  // Parsed fields
  locationParsed?: ParsedField;
  categoryParsed?: ParsedField;
  productParsed?: ParsedField;
}

/**
 * Menu item information from BJs API
 */
export interface MenuItemInfo {
  ItemId?: string;
  ItemName?: string;
  ItemDesc?: string;
  ItemPrice?: string;
  ItemImageURL?: string;
  ItemPLU?: string;
  [key: string]: any; // Allow other fields from API
}

/**
 * Product change record comparing before and after states
 */
export interface ProductChange {
  before: ProductEntry;
  after: ProductEntry;
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  menuItemInfo?: MenuItemInfo; // Menu item details for added products
}

/**
 * Parsed CSV row data
 * Left columns (0-2) are "before", right columns (3-5) are "after"
 */
export interface ProductRow {
  beforeLocation: string;
  beforeCategory: string;
  beforeProduct: string;
  afterLocation: string;
  afterCategory: string;
  afterProduct: string;
}

