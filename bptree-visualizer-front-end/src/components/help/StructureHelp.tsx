import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Network, Database, GitFork, ArrowDown } from 'lucide-react';

export const StructureHelp: React.FC = () => {
    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-8">
                <div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">B+Tree Node Types</h3>
                    <p className="text-muted-foreground">
                        A B+Tree consists of three main types of nodes, each with a specific role in storing and retrieving data.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    
                    {/* Internal Node Section */}
                    <div className="space-y-4 flex flex-col">
                        <div className="border-l-4 border-blue-500 pl-4">
                            <div className="flex items-center gap-2">
                                <Network className="w-5 h-5 text-blue-500" />
                                <h4 className="font-semibold text-blue-700 dark:text-blue-400 text-lg">1. Internal Node</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Acts as a <strong>Traffic Router</strong>. It contains only keys and pointers to other nodes.
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 mt-2 rounded border border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                                <strong>Constraint:</strong> Does NOT contain actual data values.
                            </div>
                        </div>

                        {/* Visual for Internal Node */}
                        <div className="bg-muted/30 p-6 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1">
                             <div className="flex items-center gap-0 border-2 border-blue-400 rounded-lg overflow-hidden bg-background shadow-md transform scale-90 sm:scale-100">
                                {/* P0 */}
                                <div className="w-10 h-10 border-r border-blue-200 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                </div>
                                {/* Key 1 */}
                                <div className="w-12 h-10 border-r border-blue-200 flex items-center justify-center font-bold text-sm bg-white dark:bg-black font-mono">10</div>
                                {/* P1 */}
                                <div className="w-10 h-10 border-r border-blue-200 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                </div>
                                {/* Key 2 */}
                                <div className="w-12 h-10 border-r border-blue-200 flex items-center justify-center font-bold text-sm bg-white dark:bg-black font-mono">20</div>
                                {/* P2 */}
                                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                </div>
                            </div>
                            <div className="flex justify-between w-full max-w-[250px] mt-2 text-[10px] text-blue-500 font-semibold px-2">
                                <span>Ptr to Child</span>
                                <span>Separator Key</span>
                                <span>Ptr to Child</span>
                            </div>
                        </div>
                    </div>

                    {/* Leaf Node Section */}
                    <div className="space-y-4 flex flex-col">
                        <div className="border-l-4 border-emerald-500 pl-4">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-emerald-500" />
                                <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 text-lg">2. Leaf Node</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                The <strong>Data Storage</strong> layer. All actual records (Key + Value) are stored here.
                            </p>
                             <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 mt-2 rounded border border-emerald-100 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                                <strong>Feature:</strong> Doubly Linked List (Prev/Next) for bidirectional Range Scans.
                            </div>
                        </div>

                         {/* Visual for Leaf Node */}
                         <div className="bg-muted/30 p-6 rounded-lg border border-dashed flex flex-col items-center justify-center flex-1">
                             <div className="flex items-center gap-2">
                                {/* Prev Ptr */}
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center border border-emerald-300">
                                     <ArrowDown className="w-4 h-4 text-emerald-600 rotate-90" />
                                </div>
                                
                                <div className="flex items-center gap-0 border-2 border-emerald-400 rounded-lg overflow-hidden bg-background shadow-md">
                                    {/* Record 1 */}
                                    <div className="px-3 h-10 border-r border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/40">
                                        <span className="font-bold text-sm font-mono">10</span>
                                        <span className="text-xs text-muted-foreground">"ValA"</span>
                                    </div>
                                    {/* Record 2 */}
                                    <div className="px-3 h-10 border-r border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/40">
                                        <span className="font-bold text-sm font-mono">15</span>
                                        <span className="text-xs text-muted-foreground">"ValB"</span>
                                    </div>
                                </div>

                                {/* Next Ptr */}
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center border border-emerald-300">
                                     <ArrowDown className="w-4 h-4 text-emerald-600 -rotate-90" />
                                </div>
                             </div>
                              <div className="flex gap-8 mt-2 text-[10px] text-emerald-600 font-semibold">
                                <span>&larr; Prev Leaf</span>
                                <span>Next Leaf &rarr;</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Root Node Section - Full Width */}
                <div className="pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         <div className="md:col-span-1 space-y-4">
                             <div className="border-l-4 border-amber-500 pl-4">
                                <div className="flex items-center gap-2">
                                    <GitFork className="w-5 h-5 text-amber-500" />
                                    <h4 className="font-semibold text-amber-700 dark:text-amber-400 text-lg">3. Root Node</h4>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    The <strong>Entry Point</strong> of the tree. It is the only node that has no parent.
                                </p>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 mt-2 rounded border border-amber-100 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                                    <strong>Dual Nature:</strong> Can be a <em>Leaf</em> (if tree is small) or an <em>Internal Node</em> (if tree grows).
                                </div>
                            </div>
                         </div>

                         <div className="md:col-span-2 bg-muted/30 p-4 rounded-lg border border-dashed flex flex-col items-center justify-center">
                             {/* Hierarchy Visual */}
                             {/* Hierarchy Visual */}
                             <div className="flex flex-col items-center gap-4">
                                 {/* Root */}
                                 <div className="border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-4 py-1.5 rounded-md text-xs font-bold shadow-sm z-10 min-w-[80px] text-center">
                                     ROOT
                                 </div>
                                 
                                 {/* Branches */}
                                 <div className="relative w-64 h-8 -mt-2">
                                     {/* Top vertical from Root */}
                                     <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-muted-foreground/30 -translate-x-1/2"></div>
                                     {/* Horizontal bar */}
                                     <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted-foreground/30 border-t border-dashed border-muted-foreground/50"></div>
                                     {/* Left vertical */}
                                     <div className="absolute top-4 left-0 w-0.5 h-4 bg-muted-foreground/30"></div>
                                     {/* Middle vertical */}
                                     <div className="absolute top-4 left-1/2 w-0.5 h-4 bg-muted-foreground/30 -translate-x-1/2"></div>
                                     {/* Right vertical */}
                                     <div className="absolute top-4 right-0 w-0.5 h-4 bg-muted-foreground/30"></div>
                                 </div>

                                 {/* Children */}
                                 <div className="flex gap-4 -mt-2 w-64 justify-between">
                                     <div className="border border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded text-[10px] font-semibold w-16 text-center">
                                         Internal
                                     </div>
                                      <div className="border border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded text-[10px] font-semibold w-16 text-center">
                                         Internal
                                     </div>
                                     <div className="border border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded text-[10px] font-semibold w-16 text-center">
                                         Internal
                                     </div>
                                 </div>

                                  <div className="flex gap-2 text-[10px] text-muted-foreground mt-1 italic">
                                     ...down to Leaves (Multi-way Branching)
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>

            </div>
        </ScrollArea>
    );
};
