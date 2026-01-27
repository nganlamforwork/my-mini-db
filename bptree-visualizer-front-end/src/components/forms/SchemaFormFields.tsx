import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import type { Schema, ColumnDefinition } from '@/types/database';

export type FieldValue = string;

export interface SchemaFormFieldsProps {
  schema: Schema;
  values: Record<string, FieldValue>;
  onValuesChange: (values: Record<string, FieldValue>) => void;
  requiredFields?: string[]; // Fields that are required (defaults to primaryKey)
  showOptionalFields?: boolean; // Whether to show non-primary-key fields (default: true for INSERT/UPDATE)
  validations?: Record<string, { valid: boolean; error?: string }>;
}

// Convert backend column type to frontend input type
const getInputType = (type: ColumnDefinition['type']): string => {
  switch (type) {
    case 'INT':
      return 'number';
    case 'FLOAT':
      return 'number';
    case 'BOOL':
      return 'text';
    case 'STRING':
    default:
      return 'text';
  }
};

// Get placeholder for input
const getPlaceholder = (type: ColumnDefinition['type']): string => {
  switch (type) {
    case 'INT':
      return 'e.g. 42';
    case 'FLOAT':
      return 'e.g. 3.14';
    case 'BOOL':
      return 'true/false/1/0';
    case 'STRING':
    default:
      return `Enter ${type.toLowerCase()} value`;
  }
};

export const SchemaFormFields: React.FC<SchemaFormFieldsProps> = ({
  schema,
  values,
  onValuesChange,
  requiredFields,
  showOptionalFields = true,
  validations = {},
}) => {
  const primaryKeySet = new Set(schema.primaryKey);
  const requiredSet = new Set(requiredFields || schema.primaryKey);

  // Filter columns based on showOptionalFields
  const visibleColumns = showOptionalFields
    ? schema.columns
    : schema.columns.filter(col => primaryKeySet.has(col.name));

  const handleValueChange = (columnName: string, value: string) => {
    onValuesChange({
      ...values,
      [columnName]: value,
    });
  };

  return (
    <div className="space-y-3">
      {visibleColumns.map((column) => {
        const isRequired = requiredSet.has(column.name);
        const isPrimaryKey = primaryKeySet.has(column.name);
        const validation = validations[column.name];
        const hasError = validation && !validation.valid;

        return (
          <div key={column.name} className="space-y-1">
            <Label htmlFor={column.name} className="text-sm">
              {column.name}
              {isRequired && <span className="text-destructive ml-1">*</span>}
              {isPrimaryKey && (
                <span className="text-xs text-muted-foreground ml-1">(PK)</span>
              )}
            </Label>
            <Input
              id={column.name}
              type={getInputType(column.type)}
              placeholder={getPlaceholder(column.type)}
              value={values[column.name] || ''}
              onChange={(e) => handleValueChange(column.name, e.target.value)}
              className={hasError ? 'border-destructive' : ''}
              required={isRequired}
            />
            {hasError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={12} />
                {validation.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
