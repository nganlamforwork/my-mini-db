import type { CompositeKey } from '@/types/database';

/**
 * Formats a key for display, handling multiple input formats:
 * - CompositeKey: { values: [{ type, value }] }
 * - Arrays: [1, 2, 3] or ["a", "b"]
 * - Objects: { id: 1, name: "test" }
 * - Primitives: 1, "string", true
 */
export function formatKey(key: CompositeKey | any[] | Record<string, any> | string | number | boolean | null | undefined): string {
  // Handle null/undefined
  if (key === null || key === undefined) {
    return '';
  }

  // Handle CompositeKey format (from backend API)
  if (typeof key === 'object' && 'values' in key && Array.isArray(key.values)) {
    const values = key.values;
    if (values.length === 0) return '';
    if (values.length === 1) {
      // Single value - return as-is
      return String(values[0].value ?? values[0]);
    }
    // Multiple values - return as tuple
    return `(${values.map(v => String(v.value ?? v)).join(', ')})`;
  }

  // Handle arrays
  if (Array.isArray(key)) {
    if (key.length === 0) return '';
    if (key.length === 1) {
      return String(key[0]);
    }
    return `(${key.map(v => String(v)).join(', ')})`;
  }

  // Handle primitives
  if (typeof key !== 'object') {
    return String(key);
  }

  // Handle plain objects (fallback - should not happen in normal flow)
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}

/**
 * Safely extracts key values from various formats for comparison
 */
export function extractKeyValues(key: CompositeKey | any[] | Record<string, any> | string | number | boolean | null | undefined): any[] {
  if (key === null || key === undefined) {
    return [];
  }

  // Handle CompositeKey format
  if (typeof key === 'object' && 'values' in key && Array.isArray(key.values)) {
    return key.values.map(v => v.value ?? v);
  }

  // Handle arrays
  if (Array.isArray(key)) {
    return key;
  }

  // Handle primitives
  if (typeof key !== 'object') {
    return [key];
  }

  // Handle objects - extract values
  return Object.values(key);
}

/**
 * Compares two keys for equality (handles composite keys properly)
 * Returns 0 if equal, -1 if key1 < key2, 1 if key1 > key2
 * This is used for finding key positions in arrays
 */
export function compareKeys(
  key1: CompositeKey | any[] | Record<string, any> | string | number | boolean | null | undefined,
  key2: CompositeKey | any[] | Record<string, any> | string | number | boolean | null | undefined
): number {
  // Handle null/undefined
  if (key1 === null || key1 === undefined) {
    if (key2 === null || key2 === undefined) return 0;
    return -1;
  }
  if (key2 === null || key2 === undefined) {
    return 1;
  }

  // Extract values for comparison
  const values1 = extractKeyValues(key1);
  const values2 = extractKeyValues(key2);

  // Compare length first
  if (values1.length !== values2.length) {
    return values1.length - values2.length;
  }

  // Compare each value in order
  for (let i = 0; i < values1.length; i++) {
    const v1 = values1[i];
    const v2 = values2[i];
    
    // Handle different types
    if (v1 < v2) return -1;
    if (v1 > v2) return 1;
    
    // For objects/arrays, do deep comparison
    if (typeof v1 === 'object' && typeof v2 === 'object') {
      const str1 = JSON.stringify(v1);
      const str2 = JSON.stringify(v2);
      if (str1 < str2) return -1;
      if (str1 > str2) return 1;
    }
  }

  return 0; // Equal
}

/**
 * Formats node keys for graph visualization with truncation
 * - Shows ALL keys in the node (no limit on number of keys)
 * - Truncates WITHIN each composite key tuple if it has more than 2 values
 * - Truncates individual values to max 10 characters if too long
 * This is ONLY for visual rendering on the canvas, not for data operations
 */
export function formatNodeDataForGraph(keys: any[]): string[] {
  if (!keys || keys.length === 0) return [];
  
  const MAX_VALUES_PER_KEY = 2; // Show first 2 values in composite key
  const MAX_CHAR_PER_VALUE = 10; // Max characters per individual value
  
  // Process each key: show ALL keys, but truncate within each key tuple
  return keys.map((key: any) => {
    // Extract key values
    const keyValues = extractKeyValues(key);
    
    if (keyValues.length === 0) {
      return '';
    }
    
    // Single value key
    if (keyValues.length === 1) {
      const valueStr = String(keyValues[0]);
      // Truncate if too long
      if (valueStr.length <= MAX_CHAR_PER_VALUE) {
        return valueStr;
      }
      return valueStr.substring(0, MAX_CHAR_PER_VALUE) + '...';
    }
    
    // Composite key: show first 2 values, then "+{n} more" if more exist
    const valuesToShow = keyValues.slice(0, MAX_VALUES_PER_KEY);
    const remainingCount = keyValues.length - MAX_VALUES_PER_KEY;
    
    // Truncate each value if too long
    const truncatedValues = valuesToShow.map((val: any) => {
      const valueStr = String(val);
      if (valueStr.length <= MAX_CHAR_PER_VALUE) {
        return valueStr;
      }
      return valueStr.substring(0, MAX_CHAR_PER_VALUE) + '...';
    });
    
    // Build tuple string
    if (remainingCount > 0) {
      return `(${truncatedValues.join(', ')}, +${remainingCount} more)`;
    } else {
      return `(${truncatedValues.join(', ')})`;
    }
  }).filter(Boolean);
}
