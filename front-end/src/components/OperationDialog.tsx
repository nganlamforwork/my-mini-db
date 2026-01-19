import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InsertForm } from './forms/InsertForm';
import { SearchForm } from './forms/SearchForm';
import { UpdateForm } from './forms/UpdateForm';
import { DeleteForm } from './forms/DeleteForm';
import { RangeQueryForm } from './forms/RangeQueryForm';
import type { Schema } from '@/types/database';

interface OperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'insert' | 'search' | 'update' | 'delete' | 'range';
  schema: Schema | null | undefined; // undefined = not loaded yet, null = loaded but doesn't exist
  onSubmit: (rowData?: Record<string, any>, startKeyData?: Record<string, any>, endKeyData?: Record<string, any>) => void;
}

export const OperationDialog: React.FC<OperationDialogProps> = ({ open, onOpenChange, operation, schema, onSubmit }) => {
  const handleInsertSubmit = (rowData: Record<string, any>) => {
    onSubmit(rowData);
    onOpenChange(false);
  };

  const handleUpdateSubmit = (rowData: Record<string, any>) => {
    onSubmit(rowData);
    onOpenChange(false);
  };

  const handleSearchSubmit = (keyData: Record<string, any>) => {
    onSubmit(undefined, keyData);
    onOpenChange(false);
  };

  const handleDeleteSubmit = (keyData: Record<string, any>) => {
    onSubmit(undefined, keyData);
    onOpenChange(false);
  };

  const handleRangeSubmit = (startKeyData: Record<string, any>, endKeyData: Record<string, any>) => {
    onSubmit(undefined, startKeyData, endKeyData);
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

  // Show loading state if schema is not yet loaded (undefined = not loaded yet)
  if (schema === undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="capitalize">{operation} Operation</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading database schema...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="capitalize">{operation} Operation</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {operation === 'insert' && <InsertForm schema={schema} onSubmit={handleInsertSubmit} />}
          {operation === 'search' && <SearchForm schema={schema} onSubmit={handleSearchSubmit} />}
          {operation === 'update' && <UpdateForm schema={schema} onSubmit={handleUpdateSubmit} />}
          {operation === 'delete' && <DeleteForm schema={schema} onSubmit={handleDeleteSubmit} />}
          {operation === 'range' && <RangeQueryForm schema={schema} onSubmit={handleRangeSubmit} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};
