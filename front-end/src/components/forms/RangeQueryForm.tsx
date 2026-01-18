import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { BaseFormFields, type ColumnInput } from './BaseFormFields';
import { validateValue, parseValue, createNewColumn } from './formUtils';
import type { ColumnType } from '@/types/database';

interface RangeQueryFormProps {
  onSubmit: (startKey: { values: Array<{ type: ColumnType; value: any }> }, endKey: { values: Array<{ type: ColumnType; value: any }> }) => void;
}

export const RangeQueryForm: React.FC<RangeQueryFormProps> = ({ onSubmit }) => {
  const [startKeyColumns, setStartKeyColumns] = useState<ColumnInput[]>([createNewColumn('int')]);
  const [endKeyColumns, setEndKeyColumns] = useState<ColumnInput[]>([createNewColumn('int')]);

  const startKeyValidation = useMemo(() => {
    return startKeyColumns.map(col => validateValue(col.type, col.value));
  }, [startKeyColumns]);

  const endKeyValidation = useMemo(() => {
    return endKeyColumns.map(col => validateValue(col.type, col.value));
  }, [endKeyColumns]);

  const isFormValid = useMemo(() => {
    const allStartValid = startKeyValidation.every(v => v.valid);
    const allEndValid = endKeyValidation.every(v => v.valid);
    return allStartValid && allEndValid;
  }, [startKeyValidation, endKeyValidation]);

  const handleSubmit = () => {
    if (!isFormValid) return;

    const startKey = {
      values: startKeyColumns.map(col => ({
        type: col.type,
        value: parseValue(col.type, col.value)
      }))
    };

    const endKey = {
      values: endKeyColumns.map(col => ({
        type: col.type,
        value: parseValue(col.type, col.value)
      }))
    };

    onSubmit(startKey, endKey);
  };

  return (
    <div className="space-y-6">
      {/* Start Key */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Start Key</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStartKeyColumns([...startKeyColumns, createNewColumn()])}
            className="h-7 text-xs"
          >
            <Plus size={12} className="mr-1" /> Add Column
          </Button>
        </div>
        <BaseFormFields
          columns={startKeyColumns}
          onColumnsChange={setStartKeyColumns}
          validations={startKeyValidation}
        />
      </div>

      {/* End Key */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">End Key</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEndKeyColumns([...endKeyColumns, createNewColumn()])}
            className="h-7 text-xs"
          >
            <Plus size={12} className="mr-1" /> Add Column
          </Button>
        </div>
        <BaseFormFields
          columns={endKeyColumns}
          onColumnsChange={setEndKeyColumns}
          validations={endKeyValidation}
        />
      </div>

      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <strong>Note:</strong> Range queries return all keys between start key (inclusive) and end key (inclusive). Both keys must have the same structure.
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Range Query
        </Button>
      </div>
    </div>
  );
};
