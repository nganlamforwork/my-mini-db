import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDown } from 'lucide-react';

export const OrderHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-8">
        <div>
           <div className="flex flex-col gap-2 text-base text-muted-foreground mt-0">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Concept: </span>
                The <strong>Order (m)</strong> of a B+Tree determines the capacity of its nodes.
              </div>
              <div>
                <span className="font-bold text-blue-700 dark:text-blue-400">Definition:</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Order (m):</strong> Maximum number of children an internal node can have.</li>
                   <li><strong>Max Keys:</strong> <code>m - 1</code></li>
                   <li><strong>Min Keys:</strong> <code>&lceil;m/2&rceil; - 1</code> (except root)</li>
                </ul>
              </div>
          </div>
        </div>

        <div className="space-y-4">
            <div className="border-l-4 border-violet-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">Example: Order = 4</h4>
                <p className="text-base text-muted-foreground mt-1">
                  A B+Tree with Order 4 (also called a 2-3-4 tree in specific contexts) has the following properties:
                </p>
            </div>

            <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center gap-8">
                
                {/* Visual Representation */}
                <div className="flex flex-col items-center gap-6">
                   <div className="relative">
                      {/* Node Body */}
                      <div className="flex items-center gap-0 border-2 border-slate-400 rounded-lg overflow-hidden bg-background shadow-md">
                          {/* Ptr 0 */}
                          <div className="w-8 h-10 border-r border-slate-300 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative group cursor-help">
                              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Child 1
                              </div>
                          </div>
                          
                          {/* Key 1 */}
                          <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm">
                              K1
                          </div>

                           {/* Ptr 1 */}
                          <div className="w-8 h-10 border-r border-slate-300 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative group cursor-help">
                              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                               <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Child 2
                              </div>
                          </div>

                          {/* Key 2 */}
                          <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm">
                              K2
                          </div>

                           {/* Ptr 2 */}
                          <div className="w-8 h-10 border-r border-slate-300 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative group cursor-help">
                               <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Child 3
                              </div>
                          </div>

                          {/* Key 3 */}
                          <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm">
                              K3
                          </div>

                           {/* Ptr 3 */}
                          <div className="w-8 h-10 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative group cursor-help">
                              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                               <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Child 4
                              </div>
                          </div>
                      </div>

                      {/* Labels */}
                      <div className="absolute -bottom-8 left-0 right-0 flex justify-between text-[10px] text-muted-foreground px-1">
                          <div className="text-center w-1/4">
                              <ArrowDown className="w-3 h-3 mx-auto mb-0.5 text-slate-400" />
                              Child Pointers (4)
                          </div>
                           <div className="text-center w-1/4">
                               <ArrowDown className="w-3 h-3 mx-auto mb-0.5 text-slate-400" />
                              Keys (3)
                          </div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-6">
                    <div className="bg-background p-3 rounded border shadow-sm flex flex-col items-center">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Max Keys</span>
                        <span className="text-2xl font-bold text-violet-600">3</span>
                        <span className="text-[10px] text-muted-foreground">(Order - 1)</span>
                    </div>
                    <div className="bg-background p-3 rounded border shadow-sm flex flex-col items-center">
                        <span className="text-xs text-muted-foreground uppercase font-semibold">Max Children</span>
                        <span className="text-2xl font-bold text-blue-600">4</span>
                        <span className="text-[10px] text-muted-foreground">(Order)</span>
                    </div>
                </div>
            </div>
        </div>

        <div>
             <h3 className="text-2xl font-semibold mb-2 text-primary">Key Takeaways</h3>
             <ul className="list-disc ml-6 space-y-2 text-muted-foreground">
                 <li>Internal nodes act as a <strong>traffic router</strong>, directing searches to the correct child.</li>
                 <li>Leaf nodes hold the actual data (Values/Records).</li>
                 <li>The tree remains balanced because all leaf nodes are at the same depth.</li>
             </ul>
        </div>

      </div>
    </ScrollArea>
  );
};
