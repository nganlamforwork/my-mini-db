import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const InsertHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Overview</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The <strong>Insert Operation</strong> adds a new key-value pair to the B+Tree while maintaining its balanced property. 
            It ensures that all leaf nodes are at the same depth. The core complexity lies in handling <em>overflows</em> via 
            <strong> Node Splitting</strong>, which can propagate from the leaf level up to the root.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-primary">Algorithm Steps</h3>
          <ol className="space-y-4 text-sm text-muted-foreground ml-4 list-decimal marker:text-foreground">
            <li>
              <span className="font-semibold text-foreground">Find Target Leaf</span>:
              <p className="mt-1">Traverse from the root to the correct leaf node where the key belongs.</p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Insert Entry</span>:
              <p className="mt-1">Add the key-value pair into the leaf in sorted order.</p>
            </li>
            <li>
              <span className="font-semibold text-foreground">Check Overflow</span>:
              <p className="mt-1">If the node size exceeds the maximum capacity (Order - 1 keys), trigger a <strong>Split</strong>.</p>
            </li>
          </ol>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-3 text-primary">Detailed Split Logic</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground text-sm">1. Leaf Node Split</h4>
              <ul className="list-disc ml-5 mt-1 text-sm text-muted-foreground space-y-1">
                <li>Create a new leaf node <strong>L'</strong>.</li>
                <li>Keep the first <em>ceil((n+1)/2)</em> keys in the original node <strong>L</strong>.</li>
                <li>Move the remaining keys to the new node <strong>L'</strong>.</li>
                <li>Update the <em>Next Page</em> pointers: <strong>L.next</strong> points to <strong>L'</strong>.</li>
                <li><strong>Copy</strong> the first key of <strong>L'</strong> (the separation key) to the parent internal node.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground text-sm">2. Internal Node Split</h4>
              <ul className="list-disc ml-5 mt-1 text-sm text-muted-foreground space-y-1">
                <li>Create a new internal node <strong>I'</strong>.</li>
                <li>Keep the first <em>ceil(n/2)</em> keys in the original node <strong>I</strong>.</li>
                <li><strong>Push up</strong> the middle key to the parent node. (Note: Unlike leaf split, the middle key is <em>moved</em>, not copied).</li>
                <li>Move the remaining keys to the new node <strong>I'</strong>.</li>
              </ul>
            </div>
            
             <div>
              <h4 className="font-semibold text-foreground text-sm">3. Root Split</h4>
              <ul className="list-disc ml-5 mt-1 text-sm text-muted-foreground space-y-1">
                 <li>If the root splits, create a <strong>new root</strong>.</li>
                 <li>The new root will contain the promoted key and pointers to the two split nodes.</li>
                 <li>This is the only operation that increases the tree height.</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
           <h3 className="text-lg font-semibold mb-2 text-primary">Complexity</h3>
           <p className="text-sm font-mono text-foreground bg-secondary/50 inline-block px-2 py-1 rounded">O(log n)</p>
           <p className="text-xs text-muted-foreground mt-1">
             In the worst case, splitting propagates all the way to the root.
           </p>
        </div>
      </div>
    </ScrollArea>
  );
};
