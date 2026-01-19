import type { Schema, ColumnDefinition } from '@/types/database';
import type { FieldValue } from './SchemaFormFields';

// Validate a single field value against its column definition
export const validateField = (
  column: ColumnDefinition,
  value: FieldValue,
  isRequired: boolean
): { valid: boolean; error?: string } => {
  // Check if required field is empty
  if (isRequired && (!value || value.trim() === '')) {
    return { valid: false, error: 'This field is required' };
  }

  // If optional and empty, it's valid (will be null/empty)
  if (!isRequired && (!value || value.trim() === '')) {
    return { valid: true };
  }

  // Validate based on type
  switch (column.type) {
    case 'INT': {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || !Number.isInteger(Number(value))) {
        return { valid: false, error: 'Must be a valid integer' };
      }
      return { valid: true };
    }
    case 'FLOAT': {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || value.trim() === '') {
        return { valid: false, error: 'Must be a valid number' };
      }
      return { valid: true };
    }
    case 'BOOL': {
      const lower = value.toLowerCase().trim();
      if (lower !== 'true' && lower !== 'false' && lower !== '1' && lower !== '0') {
        return { valid: false, error: 'Must be true, false, 1, or 0' };
      }
      return { valid: true };
    }
    case 'STRING':
    default:
      return { valid: true };
  }
};

// Parse field value to appropriate type
export const parseFieldValue = (column: ColumnDefinition, value: FieldValue): any => {
  if (!value || value.trim() === '') {
    return null; // Empty values become null
  }

  switch (column.type) {
    case 'INT':
      return parseInt(value, 10);
    case 'FLOAT':
      return parseFloat(value);
    case 'BOOL': {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1';
    }
    case 'STRING':
    default:
      return value;
  }
};

// Convert form values to row data object
export const formValuesToRowData = (
  schema: Schema,
  values: Record<string, FieldValue>,
  includeOptional: boolean = true
): Record<string, any> => {
  const rowData: Record<string, any> = {};

  const columnsToInclude = includeOptional
    ? schema.columns
    : schema.columns.filter(col => schema.primaryKey.includes(col.name));

  for (const column of columnsToInclude) {
    const value = values[column.name];
    if (value !== undefined && value !== null && value !== '') {
      rowData[column.name] = parseFieldValue(column, value);
    } else if (includeOptional) {
      // For optional fields, include null if empty
      rowData[column.name] = null;
    }
  }

  return rowData;
};

// Validate all required fields are filled
export const validateRequiredFields = (
  schema: Schema,
  values: Record<string, FieldValue>,
  requiredFields?: string[]
): boolean => {
  const requiredSet = new Set(requiredFields || schema.primaryKey);
  
  for (const fieldName of requiredSet) {
    const value = values[fieldName];
    if (!value || value.trim() === '') {
      return false;
    }
  }
  
  return true;
};

// Validate all fields and return validation results
export const validateAllFields = (
  schema: Schema,
  values: Record<string, FieldValue>,
  requiredFields?: string[]
): Record<string, { valid: boolean; error?: string }> => {
  const validations: Record<string, { valid: boolean; error?: string }> = {};
  const requiredSet = new Set(requiredFields || schema.primaryKey);

  for (const column of schema.columns) {
    const isRequired = requiredSet.has(column.name);
    const value = values[column.name] || '';
    validations[column.name] = validateField(column, value, isRequired);
  }

  return validations;
};
