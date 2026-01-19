import React, { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SchemaFormFields, type FieldValue } from './SchemaFormFields';
import { validateAllFields, formValuesToRowData, validateRequiredFields } from './schemaFormUtils';
import type { Schema } from '@/types/database';

interface UpdateFormProps {
  schema: Schema | null;
  onSubmit: (rowData: Record<string, any>) => void;
}

export const UpdateForm: React.FC<UpdateFormProps> = ({ schema, onSubmit }) => {
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  // Initialize values when schema changes
  useEffect(() => {
    if (schema) {
      const initialValues: Record<string, FieldValue> = {};
      for (const column of schema.columns) {
        initialValues[column.name] = '';
      }
      setValues(initialValues);
    }
  }, [schema]);

  const validations = useMemo(() => {
    if (!schema) return {};
    return validateAllFields(schema, values, schema.primaryKey);
  }, [schema, values]);

  const isFormValid = useMemo(() => {
    if (!schema) return false;
    // All primary key fields must be filled
    const allRequiredFilled = validateRequiredFields(schema, values, schema.primaryKey);
    // All filled fields must be valid
    const allValid = Object.values(validations).every(v => v.valid);
    return allRequiredFilled && allValid;
  }, [schema, values, validations]);

  const handleSubmit = () => {
    if (!schema || !isFormValid) return;

    const rowData = formValuesToRowData(schema, values, true);
    onSubmit(rowData);
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
        <Label className="text-sm font-semibold">Row Data</Label>
        <SchemaFormFields
          schema={schema}
          values={values}
          onValuesChange={setValues}
          requiredFields={schema.primaryKey}
          showOptionalFields={true}
          validations={validations}
        />
        <p className="text-xs text-muted-foreground">
          Fields marked with <span className="text-destructive">*</span> are required (Primary Key).
          Other fields are optional.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Update
        </Button>
      </div>
    </div>
  );
};
