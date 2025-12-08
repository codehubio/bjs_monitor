import { ParsedField, ParsedAttributesField } from '../types';

/**
 * Parse a field that contains "id: name" format
 * @param field The field value (e.g., "418: West Covina" or "137: Cocktails - 379: Seasonal")
 * @returns Parsed field with id, name, and raw value
 */
export function parseField(field: string): ParsedField {
  if (!field || field.trim() === '') {
    return {
      id: '',
      name: '',
      raw: field
    };
  }

  // Find the first colon to separate ID and name
  const colonIndex = field.indexOf(':');
  
  if (colonIndex === -1) {
    // No colon found, treat entire string as name
    return {
      id: '',
      name: field.trim(),
      raw: field
    };
  }

  const id = field.substring(0, colonIndex).trim();
  const name = field.substring(colonIndex + 1).trim();

  return {
    id,
    name,
    raw: field
  };
}

/**
 * Parse an attributes field that contains format: <type>-<attribute-category-name>-<attribute-id>:<attribute-name> | prices
 * Example: "Regular - Cheese - 101142: Whole-Milk Mozzarella Cheese | price: 1.99"
 * @param field The attributes field value
 * @returns Parsed field with id, name, category, type, and raw value
 */
export function parseAttributesField(field: string): ParsedAttributesField {
  if (!field || field.trim() === '') {
    return {
      id: '',
      name: '',
      category: '',
      type: '',
      raw: field
    };
  }

  // Remove the price part (everything after "|")
  const parts = field.split('|');
  const attributePart = parts[0].trim();

  // The format is: <type>-<attribute-category-name>-<attribute-id>:<attribute-name>
  // We need to find the last occurrence of "-" followed by digits (the attribute-id)
  // Then extract everything after the colon as the attribute-name
  
  // Find the last colon in the attribute part
  const lastColonIndex = attributePart.lastIndexOf(':');
  
  if (lastColonIndex === -1) {
    // No colon found, treat entire string as name
    return {
      id: '',
      name: attributePart.trim(),
      category: '',
      type: '',
      raw: field
    };
  }

  // Everything before the colon contains: <type>-<attribute-category-name>-<attribute-id>
  const beforeColon = attributePart.substring(0, lastColonIndex).trim();
  // Everything after the colon is the attribute name
  const attributeName = attributePart.substring(lastColonIndex + 1).trim();

  // Split by "-" to extract type, category, and id
  const dashParts = beforeColon.split('-').map(p => p.trim());
  
  // The last part is the attribute-id
  const attributeId = dashParts[dashParts.length - 1] || '';
  
  // The second-to-last part is the attribute category name
  const attributeCategory = dashParts.length >= 2 ? dashParts[dashParts.length - 2] : '';
  
  // The first part is the type (if there are at least 3 parts)
  const attributeType = dashParts.length >= 3 ? dashParts[0] : '';

  return {
    id: attributeId,
    name: attributeName,
    category: attributeCategory,
    type: attributeType,
    raw: field
  };
}

