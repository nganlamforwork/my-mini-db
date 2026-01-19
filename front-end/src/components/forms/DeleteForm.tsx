import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { BaseFormFields, type ColumnInput } from './BaseFormFields';
import { validateValue, parseValue, createNewColumn } from './formUtils';
import type { ColumnType } from '@/types/database';

interface DeleteFormProps {
  onSubmit: (key: { values: Array<{ type: ColumnType; value: any }> }) => void;
}

export const DeleteForm: React.FC<DeleteFormProps> = ({ onSubmit }) => {
  const [keyColumns, setKeyColumns] = useState<ColumnInput[]>([createNewColumn('int')]);

  const keyValidation = useMemo(() => {
    return keyColumns.map(col => validateValue(col.type, col.value));
  }, [keyColumns]);

  const isFormValid = useMemo(() => {
    return keyValidation.every(v => v.valid);
  }, [keyValidation]);

  const handleSubmit = () => {
    if (!isFormValid) return;

    const key = {
      values: keyColumns.map(col => ({
        type: col.type,
        value: parseValue(col.type, col.value)
      }))
    };

    onSubmit(key);
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

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!isFormValid}>
          Delete
        </Button>
      </div>
    </div>
  );
};
