import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, ArrowLeftRight, Merge, ChevronRight } from 'lucide-react';

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
        <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0">
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
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      
                      {/* Step 1: Underflow */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-orange-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">1. Identify Underflow</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               Deleting key (10) leaves the node with 0 keys (Min Required = 1).
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                            <div className="text-sm font-semibold text-muted-foreground mb-2">State 1: Empty Node</div>
                            <div className="flex items-center gap-0 border-2 border-orange-500 border-dashed rounded overflow-hidden bg-background">
                              <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                              <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                            </div>
                            <span className="text-orange-600 text-xs font-bold mt-1">Underflow!</span>
                        </div>
                      </div>

                      {/* Step 2: Check Sibling */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-emerald-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">2. Check Sibling</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               The right sibling has 2 keys (Surplus). It can spare one key.
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                            <div className="text-sm font-semibold text-muted-foreground mb-2">State 2: Rich Sibling</div>
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-8 border-2 border-dashed border-orange-300 rounded bg-background/50"></div>
                               <div className="flex items-center gap-0 border border-emerald-500 rounded overflow-hidden shadow-sm bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold bg-emerald-100 text-emerald-800">20</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold">30</div>
                               </div>
                            </div>
                        </div>
                      </div>

                      {/* Step 3: Rotate (Parent Involved) */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-blue-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">3. Rotate Key</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               Sibling key (20) replaces Parent key. Parent key moves down to Target.
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                            <div className="flex flex-col items-center w-full gap-2 relative">
                               {/* Parent Node */}
                               <div className="flex flex-col items-center z-10">
                                  <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-blue-200 shadow-sm mb-1">
                                     <span className="text-xs font-bold text-muted-foreground mr-2">Parent:</span>
                                     <span className="text-sm font-bold text-blue-600">20</span>
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

                   </div>
                </TabsContent>

                {/* 3. Merge Tab */}
                <TabsContent value="merge" className="mt-0">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Step 1: Underflow */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-orange-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">1. Underflow</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               Node becomes empty. Min required is 1.
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                             <div className="flex items-center gap-0 border-2 border-orange-500 border-dashed rounded overflow-hidden bg-background">
                              <div className="px-3 py-2 border-r text-sm text-transparent bg-muted/20">__</div>
                            </div>
                        </div>
                      </div>

                      {/* Step 2: Sibling Check (Fail) */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-red-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">2. Sibling Minimum</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               Sibling also has only 1 key (Min). Cannot borrow.
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[160px]">
                            <div className="flex items-center gap-4">
                               <div className="flex items-center gap-0 border border-red-400 rounded overflow-hidden shadow-sm bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold text-red-700">30</div>
                               </div>
                            </div>
                            <span className="text-red-500 text-xs mt-2">No Extra Keys</span>
                        </div>
                      </div>

                      {/* Step 3: Merge (Parent Involved) */}
                      <div className="flex flex-col gap-4">
                         <div className="border-l-4 border-purple-500 pl-4 h-24">
                            <h4 className="font-semibold text-foreground text-lg">3. Coalesce</h4>
                            <p className="text-muted-foreground mt-1 text-sm">
                               Target and Sibling merge. Parent key (30) is pulled down into the new node.
                            </p>
                        </div>
                        <div className="bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1 min-h-[200px]">
                             <div className="flex flex-col items-center w-full gap-2 relative">
                               {/* Parent Node */}
                               <div className="flex flex-col items-center z-10">
                                  <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg border-2 border-purple-200 shadow-sm mb-1 opacity-50">
                                     <span className="text-xs font-bold text-muted-foreground">Parent (Key 30 Removed)</span>
                                  </div>
                                  <ChevronRight  className="h-5 w-5 text-purple-500 animate-bounce" />
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

                   </div>
                </TabsContent>
             </div>
          </ScrollArea>
        </div>
      </Tabs>
    </div>
  );
};
