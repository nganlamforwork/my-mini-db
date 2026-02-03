import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const UpdateHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Overview</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>Update Operation</strong> modifies the value associated with an existing key. 
            It is optimized to perform <em>in-place updates</em> whenever possible to avoid expensive tree restructuring.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-sm text-muted-foreground ml-4 list-decimal marker:text-foreground">
            <li>
              <span className="font-semibold text-foreground">Locate Key</span>:
              <p className="mt-1">Traverse the tree to find the leaf node containing the target key.</p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Check Capacity</span>:
              <p className="mt-1">
                Compare the size of the new value with the old value. 
                If the new value fits within the existing page's free space (or is smaller), proceed to update.
              </p>
            </li>
            <li>
              <span className="font-semibold text-foreground">In-Place Update</span>:
              <p className="mt-1">
                 Overwrite the old value with the new one and update the page's free space counter. This is the <strong>fast path</strong>.
              </p>
            </li>
             <li>
              <span className="font-semibold text-foreground">Fallback (Delete + Insert)</span>:
              <p className="mt-1">
                If the new value is too large for the current page, performing an in-place update is not safe.
                Instead, <strong>Delete</strong> the old entry (potentially triggering a merge) and then <strong>Insert</strong> the new entry (potentially triggering a split).
              </p>
            </li>
          </ol>
        </div>

        <div>
           <h3 className="text-lg font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-sm font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n)</p>
        </div>
      </div>
    </ScrollArea>
  );
};
