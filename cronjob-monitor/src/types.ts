/**
 * Parsed ID and name from a field like "418: West Covina"
 */
export interface ParsedField {
  id: string;
  name: string;
  raw: string; // Original raw value
}

/**
 * Parsed attributes field with category
 * Format: <type>-<attribute-category-name>-<attribute-id>:<attribute-name> | prices
 */
export interface ParsedAttributesField extends ParsedField {
  category?: string; // Attribute category name (e.g., "Cheese")
  type?: string; // Attribute type (e.g., "Regular")
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

/**
 * Price entry for a specific time period (before or after)
 */
export interface PriceEntry {
  location: string;
  category: string;
  product: string;
  price: string;
  // Parsed fields
  locationParsed?: ParsedField;
  categoryParsed?: ParsedField;
  productParsed?: ParsedField;
}

/**
 * Price change record comparing before and after states
 */
export interface PriceChange {
  before: PriceEntry;
  after: PriceEntry;
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  menuItemInfo?: MenuItemInfo; // Menu item details for added prices
}

/**
 * Parsed CSV row data for price
 * Left columns (0-3) are "before", right columns (4-7) are "after"
 */
export interface PriceRow {
  beforeLocation: string;
  beforeCategory: string;
  beforeProduct: string;
  beforePrice: string;
  afterLocation: string;
  afterCategory: string;
  afterProduct: string;
  afterPrice: string;
}

/**
 * Sub-attributes entry for a specific time period (before or after)
 */
export interface SubAttributesEntry {
  location: string;
  category: string;
  product: string;
  attributes: string;
  subAttributes: string;
  // Parsed fields
  locationParsed?: ParsedField;
  categoryParsed?: ParsedField;
  productParsed?: ParsedField;
  attributesParsed?: ParsedField;
  subAttributesParsed?: ParsedField;
}

/**
 * Sub-attributes change record comparing before and after states
 */
export interface SubAttributesChange {
  before: SubAttributesEntry;
  after: SubAttributesEntry;
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  menuItemInfo?: MenuItemInfo; // Menu item details for added sub-attributes
}

/**
 * Parsed CSV row data for sub-attributes
 * Left columns (0-4) are "before", right columns (5-9) are "after"
 */
export interface SubAttributesRow {
  beforeLocation: string;
  beforeCategory: string;
  beforeProduct: string;
  beforeAttributes: string;
  beforeSubAttributes: string;
  afterLocation: string;
  afterCategory: string;
  afterProduct: string;
  afterAttributes: string;
  afterSubAttributes: string;
}

/**
 * Attributes entry for a specific time period (before or after)
 */
export interface AttributesEntry {
  location: string;
  category: string;
  product: string;
  attributes: string;
  // Parsed fields
  locationParsed?: ParsedField;
  categoryParsed?: ParsedField;
  productParsed?: ParsedField;
  attributesParsed?: ParsedAttributesField;
}

/**
 * Attributes change record comparing before and after states
 */
export interface AttributesChange {
  before: AttributesEntry;
  after: AttributesEntry;
  changeType: 'added' | 'removed' | 'modified' | 'moved';
  menuItemInfo?: MenuItemInfo; // Menu item details for added attributes
}

/**
 * Parsed CSV row data for attributes
 * Left columns (0-3) are "before", right columns (4-7) are "after"
 */
export interface AttributesRow {
  beforeLocation: string;
  beforeCategory: string;
  beforeProduct: string;
  beforeAttributes: string;
  afterLocation: string;
  afterCategory: string;
  afterProduct: string;
  afterAttributes: string;
}

