import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';


export const RoutingHelp: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const isHovered = (index: number) => hoveredIndex === index;
  const isAnyHovered = hoveredIndex !== null;

  // Helper to get opacity class
  const getOpacity = (index: number) => {
    if (!isAnyHovered) return "opacity-100";
    return isHovered(index) ? "opacity-100" : "opacity-40";
  };

  const getLineStyles = (index: number) => {
      const active = isHovered(index);
      return {
          stroke: active ? "#3b82f6" : "#94a3b8", // blue-500 : slate-400
          strokeWidth: active ? 4 : 2,
          opacity: isAnyHovered ? (active ? 1 : 0.2) : 0.4
      };
  };

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
                <span className="font-bold text-cyan-700 dark:text-cyan-400">Routing Logic:</span>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                   <li><strong>Internal Nodes:</strong> Contain <code>Key i</code> and pointers <code>P_i</code>.</li>
                   <li><strong>Decision:</strong> Compare Search Key (K) with Separator Key (S).</li>
                </ul>
              </div>
          </div>
        </div>

        <div className="space-y-8">
            <div className="space-y-4">
                <div className="border-l-4 border-cyan-500 pl-4">
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
                                  <div 
                                    className={`w-10 h-12 flex items-center justify-center border-r border-slate-300 relative group transition-colors cursor-pointer ${isHovered(0) ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}
                                    onMouseEnter={() => setHoveredIndex(0)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                  >
                                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isHovered(0) ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-500'}`}></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P0</span>
                                  </div>
                                  {/* Key K1 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K1</div>
                                  
                                  {/* P1 */}
                                  <div 
                                    className={`w-10 h-12 flex items-center justify-center border-r border-slate-300 relative group transition-colors cursor-pointer ${isHovered(1) ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}
                                    onMouseEnter={() => setHoveredIndex(1)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                  >
                                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isHovered(1) ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-500'}`}></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P1</span>
                                  </div>
                                  {/* Key K2 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K2</div>

                                  {/* P2 */}
                                  <div 
                                    className={`w-10 h-12 flex items-center justify-center border-r border-slate-300 relative group transition-colors cursor-pointer ${isHovered(2) ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}
                                    onMouseEnter={() => setHoveredIndex(2)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                  >
                                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isHovered(2) ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-500'}`}></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P2</span>
                                  </div>
                                  {/* Key K3 */}
                                  <div className="w-14 h-12 flex items-center justify-center text-xl font-bold border-r border-slate-300 bg-white dark:bg-black font-mono">K3</div>

                                  {/* P3 */}
                                  <div 
                                    className={`w-10 h-12 flex items-center justify-center relative group transition-colors cursor-pointer ${isHovered(3) ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}
                                    onMouseEnter={() => setHoveredIndex(3)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                  >
                                      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${isHovered(3) ? 'bg-blue-500' : 'bg-slate-400 dark:bg-slate-500'}`}></div>
                                      <span className="absolute -top-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">P3</span>
                                  </div>
                              </div>
                         </div>

                         {/* SVG Lines - Absolute positioned behind content */}
                         <svg className="absolute top-12 left-1/2 -ml-[300px] w-[600px] h-36 pointer-events-none z-0" overflow="visible">
                              {/* Branch 1 Line (P0) */}
                              <path d="M 156 0 L 80 100" fill="none" style={getLineStyles(0)} className="transition-all duration-300" />
                              <circle cx="156" cy="0" r={isHovered(0) ? 5 : 4} fill={isHovered(0) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(0).opacity }} />
                              <polygon points="80,100 85,90 75,90" fill={isHovered(0) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(0).opacity }} />
                              
                              {/* Branch 2 Line (P1) */}
                              <path d="M 252 0 L 220 100" fill="none" style={getLineStyles(1)} className="transition-all duration-300" />
                              <circle cx="252" cy="0" r={isHovered(1) ? 5 : 4} fill={isHovered(1) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(1).opacity }} />
                              <polygon points="220,100 225,90 215,90" fill={isHovered(1) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(1).opacity }} />

                              {/* Branch 3 Line (P2) */}
                              <path d="M 348 0 L 380 100" fill="none" style={getLineStyles(2)} className="transition-all duration-300" />
                              <circle cx="348" cy="0" r={isHovered(2) ? 5 : 4} fill={isHovered(2) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(2).opacity }} />
                              <polygon points="380,100 374,88 386,88" fill={isHovered(2) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(2).opacity }} />

                              {/* Branch 4 Line (P3) */}
                              <path d="M 444 0 L 520 100" fill="none" style={getLineStyles(3)} className="transition-all duration-300" />
                              <circle cx="444" cy="0" r={isHovered(3) ? 5 : 4} fill={isHovered(3) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(3).opacity }} />
                              <polygon points="520,100 525,90 515,90" fill={isHovered(3) ? "#3b82f6" : "#94a3b8"} className="transition-all duration-300" style={{ opacity: getLineStyles(3).opacity }} />
                         </svg>

                         {/* Level 2: Children Ranges */}
                         <div className="grid grid-cols-4 gap-2 w-full mt-12">
                             {/* Branch 1 */}
                             <div 
                                className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border transition-all duration-300 cursor-pointer ${
                                    isHovered(0) 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 shadow-md scale-105 ring-2 ring-blue-500/20' 
                                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                } ${getOpacity(0)}`}
                                onMouseEnter={() => setHoveredIndex(0)}
                                onMouseLeave={() => setHoveredIndex(null)}
                             >
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P0 Branch</span>
                                 <code className={`text-sm font-bold ${isHovered(0) ? 'text-blue-700 dark:text-blue-300 scale-110' : 'text-blue-600 dark:text-blue-400'}`}><span className="text-rose-600 dark:text-rose-400">K</span> &lt; K1</code>
                             </div>

                             {/* Branch 2 */}
                             <div 
                                className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border transition-all duration-300 cursor-pointer ${
                                    isHovered(1) 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 shadow-md scale-105 ring-2 ring-blue-500/20' 
                                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                } ${getOpacity(1)}`}
                                onMouseEnter={() => setHoveredIndex(1)}
                                onMouseLeave={() => setHoveredIndex(null)}
                             >
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P1 Branch</span>
                                 <code className={`text-sm font-bold ${isHovered(1) ? 'text-blue-700 dark:text-blue-300 scale-110' : 'text-blue-600 dark:text-blue-400'}`}>K1 &le; <span className="text-rose-600 dark:text-rose-400">K</span> &lt; K2</code>
                             </div>

                             {/* Branch 3 */}
                             <div 
                                className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border transition-all duration-300 cursor-pointer ${
                                    isHovered(2) 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 shadow-md scale-105 ring-2 ring-blue-500/20' 
                                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                } ${getOpacity(2)}`}
                                onMouseEnter={() => setHoveredIndex(2)}
                                onMouseLeave={() => setHoveredIndex(null)}
                             >
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P2 Branch</span>
                                 <code className={`text-sm font-bold ${isHovered(2) ? 'text-blue-700 dark:text-blue-300 scale-110' : 'text-blue-600 dark:text-blue-400'}`}>K2 &le; <span className="text-rose-600 dark:text-rose-400">K</span> &lt; K3</code>
                             </div>

                             {/* Branch 4 */}
                             <div 
                                className={`p-4 rounded-lg flex flex-col items-center justify-center text-center h-24 border transition-all duration-300 cursor-pointer ${
                                    isHovered(3) 
                                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 shadow-md scale-105 ring-2 ring-blue-500/20' 
                                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                } ${getOpacity(3)}`}
                                onMouseEnter={() => setHoveredIndex(3)}
                                onMouseLeave={() => setHoveredIndex(null)}
                             >
                                 <span className="text-xs text-muted-foreground font-semibold mb-1">P3 Branch</span>
                                 <code className={`text-sm font-bold ${isHovered(3) ? 'text-blue-700 dark:text-blue-300 scale-110' : 'text-blue-600 dark:text-blue-400'}`}><span className="text-rose-600 dark:text-rose-400">K</span> &ge; K3</code>
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
