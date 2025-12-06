/**
 * Parsed ID and name from a field like "418: West Covina"
 */
export interface ParsedField {
  id: string;
  name: string;
  raw: string; // Original raw value
}

/**
 * Product entry for a specific day (Thursday or Friday)
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
 * Product change record comparing Thursday and Friday
 */
export interface ProductChange {
  thursday: ProductEntry;
  friday: ProductEntry;
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  menuItemInfo?: MenuItemInfo; // Menu item details for added products
}

/**
 * Parsed CSV row data
 */
export interface ProductRow {
  thursdayLocation: string;
  thursdayCategory: string;
  thursdayProduct: string;
  fridayLocation: string;
  fridayCategory: string;
  fridayProduct: string;
}

