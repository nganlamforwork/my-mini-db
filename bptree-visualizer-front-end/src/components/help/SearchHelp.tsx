import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpStepWizard } from './HelpStepWizard';

export const SearchHelp: React.FC = () => {
  const steps = [
    // Step 1: Start at Root
    <div className="space-y-4 flex flex-col h-full" key="step1">
       <div className="border-l-4 border-blue-500 pl-4">
          <h4 className="font-semibold text-foreground text-lg">1. Start at Root</h4>
          <p className="text-base text-muted-foreground mt-1">
            Begin traversal from the root page. Support the <strong>Target Key (35)</strong> to guide the process.
          </p>
       </div>
       <div className="bg-muted/30 p-4 rounded-lg flex flex-col items-center justify-center gap-6 border border-dashed flex-1 min-h-[160px]">
          
          {/* Target Key Display */}
          <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Target:</span>
              <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold rounded border border-blue-200 shadow-sm">
                  35
              </div>
          </div>

          <div className="flex flex-col items-center">
             <div className="w-20 h-10 border-2 border-primary rounded bg-background flex items-center justify-center shadow-sm">
                <span className="text-sm font-bold">Root</span>
             </div>
             <div className="w-0.5 h-6 bg-blue-500"></div>
             <div className="text-xs text-blue-600 font-medium">Start Search</div>
          </div>
       </div>
    </div>,

    // Step 2: Internal Node Navigation
    <div className="space-y-4 flex flex-col h-full" key="step2">
       <div className="border-l-4 border-indigo-500 pl-4">
          <h4 className="font-semibold text-foreground text-lg">2. Internal Node Navigation</h4>
          <p className="text-base text-muted-foreground mt-1">
            Compare <strong>Target Key (35)</strong> with separator keys to find the correct path.
          </p>
       </div>
       <div className="bg-muted/30 p-6 rounded-lg flex flex-col items-center justify-center gap-6 border border-dashed flex-1 min-h-[200px]">
          
          {/* Target Key Display */}
          <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-muted-foreground">Target:</span>
              <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded border border-indigo-200 shadow-sm animate-pulse">
                  35
              </div>
          </div>

          {/* Internal Node Structure */}
          <div className="relative z-10">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1 text-center">Internal Node</div>
              <div className="flex items-center border-2 border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-background shadow-md">
                  {/* P0 */}
                  <div className="w-8 h-10 border-r bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-[10px] text-muted-foreground">P0</div>
                  
                  {/* Key 10 */}
                  <div className="w-10 h-10 border-r flex items-center justify-center font-semibold text-muted-foreground">10</div>
                  
                  {/* P1 */}
                  <div className="w-8 h-10 border-r bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-[10px] text-muted-foreground">P1</div>
                  
                  {/* Key 30 */}
                  <div className="w-10 h-10 border-r flex items-center justify-center font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">30</div>
                  
                  {/* P2 (Selected) */}
                  <div className="w-8 h-10 border-r bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 relative group">
                      P2
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                          <div className="w-0.5 h-8 bg-indigo-500"></div>
                          <div className="w-2 h-2 border-r-2 border-b-2 border-indigo-500 rotate-45 -mt-1.5"></div>
                      </div>
                  </div>
                  
                  {/* Key 50 */}
                  <div className="w-10 h-10 border-r flex items-center justify-center font-semibold text-muted-foreground">50</div>
                  
                  {/* P3 */}
                  <div className="w-8 h-10 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-[10px] text-muted-foreground">P3</div>
              </div>
          </div>

          {/* Explanation Logic */}
          <div className="mt-4 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-900">
               30 &le; 35 &lt; 50 &rarr; Follow P2
          </div>
       </div>
    </div>,

    // Step 3: Leaf Node Search
    <div className="space-y-4 flex flex-col h-full" key="step3">
       <div className="border-l-4 border-emerald-500 pl-4">
          <h4 className="font-semibold text-foreground text-lg">3. Leaf Node Search</h4>
          <p className="text-base text-muted-foreground mt-1">
            In the leaf, search the sorted key array for an exact match of <strong>Target (35)</strong>.
          </p>
       </div>
       <div className="bg-muted/30 p-4 rounded-lg flex flex-col items-center justify-center gap-6 border border-dashed flex-1 min-h-[160px]">
           
           {/* Target Key Display */}
          <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Target:</span>
              <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold rounded border border-emerald-200 shadow-sm">
                  35
              </div>
          </div>

           <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
              <div className="px-4 py-3 border-r text-sm text-muted-foreground">15</div>
              <div className="px-4 py-3 border-r text-sm text-muted-foreground">22</div>
              <div className="px-4 py-3 border-r text-sm font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 relative">
                  35
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  </div>
              </div>
              <div className="px-4 py-3 text-sm text-muted-foreground">41</div>
           </div>
           
           <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900">
               Match Found!
          </div>
       </div>
    </div>,

    // Complexity
    <div className="space-y-4 flex flex-col h-full" key="complexity">
       <div className="border-l-4 border-amber-500 pl-4">
          <h4 className="font-semibold text-foreground text-lg">Complexity</h4>
          <p className="text-base text-muted-foreground mt-1">
            Logarithmic time complexity due to tree height.
          </p>
       </div>
        <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center min-h-[160px] border border-dashed flex-1">
           <div className="text-center">
              <code className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">O(log n)</code>
              <p className="text-xs text-muted-foreground mt-1">Base depends on Order (Branching Factor)</p>
           </div>
       </div>
    </div>
  ];

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-8 flex flex-col h-full"> 
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

        <HelpStepWizard 
           steps={steps} 
           showAllClassName="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch"
           className="flex-1"
        />
      </div>
    </ScrollArea>
  );
};
