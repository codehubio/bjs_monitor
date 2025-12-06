import { ParsedField } from './types';

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

