import React, { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SchemaFormFields, type FieldValue } from './SchemaFormFields';
import { formValuesToRowData, validateRequiredFields, validateField } from './schemaFormUtils';
import type { Schema } from '@/types/database';

interface RangeQueryFormProps {
  schema: Schema | null;
  onSubmit: (startKeyData: Record<string, any>, endKeyData: Record<string, any>) => void;
}

export const RangeQueryForm: React.FC<RangeQueryFormProps> = ({ schema, onSubmit }) => {
  const [startValues, setStartValues] = useState<Record<string, FieldValue>>({});
  const [endValues, setEndValues] = useState<Record<string, FieldValue>>({});

  // Initialize values when schema changes (only primary key columns)
  useEffect(() => {
    if (schema) {
      const initialValues: Record<string, FieldValue> = {};
      for (const pkCol of schema.primaryKey) {
        initialValues[pkCol] = '';
      }
      setStartValues(initialValues);
      setEndValues(initialValues);
    }
  }, [schema]);

  const startValidations = useMemo(() => {
    if (!schema) return {};
    const pkValidations: Record<string, { valid: boolean; error?: string }> = {};
    for (const pkCol of schema.primaryKey) {
      const column = schema.columns.find(col => col.name === pkCol);
      if (column) {
        const value = startValues[pkCol] || '';
        pkValidations[pkCol] = validateField(column, value, true);
      }
    }
    return pkValidations;
  }, [schema, startValues]);

  const endValidations = useMemo(() => {
    if (!schema) return {};
    const pkValidations: Record<string, { valid: boolean; error?: string }> = {};
    for (const pkCol of schema.primaryKey) {
      const column = schema.columns.find(col => col.name === pkCol);
      if (column) {
        const value = endValues[pkCol] || '';
        pkValidations[pkCol] = validateField(column, value, true);
      }
    }
    return pkValidations;
  }, [schema, endValues]);

  const isFormValid = useMemo(() => {
    if (!schema) return false;
    // Both start and end keys must be complete and valid
    const startFilled = validateRequiredFields(schema, startValues, schema.primaryKey);
    const endFilled = validateRequiredFields(schema, endValues, schema.primaryKey);
    const startValid = Object.values(startValidations).every(v => v.valid);
    const endValid = Object.values(endValidations).every(v => v.valid);
    return startFilled && endFilled && startValid && endValid;
  }, [schema, startValues, endValues, startValidations, endValidations]);

  const handleSubmit = () => {
    if (!schema || !isFormValid) return;

    const startKeyData = formValuesToRowData(schema, startValues, false);
    const endKeyData = formValuesToRowData(schema, endValues, false);
    onSubmit(startKeyData, endKeyData);
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
      {/* Start Key */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Start Key</Label>
        <SchemaFormFields
          schema={schema}
          values={startValues}
          onValuesChange={setStartValues}
          requiredFields={schema.primaryKey}
          showOptionalFields={false}
          validations={startValidations}
        />
      </div>

      {/* End Key */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">End Key</Label>
        <SchemaFormFields
          schema={schema}
          values={endValues}
          onValuesChange={setEndValues}
          requiredFields={schema.primaryKey}
          showOptionalFields={false}
          validations={endValidations}
        />
      </div>

      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <strong>Note:</strong> Range queries return all keys between start key (inclusive) and end key (inclusive). Both keys must have all primary key components filled.
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Range Query
        </Button>
      </div>
    </div>
  );
};
