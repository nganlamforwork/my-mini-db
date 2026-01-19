import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, GripVertical } from 'lucide-react';
import type { ColumnDefinition } from '@/types/database';

interface SchemaBuilderProps {
  value: {
    columns: ColumnDefinition[];
    primaryKey: string[];
  };
  onChange: (value: {
    columns: ColumnDefinition[];
    primaryKey: string[];
  }) => void;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({ value, onChange }) => {
  const { columns, primaryKey } = value;

  const handleAddColumn = () => {
    const newColumn: ColumnDefinition = {
      name: '',
      type: 'INT',
    };
    onChange({
      ...value,
      columns: [...columns, newColumn],
    });
  };

  const handleRemoveColumn = (index: number) => {
    const columnToRemove = columns[index];
    const newColumns = columns.filter((_, i) => i !== index);
    const newPrimaryKey = primaryKey.filter(pk => pk !== columnToRemove.name);
    onChange({
      ...value,
      columns: newColumns,
      primaryKey: newPrimaryKey,
    });
  };

  const handleColumnChange = (index: number, updates: Partial<ColumnDefinition>) => {
    const oldColumn = columns[index];
    const newColumns = columns.map((col, i) =>
      i === index ? { ...col, ...updates } : col
    );
    
    // If column name changed, update primary key references
    let newPrimaryKey = primaryKey;
    if (updates.name && updates.name !== oldColumn.name) {
      newPrimaryKey = primaryKey.map(pk => pk === oldColumn.name ? updates.name! : pk);
    }
    
    onChange({
      ...value,
      columns: newColumns,
      primaryKey: newPrimaryKey,
    });
  };

  const handleTogglePrimaryKey = (columnName: string) => {
    const isInPrimaryKey = primaryKey.includes(columnName);
    let newPrimaryKey: string[];
    
    if (isInPrimaryKey) {
      // Remove from primary key
      newPrimaryKey = primaryKey.filter(pk => pk !== columnName);
    } else {
      // Add to primary key (at the end)
      newPrimaryKey = [...primaryKey, columnName];
    }
    
    onChange({
      ...value,
      primaryKey: newPrimaryKey,
    });
  };


  return (
    <div className="space-y-4">
      {/* Columns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Columns <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
            className="h-7 text-xs"
          >
            <Plus size={12} className="mr-1" /> Add Column
          </Button>
        </div>

        <div className="space-y-2">
          {columns.map((column, index) => (
            <div key={index} className="flex gap-2 items-start p-2 border rounded-lg">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <Input
                    placeholder="Column name"
                    value={column.name}
                    onChange={(e) => handleColumnChange(index, { name: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Select
                    value={column.type}
                    onValueChange={(type: ColumnDefinition['type']) =>
                      handleColumnChange(index, { type })
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INT">INT</SelectItem>
                      <SelectItem value="STRING">STRING</SelectItem>
                      <SelectItem value="FLOAT">FLOAT</SelectItem>
                      <SelectItem value="BOOL">BOOL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={primaryKey.includes(column.name) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePrimaryKey(column.name)}
                  disabled={!column.name}
                  className="h-7 text-xs"
                >
                  PK
                </Button>
                {columns.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveColumn(index)}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Key Order */}
      {primaryKey.length > 0 && (
        <div className="space-y-2">
          <Label>Primary Key Order</Label>
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            {primaryKey.map((pkCol, index) => {
              const column = columns.find(col => col.name === pkCol);
              return (
                <div
                  key={pkCol}
                  className="flex items-center gap-2 p-2 bg-background rounded border"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">
                    {index + 1}. {pkCol}
                    {column && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({column.type})
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newPrimaryKey = primaryKey.filter(pk => pk !== pkCol);
                      onChange({ ...value, primaryKey: newPrimaryKey });
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <X size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            The order of columns in the primary key determines how records are sorted.
            Drag to reorder (coming soon) or remove and re-add to change order.
          </p>
        </div>
      )}

      {columns.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Add at least one column to define the table schema.
        </p>
      )}
    </div>
  );
};
