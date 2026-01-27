import type { ColumnType } from '@/types/database';
import type { ColumnInput } from './BaseFormFields';

export const validateValue = (type: ColumnType, value: string): { valid: boolean; error?: string } => {
  if (!value.trim()) {
    return { valid: false, error: 'Value is required' };
  }

  switch (type) {
    case 'int': {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || !Number.isInteger(Number(value))) {
        return { valid: false, error: 'Must be a valid integer' };
      }
      return { valid: true };
    }
    case 'float': {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || value.trim() === '') {
        return { valid: false, error: 'Must be a valid number' };
      }
      return { valid: true };
    }
    case 'bool': {
      const lower = value.toLowerCase().trim();
      if (lower !== 'true' && lower !== 'false' && lower !== '1' && lower !== '0') {
        return { valid: false, error: 'Must be true, false, 1, or 0' };
      }
      return { valid: true };
    }
    case 'string': {
      return { valid: true };
    }
    default:
      return { valid: true };
  }
};

export const parseValue = (type: ColumnType, value: string): any => {
  switch (type) {
    case 'int':
      return parseInt(value, 10);
    case 'float':
      return parseFloat(value);
    case 'bool':
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1';
    default:
      return value;
  }
};

export const createNewColumn = (type: ColumnType = 'int'): ColumnInput => ({
  id: Date.now().toString(),
  type,
  value: ''
});
