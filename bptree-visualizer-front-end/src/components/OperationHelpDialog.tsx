import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OperationHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: 'insert' | 'search' | 'update' | 'delete' | 'range' | null;
}

const operationDescriptions = {
  insert: {
    title: 'Insert Operation',
    overview: 'B+Tree insertion with automatic node splitting to maintain balance. The operation handles two cases: simple insertion (no split) and insertion with splits that propagate upward. All insertions maintain sorted order and tree balance properties.',
    algorithm: [
      'Handle empty tree - Create root leaf if tree is empty',
      'Find target leaf - Navigate to leaf that should contain the key',
      'Check duplicates - Return error if key already exists',
      'Insert into leaf - Add key-value pair in sorted order',
      'Check overflow - Verify if leaf exceeds capacity (key count or payload size)',
      'Split if needed - Split leaf and propagate split upward through internal nodes',
      'Create new root - If root splits, create new root internal node'
    ],
    complexity: 'O(log n)',
    purpose: 'Adds new key-value pairs to the database while maintaining B+Tree balance through automatic node splitting.'
  },
  search: {
    title: 'Search Operation',
    overview: 'Standard B+Tree search with O(log n) complexity through binary search at both internal nodes and leaves. The search traverses from root to leaf using binary search to determine the correct path, then performs binary search within the target leaf to find the exact key.',
    algorithm: [
      'Start at root - Begin traversal from the root page',
      'Navigate internal nodes - Binary search keys to determine correct child pointer',
      'Follow path downward - Descend through internal nodes until reaching a leaf',
      'Search leaf - Binary search in the leaf\'s sorted key array to find exact match',
      'Return result - Return value if found, error otherwise'
    ],
    complexity: 'O(log n)',
    purpose: 'Efficiently locates values by their keys using binary search at each tree level.'
  },
  update: {
    title: 'Update Operation',
    overview: 'Atomic value modification that optimizes for the common case where the new value fits in the existing page. The implementation avoids unnecessary tree rebalancing by performing in-place updates when possible, falling back to delete-insert only when required.',
    algorithm: [
      'Locate key - Find leaf containing target key',
      'Verify existence - Return error if key not found',
      'Calculate size change - Compare old and new value sizes',
      'Check capacity - Determine if new value fits in current page',
      'In-place update - If fits, replace value and update free space',
      'Fallback - If doesn\'t fit, delete old entry and re-insert'
    ],
    complexity: 'O(log n)',
    purpose: 'Modifies existing values atomically, optimizing for in-place updates when possible.'
  },
  delete: {
    title: 'Delete Operation',
    overview: 'Full B+Tree deletion maintaining tree balance through redistribution (borrowing) and merging. The algorithm handles both leaf and internal node rebalancing with proper separator key management.',
    algorithm: [
      'Locate and remove - Find leaf and remove key-value pair',
      'Check underflow - Verify node maintains minimum occupancy',
      'Try borrowing - Attempt to borrow from sibling with surplus keys',
      'Merge if needed - If siblings at minimum, merge nodes and remove separator',
      'Propagate upward - Recursively rebalance parent if it underflows',
      'Handle root - Reduce tree height when root has single child'
    ],
    complexity: 'O(log n)',
    purpose: 'Removes key-value pairs while maintaining B+Tree balance through borrowing and merging operations.'
  },
  range: {
    title: 'Range Query Operation',
    overview: 'Efficient range scanning leveraging the leaf-level doubly-linked list. Unlike point queries that require tree traversal, range queries follow horizontal links between leaves after locating the start position, achieving O(log n + k) complexity where k is the result count.',
    algorithm: [
      'Validate range - Ensure startKey ≤ endKey',
      'Locate start leaf - Find leaf containing or after startKey',
      'Scan current leaf - Collect keys within range',
      'Follow leaf chain - Use NextPage pointer to traverse horizontally',
      'Early termination - Stop when keys exceed endKey',
      'Return results - Aggregate collected key-value pairs'
    ],
    complexity: 'O(log n + k) where k = result count',
    purpose: 'Efficiently retrieves all keys within a specified range using horizontal leaf traversal.'
  }
};

export const OperationHelpDialog: React.FC<OperationHelpDialogProps> = ({ open, onOpenChange, operation }) => {
  const [selectedOp, setSelectedOp] = React.useState<'insert' | 'search' | 'update' | 'delete' | 'range'>(operation || 'insert');

  React.useEffect(() => {
    if (operation) {
      setSelectedOp(operation);
    }
  }, [operation]);

  if (!open) return null;

  const operations: Array<'insert' | 'search' | 'update' | 'delete' | 'range'> = ['insert', 'search', 'update', 'delete', 'range'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Algorithms</DialogTitle>
        </DialogHeader>
        <Tabs value={selectedOp} onValueChange={(value) => setSelectedOp(value as typeof selectedOp)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {operations.map(op => (
              <TabsTrigger key={op} value={op} className="capitalize text-xs">
                {op}
              </TabsTrigger>
            ))}
          </TabsList>
          {operations.map(op => {
            const info = operationDescriptions[op];
            return (
              <TabsContent key={op} value={op} className="mt-4">
                <ScrollArea className="max-h-[calc(85vh-180px)] pr-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Overview</h3>
                      <p className="text-sm text-muted-foreground">{info.overview}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Purpose</h3>
                      <p className="text-sm text-muted-foreground">{info.purpose}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Algorithm Steps</h3>
                      <ol className="space-y-1.5 text-sm text-muted-foreground ml-4 list-decimal">
                        {info.algorithm.map((step, idx) => (
                          <li key={idx}>{step.replace(/^\d+\.\s*/, '')}</li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Time Complexity</h3>
                      <p className="text-sm font-mono text-foreground">{info.complexity}</p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
