import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const UpdateHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-0">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Modify the value associated with an existing key.
              </div>
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Key Problem: Existence</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Validation:</strong> Must confirm the key actually exists before attempting any write.</li>
                   <li><strong>Structure:</strong> Updates typically do not change the tree structure.</li>
                </ul>
              </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-base text-muted-foreground ml-4 list-decimal marker:text-foreground">
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
           <h3 className="text-2xl font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-base font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n)</p>
        </div>
      </div>
    </ScrollArea>
  );
};
