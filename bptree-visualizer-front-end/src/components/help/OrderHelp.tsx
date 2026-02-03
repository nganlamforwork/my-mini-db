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
            <div className="border-l-4 border-emerald-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">1. General Formula</h4>
                 <p className="text-base text-muted-foreground mt-1">
                    For any B+Tree of <strong>Order m</strong>:
                </p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded border">
                        <span className="block text-xs font-semibold text-muted-foreground uppercase">Max Children</span>
                        <span className="text-lg font-bold">m</span>
                    </div>
                    <div className="bg-muted/50 p-3 rounded border">
                        <span className="block text-xs font-semibold text-muted-foreground uppercase">Max Keys</span>
                        <span className="text-lg font-bold">m - 1</span>
                    </div>
                     <div className="bg-muted/50 p-3 rounded border">
                        <span className="block text-xs font-semibold text-muted-foreground uppercase">Min Children</span>
                        <span className="text-lg font-bold">&lceil;m/2&rceil;</span> <span className="text-xs text-muted-foreground">(Root is exception)</span>
                    </div>
                    <div className="bg-muted/50 p-3 rounded border">
                        <span className="block text-xs font-semibold text-muted-foreground uppercase">Min Keys</span>
                        <span className="text-lg font-bold">&lceil;m/2&rceil; - 1</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <div className="border-l-4 border-violet-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">2. Application: Order 4</h4>
                <p className="text-base text-muted-foreground mt-1">
                  In this specific visualization, we use <strong>Order = 4</strong>.
                </p>
            </div>

            <div className="bg-muted/30 pt-8 px-8 pb-20 rounded-lg border border-dashed flex flex-col items-center justify-center gap-8">
                
                {/* Visual Representation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                    {/* Max Capacity Case */}
                    <div className="flex flex-col items-center gap-6">
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Maximum Capacity</h5>
                        <div className="relative">
                            {/* Node Body */}
                            <div className="flex items-center gap-0 border-2 border-slate-400 rounded-lg overflow-hidden bg-background shadow-md">
                                {/* Ptr 0 */}
                                <div className="w-8 h-10 border-r border-slate-300 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                                {/* Key 1 */}
                                <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">K1</div>
                                {/* Ptr 1 */}
                                <div className="w-8 h-10 border-r border-slate-300 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                                {/* Key 2 */}
                                <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">K2</div>
                                {/* Ptr 2 */}
                                <div className="w-8 h-10 border-r border-slate-300 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                                {/* Key 3 */}
                                <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">K3</div>
                                {/* Ptr 3 */}
                                <div className="w-8 h-10 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                            </div>
                            {/* Labels */}
                            <div className="absolute -bottom-8 left-0 right-0 h-8">
                                <div className="absolute left-0 w-8 flex flex-col items-center overflow-visible">
                                    <ArrowDown className="w-3 h-3 text-blue-500 mb-0.5" />
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">Max Pointers (4)</span>
                                </div>
                                <div className="absolute left-1/2 -translate-x-1/2 w-12 flex flex-col items-center overflow-visible">
                                    <ArrowDown className="w-3 h-3 text-emerald-500 mb-0.5" />
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">Max Keys (3)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Min Capacity Case */}
                    <div className="flex flex-col items-center gap-6 border-l-0 md:border-l border-dashed border-slate-300 dark:border-slate-700 pl-0 md:pl-8">
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Minimum Capacity (Half Full)</h5>
                        <div className="relative">
                            {/* Node Body */}
                            <div className="flex items-center gap-0 border-2 border-slate-400 rounded-lg overflow-hidden bg-background shadow-md">
                                {/* Ptr 0 */}
                                <div className="w-8 h-10 border-r border-slate-300 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                                {/* Key 1 */}
                                <div className="w-12 h-10 border-r border-slate-300 flex items-center justify-center font-bold text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">K1</div>
                                {/* Ptr 1 */}
                                <div className="w-8 h-10 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                                </div>
                            </div>
                            {/* Labels */}
                            <div className="absolute -bottom-16 left-0 right-0 h-16 pointer-events-none">
                                {/* Min Pointers (2) - Standard Height */}
                                <div className="absolute left-0 w-8 flex flex-col items-center overflow-visible">
                                    <ArrowDown className="w-3 h-3 text-blue-500 mb-0.5" />
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap bg-background/80 px-1 rounded">Min Pointers (2)</span>
                                </div>
                                {/* Min Keys (1) - Staggered Lower */}
                                <div className="absolute left-[32px] w-12 flex flex-col items-center overflow-visible mt-6">
                                     {/* Extended arrow line */}
                                     <div className="h-6 w-px bg-emerald-500/50 absolute -top-6"></div>
                                     <ArrowDown className="w-3 h-3 text-emerald-500 mb-0.5" />
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap bg-background/80 px-1 rounded">Min Keys (1)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-4">
             <div className="border-l-4 border-orange-500 pl-4">
                <h4 className="font-semibold text-foreground text-lg">3. Real World Context: How Order (m) is Determined?</h4>
                <p className="text-base text-muted-foreground mt-1">
                  In production databases (e.g., PostgreSQL, MySQL), the Order (<span className="italic font-serif">m</span>) is calculated based on the <strong>Disk Block Size</strong> (typically 4KB) to minimize I/O.
                </p>
                <div className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md border text-left">
                     <strong>Goal:</strong> One B+Tree Node should fit exactly into one Disk Block.
                </div>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="space-y-4">
                    <h5 className="font-semibold text-foreground text-sm border-b border-orange-200 dark:border-orange-800 pb-2">Calculation Example (4KB Block):</h5>
                    
                    <ul className="text-sm space-y-1 list-disc ml-4 text-muted-foreground">
                        <li><strong>Block Size (B)</strong>: 4096 bytes (4KB)</li>
                        <li><strong>Pointer Size (P)</strong>: 8 bytes (64-bit system)</li>
                        <li><strong>Key Size (K)</strong>: 8 bytes (BigInt)</li>
                    </ul>

                    <div className="bg-background/80 p-3 rounded border border-orange-100 dark:border-orange-900 font-mono text-xs md:text-sm overflow-x-auto">
                        <p className="mb-2 text-orange-700 dark:text-orange-400 font-bold">Equation: (m × P) + ((m - 1) × K) ≤ B</p>
                        <p className="pl-4 border-l-2 border-slate-300 dark:border-slate-700">
                           (m × 8) + ((m - 1) × 8) ≤ 4096 <br/>
                           8m + 8m - 8 ≤ 4096 <br/>
                           16m ≤ 4104 <br/>
                           <span className="text-emerald-600 dark:text-emerald-400 font-bold">m ≤ 256.5</span>
                        </p>
                    </div>

                    <p className="text-sm text-foreground">
                        <span className="font-bold">Result:</span> For a 4KB disk page with 8-byte keys/pointers, the Order <span className="font-serif italic">m</span> is typically around <strong>256</strong>.
                    </p>
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
