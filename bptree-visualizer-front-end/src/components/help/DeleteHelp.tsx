import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const DeleteHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-0">
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Main Objective: </span>
                Remove a target key from the tree.
              </div>
              <div>
                <span className="font-bold text-orange-700 dark:text-orange-400">Key Problem: Underflow</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Happy Case:</strong> Node has extra keys (Keys &gt; Order/2).</li>
                   <li><strong>Underflow:</strong> Node is too empty &rarr; Requires <strong>Borrow</strong> or <strong>Merge</strong>.</li>
                </ul>
              </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-base text-muted-foreground ml-4 list-decimal marker:text-foreground">
             <li>
              <span className="font-semibold text-foreground">Find & Remove</span>:
              <p className="mt-1">Locate the leaf containing the key and remove it.</p>
            </li>
             <li>
              <span className="font-semibold text-foreground">Check Underflow</span>:
              <p className="mt-1">
                Verify if the node satisfies the minimum key count (<em>ceil(n/2) - 1</em>).
                If yes, the operation is complete. If no, proceed to rebalancing.
              </p>
            </li>
          </ol>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg border">
          <h3 className="text-2xl font-semibold mb-3 text-primary">Rebalancing Logic</h3>
          
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground text-lg flex items-center gap-2">
                1. Borrowing (Redistribution)
                <span className="px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-sm font-normal border border-green-200">Preferred</span>
              </h4>
              <p className="text-base text-muted-foreground mt-1 mb-2">
                Occurs when a sibling node has <strong>surplus</strong> keys (more than minimum).
              </p>
              <ul className="list-disc ml-5 text-base text-muted-foreground space-y-1">
                <li>Identify immediate sibling (left or right).</li>
                <li><strong>Rotate Key</strong>:
                  <ul className="list-circle ml-5 mt-1 border-l pl-2 space-y-1">
                     <li><em>From Left Sibling</em>: Move its last key to the current node. Update parent separator.</li>
                     <li><em>From Right Sibling</em>: Move its first key to the current node. Update parent separator.</li>
                  </ul>
                </li>
                <li>This operation avoids merging and preserves tree structure.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground text-lg flex items-center gap-2">
                2. Merging (Coalescing)
                 <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-sm font-normal border border-orange-200">Fallback</span>
              </h4>
               <p className="text-base text-muted-foreground mt-1 mb-2">
                Occurs when siblings are also at <strong>minimum capacity</strong> (cannot borrow).
              </p>
              <ul className="list-disc ml-5 text-base text-muted-foreground space-y-1">
                <li>Combine the current node with a sibling into a single node.</li>
                <li><strong>Pull Down</strong>: Move the separator key from the parent down into the merged node (for internal nodes).</li>
                <li>Remove the empty node and update pointers.</li>
                <li>This reduces the number of nodes and can propagate underflow to the parent.</li>
              </ul>
            </div>
            
             <div>
              <h4 className="font-semibold text-foreground text-lg">3. Root Handling</h4>
              <ul className="list-disc ml-5 mt-1 text-base text-muted-foreground space-y-1">
                 <li>If the root becomes empty after a merge, its single child becomes the new root.</li>
                 <li>This is the only operation that decreases the tree height.</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
           <h3 className="text-2xl font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-base font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n)</p>
        </div>
      </div>
    </ScrollArea>
  );
};
