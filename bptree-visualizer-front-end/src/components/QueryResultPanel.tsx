import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Star } from 'lucide-react';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from '@/lib/utils';
import type { CompositeKey, Record as DatabaseRecord, Schema } from '@/types/database';

export interface QueryResult {
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
  success: boolean;
  message: string;
  executionTime?: number;
  key?: CompositeKey;
  value?: DatabaseRecord;
  keys?: CompositeKey[];
  values?: DatabaseRecord[];
  error?: string;
  timestamp: Date;
}

interface QueryResultPanelProps {
  result: QueryResult | null;
  schema?: Schema | null; // Schema for rendering proper table columns
  onClear?: () => void;
  fullHeight?: boolean; // When true, panel expands to fill available space
  isLockedOpen?: boolean; // When true, panel is forced expanded and cannot be collapsed
  defaultExpanded?: boolean; // Default expanded state when not locked (default: false = collapsed)
}

import { formatKey } from '@/lib/keyUtils';

// Helper to format a single column value for display
const formatColumnValue = (value: any): string => {
  if (value === null || value === undefined) return 'NULL';
  return String(value);
};

// Helper to check if a column is part of the primary key
const isPrimaryKeyColumn = (columnName: string, schema: Schema | null | undefined): boolean => {
  if (!schema || !schema.primaryKey) return false;
  return schema.primaryKey.includes(columnName);
};

