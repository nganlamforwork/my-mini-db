import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDown, ArrowRight } from 'lucide-react';

export const RoutingHelp: React.FC = () => {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-8">
        <div>
           <div className="flex flex-col gap-2 text-base text-muted-foreground mt-0">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Main Objective: </span>
                Efficiently navigate from the Root to the correct Leaf using separator keys.
              </div>
              <div>
                <span className="font-bold text-violet-700 dark:text-violet-400">Routing Logic:</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Internal Nodes:</strong> Contain <code>Key i</code> and pointers <code>P_i</code>.</li>
                   <li><strong>Decision:</strong> Compare Search Key (K) with Separator Key (S).</li>
                </ul>
              </div>
          </div>
        </div>

        <div className="space-y-8">
            <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">Routing Formula</h4>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center text-center shadow-sm">
                        <span className="font-mono text-lg font-bold text-blue-600 mb-2">K &lt; S</span>
                        <p className="text-sm text-muted-foreground">Go Left</p>
                        <span className="text-xs text-muted-foreground mt-1">(Follow Pointer P<sub>i</sub>)</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center text-center shadow-sm">
                        <span className="font-mono text-lg font-bold text-emerald-600 mb-2">K == S</span>
                        <p className="text-sm text-muted-foreground">Go Right (Usually)</p>
                        <span className="text-xs text-muted-foreground mt-1">(Follow Pointer P<sub>i+1</sub>)</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 flex flex-col items-center text-center shadow-sm">
                        <span className="font-mono text-lg font-bold text-orange-600 mb-2">K &gt; S</span>
                        <p className="text-sm text-muted-foreground">Go Right</p>
                        <span className="text-xs text-muted-foreground mt-1">(Follow Pointer P<sub>i+1</sub>)</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                 <div className="border-l-4 border-violet-500 pl-4">
                    <h4 className="font-semibold text-foreground text-lg">Visual Example</h4>
                    <p className="text-muted-foreground mt-1">
                        Searching for <strong>Key 45</strong>. Node has separator <strong>30</strong>.
                    </p>
                </div>
                
                <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center gap-8">
                     <div className="flex items-center gap-8">
                         {/* Search Key */}
                         <div className="flex flex-col items-center">
                             <div className="px-4 py-2 bg-white dark:bg-zinc-800 border-2 border-violet-500 rounded-lg shadow-sm font-bold text-violet-600">
                                 45
                             </div>
                             <span className="text-[10px] text-muted-foreground mt-1">Search Key (K)</span>
                         </div>

                         <div className="text-2xl font-bold text-muted-foreground">&gt;</div>

                         {/* Node */}
                         <div className="flex flex-col items-center">
                             <div className="bg-white dark:bg-zinc-800 border-2 border-slate-300 rounded-lg flex items-center overflow-hidden">
                                 <div className="px-3 py-2 border-r bg-slate-100 dark:bg-slate-900 text-muted-foreground opacity-50 text-xs">Left</div>
                                 <div className="px-4 py-2 font-bold text-slate-700 dark:text-slate-200">30</div>
                                 <div className="px-3 py-2 border-l bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">Right</div>
                             </div>
                             <span className="text-[10px] text-muted-foreground mt-1">Internal Node (S)</span>
                         </div>
                     </div>

                     <ArrowDown className="h-6 w-6 text-muted-foreground animate-bounce" />

                     <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 text-sm font-semibold">
                         <ArrowRight className="h-4 w-4" />
                         Follow Right Pointer
                     </div>
                </div>
            </div>
        </div>
      </div>
    </ScrollArea>
  );
};
