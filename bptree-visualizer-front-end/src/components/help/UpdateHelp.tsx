import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, FileWarning, ArrowDown, Trash2, Plus, CheckCircle2 } from 'lucide-react';

export const UpdateHelp: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
       <div className="mb-4">
          <div className="flex flex-col gap-2 text-base text-muted-foreground mt-2">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Update the value associated with an existing key.
              </div>
              <div>
                <span className="font-bold text-rose-700 dark:text-rose-400">Key Problem: Page Capacity</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Simple Case:</strong> New value fits in existing page &rarr; In-Place Update (Fast).</li>
                   <li><strong>Overflow:</strong> New value is too large &rarr; Must <strong>Delete</strong> old entry and <strong>Insert</strong> new one.</li>
                </ul>
              </div>
          </div>
       </div>

      <Tabs defaultValue="simple" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
          <TabsTrigger value="simple" className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Simple Update (In-Place)
          </TabsTrigger>
          <TabsTrigger value="overflow" className="flex items-center gap-2">
            <FileWarning className="h-4 w-4" />
            Overflow (Too Large)
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
             <div className="p-4">
                
                {/* 1. Simple Update Tab */}
                <TabsContent value="simple" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="border-l-4 border-emerald-500 pl-4">
                            <h4 className="font-semibold text-foreground text-lg">Algorithm Steps</h4>
                            <ol className="list-decimal ml-5 mt-2 space-y-2 text-muted-foreground">
                              <li><strong>Locate Key:</strong> Find the leaf node containing the key.</li>
                              <li><strong>Check Size:</strong> Verify new value fits in free space.</li>
                              <li><strong>In-Place Update:</strong> Overwrite old value with new value.</li>
                            </ol>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                           <p className="text-sm text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="inline h-4 w-4 mr-2 mb-0.5" />
                              This is the <strong>Happy Path</strong>. Structure of the tree does not change.
                           </p>
                        </div>
                      </div>

                      <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center gap-4">
                          <div className="text-sm font-semibold text-muted-foreground">Example: Update Key 20 ("Old" &rarr; "New")</div>
                          
                          <div className="flex flex-col gap-6 items-center">
                             {/* Before */}
                             <div className="flex items-center gap-2 opacity-60">
                                <span className="text-xs text-muted-foreground">Before</span>
                                <div className="flex items-center gap-0 border border-muted-foreground/30 rounded overflow-hidden shadow-sm bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold border-muted-foreground/20">10</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold bg-slate-100 text-slate-700 flex flex-col items-center min-w-[60px]">
                                     <span>20</span>
                                     <span className="text-[10px] font-normal text-muted-foreground">"Old"</span>
                                  </div>
                                  <div className="px-3 py-2 border-r text-sm font-bold border-muted-foreground/20">30</div>
                                </div>
                             </div>
                             
                             <ArrowDown className="h-6 w-6 text-muted-foreground/50" />

                             {/* After */}
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">After</span>
                                <div className="flex items-center gap-0 border border-emerald-500 rounded overflow-hidden shadow-md bg-background">
                                  <div className="px-3 py-2 border-r text-sm font-bold border-muted-foreground/20">10</div>
                                  <div className="px-3 py-2 border-r text-sm font-bold bg-emerald-100 text-emerald-800 flex flex-col items-center min-w-[60px]">
                                     <span>20</span>
                                     <span className="text-[10px] font-bold">"New"</span>
                                  </div>
                                  <div className="px-3 py-2 border-r text-sm font-bold border-muted-foreground/20">30</div>
                                </div>
                             </div>
                          </div>
                      </div>
                  </div>
                </TabsContent>

                {/* 2. Overflow Update Tab */}
                <TabsContent value="overflow" className="mt-0">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                         
                         {/* Clarification Note */}
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm mb-4">
                             <div className="flex gap-2">
                                <FileWarning className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <div>
                                    <span className="font-bold text-blue-700 dark:text-blue-300">What is "Overflow" here?</span>
                                    <p className="mt-1 text-blue-800 dark:text-blue-200 leading-relaxed">
                                        Unlike <strong>Insert Overflow</strong> (which often hits a <em>Key Count</em> limit in simplified visualizations), <strong>Update Overflow</strong> occurs when the <strong>Total Byte Size</strong> of the new value exceeds the node's fixed capacity (e.g., 4KB), even if the node has few keys.
                                    </p>
                                </div>
                             </div>
                         </div>

                         <div className="border-l-4 border-amber-500 pl-4">
                            <h4 className="font-semibold text-foreground text-lg">Logic: Fallback Strategy</h4>
                            <p className="text-muted-foreground mt-2">
                               If the new value is <strong>too large</strong> to fit in the current page, we cannot do a simple overwrite.
                            </p>
                            <p className="text-muted-foreground mt-2">
                               Strategy: treat it as a <strong>Delete</strong> followed by an <strong>Insert</strong>.
                            </p>
                        </div>
                        <ol className="list-decimal ml-5 mt-4 space-y-3 text-muted-foreground">
                              <li><strong>Delete Old:</strong> Remove the key (may trigger merge/borrow).</li>
                              <li><strong>Insert New:</strong> Insert key with new large value (may trigger split).</li>
                        </ol>
                      </div>

                      <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center gap-6">
                           <div className="flex items-center gap-4">
                              <div className="px-4 py-2 border rounded-md bg-background flex flex-col items-center shadow-sm">
                                 <span className="text-lg font-bold">20</span>
                                 <span className="text-xs text-muted-foreground">"Small"</span>
                              </div>
                              <span className="text-muted-foreground">&rarr;</span>
                              <div className="px-4 py-2 border-2 border-amber-500 rounded-md bg-amber-50 dark:bg-amber-900/20 flex flex-col items-center shadow-sm">
                                 <span className="text-lg font-bold text-amber-700 dark:text-amber-300">20</span>
                                 <span className="text-xs text-amber-600 dark:text-amber-400">"EXTREMELY_LARGE..."</span>
                              </div>
                           </div>
                           
                           <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                              <div className="h-px w-full bg-border my-2 relative">
                                 <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">Becomes</span>
                              </div>
                              
                              <div className="flex w-full gap-4">
                                 <div className="flex-1 border border-rose-200 bg-rose-50 dark:bg-rose-900/10 rounded-lg p-3 flex flex-col items-center text-center">
                                    <Trash2 className="h-5 w-5 text-rose-500 mb-1" />
                                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">1. Delete</span>
                                    <span className="text-[10px] text-muted-foreground">Remove key 20</span>
                                 </div>
                                 <div className="flex-1 border border-blue-200 bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 flex flex-col items-center text-center">
                                    <Plus className="h-5 w-5 text-blue-500 mb-1" />
                                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">2. Insert</span>
                                    <span className="text-[10px] text-muted-foreground">Insert 20 (Large)</span>
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