// Helper to parse Record to a row object mapping column names to values
const parseRecordToRow = (record: DatabaseRecord, schema: Schema | null | undefined): { [key: string]: any } => {
  const row: { [key: string]: any } = {};
  
  if (!schema || !record.columns) {
    // Fallback: if no schema, return empty object or use index-based mapping
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
const parseKeyToRow = (key: CompositeKey, schema: Schema | null | undefined): { [key: string]: any } => {
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

export function QueryResultPanel({ 
  result, 
  schema,
  onClear, 
  fullHeight = false, 
  isLockedOpen = false,
  defaultExpanded = false 
}: QueryResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Force expanded state when locked open
  const effectiveExpanded = isLockedOpen ? true : isExpanded;

  // Always render panel, even when no result (for persistence in DOM)
  // Show empty state when no results
  if (!result) {
    return (
      <div className={cn(
        "border-t border-border bg-card flex flex-col",
        fullHeight ? "flex-1 min-h-0" : (effectiveExpanded ? "min-h-[250px] max-h-[40vh]" : "h-auto")
      )}>
        <div className="flex items-center justify-between px-4 py-2 text-xs border-b border-border flex-shrink-0">
          <span className="text-muted-foreground">Query Result</span>
          {!isLockedOpen && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-muted-foreground" />
              ) : (
                <ChevronUp size={14} className="text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        {effectiveExpanded && (
          <div className={cn(
            "flex items-center justify-center",
            fullHeight ? "flex-1" : "min-h-[200px]"
          )}>
            <p className="text-sm text-muted-foreground">No query executed yet</p>
          </div>
        )}
      </div>
    );
  }

  const isQueryOperation = result.operation === 'SEARCH' || result.operation === 'RANGE_QUERY';
  const hasResults = isQueryOperation && 
    ((result.operation === 'SEARCH' && result.value) || 
     (result.operation === 'RANGE_QUERY' && result.keys && result.keys.length > 0));

  // Extract error reason from message or error field
  const getErrorReason = (): string | null => {
    // Check error field first (for actual failures)
    if (result.error) {
      return result.error;
    }
    
    // Extract from message (e.g., "Key not found", "Key 123 not found")
    // This handles both success cases (key not found) and failure cases
    const message = result.message || '';
    
    // Check for "not found" patterns (even if success: true)
    if (message.includes('not found')) {
      // Extract just the "Key X not found" part, or use the full message
      const match = message.match(/Key\s+[^.]*not found/i);
      return match ? match[0] : message;
    }
    
    // For failures without "not found", return the message as reason
    if (!result.success && message) {
      return message;
    }
    
    return null;
  };

  const errorReason = getErrorReason();
  const showZeroResults = isQueryOperation && !hasResults && !errorReason;

  return (
    <div className={cn(
      "border-t border-border bg-card flex flex-col",
      fullHeight ? "flex-1 min-h-0" : (effectiveExpanded ? "min-h-[250px] max-h-[40vh]" : "h-auto")
    )}>
      {/* Compact Status Bar - Single Line */}
      <div className="flex items-center justify-between px-4 py-2 text-xs border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Status Icon */}
          {result.success ? (
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          
          {/* Combined Status Line */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={cn(
              "font-medium flex-shrink-0",
              result.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              Status: {result.success ? 'Success' : 'Failed'}
            </span>
            
            {/* Error/Reason - Show for failures or "not found" cases */}
            {errorReason && (
              <>
                <span className="text-muted-foreground flex-shrink-0">|</span>
                <span className={cn(
                  "flex-shrink-0",
                  result.success ? "text-muted-foreground" : "text-red-600 dark:text-red-400"
                )}>
                  Reason: {errorReason}
                </span>
              </>
            )}
            
            {/* Execution Time */}
            {result.executionTime !== undefined && (
              <>
                <span className="text-muted-foreground flex-shrink-0">|</span>
                <span className="text-muted-foreground flex-shrink-0">
                  ({result.executionTime}ms)
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              Clear
            </Button>
          )}
          {!isLockedOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(prev => !prev);
              }}
              className="p-0.5 hover:bg-muted rounded"
              aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
            >
              {isExpanded ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Results Container - Fixed height with scroll */}
      {effectiveExpanded && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isQueryOperation ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-0">
                {hasResults ? (
                  schema && schema.columns && schema.columns.length > 0 ? (
                    // Schema-based table rendering using Shadcn Table components
                    <div className="overflow-x-auto">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
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
                          {result.operation === 'SEARCH' && result.value && result.key && (() => {
                            const keyRow = parseKeyToRow(result.key, schema);
                            const valueRow = parseRecordToRow(result.value, schema);
                            // Merge key and value rows (key values take precedence for PK columns)
                            const mergedRow = { ...valueRow, ...keyRow };
                            return (
                              <TableRow>
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
                          })()}
                          {result.operation === 'RANGE_QUERY' && result.keys && result.keys.map((key, index) => {
                            const keyRow = parseKeyToRow(key, schema);
                            const valueRow = result.values && result.values[index] 
                              ? parseRecordToRow(result.values[index], schema)
                              : {};
                            // Merge key and value rows (key values take precedence for PK columns)
                            const mergedRow = { ...valueRow, ...keyRow };
                            return (
                              <TableRow key={index}>
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
                    // Fallback: Legacy Key/Value table when schema is not available
                    <div className="p-4">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            <TableHead className="text-left px-3 py-2">Key</TableHead>
                            <TableHead className="text-left px-3 py-2">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.operation === 'SEARCH' && result.value && result.key && (
                            <TableRow>
                              <TableCell className="text-left px-3 py-2 font-mono font-semibold">
                                {formatKey(result.key)}
                              </TableCell>
                              <TableCell className="text-left px-3 py-2 font-mono">
                                {result.value.columns?.map((col: { type: string; value: any }, idx: number) => (
                                  <span key={idx}>
                                    {idx > 0 && ', '}
                                    {formatColumnValue(col.value)}
                                  </span>
                                ))}
                              </TableCell>
                            </TableRow>
                          )}
                          {result.operation === 'RANGE_QUERY' && result.keys && result.keys.map((key, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-left px-3 py-2 font-mono font-semibold">
                                {formatKey(key)}
                              </TableCell>
                              <TableCell className="text-left px-3 py-2 font-mono">
                                {result.values && result.values[index] 
                                  ? result.values[index].columns?.map((col: { type: string; value: any }, idx: number) => (
                                      <span key={idx}>
                                        {idx > 0 && ', '}
                                        {formatColumnValue(col.value)}
                                      </span>
                                    ))
                                  : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : showZeroResults ? (
                  // Only show "0 results found" when there's no specific error reason
                  <div className="text-xs text-muted-foreground text-center py-8 px-4">
                    0 results found
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            // Non-query operations (INSERT/UPDATE/DELETE) - show success message
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="text-xs text-muted-foreground">
                {result.message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
