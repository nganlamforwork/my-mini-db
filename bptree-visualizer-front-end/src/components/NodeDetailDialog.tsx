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
import { Badge } from '@/components/ui/badge';
import { Database, FileText, ArrowRight, ArrowLeft, Crown } from 'lucide-react';
import { formatKey } from '@/lib/keyUtils';

interface NodeDetailDialogProps {
  node: TreeNode | null;
  schema?: Schema | null; // Schema for rendering proper table columns
  isRoot?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

// Helper to format key values as (x) or (x, y, z)
const formatKeyValues = (key: { values: Array<{ type: string; value: any }> }): string => {
  if (!key || !key.values || key.values.length === 0) return '()';
  const values = key.values.map(v => formatColumnValue(v.value));
  if (values.length === 1) {
    return `(${values[0]})`;
  }
  return `(${values.join(', ')})`;
};

// Helper to format record columns as (y) or (y, z, k)
const formatRecordValues = (record: { columns: Array<{ type: string; value: any }> } | undefined): string => {
  if (!record || !record.columns || record.columns.length === 0) return '()';
  const values = record.columns.map(col => formatColumnValue(col.value));
  if (values.length === 1) {
    return `(${values[0]})`;
  }
  return `(${values.join(', ')})`;
};


export const NodeDetailDialog: React.FC<NodeDetailDialogProps> = ({ node, schema: _schema, isRoot = false, open, onOpenChange }) => {
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

          {/* Leaf Node: Stored Records - Simple Format */}
          {!isInternal && node.values && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Stored Records ({node.keys.length})
              </h3>
              
              <div className="space-y-2">
              {node.keys.map((key, idx) => {
                const record = node.values?.[idx];
                const keyStr = formatKeyValues(key);
                const valueStr = formatRecordValues(record);
                
                return (
                  <div
                    key={idx}
                    className="bg-background border rounded-lg p-3 font-mono text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-foreground">{keyStr}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="text-muted-foreground">{valueStr}</span>
                  </div>
                );
              })}
              </div>
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
