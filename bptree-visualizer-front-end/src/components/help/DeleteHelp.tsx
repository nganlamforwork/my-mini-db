import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, ArrowLeftRight, Merge, ChevronDown } from 'lucide-react';
import { HelpStepWizard } from './HelpStepWizard';

export const DeleteHelp: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
       <div className="mb-4">
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-2">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Remove a target key from the tree.
              </div>
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Key Problem: Underflow</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Happy Case:</strong> Node has extra keys (Keys &gt; Order/2).</li>
                   <li><strong>Underflow:</strong> Node is too empty &rarr; Requires <strong>Borrow</strong> or <strong>Merge</strong>.</li>
                </ul>
              </div>
          </div>
       </div>

      <Tabs defaultValue="simple" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          <TabsTrigger value="simple" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Simple Delete (Happy)
          </TabsTrigger>
          <TabsTrigger value="borrow" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Borrow (Rotate)
          </TabsTrigger>
          <TabsTrigger value="merge" className="flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Merge (Coalesce)
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
             <div className="p-4">
                
                {/* 1. Simple Delete Tab */}
                <TabsContent value="simple" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="border-l-4 border-rose-500 pl-4">
                            <h4 className="font-semibold text-foreground text-lg">Algorithm Steps</h4>
                            <ol className="list-decimal ml-5 mt-2 space-y-2 text-muted-foreground">
                              <li><strong>Find Target:</strong> Locate the leaf node containing the key.</li>
                              <li><strong>Remove Entry:</strong> Delete the key from the node.</li>
                              <li><strong>Check Capacity:</strong> If keys remain &ge; Min Capacity, no further action needed.</li>
                            </ol>
                        </div>
                      </div>

                      <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center gap-4">
                          <div className="text-sm font-semibold text-muted-foreground">Example: Delete 20 (Min=1)</div>
                          <div className="flex flex-col gap-4">
                             <div className="flex items-center gap-2 opacity-50">
                                <span className="text-xs text-muted-foreground w-12 text-right">Before:</span>
                                <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold">10</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold bg-rose-100 text-rose-700">20</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                </div>
                             </div>
                             
                             <div className="flex justify-center">
                                <div className="h-6 w-0.5 bg-rose-500/50"></div>
                             </div>

                             <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-12 text-right">After:</span>
                                <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold">10</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                  <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                                </div>
                             </div>
                          </div>
                      </div>
                  </div>
                </TabsContent>

                {/* 2. Borrow Tab */}
                <TabsContent value="borrow" className="mt-0">
                   <HelpStepWizard 
                      showAllClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                      className="flex-1"
                      steps={[
                        // Step 1: Search (Initial State)
                        <div className="flex flex-col gap-4 h-full" key="step1">
                           <div className="border-l-4 border-slate-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">1. Search Target</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Locate target key (10). Parent (20) separates Target and Sibling.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                              <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-blue-600">20</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                 </div>
  
                                 {/* Connector Line */}
                                 <div className="absolute top-8 w-32 h-8 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
  
                                 <div className="flex gap-4 mt-8 w-full justify-center">
                                     {/* Target Node */}
                                      <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold bg-slate-100 text-slate-700">10</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Target</span>
                                     </div>
  
                                     {/* Sibling Node */}
                                      <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold">20</div>
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Sibling</span>
                                     </div>
                                 </div>
                              </div>
                          </div>
                        </div>,
  
                        // Step 2: Underflow
                        <div className="flex flex-col gap-4 h-full" key="step2">
                           <div className="border-l-4 border-orange-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">2. Identify Underflow</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Deleting key (10) leaves the node with 0 keys (Min Required = 1).
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                              <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-blue-600">20</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                 </div>
  
                                 {/* Connector Line */}
                                 <div className="absolute top-8 w-32 h-8 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
  
                                 <div className="flex gap-4 mt-8 w-full justify-center">
                                     {/* Target Node (Underflow) */}
                                     <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border-2 border-orange-500 border-dashed rounded overflow-hidden bg-background">
                                           <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                                         </div>
                                         <span className="text-orange-600 text-xs font-bold mt-1">Underflow!</span>
                                     </div>
  
                                     {/* Sibling Node */}
                                     <div className="flex flex-col items-center opacity-70">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold">20</div>
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Sibling</span>
                                     </div>
                                 </div>
                              </div>
                          </div>
                        </div>,
  
                        // Step 3: Check Sibling
                        <div className="flex flex-col gap-4 h-full" key="step3">
                           <div className="border-l-4 border-emerald-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">3. Check Sibling</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Parent (20) checks right sibling. Sibling has keys [20, 30] (Surplus).
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                              <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10 mb-6">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-blue-600">20</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                    <div className="absolute top-10 w-24 h-4 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
                                 </div>
  
                                 <div className="flex items-center gap-4 mt-2">
                                    <div className="w-12 h-8 border-2 border-dashed border-orange-300 rounded bg-background/50"></div>
                                    <div className="flex items-center gap-0 border border-emerald-500 rounded overflow-hidden shadow-sm bg-background">
                                       <div className="px-3 py-2 border-r text-sm font-bold bg-emerald-100 text-emerald-800">20</div>
                                       <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                    </div>
                                 </div>
                                 <span className="text-emerald-600 text-xs font-bold">Can Borrow</span>
                              </div>
                          </div>
                        </div>,
  
                        // Step 4: Rotate
                        <div className="flex flex-col gap-4 h-full" key="step4">
                           <div className="border-l-4 border-blue-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">4. Rotate Key</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Sibling key (20) &rarr; Parent. Old Parent key (20) &rarr; Target. Parent updated to 30.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                              <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-blue-200 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-blue-600">30</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                 </div>
  
                                 {/* Connector Line */}
                                 <div className="absolute top-8 w-32 h-8 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
                                 
                                 <div className="flex gap-4 mt-8 w-full justify-center">
                                     {/* Target Node */}
                                     <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden bg-background shadow-sm">
                                           <div className="px-3 py-2 border-r text-sm font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">20</div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground mt-1">Target</span>
                                     </div>
                                      
                                     {/* Sibling Node */}
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden bg-background shadow-sm">
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground mt-1">Sibling</span>
                                     </div>
                                 </div>
                              </div>
                          </div>
                        </div>
                      ]}
                   />
                </TabsContent>

                {/* 3. Merge Tab */}
                <TabsContent value="merge" className="mt-0">
                   <HelpStepWizard 
                      showAllClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                      className="flex-1"
                      steps={[
                        // Step 1: Search (Initial)
                        <div className="flex flex-col gap-4 h-full" key="step1">
                           <div className="border-l-4 border-slate-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">1. Search Target</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Locate key (25). Parent (30) separates Target and Sibling.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                              <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-purple-600">30</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                 </div>
  
                                 {/* Connector Line */}
                                 <div className="absolute top-8 w-32 h-8 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
                                 
                                 <div className="flex gap-4 mt-8 w-full justify-center">
                                     {/* Target Node */}
                                      <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold bg-slate-100 text-slate-700">25</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Target</span>
                                     </div>
  
                                     {/* Sibling Node */}
                                      <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Sibling</span>
                                     </div>
                                 </div>
                              </div>
                          </div>
                        </div>,
  
                        // Step 2: Underflow
                        <div className="flex flex-col gap-4 h-full" key="step2">
                           <div className="border-l-4 border-orange-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">2. Identify Underflow</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Node becomes empty. Parent key is 30.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                               <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-purple-600">30</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                 </div>
  
                                 {/* Connector Line */}
                                 <div className="absolute top-8 w-32 h-8 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
  
                                 <div className="flex gap-4 mt-8 w-full justify-center">
                                     {/* Target Node (Underflow) */}
                                     <div className="flex flex-col items-center">
                                         <div className="flex items-center gap-0 border-2 border-orange-500 border-dashed rounded overflow-hidden bg-background">
                                           <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                                         </div>
                                         <span className="text-orange-600 text-xs font-bold mt-1">Underflow!</span>
                                     </div>
  
                                     {/* Sibling Node */}
                                     <div className="flex flex-col items-center opacity-70">
                                         <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                           <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                                         </div>
                                         <span className="text-[10px] text-muted-foreground mt-1">Sibling</span>
                                     </div>
                                 </div>
                              </div>
                          </div>
                        </div>,
  
                        // Step 3: Sibling Check (Fail)
                        <div className="flex flex-col gap-4 h-full" key="step3">
                           <div className="border-l-4 border-red-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">3. Sibling Minimum</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Parent (30) checks sibling. Sibling has only 1 key (Min). Cannot borrow.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                               <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10 mb-6">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-muted-foreground/20 shadow-sm mb-1">
                                       <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                       <span className="text-sm font-bold text-muted-foreground mr-1">...</span><span className="text-sm font-bold text-purple-600">30</span><span className="text-sm font-bold text-muted-foreground ml-1">...</span>
                                    </div>
                                    <div className="absolute top-10 w-24 h-4 border-t-2 border-x-2 border-muted-foreground/20 rounded-t-xl"></div>
                                 </div>
                                 
                                 <div className="flex items-center gap-4 mt-2">
                                    <div className="w-8 h-8 border-dashed border-2 border-orange-300 rounded"></div>
                                    <div className="flex items-center gap-0 border border-red-400 rounded overflow-hidden shadow-sm bg-background">
                                       <div className="px-3 py-2 border-r text-sm font-bold text-red-700">30</div>
                                    </div>
                                 </div>
                                 <span className="text-red-500 text-xs mt-2">No Extra Keys</span>
                              </div>
                          </div>
                        </div>,
  
                        // Step 4: Merge (Parent Involved)
                        <div className="flex flex-col gap-4 h-full" key="step4">
                           <div className="border-l-4 border-purple-500 pl-4 h-24">
                              <h4 className="font-semibold text-foreground text-lg">4. Coalesce</h4>
                              <p className="text-muted-foreground mt-1 text-sm">
                                 Parent key (30) is <strong>pulled down</strong> into the new node.
                              </p>
                          </div>
                          <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                               <div className="flex flex-col items-center w-full gap-2 relative">
                                 {/* Parent Node */}
                                 <div className="flex flex-col items-center z-10">
                                    <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-purple-200 shadow-sm mb-1 opacity-50">
                                       <span className="text-xs font-bold text-muted-foreground">Parent: ... <span className="line-through decoration-2 decoration-rose-500 px-1">30</span> ...</span>
                                    </div>
                                    <ChevronDown  className="h-5 w-5 text-purple-500 animate-bounce" />
                                 </div>
  
                                 <div className="flex flex-col items-center mt-2">
                                    <div className="flex items-center gap-0 border-2 border-purple-500 rounded overflow-hidden shadow-md bg-white dark:bg-zinc-900">
                                       <div className="px-3 py-2 border-r text-sm font-bold opacity-50">...</div>
                                       <div className="px-3 py-2 border-r text-sm font-bold bg-purple-100 text-purple-800">30</div>
                                       <div className="px-3 py-2 border-r text-sm font-bold">...</div>
                                    </div>
                                    <span className="text-[10px] text-purple-600 font-bold mt-1">Merged Node</span>
                                 </div>
                              </div>
                          </div>
                        </div>
                      ]}
                   />
                </TabsContent>

                 {/* Complexity */}
                <div className="mt-8 space-y-4">
                     <div className="border-l-4 border-amber-500 pl-4">
                        <h4 className="font-semibold text-foreground text-lg">Complexity</h4>
                        <p className="text-base text-muted-foreground mt-1">
                           Logarithmic time complexity due to tree height traversal. Rebalancing cost is amortized.
                        </p>
                     </div>
                      <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-center h-24 border border-dashed">
                         <div className="text-center">
                            <code className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">O(log n)</code>
                            <p className="text-xs text-muted-foreground mt-1">n = number of keys</p>
                         </div>
                     </div>
                  </div>
             </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
};
