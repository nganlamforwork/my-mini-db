import React from 'react';
import type { TreeNode, Schema } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Database, FileText, ArrowRight, ArrowLeft, Crown, Star, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeDetailDialogProps {
  node: TreeNode | null;
  schema?: Schema | null; // Schema for rendering proper table columns
  isRoot?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { formatKey } from '@/lib/keyUtils';

// Helper to format a single column value for display (simplified, no quotes)
const formatColumnValue = (value: any): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    // Check if it's a float and format accordingly
    if (Number.isInteger(value)) {
      return String(value);
    }
    return String(Number(value).toFixed(2));
  }
  return String(value);
};

// Helper to check if a column is part of the primary key
const isPrimaryKeyColumn = (columnName: string, schema: Schema | null | undefined): boolean => {
  if (!schema || !schema.primaryKey) return false;
  return schema.primaryKey.includes(columnName);
};

// Helper to parse Record to a row object mapping column names to values
const parseRecordToRow = (record: { columns: Array<{ type: string; value: any }> }, schema: Schema | null | undefined): { [key: string]: any } => {
  const row: { [key: string]: any } = {};
  
  if (!schema || !record.columns) {
    return {};
  }
  
  // Record.columns are in the same order as schema.columns
  schema.columns.forEach((colDef, index) => {
    if (record.columns[index]) {
      row[colDef.name] = record.columns[index].value;
    } else {
      row[colDef.name] = null;
    }
  });
  
  return row;
};

// Helper to extract key values as a row object (for display in table)
const parseKeyToRow = (key: { values: Array<{ type: string; value: any }> }, schema: Schema | null | undefined): { [key: string]: any } => {
  const row: { [key: string]: any } = {};
  
  if (!schema || !key.values) {
    return {};
  }
  
  // Key values are in the order of schema.primaryKey
  schema.primaryKey.forEach((pkColName, index) => {
    if (key.values[index]) {
      row[pkColName] = key.values[index].value;
    } else {
      row[pkColName] = null;
    }
  });
  
  return row;
};

