import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { BaseFormFields, type ColumnInput } from './BaseFormFields';
import { validateValue, parseValue, createNewColumn } from './formUtils';
import type { ColumnType } from '@/types/database';

interface UpdateFormProps {
  onSubmit: (key: { values: Array<{ type: ColumnType; value: any }> }, value: { columns: Array<{ type: ColumnType; value: any }> }) => void;
}

export const UpdateForm: React.FC<UpdateFormProps> = ({ onSubmit }) => {
  const [keyColumns, setKeyColumns] = useState<ColumnInput[]>([createNewColumn('int')]);
  const [valueColumns, setValueColumns] = useState<ColumnInput[]>([createNewColumn('string')]);

  const keyValidation = useMemo(() => {
    return keyColumns.map(col => validateValue(col.type, col.value));
  }, [keyColumns]);

  const valueValidation = useMemo(() => {
    return valueColumns.map(col => validateValue(col.type, col.value));
  }, [valueColumns]);

  const isFormValid = useMemo(() => {
    const allKeyValid = keyValidation.every(v => v.valid);
    const allValueValid = valueValidation.every(v => v.valid);
    return allKeyValid && allValueValid;
  }, [keyValidation, valueValidation]);

  const handleSubmit = () => {
    if (!isFormValid) return;

    const key = {
      values: keyColumns.map(col => ({
        type: col.type,
        value: parseValue(col.type, col.value)
      }))
    };

    const value = {
      columns: valueColumns.map(col => ({
        type: col.type,
        value: parseValue(col.type, col.value)
      }))
    };

    onSubmit(key, value);
  };

  return (
    <div className="space-y-6">
      {/* Key Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Composite Key</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setKeyColumns([...keyColumns, createNewColumn()])}
            className="h-7 text-xs"
          >
            <Plus size={12} className="mr-1" /> Add Column
          </Button>
        </div>
        <BaseFormFields
          columns={keyColumns}
          onColumnsChange={setKeyColumns}
          validations={keyValidation}
        />
      </div>

      {/* Value Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Record Value</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValueColumns([...valueColumns, createNewColumn('string')])}
            className="h-7 text-xs"
          >
            <Plus size={12} className="mr-1" /> Add Column
          </Button>
        </div>
        <BaseFormFields
          columns={valueColumns}
          onColumnsChange={setValueColumns}
          validations={valueValidation}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Update
        </Button>
      </div>
    </div>
  );
};
