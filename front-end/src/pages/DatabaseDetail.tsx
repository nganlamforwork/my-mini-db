import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { TreeCanvas } from '@/components/TreeCanvas';
import { SystemLog } from '@/components/SystemLog';
import { Button } from '@/components/ui/button';
import { getMockTree } from '@/lib/mockData';
import type { LogEntry, TreeStructure } from '@/types/database';
import { Plus, Search, Trash2, MemoryStick, ChevronRight } from 'lucide-react';

export function DatabaseDetail() {
  const { name } = useParams<{ name: string }>()
  const [treeData] = useState<TreeStructure>(getMockTree())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [highlighted] = useState<number[]>([])

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      message,
      type
    }, ...prev].slice(0, 50))
  }

  useEffect(() => {
    if (name) {
      addLog(`Database "${name}" initialized successfully.`)
      addLog(`B+ Tree root located at Page #${treeData.rootPage}`, 'success')
      addLog(`Tree height: ${treeData.height}`, 'info')
    }
  }, [name, treeData.rootPage, treeData.height])

  if (!name) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <DatabaseHeader databaseName="Unknown" />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Database not found</p>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <DatabaseHeader databaseName={name} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-card border-r border-border flex flex-col shadow-lg z-20">
          <div className="p-5 space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Key (Integer)</label>
                <input type="number" className="w-full bg-muted border border-input rounded-lg p-2.5 text-foreground font-mono text-sm focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Value (String)</label>
                <input type="text" className="w-full bg-muted border border-input rounded-lg p-2.5 text-foreground font-mono text-sm focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all outline-none" placeholder="Data string..." />
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="green" size="sm">
                  <Plus size={14} className="mr-2" /> Insert
                </Button>
                <Button variant="blue" size="sm">
                  <Search size={14} className="mr-2" /> Search
                </Button>
                <Button variant="red" size="sm" className="col-span-2">
                  <Trash2 size={14} className="mr-2" /> Delete Key
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                   <MemoryStick size={12} /> Page Buffer
                 </h3>
                 <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">8 Slots</span>
               </div>
               <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                 {[1, 2, 5, 12].map(id => (
                   <div key={id} className="bg-muted/50 border border-border p-2 rounded-lg flex items-center justify-between group hover:border-primary/50 transition-colors cursor-pointer">
                     <div className="flex items-center gap-3">
                       <div className="w-6 h-6 bg-muted border border-border rounded flex items-center justify-center text-[10px] font-mono text-foreground">P{id}</div>
                       <span className="text-[11px] font-mono text-muted-foreground">0xAF...21</span>
                     </div>
                     <ChevronRight size={12} className="text-muted-foreground/50 group-hover:text-primary" />
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <div className="mt-auto">
            <SystemLog logs={logs} />
          </div>
        </aside>

        {/* Visualization Area */}
        <main className="flex-1 relative flex flex-col bg-background">
          <div className="absolute top-6 left-6 z-10 flex gap-4">
             <div className="border border-border p-3 px-4 rounded-xl backdrop-blur-xl flex items-center gap-4  pointer-events-none select-none">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">I/O Operations</span>
                  <span className="text-xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-tighter">1,284</span>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Tree Height</span>
                  <span className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tracking-tighter">{treeData.height}</span>
                </div>
             </div>
          </div>
          
          <TreeCanvas 
            treeData={treeData} 
            highlightedIds={highlighted} 
          />
        </main>
      </div>
    </div>
  )
}
