import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';
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
  isLockedOpen?: boolean; // When true, panel is forced expanded and cannot be collapsed
  defaultExpanded?: boolean; // Default expanded state when not locked (default: false = collapsed)
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

export function QueryResultPanel({ 
  result, 
  onClear, 
  fullHeight = false, 
  isLockedOpen = false,
  defaultExpanded = false 
}: QueryResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Track previous result timestamp to detect new results
  const prevTimestampRef = useRef<Date | null>(null);
  
  // Auto-expand when a new result arrives (if not locked open)
  useEffect(() => {
    if (result && !isLockedOpen) {
      const currentTimestamp = result.timestamp;
      const prevTimestamp = prevTimestampRef.current;
      
      // Check if this is a new result (different timestamp)
      if (!prevTimestamp || currentTimestamp.getTime() !== prevTimestamp.getTime()) {
        // New result arrived - auto-expand to show it
        setIsExpanded(true);
        prevTimestampRef.current = currentTimestamp;
      }
    } else if (!result) {
      // Reset timestamp when result is cleared
      prevTimestampRef.current = null;
    }
  }, [result, isLockedOpen]);
  
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
                ) : showZeroResults ? (
                  // Only show "0 results found" when there's no specific error reason
                  <div className="text-xs text-muted-foreground text-center py-8">
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
