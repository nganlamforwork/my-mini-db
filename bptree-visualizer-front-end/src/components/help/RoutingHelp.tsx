import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';


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
            <div className="space-y-4">
                <div className="border-l-4 border-violet-500 pl-4">
                    <h4 className="font-semibold text-foreground text-lg">Routing Rules</h4>
                    <p className="text-muted-foreground mt-1">
                        To find a key <strong>K</strong>, we compare it against the separator keys <strong>K1, K2, K3</strong> in the node to decide which child pointer (branch) to follow.
                    </p>
                </div>
                
                <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center min-h-[300px]">
                     {/* Tree Diagram */}
                     <div className="relative flex flex-col items-center gap-12 w-full max-w-2xl">
                         
                         {/* Level 1: Parent Node [ P0 | 10 | P1 | 20 | P2 | 30 | P3 ] */}
                         <div className="relative z-10">
                              <div className="flex bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-400 shadow-md">
                                  {/* P0 */}
                                  <div className="w-10 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-r border-slate-300 relative group">
                                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P0</span>
                                  </div>
                                  {/* Key K1 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K1</div>
                                  
                                  {/* P1 */}
                                  <div className="w-10 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-r border-slate-300 relative group">
                                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P1</span>
                                  </div>
                                  {/* Key K2 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K2</div>

                                  {/* P2 */}
                                  <div className="w-10 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 border-r border-slate-300 relative group">
                                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P2</span>
                                  </div>
                                  {/* Key K3 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K3</div>

                                  {/* P3 */}
                                  <div className="w-10 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 relative group">
                                      <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P3</span>
                                  </div>
                              </div>
                         </div>

                         {/* SVG Lines - Absolute positioned behind content */}
                         <svg className="absolute top-12 left-1/2 -ml-[300px] w-[600px] h-36 pointer-events-none z-0" overflow="visible">
                              {/* Branch 1 Line (P0) */}
                              <path d="M 156 0 L 80 100" fill="none" stroke="#94a3b8" strokeWidth="3" className="opacity-30 dark:opacity-50" />
                              <circle cx="156" cy="0" r="4" fill="#94a3b8" className="opacity-30 dark:opacity-50" /> {/* Anchor Dot */}
                              <polygon points="80,100 85,90 75,90" fill="#94a3b8" className="opacity-30 dark:opacity-50" />
                              
                              {/* Branch 2 Line (P1) */}
                              <path d="M 252 0 L 220 100" fill="none" stroke="#94a3b8" strokeWidth="3" className="opacity-30 dark:opacity-50" />
                              <circle cx="252" cy="0" r="4" fill="#94a3b8" className="opacity-30 dark:opacity-50" />
                              <polygon points="220,100 225,90 215,90" fill="#94a3b8" className="opacity-30 dark:opacity-50" />

                              {/* Branch 3 Line (P2) */}
                              <path d="M 348 0 L 380 100" fill="none" stroke="#94a3b8" strokeWidth="3" className="opacity-30 dark:opacity-50" />
                              <circle cx="348" cy="0" r="4" fill="#94a3b8" className="opacity-30 dark:opacity-50" />
                              <polygon points="380,100 374,88 386,88" fill="#94a3b8" className="opacity-30 dark:opacity-50" />

                              {/* Branch 4 Line (P3) */}
                              <path d="M 444 0 L 520 100" fill="none" stroke="#94a3b8" strokeWidth="3" className="opacity-30 dark:opacity-50" />
                              <circle cx="444" cy="0" r="4" fill="#94a3b8" className="opacity-30 dark:opacity-50" />
                              <polygon points="520,100 525,90 515,90" fill="#94a3b8" className="opacity-30 dark:opacity-50" />
                         </svg>

                         {/* Level 2: Children Ranges */}
                         <div className="grid grid-cols-4 gap-2 w-full mt-12">
                             {/* Branch 1 */}
                             <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border border-blue-200 dark:border-blue-800">
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P0 Branch</span>
                                 <code className="text-sm font-bold text-blue-700 dark:text-blue-300">K &lt; K1</code>
                             </div>

                             {/* Branch 2 */}
                             <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border border-blue-200 dark:border-blue-800">
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P1 Branch</span>
                                 <code className="text-sm font-bold text-blue-700 dark:text-blue-300">K1 &le; K &lt; K2</code>
                             </div>

                             {/* Branch 3 */}
                             <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border border-blue-200 dark:border-blue-800">
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P2 Branch</span>
                                 <code className="text-sm font-bold text-blue-700 dark:text-blue-300">K2 &le; K &lt; K3</code>
                             </div>

                             {/* Branch 4 */}
                             <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border border-blue-200 dark:border-blue-800">
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P3 Branch</span>
                                 <code className="text-sm font-bold text-blue-700 dark:text-blue-300">K &ge; K3</code>
                             </div>
                         </div>
                     </div>
                </div>
            </div>
        </div>

      </div>
    </ScrollArea>
  );
};
