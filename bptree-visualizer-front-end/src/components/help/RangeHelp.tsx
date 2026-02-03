import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const RangeHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Overview</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>Range Query Operation</strong> leverages the B+Tree's leaf-level doubly-linked list.
            Unlike point queries, it scans horizontally across leaves, making it highly efficient for retrieving ranges of data.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-sm text-muted-foreground ml-4 list-decimal marker:text-foreground">
            <li>
              <span className="font-semibold text-foreground">Locate Start</span>:
              <p className="mt-1">
                Traverse the tree to find the leaf containing the <em>Start Key</em> (or the first key &ge; Start Key).
              </p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Scan Leaf</span>:
              <p className="mt-1">
                Iterate through the keys in the current leaf, collecting those that satisfy <code>key &le; End Key</code>.
              </p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Follow Leaf Chain</span>:
              <p className="mt-1">
                 If the end of the leaf is reached and the last key is still &lt; <em>End Key</em>, 
                 use the <strong>Next Page</strong> pointer to jump to the right sibling leaf.
              </p>
            </li>
             <li>
              <span className="font-semibold text-foreground">Terminate</span>:
              <p className="mt-1">Stop scanning when a key exceeds the <em>End Key</em>.</p>
            </li>
          </ol>
        </div>

        <div>
           <h3 className="text-lg font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-sm font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n + k)</p>
           <p className="text-xs text-muted-foreground mt-1">
             Where <em>k</em> is the number of results found.
           </p>
        </div>
      </div>
    </ScrollArea>
  );
};
