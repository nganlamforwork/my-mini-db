// Simple range query form
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CompositeKey } from '@/types/database';

interface SimpleRangeFormProps {
  onSubmit: (startKey: CompositeKey, endKey: CompositeKey) => void;
}

export const SimpleRangeForm: React.FC<SimpleRangeFormProps> = ({ onSubmit }) => {
  const [keyType, setKeyType] = useState<'int' | 'string'>('int');
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');

  const handleSubmit = () => {
    if (!startValue.trim() || !endValue.trim()) {
      return;
    }

    let startKey: CompositeKey;
    let endKey: CompositeKey;

    if (keyType === 'int') {
      const startInt = parseInt(startValue, 10);
      const endInt = parseInt(endValue, 10);
      if (isNaN(startInt) || isNaN(endInt)) {
        alert('Invalid integer values');
        return;
      }
      startKey = { values: [{ type: 'int' as const, value: startInt }] };
      endKey = { values: [{ type: 'int' as const, value: endInt }] };
    } else {
      startKey = { values: [{ type: 'string' as const, value: startValue }] };
      endKey = { values: [{ type: 'string' as const, value: endValue }] };
    }

    onSubmit(startKey, endKey);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Key Type</Label>
        <Select value={keyType} onValueChange={(v: 'int' | 'string') => setKeyType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="int">Int</SelectItem>
            <SelectItem value="string">String</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Start Key</Label>
        <Input
          value={startValue}
          onChange={(e) => setStartValue(e.target.value)}
          placeholder={keyType === 'int' ? 'Enter start integer' : 'Enter start string'}
        />
      </div>

      <div className="space-y-2">
        <Label>End Key</Label>
        <Input
          value={endValue}
          onChange={(e) => setEndValue(e.target.value)}
          placeholder={keyType === 'int' ? 'Enter end integer' : 'Enter end string'}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={!startValue.trim() || !endValue.trim()}>
          Query Range
        </Button>
      </div>
    </div>
  );
};
