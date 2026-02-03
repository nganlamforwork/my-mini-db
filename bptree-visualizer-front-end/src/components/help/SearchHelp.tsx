import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const SearchHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Overview</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>Search Operation</strong> efficiently locates a value by its key. 
            It leverages the B+Tree structure to perform binary searches at each level, ensuring predictable performance.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-sm text-muted-foreground ml-4 list-decimal marker:text-foreground">
            <li>
              <span className="font-semibold text-foreground">Start at Root</span>:
              <p className="mt-1">Begin traversal from the root page.</p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Navigate Internal Nodes</span>:
              <p className="mt-1">
                Perform <strong>Binary Search</strong> on the keys within the node to determine which child pointer to follow.
                Traverse downwards until a leaf node is reached.
              </p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Search Leaf</span>:
              <p className="mt-1">
                 Perform <strong>Binary Search</strong> in the leaf's sorted key array to find the exact match.
              </p>
            </li>
             <li>
              <span className="font-semibold text-foreground">Return Result</span>:
              <p className="mt-1">Return the value if found, or an error/null if the key does not exist.</p>
            </li>
          </ol>
        </div>

        <div>
           <h3 className="text-lg font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-sm font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n)</p>
           <p className="text-xs text-muted-foreground mt-1">
             Depends on the height of the tree.
           </p>
        </div>
      </div>
    </ScrollArea>
  );
};
