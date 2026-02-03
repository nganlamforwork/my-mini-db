import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeftRight } from 'lucide-react';

export const RangeHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-8">
        <div>
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-0">
              <div>
                <span className="font-bold text-violet-700 dark:text-violet-400">Main Objective: </span>
                Retrieve all keys falling within a closed interval <code>[Start, End]</code>.
              </div>
              <div>
                <span className="font-bold text-indigo-700 dark:text-indigo-400">Key Problem: Continuity</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Traversal:</strong> Need to jump between leaf nodes using <code>Next</code> pointers without going back up to the parent.</li>
                </ul>
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Step 1: Locate Start */}
           <div className="space-y-4">
             <div className="border-l-4 border-violet-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">1. Locate Start</h4>
                <p className="text-base text-muted-foreground mt-1">
                  Traverse the tree to find the leaf containing the <em>Start Key</em> (or the first key &ge; Start Key).
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-32 border border-dashed">
                <div className="flex flex-col items-center gap-2">
                   <div className="flex gap-2 opacity-50">
                      <div className="w-10 h-8 border rounded flex items-center justify-center bg-background text-xs">...</div>
                   </div>
                   <div className="flex flex-col items-center">
                      <div className="px-4 py-2 border-2 border-violet-500 rounded bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold shadow-md">
                         Start Search: 18
                      </div>
                      <div className="h-4 w-0.5 bg-violet-500"></div>
                      <div className="w-24 h-10 border rounded flex items-center justify-center bg-background text-sm font-medium shadow-sm">
                         Leaf Node
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Step 2: Scan Leaf */}
           <div className="space-y-4">
             <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">2. Scan Leaf</h4>
                <p className="text-base text-muted-foreground mt-1">
                  Iterate through the keys starting from the first matching position. Collect keys <code>&le; End Key</code>.
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-32 border border-dashed flex-col gap-2">
                <div className="text-xs font-semibold text-muted-foreground mb-1">End Key: 36</div>
                <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                   <div className="px-3 py-3 border-r text-sm text-muted-foreground/50 bg-muted/20">15</div>
                   <div className="px-3 py-3 border-r text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 relative">
                      22
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-500" title="Start Point"></div>
                   </div>
                   <div className="px-3 py-3 border-r text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">35</div>
                   <div className="px-3 py-3 text-sm text-muted-foreground opacity-50 bg-background/50">45</div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex gap-4">
                   <span className="text-muted-foreground/50">Skipped (&lt; 18)</span>
                   <span className="text-blue-600 font-medium">Included</span>
                   <span>Excluded (&gt; 36)</span>
                </div>
             </div>
          </div>

          {/* Step 3: Follow Leaf Chain */}
           <div className="space-y-4">
             <div className="border-l-4 border-cyan-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">3. Follow Leaf Chain</h4>
                <p className="text-base text-muted-foreground mt-1">
                   If the range extends beyond the current node, use the <strong>Next Page</strong> pointer to jump to the sibling leaf.
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-32 border border-dashed">
                <div className="flex items-center gap-4">
                   <div className="w-24 h-12 border rounded bg-background flex items-center justify-center text-sm shadow-sm">
                      Leaf A
                   </div>
                   <div className="flex flex-col items-center">
                      <div className="h-0.5 w-12 bg-cyan-500"></div>
                      <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider mt-1">Next Ptr</div>
                   </div>
                   <div className="w-24 h-12 border-2 border-cyan-500 rounded bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center text-sm font-bold text-cyan-700 dark:text-cyan-300 shadow-md">
                      Leaf B
                   </div>
                </div>
             </div>
          </div>

           {/* Complexity */}
           <div className="space-y-4">
             <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">Complexity</h4>
                <p className="text-base text-muted-foreground mt-1">
                   Efficiency depends on search depth plus the number of elements retrieved.
                </p>
             </div>
              <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-32 border border-dashed">
                 <div className="text-center">
                    <code className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">O(log n + k)</code>
                    <p className="text-xs text-muted-foreground mt-1">k = number of results found</p>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
