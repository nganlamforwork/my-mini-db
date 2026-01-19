import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import type { CompositeKey, Record } from '@/types/database';

export interface QueryResult {
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
  success: boolean;
  message: string;
  executionTime?: number;
  key?: CompositeKey;
  value?: Record;
  keys?: CompositeKey[];
  values?: Record[];
  error?: string;
  timestamp: Date;
}

interface QueryResultPanelProps {
  result: QueryResult | null;
  onClear?: () => void;
  fullHeight?: boolean; // When true, panel expands to fill available space
}

// Helper to format key for display
const formatKey = (key: CompositeKey): string => {
  if (!key || !key.values || key.values.length === 0) return '';
  if (key.values.length === 1) {
    return String(key.values[0].value);
  }
  return `(${key.values.map(v => String(v.value)).join(', ')})`;
};

// Helper to format value for display
const formatValue = (value: Record): string => {
  if (!value || !value.columns || value.columns.length === 0) return '';
  if (value.columns.length === 1) {
    return String(value.columns[0].value);
  }
  return `(${value.columns.map(v => String(v.value)).join(', ')})`;
};

export function QueryResultPanel({ result, onClear, fullHeight = false }: QueryResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!result) {
    // Show empty state when no results - still occupy space in full-height mode
    if (fullHeight) {
      return (
        <div className="flex-1 flex flex-col border-t border-border bg-card">
          <div className="flex items-center justify-between px-4 py-2 text-xs border-b border-border">
            <span className="text-muted-foreground">Query Result</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No query executed yet</p>
          </div>
        </div>
      );
    }
    return null;
  }

  const isQueryOperation = result.operation === 'SEARCH' || result.operation === 'RANGE_QUERY';
  const hasResults = isQueryOperation && 
    ((result.operation === 'SEARCH' && result.value) || 
     (result.operation === 'RANGE_QUERY' && result.keys && result.keys.length > 0));

  return (
    <div className={cn(
      "border-t border-border bg-card flex flex-col",
      fullHeight ? "flex-1 min-h-0" : "min-h-[250px] max-h-[40vh]"
    )}>
      {/* Compact Status Bar - Single Line */}
      <div className="flex items-center justify-between px-4 py-2 text-xs border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status Icon */}
          {result.success ? (
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          
          {/* Status Text */}
          <span className={cn(
            "font-medium flex-shrink-0",
            result.success ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          )}>
            Status: {result.success ? 'Success' : 'Failed'}
          </span>
          
          {/* Message */}
          <span className="text-foreground flex-1 min-w-0 truncate">
            {result.message}
          </span>
          
          {/* Execution Time */}
          {result.executionTime !== undefined && (
            <span className="text-muted-foreground flex-shrink-0">
              Time: {result.executionTime}ms
            </span>
          )}
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
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Results Container - Fixed height with scroll */}
      {isExpanded && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isQueryOperation ? (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4">
                {hasResults ? (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">Key</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.operation === 'SEARCH' && result.value && result.key && (
                        <tr className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono font-semibold">
                            {formatKey(result.key)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatValue(result.value)}
                          </td>
                        </tr>
                      )}
                      {result.operation === 'RANGE_QUERY' && result.keys && result.keys.map((key, index) => (
                        <tr key={index} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono font-semibold">
                            {formatKey(key)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {result.values && result.values[index] 
                              ? formatValue(result.values[index])
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    0 results found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="text-xs text-muted-foreground">
                {result.message}
              </div>
            </div>
          )}

          {/* Error Display - Compact, Inline */}
          {!result.success && result.error && (
            <div className="border-t border-border px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle size={12} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                <span className="text-red-600 dark:text-red-400">
                  {result.error}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
