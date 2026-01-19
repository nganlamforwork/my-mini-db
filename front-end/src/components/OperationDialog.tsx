import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InsertForm } from './forms/InsertForm';
import { SearchForm } from './forms/SearchForm';
import { UpdateForm } from './forms/UpdateForm';
import { DeleteForm } from './forms/DeleteForm';
import { RangeQueryForm } from './forms/RangeQueryForm';
import type { ColumnType } from '@/types/database';

interface OperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'insert' | 'search' | 'update' | 'delete' | 'range';
  onSubmit: (key: { values: Array<{ type: ColumnType; value: any }> }, value?: { columns: Array<{ type: ColumnType; value: any }> }, endKey?: { values: Array<{ type: ColumnType; value: any }> }) => void;
}

export const OperationDialog: React.FC<OperationDialogProps> = ({ open, onOpenChange, operation, onSubmit }) => {
  const handleFormSubmit = (
    key: { values: Array<{ type: ColumnType; value: any }> },
    value?: { columns: Array<{ type: ColumnType; value: any }> }
  ) => {
    onSubmit(key, value);
    onOpenChange(false);
  };

  const handleRangeSubmit = (
    startKey: { values: Array<{ type: ColumnType; value: any }> },
    endKey: { values: Array<{ type: ColumnType; value: any }> }
  ) => {
    // For range queries, pass startKey, undefined value, and endKey
    onSubmit(startKey, undefined, endKey);
    onOpenChange(false);
  };

  const getDescription = () => {
    switch (operation) {
      case 'insert':
        return 'Add a new key-value pair to the database';
      case 'search':
        return 'Find a value by its key';
      case 'update':
        return 'Modify the value for an existing key';
      case 'delete':
        return 'Remove a key-value pair from the database';
      case 'range':
        return 'Query all keys within a specified range';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="capitalize">{operation} Operation</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {operation === 'insert' && <InsertForm onSubmit={handleFormSubmit} />}
          {operation === 'search' && <SearchForm onSubmit={(key) => handleFormSubmit(key)} />}
          {operation === 'update' && <UpdateForm onSubmit={handleFormSubmit} />}
          {operation === 'delete' && <DeleteForm onSubmit={(key) => handleFormSubmit(key)} />}
          {operation === 'range' && <RangeQueryForm onSubmit={handleRangeSubmit} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