export const NodeDetailDialog: React.FC<NodeDetailDialogProps> = ({ node, schema, isRoot = false, open, onOpenChange }) => {
  if (!node) return null;

  const isInternal = node.type === 'internal';

  // Simple icon color change for root - keep dialog styling same as internal/leaf
  const iconColor = isRoot 
    ? "text-amber-600 dark:text-amber-400" 
    : (isInternal ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isInternal ? "max-w-2xl max-h-[80vh]" : "max-w-4xl max-h-[85vh]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {isRoot ? (
              <Crown className={`h-5 w-5 ${iconColor}`} />
            ) : isInternal ? (
              <Database className={`h-5 w-5 ${iconColor}`} />
            ) : (
              <FileText className={`h-5 w-5 ${iconColor}`} />
            )}
            {isRoot 
              ? `Root (${isInternal ? 'Internal' : 'Leaf'}) Node` 
              : (isInternal ? 'Internal Node' : 'Leaf Node')} - Page #{node.pageId}
          </DialogTitle>
          <DialogDescription>
            {isRoot && `This is the root node of the B+ Tree. The root can be either a leaf node (when the tree is small) or an internal node (as the tree grows). All tree operations start from here.`}
            {!isRoot && isInternal && 'Internal nodes contain keys and child pointers for tree navigation.'}
            {!isRoot && !isInternal && 'Leaf nodes contain stored records (rows) and maintain sibling links.'}
          </DialogDescription>
        </DialogHeader>

        {/* Node Metadata - Compact Badge Layout */}
        <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
          <Badge variant="outline">
            ID: {node.pageId}
          </Badge>
          <Badge variant="secondary" className="capitalize">
            Type: {isRoot ? `Root (${isInternal ? 'Internal' : 'Leaf'})` : node.type}
          </Badge>
          <Badge variant="outline">
            Keys: {node.keys.length}
          </Badge>
          {node.nextPage !== undefined && (
            <Badge variant="outline">
              Next: {node.nextPage || 'None'}
            </Badge>
          )}
          {node.prevPage !== undefined && (
            <Badge variant="outline">
              Prev: {node.prevPage || 'None'}
            </Badge>
          )}
        </div>

        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6 mt-4">

          {/* Leaf Node: Stored Records - Table Layout */}
          {!isInternal && node.values && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Stored Records ({node.keys.length})
              </h3>
              
              {/* Primary Key Description Alert */}
              {schema && schema.primaryKey && schema.primaryKey.length > 0 && (
                <Alert variant="info">
                  <Info size={16} />
                  <AlertDescription className="text-sm flex items-center gap-2">
                    Columns marked with <Star className="inline h-3 w-3 text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400" /> represent the Primary Key.
                  </AlertDescription>
                </Alert>
              )}
              
              {schema && schema.columns && schema.columns.length > 0 ? (
                // Schema-based table rendering using Shadcn Table components
                <div className="overflow-x-auto border rounded-lg">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        {schema.columns.map((colDef) => {
                          const isPK = isPrimaryKeyColumn(colDef.name, schema);
                          return (
                            <TableHead
                              key={colDef.name}
                              className={cn(
                                "text-left px-3 py-2 h-auto",
                                isPK ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center gap-1.5 text-left">
                                {isPK && (
                                  <Star 
                                    size={12} 
                                    className="text-red-600 dark:text-red-400 fill-red-600 dark:fill-red-400 flex-shrink-0" 
                                  />
                                )}
                                <span className="text-left">{colDef.name}</span>
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {node.keys.map((key, idx) => {
                        const record = node.values?.[idx];
                        if (!record) return null;
                        
                        const keyRow = parseKeyToRow(key, schema);
                        const valueRow = parseRecordToRow(record, schema);
                        // Merge key and value rows (key values take precedence for PK columns)
                        const mergedRow = { ...valueRow, ...keyRow };
                        
                        return (
                          <TableRow key={idx}>
                            {schema.columns.map((colDef) => {
                              const isPK = isPrimaryKeyColumn(colDef.name, schema);
                              const cellValue = mergedRow[colDef.name];
                              return (
                                <TableCell
                                  key={colDef.name}
                                  className={cn(
                                    "text-left px-3 py-1.5 font-mono",
                                    isPK && "font-bold text-red-600 dark:text-red-400"
                                  )}
                                >
                                  {formatColumnValue(cellValue)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                // Fallback: Legacy card layout when schema is not available
                <div className="space-y-3">
                  {node.keys.map((key, idx) => {
                    const record = node.values?.[idx];
                    return (
                      <div
                        key={idx}
                        className="bg-background border rounded-lg p-4 space-y-3"
                      >
                        {/* Key */}
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          <span className="text-muted-foreground text-xs font-semibold">Key #{idx + 1}:</span>
                          <span className="font-mono font-semibold text-sm">{formatKey(key)}</span>
                          <div className="ml-auto text-xs text-muted-foreground">
                            {key.values.map((val, vIdx) => (
                              <span key={vIdx} className="ml-2">
                                <span className="capitalize">{val.type}</span>
                                <span className="mx-1">→</span>
                                <span>{formatColumnValue(val)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* Value */}
                        {record && (
                          <div className="space-y-2">
                            <span className="text-muted-foreground text-xs font-semibold">Value:</span>
                            <div className="grid grid-cols-1 gap-2 ml-4">
                              {record.columns.map((col, colIdx) => (
                                <div
                                  key={colIdx}
                                  className="flex items-start gap-3 text-sm"
                                >
                                  <span className="text-muted-foreground min-w-[60px] capitalize">{col.type}:</span>
                                  <span className="font-mono">{formatColumnValue(col)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Internal Node: Keys */}
          {isInternal && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Keys ({node.keys.length})
              </h3>
              <div className="space-y-1">
                {node.keys.map((key, idx) => (
                  <div
                    key={idx}
                    className="font-mono text-sm py-1 px-2 rounded hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground mr-2">#{idx + 1}:</span>
                    <span className="font-semibold">{formatKey(key)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Node: Children */}
          {isInternal && node.children && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Child Pointers ({node.children.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {node.children.map((childId, idx) => (
                  <div
                    key={idx}
                    className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-1.5 font-mono text-sm"
                  >
                    Page #{childId}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Internal nodes have {node.keys.length} keys and {node.children.length} children.
                Each child subtree contains keys between adjacent keys.
              </p>
            </div>
          )}

          {/* Leaf Node: Sibling Links */}
          {!isInternal && (node.nextPage !== undefined || node.prevPage !== undefined) && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Sibling Links</h3>
              <div className="flex items-center gap-4 text-sm">
                {node.prevPage !== undefined && (
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Previous:</span>
                    <span className="font-mono">{node.prevPage || 'None'}</span>
                  </div>
                )}
                {node.nextPage !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Next:</span>
                    <span className="font-mono">{node.nextPage || 'None'}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Leaf nodes are linked for efficient range queries and sequential scans.
              </p>
            </div>
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
