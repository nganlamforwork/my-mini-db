import { ScrollArea } from '@/components/ui/scroll-area';

export const SearchHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-8">
        <div>
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-2">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Find the leaf node containing the specific target key.
              </div>
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Key Problem: Navigation</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Routing:</strong> Must correctly choose the child pointer where <code>child_key &le; target &lt; next_key</code>.</li>
                </ul>
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Step 1: Start at Root */}
          <div className="space-y-4">
             <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">1. Start at Root</h4>
                <p className="text-base text-muted-foreground mt-1">
                  Begin traversal from the root page. The root is the entry point for all operations.
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center min-h-[160px] border border-dashed">
                <div className="flex flex-col items-center">
                   <div className="w-20 h-12 border-2 border-primary rounded bg-background flex items-center justify-center shadow-sm">
                      <span className="text-sm font-bold">Root</span>
                   </div>
                   <div className="w-0.5 h-6 bg-muted-foreground/50"></div>
                   <div className="text-xs text-muted-foreground">Entry Level</div>
                </div>
             </div>
          </div>

          {/* Step 2: Internal Node Navigation */}
           <div className="space-y-4">
             <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">2. Internal Node Navigation</h4>
                <p className="text-base text-muted-foreground mt-1">
                  Perform <strong>Binary Search</strong> on separator keys to choose the correct child pointer.
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center min-h-[160px] border border-dashed">
                <div className="flex gap-2">
                   <div className="flex flex-col items-center opacity-50">
                      <div className="w-14 h-10 border rounded flex items-center justify-center bg-background"><span className="text-sm">10</span></div>
                      <div className="w-px h-4 bg-foreground"></div>
                   </div>
                   <div className="flex flex-col items-center">
                      <div className="w-14 h-10 border-2 border-indigo-500 rounded flex items-center justify-center bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold shadow-md transform scale-110">
                         <span className="text-sm">30</span>
                      </div>
                      <div className="h-4 w-0.5 bg-indigo-500"></div>
                      <div className="text-xs text-indigo-600 font-medium whitespace-nowrap">Target(35) &gt; 30</div>
                   </div>
                   <div className="flex flex-col items-center opacity-50">
                      <div className="w-14 h-10 border rounded flex items-center justify-center bg-background"><span className="text-sm">50</span></div>
                      <div className="w-px h-4 bg-foreground"></div>
                   </div>
                </div>
             </div>
          </div>
          
           {/* Step 3: Leaf Node Search */}
           <div className="space-y-4">
             <div className="border-l-4 border-emerald-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">3. Leaf Node Search</h4>
                <p className="text-base text-muted-foreground mt-1">
                  In the leaf, search the sorted key array for an exact match.
                </p>
             </div>
             <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center min-h-[160px] border border-dashed">
                 <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                    <div className="px-4 py-3 border-r text-sm text-muted-foreground">15</div>
                    <div className="px-4 py-3 border-r text-sm text-muted-foreground">22</div>
                    <div className="px-4 py-3 border-r text-sm font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">35</div>
                    <div className="px-4 py-3 text-sm text-muted-foreground">41</div>
                 </div>
             </div>
          </div>

           {/* Complexity */}
           <div className="space-y-4">
             <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">Complexity</h4>
                <p className="text-base text-muted-foreground mt-1">
                  Logarithmic time complexity due to tree height.
                </p>
             </div>
              <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center min-h-[160px] border border-dashed">
                 <div className="text-center">
                    <code className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">O(log n)</code>
                    <p className="text-xs text-muted-foreground mt-1">Base depends on Order (Branching Factor)</p>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
