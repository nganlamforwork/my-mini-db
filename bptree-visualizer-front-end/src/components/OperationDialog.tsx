import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InsertForm } from './forms/InsertForm';
import { SearchForm } from './forms/SearchForm';
import { UpdateForm } from './forms/UpdateForm';
import { DeleteForm } from './forms/DeleteForm';
import { RangeQueryForm } from './forms/RangeQueryForm';
import { SimpleKeyValueForm } from './forms/SimpleKeyValueForm';
import { SimpleRangeForm } from './forms/SimpleRangeForm';
import type { Schema, CompositeKey, Record as DBRecord } from '@/types/database';

interface OperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'insert' | 'search' | 'update' | 'delete' | 'range';
  schema?: Schema | null | undefined; // Optional - not needed for simple operations
  onSubmit: (rowData?: { key?: CompositeKey; value?: DBRecord } | Record<string, any>, startKeyData?: CompositeKey | Record<string, any>, endKeyData?: CompositeKey | Record<string, any>) => void;
}

export const OperationDialog: React.FC<OperationDialogProps> = ({ open, onOpenChange, operation, schema, onSubmit }) => {
  const handleInsertSubmit = (rowData: Record<string, any> | { key: CompositeKey; value: DBRecord }) => {
    onSubmit(rowData);
    onOpenChange(false);
  };

  const handleUpdateSubmit = (rowData: Record<string, any> | { key: CompositeKey; value: DBRecord }) => {
    onSubmit(rowData);
    onOpenChange(false);
  };

  const handleSearchSubmit = (keyData: Record<string, any> | CompositeKey) => {
    // Handle both old format (keyData object) and new format (CompositeKey directly)
    if ('values' in keyData && Array.isArray(keyData.values)) {
      onSubmit(undefined, keyData as CompositeKey);
    } else {
      onSubmit(undefined, keyData as any);
    }
    onOpenChange(false);
  };

  const handleDeleteSubmit = (keyData: Record<string, any> | CompositeKey) => {
    // Handle both old format (keyData object) and new format (CompositeKey directly)
    if ('values' in keyData && Array.isArray(keyData.values)) {
      onSubmit(undefined, keyData as CompositeKey);
    } else {
      onSubmit(undefined, keyData as any);
    }
    onOpenChange(false);
  };

  const handleRangeSubmit = (startKeyData: Record<string, any> | CompositeKey, endKeyData: Record<string, any> | CompositeKey) => {
    // Handle both old format (keyData object) and new format (CompositeKey directly)
    const startKey = ('values' in startKeyData && Array.isArray(startKeyData.values)) ? startKeyData as CompositeKey : startKeyData as any;
    const endKey = ('values' in endKeyData && Array.isArray(endKeyData.values)) ? endKeyData as CompositeKey : endKeyData as any;
    onSubmit(undefined, startKey, endKey);
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
          {schema ? (
            <>
              {operation === 'insert' && <InsertForm schema={schema} onSubmit={handleInsertSubmit} />}
              {operation === 'search' && <SearchForm schema={schema} onSubmit={handleSearchSubmit} />}
              {operation === 'update' && <UpdateForm schema={schema} onSubmit={handleUpdateSubmit} />}
              {operation === 'delete' && <DeleteForm schema={schema} onSubmit={handleDeleteSubmit} />}
              {operation === 'range' && <RangeQueryForm schema={schema} onSubmit={handleRangeSubmit} />}
            </>
          ) : (
            <>
              {operation === 'insert' && (
                <SimpleKeyValueForm
                  operation="insert"
                  onSubmit={(key: CompositeKey, value?: DBRecord) => {
                    if (value) {
                      handleInsertSubmit({ key, value } as any);
                    }
                  }}
                />
              )}
              {operation === 'search' && (
                <SimpleKeyValueForm
                  operation="search"
                  onSubmit={(key: CompositeKey) => {
                    handleSearchSubmit(key);
                  }}
                />
              )}
              {operation === 'update' && (
                <SimpleKeyValueForm
                  operation="update"
                  onSubmit={(key: CompositeKey, value?: DBRecord) => {
                    if (value) {
                      handleUpdateSubmit({ key, value } as any);
                    }
                  }}
                />
              )}
              {operation === 'delete' && (
                <SimpleKeyValueForm
                  operation="delete"
                  onSubmit={(key: CompositeKey) => {
                    handleDeleteSubmit(key);
                  }}
                />
              )}
              {operation === 'range' && (
                <SimpleRangeForm
                  onSubmit={(startKey: CompositeKey, endKey: CompositeKey) => {
                    handleRangeSubmit(startKey, endKey);
                  }}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
