import React from 'react';
import type { TreeNode } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, FileText, ArrowRight, ArrowLeft, Crown } from 'lucide-react';

interface NodeDetailDialogProps {
  node: TreeNode | null;
  isRoot?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatKey = (key: { values: Array<{ type: string; value: any }> }): string => {
  if (key.values.length === 1) {
    return String(key.values[0].value);
  }
  return `(${key.values.map(v => String(v.value)).join(', ')})`;
};

const formatColumnValue = (col: { type: string; value: any }): string => {
  switch (col.type) {
    case 'string':
      return `"${col.value}"`;
    case 'bool':
      return col.value ? 'true' : 'false';
    case 'float':
      return String(Number(col.value).toFixed(2));
    default:
      return String(col.value);
  }
};

export const NodeDetailDialog: React.FC<NodeDetailDialogProps> = ({ node, isRoot = false, open, onOpenChange }) => {
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
            {!isRoot && !isInternal && 'Leaf nodes contain key-value pairs and maintain sibling links.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6 mt-4">
          {/* Node Metadata */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3">Node Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Page ID:</span>
                <span className="ml-2 font-mono font-semibold">{node.pageId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 font-semibold capitalize">
                  {isRoot ? `Root (${isInternal ? 'Internal' : 'Leaf'})` : node.type}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Key Count:</span>
                <span className="ml-2 font-mono font-semibold">{node.keys.length}</span>
              </div>
              {node.nextPage !== undefined && (
                <div>
                  <span className="text-muted-foreground">Next Page:</span>
                  <span className="ml-2 font-mono">{node.nextPage || 'None'}</span>
                </div>
              )}
              {node.prevPage !== undefined && (
                <div>
                  <span className="text-muted-foreground">Previous Page:</span>
                  <span className="ml-2 font-mono">{node.prevPage || 'None'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Leaf Node: Key-Value Pairs */}
          {!isInternal && node.values && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Key-Value Pairs ({node.keys.length})
              </h3>
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
            </div>
          )}

          {/* Internal Node: Keys */}
          {isInternal && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Keys ({node.keys.length})
              </h3>
              <div className="space-y-2">
                {node.keys.map((key, idx) => (
                  <div
                    key={idx}
                    className="bg-background border rounded-lg p-3 font-mono text-sm"
                  >
                    <span className="text-muted-foreground mr-2">#{idx + 1}:</span>
                    <span className="font-semibold">{formatKey(key)}</span>
                    <div className="mt-2 ml-6 text-xs text-muted-foreground">
                      {key.values.map((val, vIdx) => (
                        <div key={vIdx}>
                          <span className="capitalize">{val.type}</span>
                          <span className="mx-2">→</span>
                          <span>{formatColumnValue(val)}</span>
                        </div>
                      ))}
                    </div>
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
