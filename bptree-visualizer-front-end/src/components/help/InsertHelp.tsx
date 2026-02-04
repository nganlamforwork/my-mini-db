import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Split } from 'lucide-react';
import { HelpStepWizard } from './HelpStepWizard';

export const InsertHelp: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
       <div className="mb-4">
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-2">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Add a new key-value pair to the tree while maintaining sorted order.
              </div>
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Key Problem: Constraints</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Happy Case:</strong> Node has space (Keys &lt; Order-1).</li>
                   <li><strong>Overflow:</strong> Node is full (Keys = Order-1) &rarr; Requires <strong>Split</strong>.</li>
                </ul>
              </div>
          </div>
       </div>

      <Tabs defaultValue="simple" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="simple" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Simple Insert (Happy Case)
          </TabsTrigger>
          <TabsTrigger value="split" className="flex items-center gap-2">
            <Split className="h-4 w-4" />
            Node Split (Overflow)
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
             <div className="p-4">
                <TabsContent value="simple" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="border-l-4 border-emerald-500 pl-4">
                            <h4 className="font-semibold text-foreground text-lg">Algorithm Steps</h4>
                            <ol className="list-decimal ml-5 mt-2 space-y-2 text-muted-foreground">
                              <li><strong>Find Target Leaf:</strong> Traverse from root to the correct leaf.</li>
                              <li><strong>Insert Entry:</strong> Place the key in sorted order.</li>
                              <li><strong>Update Pointers:</strong> No structural changes if capacity allows.</li>
                            </ol>
                        </div>
                      </div>

                      <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center gap-4">
                          <div className="text-sm font-semibold text-muted-foreground">Example: Insert 15</div>
                          <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                            <div className="px-3 py-3 border-r text-sm font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">10</div>
                            <div className="px-3 py-3 border-r text-sm font-bold bg-emerald-500 text-white animate-pulse">15</div>
                            <div className="px-3 py-3 border-r text-sm font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">20</div>
                          </div>
                          <p className="text-xs text-muted-foreground">Key 15 fits into the available slot.</p>
                      </div>
                  </div>
                </TabsContent>

                <TabsContent value="split" className="mt-0">
                   <HelpStepWizard 
                      showAllClassName="grid grid-cols-1 md:grid-cols-6 gap-6"
                      className="flex-1"
                      steps={[
                        // Step 1: Search - Col Span 2 (1/3 of row)
                        <div className="flex flex-col gap-4 md:col-span-2 h-full" key="step1">
                           <div className="border-l-4 border-blue-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">1. Search for Leaf</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Start from the root and traverse down to find the correct leaf node that <em>should</em> contain the new key (25).
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                              <div className="text-sm font-semibold text-muted-foreground mb-2">State 1: Search Path</div>
                              <div className="flex flex-col items-center gap-2">
                                 <div className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border shadow-sm text-xs">Root</div>
                                 <div className="h-4 w-0.5 bg-muted-foreground/30"></div>
                                 <div className="bg-white dark:bg-zinc-800 px-3 py-1 rounded border shadow-sm text-xs">Internal</div>
                                 <div className="h-4 w-0.5 bg-blue-500"></div>
                                 <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1 rounded border border-blue-200 text-xs font-bold animate-pulse">Target Leaf</div>
                              </div>
                          </div>
                        </div>,

                        // Step 2: Target / Full - Col Span 2 (1/3 of row)
                        <div className="flex flex-col gap-4 md:col-span-2 h-full" key="step2">
                           <div className="border-l-4 border-amber-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">2. Target is Full</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 The target leaf is found, but it is already full (Max Capacity). The new key cannot fit directly.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                              <div className="text-sm font-semibold text-muted-foreground mb-2">State 2: Key Waiting</div>
                              <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background opacity-80">
                                   <div className="px-2 py-2 border-r text-sm font-bold">10</div>
                                   <div className="px-2 py-2 border-r text-sm font-bold">20</div>
                                   <div className="px-2 py-2 border-r text-sm font-bold">30</div>
                                 </div>
                                 <div className="text-amber-600 font-bold flex items-center gap-1">
                                    <span className="text-xl">&larr;</span>
                                    <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/50 border border-amber-300 rounded text-sm text-amber-700 dark:text-amber-300">25</div>
                                 </div>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-2">Target Node Full + New Key</div>
                          </div>
                        </div>,

                        // Step 3: Overflow - Col Span 2 (1/3 of row)
                        <div className="flex flex-col gap-4 md:col-span-2 h-full" key="step3">
                           <div className="border-l-4 border-orange-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">3. Temporary Overflow</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Combine keys and sort them in a temporary buffer to find the <strong>Split Point</strong> (Middle Key).
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                              <div className="text-sm font-semibold text-muted-foreground mb-2">State 3: Sorted Buffer</div>
                              <div className="inline-flex items-center gap-0 border-2 border-amber-400 border-dashed rounded overflow-hidden bg-background/50">
                                   <div className="px-2 py-2 border-r text-sm font-bold opacity-70">10</div>
                                   <div className="px-2 py-2 border-r text-sm font-bold opacity-70">20</div>
                                   <div className="px-2 py-2 border-r text-sm font-bold bg-amber-100 text-amber-700 ring-2 ring-inset ring-amber-500 z-10">25</div>
                                   <div className="px-2 py-2 border-r text-sm font-bold opacity-70">30</div>
                               </div>
                               <div className="text-[10px] text-amber-600 mt-1 font-medium">Split Index: 2 (Key 25)</div>
                          </div>
                        </div>,

                        // Step 4: Split - Col Span 3 (1/2 of row)
                         <div className="flex flex-col gap-4 md:col-span-3 h-full" key="step4">
                           <div className="border-l-4 border-cyan-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">4. Split Nodes</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Divide the keys into two new nodes. <br/>
                                 <strong>Left:</strong> Keys &lt; Split Point. <br/>
                                 <strong>Right:</strong> Keys &ge; Split Point.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                              <div className="text-sm font-semibold text-muted-foreground mb-2">State 4: New Nodes</div>
                              <div className="flex justify-center gap-4">
                                     <div className="flex flex-col gap-1 items-center">
                                        <div className="flex items-center gap-0 border-2 border-emerald-500 rounded overflow-hidden shadow-md bg-white dark:bg-zinc-900 scale-90">
                                           <div className="px-2 py-2 border-r text-xs font-bold">10</div>
                                           <div className="px-2 py-2 border-r text-xs font-bold">20</div>
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Left</span>
                                     </div>
                                     <div className="flex flex-col gap-1 items-center">
                                        <div className="flex items-center gap-0 border-2 border-emerald-500 rounded overflow-hidden shadow-md bg-white dark:bg-zinc-900 scale-90">
                                           <div className="px-2 py-2 border-r text-xs font-bold bg-amber-100 text-amber-700">25</div>
                                           <div className="px-2 py-2 border-r text-xs font-bold">30</div>
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Right</span>
                                     </div>
                                  </div>
                          </div>
                        </div>,

                        // Step 5: Promote - Col Span 3 (1/2 of row)
                        <div className="flex flex-col gap-4 md:col-span-3 h-full" key="step5">
                           <div className="border-l-4 border-violet-500 pl-4">
                              <h4 className="font-semibold text-foreground text-lg">5. Promote Key</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 The separation key (25) moves up to the parent.
                              </p>
                          </div>
                           <div className="bg-muted/30 p-6 rounded-lg border border-dashed flex flex-col items-center justify-center h-48 w-full flex-1">
                              <div className="text-sm font-semibold text-muted-foreground mb-4">State 5: Parent Update</div>
                               <div className="relative flex flex-col items-center gap-4">
                                     {/* Parent */}
                                     <div className="z-10 bg-white dark:bg-zinc-800 px-4 py-2 shadow-lg border-2 border-amber-500 rounded-lg flex flex-col items-center">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase mb-1">Parent Node</span>
                                        <div className="flex items-center gap-2">
                                           <span className="text-sm font-bold text-amber-700">...</span>
                                           <div className="bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded text-amber-700 dark:text-amber-300 font-bold border border-amber-200">25</div>
                                           <span className="text-sm font-bold text-amber-700">...</span>
                                        </div>
                                     </div>
  
                                     <div className="absolute top-10 w-48 h-6 border-t-2 border-x-2 border-muted-foreground/30 rounded-t-xl -z-0"></div>
  
                                     <div className="flex gap-16 pt-2">
                                        <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background opacity-70">
                                           <div className="px-3 py-2 border-r text-sm font-bold">10</div>
                                           <div className="px-3 py-2 border-r text-sm font-bold">20</div>
                                        </div>
                                        <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background opacity-70">
                                           <div className="px-3 py-2 border-r text-sm font-bold bg-amber-100 text-amber-700">25</div>
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                        </div>
                                     </div>
                                  </div>
                          </div>
                        </div>,

                        // Complexity
                        <div className="space-y-4 md:col-span-6 h-full" key="complexity">
                             <div className="border-l-4 border-amber-500 pl-4">
                                <h4 className="font-semibold text-foreground text-lg">Complexity</h4>
                                <p className="text-base text-muted-foreground mt-1">
                                   Logarithmic time complexity due to tree height traversal.
                                </p>
                             </div>
                              <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-24 border border-dashed flex-1">
                                 <div className="text-center">
                                    <code className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">O(log n)</code>
                                    <p className="text-xs text-muted-foreground mt-1">n = number of keys</p>
                                 </div>
                             </div>
                        </div>
                      ]}
                   />
                </TabsContent>
             </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
};
