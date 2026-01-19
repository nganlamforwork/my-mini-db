import React, { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SchemaFormFields, type FieldValue } from './SchemaFormFields';
import { formValuesToRowData, validateRequiredFields, validateField } from './schemaFormUtils';
import type { Schema } from '@/types/database';

interface SearchFormProps {
  schema: Schema | null;
  onSubmit: (keyData: Record<string, any>) => void;
}

export const SearchForm: React.FC<SearchFormProps> = ({ schema, onSubmit }) => {
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  // Initialize values when schema changes (only primary key columns)
  useEffect(() => {
    if (schema) {
      const initialValues: Record<string, FieldValue> = {};
      for (const pkCol of schema.primaryKey) {
        initialValues[pkCol] = '';
      }
      setValues(initialValues);
    }
  }, [schema]);

  const validations = useMemo(() => {
    if (!schema) return {};
    // Only validate primary key fields
    const pkValidations: Record<string, { valid: boolean; error?: string }> = {};
    for (const pkCol of schema.primaryKey) {
      const column = schema.columns.find(col => col.name === pkCol);
      if (column) {
        const value = values[pkCol] || '';
        pkValidations[pkCol] = validateField(column, value, true);
      }
    }
    return pkValidations;
  }, [schema, values]);

  const isFormValid = useMemo(() => {
    if (!schema) return false;
    // All primary key fields must be filled and valid
    const allRequiredFilled = validateRequiredFields(schema, values, schema.primaryKey);
    const allValid = Object.values(validations).every(v => v.valid);
    return allRequiredFilled && allValid;
  }, [schema, values, validations]);

  const handleSubmit = () => {
    if (!schema || !isFormValid) return;

    // Only include primary key fields
    const keyData = formValuesToRowData(schema, values, false);
    onSubmit(keyData);
  };

  if (!schema) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Database schema not available. Please create database with schema first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Primary Key</Label>
        <SchemaFormFields
          schema={schema}
          values={values}
          onValuesChange={setValues}
          requiredFields={schema.primaryKey}
          showOptionalFields={false}
          validations={validations}
        />
        <p className="text-xs text-muted-foreground">
          All primary key fields are required.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Search
        </Button>
      </div>
    </div>
  );
};
