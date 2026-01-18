import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { TreeCanvas } from '@/components/TreeCanvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OperationDialog } from '@/components/OperationDialog';
import { OperationHelpDialog } from '@/components/OperationHelpDialog';
import { SystemLog } from '@/components/SystemLog';
import { getMockTree } from '@/lib/mockData';
import { api } from '@/lib/api';
import type { LogEntry, TreeStructure, ExecutionStep, CacheStats } from '@/types/database';
import { Plus, Search, Trash2, Edit, ArrowLeftRight, ExternalLink, HelpCircle, Download, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function DatabaseDetail() {
  const { name } = useParams<{ name: string }>()
  const [treeData] = useState<TreeStructure>(getMockTree())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [highlighted] = useState<number[]>([])
  const [fullLogsOpen, setFullLogsOpen] = useState(false)
  const [operationDialogOpen, setOperationDialogOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpOperation, setHelpOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [animationSpeed, setAnimationSpeed] = useState([50]) // 0-100, default 50
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    size: 45,
    maxSize: 100,
    hits: 1234,
    misses: 56,
    evictions: 12
  })

  const addLog = (message: string, type: LogEntry['type'] = 'info', steps?: ExecutionStep[], operation?: LogEntry['operation']) => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      message,
      type,
      steps,
      operation
    }, ...prev].slice(0, 50))
  }

  const downloadLogsAsCSV = () => {
    const csvHeaders = ['Timestamp', 'Type', 'Operation', 'Message', 'Steps Count', 'Steps Details']
    const csvRows = logs.map(log => {
      const timestamp = log.timestamp.toISOString()
      const type = log.type
      const operation = log.operation || ''
      const message = log.message.replace(/"/g, '""') // Escape quotes
      const stepsCount = log.steps?.length || 0
      const stepsDetails = log.steps?.map((step, idx) => {
        const stepNum = String(idx + 1).padStart(3, '0')
        let stepStr = `[${stepNum}] ${step.type}`
        if (step.nodeId) stepStr += ` → ${step.nodeId}`
        if (step.pageId !== undefined) stepStr += ` (Page #${step.pageId})`
        if (step.lsn !== undefined) stepStr += ` [LSN: ${step.lsn}]`
        if (step.key) {
          const keyStr = step.key.values.map(v => String(v.value)).join(', ')
          stepStr += ` | Key: ${keyStr}`
        }
        if (step.highlightKey) {
          const keyStr = step.highlightKey.values.map(v => String(v.value)).join(', ')
          stepStr += ` | Highlight: ${keyStr}`
        }
        return stepStr
      }).join('; ') || ''
      
      return [timestamp, type, operation, message, stepsCount, stepsDetails]
        .map(field => `"${String(field).replace(/"/g, '""')}"`)
        .join(',')
    })

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `system-log-${name || 'database'}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Helper to handle API operation responses (for future API integration)
  // const handleOperationResponse = (response: OperationResponse) => {
  //   const operationName = response.operation.replace('_', ' ');
  //   if (response.success) {
  //     addLog(
  //       `${operationName} operation completed successfully`,
  //       'success',
  //       response.steps,
  //       response.operation
  //     );
  //   } else {
  //     addLog(
  //       `${operationName} operation failed: ${response.error || 'Unknown error'}`,
  //       'error',
  //       response.steps,
  //       response.operation
  //     );
  //   }
  // }

  useEffect(() => {
    if (name) {
      // Load cache stats
      const loadCacheStats = async () => {
        try {
          const stats = await api.getCacheStats(name);
          setCacheStats(stats);
        } catch (error) {
          console.error('Failed to load cache stats:', error);
        }
      };
      loadCacheStats();

      // Initial database setup logs
      addLog(`Database "${name}" initialized successfully.`)
      addLog(`B+ Tree root located at Page #${treeData.rootPage}`, 'success')
      addLog(`Tree height: ${treeData.height}`, 'info')
      
      // Mock diverse operation logs with steps
      setTimeout(() => {
        addLog(
          'INSERT operation completed successfully',
          'success',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-4', keys: [{ values: [{ type: 'int', value: 40 }] }, { values: [{ type: 'int', value: 50 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'INSERT_KEY', nodeId: 'page-4', key: { values: [{ type: 'int', value: 42 }] } }
          ],
          'INSERT'
        )
      }, 500)

      setTimeout(() => {
        addLog(
          'SEARCH operation completed successfully',
          'success',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 25 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-3', keys: [{ values: [{ type: 'int', value: 20 }] }, { values: [{ type: 'int', value: 25 }] }], highlightKey: { values: [{ type: 'int', value: 25 }] } },
            { type: 'CACHE_HIT', pageId: 3 }
          ],
          'SEARCH'
        )
      }, 1000)

      setTimeout(() => {
        addLog(
          'UPDATE operation completed successfully',
          'success',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-4', keys: [{ values: [{ type: 'int', value: 40 }] }, { values: [{ type: 'int', value: 42 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'UPDATE_KEY', nodeId: 'page-4', key: { values: [{ type: 'int', value: 42 }] } },
            { type: 'WAL_APPEND', lsn: 1234 }
          ],
          'UPDATE'
        )
      }, 1500)

      setTimeout(() => {
        addLog(
          'DELETE operation completed successfully',
          'success',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 20 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-3', keys: [{ values: [{ type: 'int', value: 20 }] }, { values: [{ type: 'int', value: 25 }] }], highlightKey: { values: [{ type: 'int', value: 20 }] } },
            { type: 'DELETE_KEY', nodeId: 'page-3', key: { values: [{ type: 'int', value: 20 }] } },
            { type: 'BORROW_FROM_RIGHT', nodeId: 'page-3' }
          ],
          'DELETE'
        )
      }, 2000)

      setTimeout(() => {
        addLog(
          'RANGE_QUERY operation completed successfully',
          'success',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 10 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-3', keys: [{ values: [{ type: 'int', value: 20 }] }, { values: [{ type: 'int', value: 25 }] }], highlightKey: { values: [{ type: 'int', value: 10 }] } },
            { type: 'PAGE_LOAD', pageId: 3 },
            { type: 'PAGE_LOAD', pageId: 4 }
          ],
          'RANGE_QUERY'
        )
      }, 2500)

      setTimeout(() => {
        addLog(
          'INSERT operation failed: Duplicate key',
          'error',
          [
            { type: 'TRAVERSE_NODE', nodeId: 'page-2', keys: [{ values: [{ type: 'int', value: 30 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'TRAVERSE_NODE', nodeId: 'page-4', keys: [{ values: [{ type: 'int', value: 40 }] }, { values: [{ type: 'int', value: 42 }] }], highlightKey: { values: [{ type: 'int', value: 42 }] } },
            { type: 'CACHE_HIT', pageId: 4 }
          ],
          'INSERT'
        )
      }, 3000)

      setTimeout(() => {
        addLog(
          'Warning: Cache size at 90% capacity',
          'warning',
          [
            { type: 'CACHE_MISS', pageId: 5 },
            { type: 'EVICT_PAGE', pageId: 1 }
          ]
        )
      }, 3500)

      setTimeout(() => {
        addLog(
          'SPLIT operation triggered due to node overflow',
          'info',
          [
            { type: 'INSERT_KEY', nodeId: 'page-5', key: { values: [{ type: 'int', value: 55 }] } },
            { type: 'SPLIT_NODE', nodeId: 'page-5' },
            { type: 'WAL_APPEND', lsn: 1235 },
            { type: 'PAGE_FLUSH', pageId: 5 }
          ]
        )
      }, 4000)

      setTimeout(() => {
        addLog(
          'MERGE operation triggered due to node underflow',
          'info',
          [
            { type: 'DELETE_KEY', nodeId: 'page-6', key: { values: [{ type: 'int', value: 60 }] } },
            { type: 'BORROW_FROM_LEFT', nodeId: 'page-6' },
            { type: 'MERGE_NODE', nodeId: 'page-6' },
            { type: 'PAGE_FLUSH', pageId: 6 }
          ]
        )
      }, 4500)
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
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Animation Speed Control */}
            <div className="space-y-2 pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Animation Speed
                </Label>
                <span className="text-xs text-muted-foreground">{animationSpeed[0]}% (Fast)</span>
              </div>
              <Slider
                value={animationSpeed}
                onValueChange={setAnimationSpeed}
                min={0}
                max={100}
                step={10}
                className="w-full"
              />
            </div>

            {/* Database Operations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Operations</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setHelpOperation(null);
                    setHelpDialogOpen(true);
                  }}
                >
                  <HelpCircle size={12} />
                </Button>
              </div>
              
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="green" 
                        size="sm" 
                        className="text-xs relative"
                        onClick={() => {
                          setCurrentOperation('insert');
                          setOperationDialogOpen(true);
                        }}
                      >
                        <Plus size={12} className="mr-1.5" /> Insert
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">Add a new key-value pair. Opens dialog to select key/value types.</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="blue" 
                        size="sm" 
                        className="text-xs relative"
                        onClick={() => {
                          setCurrentOperation('search');
                          setOperationDialogOpen(true);
                        }}
                      >
                        <Search size={12} className="mr-1.5" /> Search
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">Find a value by key using binary search. O(log n) complexity.</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="purple" 
                        size="sm" 
                        className="text-xs relative"
                        onClick={() => {
                          setCurrentOperation('update');
                          setOperationDialogOpen(true);
                        }}
                      >
                        <Edit size={12} className="mr-1.5" /> Update
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">Modify an existing value. Optimizes for in-place updates.</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="red" 
                        size="sm" 
                        className="text-xs relative"
                        onClick={() => {
                          setCurrentOperation('delete');
                          setOperationDialogOpen(true);
                        }}
                      >
                        <Trash2 size={12} className="mr-1.5" /> Delete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">Remove a key-value pair with automatic rebalancing.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="gray" 
                      size="sm" 
                      className="text-xs relative"
                      onClick={() => {
                        setCurrentOperation('range');
                        setOperationDialogOpen(true);
                      }}
                    >
                      <ArrowLeftRight size={12} className="mr-1.5" /> Range Query
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">Query keys within a range using leaf-level linked list. O(log n + k).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            </div>

            {/* Cache Statistics */}
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full" />
                  Cache Statistics
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={async () => {
                    if (!name) return;
                    try {
                      // Refresh cache stats
                      const updatedStats = await api.getCacheStats(name);
                      setCacheStats(updatedStats);
                      addLog('Cache statistics refreshed', 'success');
                    } catch (error) {
                      addLog(`Failed to refresh cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                    }
                  }}
                >
                  <RotateCcw size={10} />
                </Button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-mono">
                    {cacheStats.size} / {cacheStats.maxSize}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${(cacheStats.size / cacheStats.maxSize) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">Hits:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{cacheStats.hits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Misses:</span>
                  <span className="font-mono text-orange-600 dark:text-orange-400">{cacheStats.misses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Hit Rate:</span>
                  <span className="font-mono">
                    {cacheStats.hits + cacheStats.misses > 0
                      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Evictions:</span>
                  <span className="font-mono text-red-600 dark:text-red-400">{cacheStats.evictions.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* System Logs (Top 10) */}
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
                  System Logs
                </h3>
                <div className="flex items-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={downloadLogsAsCSV}
                  >
                    <Download size={10} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setFullLogsOpen(true)}
                  >
                    <ExternalLink size={10} />
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-hidden">
                <SystemLog logs={logs.slice(0, 10)} />
              </div>
            </div>
          </div>

          {/* Operation Dialog */}
          {currentOperation && (
            <OperationDialog
              open={operationDialogOpen}
              onOpenChange={setOperationDialogOpen}
              operation={currentOperation}
              onSubmit={(key, _value) => {
                // TODO: Call actual API and handle response
                // For now, create mock steps based on operation
                const mockSteps: ExecutionStep[] = [
                  {
                    type: 'TRAVERSE_NODE',
                    nodeId: `page-${treeData.rootPage}`,
                    keys: treeData.nodes[treeData.rootPage.toString()]?.keys || [],
                    highlightKey: key
                  },
                  {
                    type: currentOperation === 'insert' ? 'INSERT_KEY' : 
                          currentOperation === 'update' ? 'UPDATE_KEY' :
                          currentOperation === 'delete' ? 'DELETE_KEY' : 'TRAVERSE_NODE',
                    nodeId: `page-${treeData.rootPage}`,
                    key: key
                  }
                ];
                
                addLog(
                  `${currentOperation.toUpperCase()} operation initiated`,
                  'info',
                  mockSteps,
                  currentOperation.toUpperCase() as LogEntry['operation']
                );
              }}
            />
          )}

          {/* Help Dialog */}
          <OperationHelpDialog
            open={helpDialogOpen}
            onOpenChange={setHelpDialogOpen}
            operation={helpOperation || 'insert'}
          />

          {/* Full Logs Dialog */}
          <Dialog open={fullLogsOpen} onOpenChange={setFullLogsOpen}>
            <DialogContent className="max-w-4xl max-h-[85vh]">
              <DialogHeader>
                <div className="flex items-center justify-start gap-2">
                  <DialogTitle>System Logs</DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={downloadLogsAsCSV}
                  >
                    <Download size={14} className="mr-1.5" />
                    Download CSV
                  </Button>
                </div>
              </DialogHeader>
              <SystemLog logs={logs} />
            </DialogContent>
          </Dialog>
        </aside>

        {/* Visualization Area */}
        <main className="flex-1 relative flex flex-col bg-background">
          <TreeCanvas 
            treeData={treeData} 
            highlightedIds={highlighted}
            config={{
              order: 3,
              pageSize: 4096,
              cacheSize: 8,
              walEnabled: true
            }}
          />
        </main>
      </div>
    </div>
  )
}
