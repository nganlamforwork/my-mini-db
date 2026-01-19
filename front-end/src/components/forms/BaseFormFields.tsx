import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertCircle, X } from 'lucide-react';
import type { ColumnType } from '@/types/database';

export type ColumnInput = {
  id: string;
  type: ColumnType;
  value: string;
};

interface BaseFormFieldsProps {
  columns: ColumnInput[];
  onColumnsChange: (columns: ColumnInput[]) => void;
  validations: Array<{ valid: boolean; error?: string }>;
  selectWidth?: string;
}

export const BaseFormFields: React.FC<BaseFormFieldsProps> = ({
  columns,
  onColumnsChange,
  validations,
  selectWidth = 'w-32'
}) => {
  const updateColumn = (id: string, updates: Partial<ColumnInput>) => {
    onColumnsChange(columns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeColumn = (id: string) => {
    if (columns.length > 1) {
      onColumnsChange(columns.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-2">
      {columns.map((col, idx) => {
        const validation = validations[idx];
        return (
          <div key={col.id} className="space-y-1">
            <div className="flex gap-2 items-center">
              <Select
                value={col.type}
                onValueChange={(val: ColumnType) => {
                  updateColumn(col.id, { type: val, value: '' });
                }}
              >
                <SelectTrigger className={selectWidth}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="int">Integer</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="float">Float</SelectItem>
                  <SelectItem value="bool">Boolean</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type={col.type === 'bool' ? 'text' : col.type === 'int' || col.type === 'float' ? 'number' : 'text'}
                placeholder={col.type === 'bool' ? 'true/false/1/0' : col.type === 'int' ? 'e.g. 42' : col.type === 'float' ? 'e.g. 3.14' : `Enter ${col.type} value`}
                value={col.value}
                onChange={(e) => {
                  updateColumn(col.id, { value: e.target.value });
                }}
                className={`flex-1 ${validation && !validation.valid ? 'border-destructive' : ''}`}
              />
              {columns.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeColumn(col.id)}
                >
                  <X size={14} />
                </Button>
              )}
            </div>
            {validation && !validation.valid && (
              <p className="text-xs text-destructive flex items-center gap-1 ml-2">
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
