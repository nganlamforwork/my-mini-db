// Simple key-value form for operations without schema
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CompositeKey, Record as DBRecord } from '@/types/database';

interface SimpleKeyValueFormProps {
  onSubmit: (key: CompositeKey, value?: DBRecord) => void;
  operation: 'insert' | 'search' | 'update' | 'delete';
}

export const SimpleKeyValueForm: React.FC<SimpleKeyValueFormProps> = ({ onSubmit, operation }) => {
  const [keyType, setKeyType] = useState<'int' | 'string'>('int');
  const [keyValue, setKeyValue] = useState('');
  const [valueType, setValueType] = useState<'int' | 'string'>('string');
  const [valueValue, setValueValue] = useState('');

  const handleSubmit = () => {
    if (!keyValue.trim()) {
      return;
    }

    // Create composite key
    let key: CompositeKey;
    if (keyType === 'int') {
      const intVal = parseInt(keyValue, 10);
      if (isNaN(intVal)) {
        alert('Invalid integer key');
        return;
      }
      key = { values: [{ type: 'int' as const, value: intVal }] };
    } else {
      key = { values: [{ type: 'string' as const, value: keyValue }] };
    }

    // Create value if needed
    let value: DBRecord | undefined;
    if (operation === 'insert' || operation === 'update') {
      if (!valueValue.trim()) {
        alert('Value is required');
        return;
      }
      if (valueType === 'int') {
        const intVal = parseInt(valueValue, 10);
        if (isNaN(intVal)) {
          alert('Invalid integer value');
          return;
        }
        value = { columns: [{ type: 'int' as const, value: intVal }] };
      } else {
        value = { columns: [{ type: 'string' as const, value: valueValue }] };
      }
    }

    onSubmit(key, value);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Key</Label>
        <div className="flex gap-2">
          <Select value={keyType} onValueChange={(v: 'int' | 'string') => setKeyType(v)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="int">Int</SelectItem>
              <SelectItem value="string">String</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={keyType === 'int' ? 'Enter integer key' : 'Enter string key'}
          />
        </div>
      </div>

      {(operation === 'insert' || operation === 'update') && (
        <div className="space-y-2">
          <Label>Value</Label>
          <div className="flex gap-2">
            <Select value={valueType} onValueChange={(v: 'int' | 'string') => setValueType(v)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="int">Int</SelectItem>
                <SelectItem value="string">String</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={valueValue}
              onChange={(e) => setValueValue(e.target.value)}
              placeholder={valueType === 'int' ? 'Enter integer value' : 'Enter string value'}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!keyValue.trim() || ((operation === 'insert' || operation === 'update') && !valueValue.trim())}>
          {operation === 'insert' ? 'Insert' : operation === 'update' ? 'Update' : operation === 'search' ? 'Search' : 'Delete'}
        </Button>
      </div>
    </div>
  );
};
