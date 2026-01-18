import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { TreeCanvas } from '@/components/TreeCanvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OperationDialog } from '@/components/OperationDialog';
import { OperationHelpDialog } from '@/components/OperationHelpDialog';
import { SystemLog } from '@/components/SystemLog';
import { useConnectDatabase, useCloseDatabase, useTreeStructure, useCacheStats, useInsert, useUpdate, useDelete, useSearch, useRangeQuery } from '@/hooks/useDatabaseOperations';
import type { LogEntry, TreeStructure, ExecutionStep, CacheStats } from '@/types/database';
import { Plus, Search, Trash2, Edit, ArrowLeftRight, ExternalLink, HelpCircle, Download, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function DatabaseDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [treeData, setTreeData] = useState<TreeStructure | null>(null)
  const [visualTree, setVisualTree] = useState<TreeStructure | null>(null) // Incrementally mutated tree for visualization
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [highlighted] = useState<number[]>([])
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null)
  const [highlightedKey, setHighlightedKey] = useState<{ values: Array<{ type: string; value: any }> } | null>(null)
  const [isExecutingSteps, setIsExecutingSteps] = useState(false)
  const [overflowNodeId, setOverflowNodeId] = useState<number | null>(null) // Node in overflow state
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null) // Current step being visualized
  const [fullLogsOpen, setFullLogsOpen] = useState(false)
  const [operationDialogOpen, setOperationDialogOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpOperation, setHelpOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [animationSpeed, setAnimationSpeed] = useState([50]) // 0-100, default 50
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const isConnectedRef = useRef(false)
  const hasLoggedInitialLoadRef = useRef(false)
  
  // Hooks for database operations
  const connectMutation = useConnectDatabase()
  const closeMutation = useCloseDatabase()
  const { data: treeStructureData, error: treeError, isLoading: treeLoading } = useTreeStructure(name)
  const { data: cacheStatsData, refetch: refetchCacheStats } = useCacheStats(name)
  
  // Operation hooks
  const insertMutation = useInsert()
  const updateMutation = useUpdate()
  const deleteMutation = useDelete()
  const searchMutation = useSearch()
  const rangeQueryMutation = useRangeQuery()
  
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    size: 0,
    maxSize: 100,
    hits: 0,
    misses: 0,
    evictions: 0
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

  // Helper to extract page ID from nodeId string (e.g., "page-9" -> 9)
  const extractPageId = (nodeId?: string): number | null => {
    if (!nodeId) return null;
    const match = nodeId.match(/page-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Helper to format key for display
  const formatKey = (key?: { values: Array<{ type: string; value: any }> }): string => {
    if (!key || !key.values || key.values.length === 0) return '';
    if (key.values.length === 1) {
      return String(key.values[0].value);
    }
    return `(${key.values.map(v => String(v.value)).join(', ')})`;
  }

  // Helper to apply step mutation to visual tree
  const applyStepToVisualTree = (step: ExecutionStep, currentVisualTree: TreeStructure | null): TreeStructure | null => {
    if (!currentVisualTree) return currentVisualTree;
    
    const pageId = extractPageId(step.nodeId);
    if (!pageId) return currentVisualTree;

    const updatedTree = { ...currentVisualTree };
    updatedTree.nodes = { ...updatedTree.nodes };
    
    const nodeKey = pageId.toString();
    const node = updatedTree.nodes[nodeKey];
    if (!node) return currentVisualTree;

    switch (step.type) {
      case 'ADD_TEMP_KEY':
        // Update node with new keys (may cause overflow)
        if (step.keys) {
          updatedTree.nodes[nodeKey] = {
            ...node,
            keys: [...step.keys]
          };
        }
        break;
        
      case 'DELETE_KEY':
        // Update node with keys after deletion
        if (step.keys) {
          updatedTree.nodes[nodeKey] = {
            ...node,
            keys: [...step.keys]
          };
        }
        break;
        
      case 'UPDATE_KEY':
        // Update node keys/values
        if (step.keys) {
          updatedTree.nodes[nodeKey] = {
            ...node,
            keys: [...step.keys]
          };
        }
        break;
        
      case 'SPLIT_NODE':
        // Create new node and update original
        if (step.newNodes && step.newNodes.length >= 2) {
          const originalNodeId = extractPageId(step.newNodes[0]);
          const newNodeId = extractPageId(step.newNodes[1]);
          
          if (originalNodeId && newNodeId && step.keys) {
            // Update original node
            const originalKey = originalNodeId.toString();
            if (updatedTree.nodes[originalKey]) {
              updatedTree.nodes[originalKey] = {
                ...updatedTree.nodes[originalKey],
                keys: [...step.keys]
              };
            }
            
            // Create new node (will be populated from actual tree data later)
            // For now, we'll mark it as needing update
          }
        }
        break;
        
      case 'MERGE_NODE':
        // Node will be removed, handled by tree structure update
        break;
        
      case 'PROMOTE_KEY':
        // Update parent node with promoted key
        const targetPageId = extractPageId(step.targetNodeId);
        if (targetPageId && step.keys) {
          const targetKey = targetPageId.toString();
          if (updatedTree.nodes[targetKey]) {
            updatedTree.nodes[targetKey] = {
              ...updatedTree.nodes[targetKey],
              keys: [...step.keys]
            };
          }
        }
        break;
    }
    
    return updatedTree;
  }

  // Step sequencer: processes steps sequentially with incremental visual updates
  const executeStepsSequentially = async (
    steps: ExecutionStep[],
    operation: LogEntry['operation'],
    initialMessage: string
  ) => {
    if (isExecutingSteps) {
      console.warn('Step execution already in progress, skipping');
      return;
    }

    setIsExecutingSteps(true);
    setHighlightedNodeId(null);
    setHighlightedKey(null);
    setOverflowNodeId(null);
    setCurrentStep(null);
    
    // Initialize visual tree from current tree data
    if (treeData) {
      setVisualTree(JSON.parse(JSON.stringify(treeData))); // Deep clone
    }

    // Add initial log entry
    addLog(initialMessage, 'info', steps, operation);

    // Calculate delay based on animation speed (0-100 -> 2000ms to 200ms)
    const getStepDelay = () => Math.max(200, 2000 - (animationSpeed[0] * 18));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const pageId = extractPageId(step.nodeId);
      
      // Set current step for visualization
      setCurrentStep(step);
      
      // Set highlighting for current step
      setHighlightedNodeId(pageId);
      setHighlightedKey(step.highlightKey || step.key || null);
      
      // Handle overflow state
      if (step.type === 'CHECK_OVERFLOW' && step.isOverflow) {
        setOverflowNodeId(pageId);
      } else if (step.type === 'SPLIT_NODE') {
        // Clear overflow after split
        setOverflowNodeId(null);
      } else {
        // Clear overflow for other operations
        setOverflowNodeId(null);
      }

      // Apply step mutation to visual tree incrementally
      setVisualTree(prev => {
        if (!prev) return prev;
        return applyStepToVisualTree(step, prev);
      });

      // Generate log message for this step
      let stepMessage = '';
      switch (step.type) {
        case 'TRAVERSE_NODE':
          if (step.highlightKey) {
            const keyStr = formatKey(step.highlightKey);
            stepMessage = `Traversing node ${step.nodeId || 'unknown'}, comparing with ${keyStr}...`;
          } else {
            stepMessage = `Traversing node ${step.nodeId || 'unknown'}...`;
          }
          break;
        case 'ADD_TEMP_KEY':
          const addKeyStr = formatKey(step.key);
          stepMessage = `Adding key ${addKeyStr} to node ${step.nodeId || 'unknown'}${step.isOverflow ? ' (OVERFLOW!)' : ''}`;
          break;
        case 'CHECK_OVERFLOW':
          stepMessage = `Checking overflow for node ${step.nodeId || 'unknown'}: ${step.isOverflow ? 'OVERFLOW DETECTED' : 'No overflow'}`;
          break;
        case 'SPLIT_NODE':
          stepMessage = `Splitting node ${step.nodeId || 'unknown'} into ${step.newNodes?.length || 2} nodes`;
          break;
        case 'PROMOTE_KEY':
          const promoteKeyStr = formatKey(step.key);
          stepMessage = `Promoting key ${promoteKeyStr} to parent node ${step.targetNodeId || 'unknown'}`;
          break;
        case 'INSERT_KEY':
          const insertKeyStr = formatKey(step.key);
          stepMessage = `Inserting key ${insertKeyStr} into node ${step.nodeId || 'unknown'}`;
          break;
        case 'UPDATE_KEY':
          const updateKeyStr = formatKey(step.key);
          stepMessage = `Updating key ${updateKeyStr} in node ${step.nodeId || 'unknown'}`;
          break;
        case 'DELETE_KEY':
          const deleteKeyStr = formatKey(step.key);
          stepMessage = `Deleting key ${deleteKeyStr} from node ${step.nodeId || 'unknown'}`;
          break;
        case 'MERGE_NODE':
          stepMessage = `Merging node ${step.nodeId || 'unknown'} due to underflow`;
          break;
        case 'BORROW_KEY':
        case 'BORROW_FROM_LEFT':
          stepMessage = `Borrowing key from left sibling of node ${step.nodeId || 'unknown'}`;
          break;
        case 'BORROW_FROM_RIGHT':
          stepMessage = `Borrowing key from right sibling of node ${step.nodeId || 'unknown'}`;
          break;
        case 'SEARCH_FOUND':
          const foundKeyStr = formatKey(step.key);
          stepMessage = `Search found key ${foundKeyStr} in node ${step.nodeId || 'unknown'}`;
          break;
        case 'SEARCH_NOT_FOUND':
          const notFoundKeyStr = formatKey(step.key);
          stepMessage = `Search did not find key ${notFoundKeyStr}`;
          break;
        case 'PAGE_LOAD':
          stepMessage = `Loading page ${step.pageId || 'unknown'} from disk`;
          break;
        case 'PAGE_FLUSH':
          stepMessage = `Flushing page ${step.pageId || 'unknown'} to disk`;
          break;
        case 'CACHE_HIT':
          stepMessage = `Cache hit for page ${step.pageId || 'unknown'}`;
          break;
        case 'CACHE_MISS':
          stepMessage = `Cache miss for page ${step.pageId || 'unknown'}`;
          break;
        case 'EVICT_PAGE':
          stepMessage = `Evicting page ${step.pageId || 'unknown'} from cache`;
          break;
        case 'WAL_APPEND':
          stepMessage = `Appending to WAL (LSN: ${step.lsn || 'unknown'})`;
          break;
        case 'BUFFER_FLUSH':
          stepMessage = `Flushing buffer to disk`;
          break;
        default:
          stepMessage = `Executing ${step.type}${step.nodeId ? ` on node ${step.nodeId}` : ''}`;
      }

      // Add step log message in real-time
      addLog(stepMessage, 'info');

      // Wait for step animation delay
      await new Promise(resolve => {
        const timeoutId = setTimeout(() => {
          resolve(undefined);
        }, getStepDelay());
        
        // Also set up callback for TreeCanvas completion
        (window as any).__currentStepResolve = () => {
          clearTimeout(timeoutId);
          resolve(undefined);
        };
      });
    }

    // Finalize: sync visual tree with actual tree data
    if (treeStructureData) {
      setVisualTree(JSON.parse(JSON.stringify(treeStructureData)));
      setTreeData(treeStructureData);
    }

    setIsExecutingSteps(false);
    setHighlightedNodeId(null);
    setHighlightedKey(null);
    setOverflowNodeId(null);
    setCurrentStep(null);
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

  // Auto-connect to database on mount (reset ref when name changes)
  useEffect(() => {
    // Reset connection ref, initial load flag, and tree data when database name changes
    isConnectedRef.current = false
    hasLoggedInitialLoadRef.current = false
    setTreeData(null) // Clear tree data when switching databases
    
    if (name) {
      connectMutation.mutate(
        { name, config: { cacheSize: 100 } },
        {
          onSuccess: () => {
            isConnectedRef.current = true
            addLog(`Database "${name}" connected successfully.`, 'success')
          },
          onError: (error: Error) => {
            isConnectedRef.current = false
            addLog(`Failed to connect to database: ${error.message}`, 'error')
          },
        }
      )
    }
  }, [name])

  // Load tree structure from API - update when data changes (on load or after operations)
  useEffect(() => {
    if (treeStructureData) {
      const isInitialLoad = !treeData
      
      if (isInitialLoad) {
        // Initial load - update immediately
        setTreeData(treeStructureData)
        setVisualTree(JSON.parse(JSON.stringify(treeStructureData))) // Deep clone for visual tree
        if (!hasLoggedInitialLoadRef.current) {
          hasLoggedInitialLoadRef.current = true
          addLog(`B+ Tree root located at Page #${treeStructureData.rootPage}`, 'success')
          addLog(`Tree height: ${treeStructureData.height}`, 'info')
        }
      } else if (!isExecutingSteps) {
        // Not executing steps - update immediately (e.g., manual refresh or after operation completes)
        setTreeData(treeStructureData)
        setVisualTree(JSON.parse(JSON.stringify(treeStructureData))) // Sync visual tree
      }
      // During step execution, visual tree is updated incrementally by executeStepsSequentially
    }
  }, [treeStructureData, isExecutingSteps, treeData])

  useEffect(() => {
    if (cacheStatsData) {
      // Only update if values actually changed to prevent unnecessary re-renders
      setCacheStats(prev => {
        if (prev.size === cacheStatsData.size && 
            prev.hits === cacheStatsData.hits && 
            prev.misses === cacheStatsData.misses && 
            prev.evictions === cacheStatsData.evictions) {
          return prev // No change, return previous value
        }
        return cacheStatsData
      })
    }
  }, [cacheStatsData])

  // Handle closing database on unmount (if not navigating)
  useEffect(() => {
    return () => {
      if (name && isConnectedRef.current && !isNavigating) {
        // Only close if we're not navigating (handled by navigate handler)
        // Use a silent close - don't navigate or show logs
        closeMutation.mutate(name, { onSettled: () => {} })
      }
    }
  }, [name, isNavigating])

  // Mock logs removed - now using real API step execution

  // Handle navigation with confirmation
  const handleNavigateAway = () => {
    // Always show confirmation dialog when navigating away
    // This allows proper cleanup of the database connection
    setCloseConfirmOpen(true)
  }

  // Handle closing database and navigating
  const handleCloseAndNavigate = async () => {
    if (!name) {
      navigate('/')
      return
    }
    
    setIsNavigating(true)
    setCloseConfirmOpen(false)
    
    try {
      await closeMutation.mutateAsync(name)
      addLog(`Database "${name}" closed successfully.`, 'info')
    } catch (error) {
      addLog(`Failed to close database: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setIsNavigating(false)
      // Always navigate, regardless of close success/failure
      navigate('/')
    }
  }

  if (!name) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <DatabaseHeader databaseName="Unknown" onBackClick={handleNavigateAway} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Database not found</p>
        </main>
      </div>
    )
  }

  if (!treeData) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <DatabaseHeader databaseName={name} onBackClick={handleNavigateAway} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            {connectMutation.isPending ? 'Connecting to database...' : 'Loading database...'}
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Database?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close the database connection? This will free up memory but keep the data on disk.
              You can reconnect later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeMutation.isPending || isNavigating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCloseAndNavigate()
              }}
              disabled={closeMutation.isPending || isNavigating}
            >
              {closeMutation.isPending || isNavigating ? 'Closing...' : 'Close & Go Back'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DatabaseHeader databaseName={name} onBackClick={handleNavigateAway} />
      
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
                      const result = await refetchCacheStats();
                      if (result.data) {
                        setCacheStats(result.data);
                        addLog('Cache statistics refreshed', 'success');
                      }
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
              onSubmit={(key, value, endKey) => {
                if (!name) return;

                const handleOperationSuccess = async (response: any, operation: string) => {
                  if (response.success) {
                    // Execute steps sequentially with animations
                    if (response.steps && response.steps.length > 0) {
                      await executeStepsSequentially(
                        response.steps,
                        operation as LogEntry['operation'],
                        `${operation} operation started`
                      );
                      addLog(
                        `${operation} operation completed successfully`,
                        'success',
                        response.steps,
                        operation as LogEntry['operation']
                      );
                    } else {
                      addLog(
                        `${operation} operation completed successfully`,
                        'success',
                        [],
                        operation as LogEntry['operation']
                      );
                    }
                    // Tree will automatically refetch due to query invalidation in hooks
                  } else {
                    // Even on failure, show steps if available
                    if (response.steps && response.steps.length > 0) {
                      await executeStepsSequentially(
                        response.steps,
                        operation as LogEntry['operation'],
                        `${operation} operation started`
                      );
                    }
                    addLog(
                      `${operation} operation failed: ${response.error || 'Unknown error'}`,
                      'error',
                      response.steps || [],
                      operation as LogEntry['operation']
                    );
                  }
                };

                const handleOperationError = (error: Error, operation: string) => {
                  addLog(
                    `${operation} operation failed: ${error.message}`,
                    'error',
                    [],
                    operation as LogEntry['operation']
                  );
                };

                switch (currentOperation) {
                  case 'insert':
                    if (!value) {
                      addLog('Insert operation requires both key and value', 'error');
                      return;
                    }
                    insertMutation.mutate(
                      { name, key, value },
                      {
                        onSuccess: (response) => handleOperationSuccess(response, 'INSERT'),
                        onError: (error) => handleOperationError(error as Error, 'INSERT'),
                      }
                    );
                    break;

                  case 'update':
                    if (!value) {
                      addLog('Update operation requires both key and value', 'error');
                      return;
                    }
                    updateMutation.mutate(
                      { name, key, value },
                      {
                        onSuccess: (response) => handleOperationSuccess(response, 'UPDATE'),
                        onError: (error) => handleOperationError(error as Error, 'UPDATE'),
                      }
                    );
                    break;

                  case 'delete':
                    deleteMutation.mutate(
                      { name, key },
                      {
                        onSuccess: (response) => handleOperationSuccess(response, 'DELETE'),
                        onError: (error) => handleOperationError(error as Error, 'DELETE'),
                      }
                    );
                    break;

                  case 'search':
                    searchMutation.mutate(
                      { name, key },
                      {
                        onSuccess: async (response) => {
                          if (response.success && response.value) {
                            if (response.steps && response.steps.length > 0) {
                              await executeStepsSequentially(
                                response.steps,
                                'SEARCH',
                                'Search operation started'
                              );
                            }
                            addLog(
                              `Search operation found value for key`,
                              'success',
                              response.steps,
                              'SEARCH'
                            );
                          } else {
                            if (response.steps && response.steps.length > 0) {
                              await executeStepsSequentially(
                                response.steps,
                                'SEARCH',
                                'Search operation started'
                              );
                            }
                            addLog(
                              `Search operation: key not found`,
                              'warning',
                              response.steps || [],
                              'SEARCH'
                            );
                          }
                        },
                        onError: (error) => handleOperationError(error as Error, 'SEARCH'),
                      }
                    );
                    break;

                  case 'range':
                    // For range queries, endKey is passed separately
                    if (!endKey || !endKey.values || endKey.values.length === 0) {
                      // Try to extract from value if endKey not provided (legacy format)
                      if (value && value.columns && value.columns.length > 0) {
                        const extractedEndKey = { values: value.columns };
                        rangeQueryMutation.mutate(
                          { name, startKey: key, endKey: extractedEndKey },
                          {
                          onSuccess: async (response) => {
                            if (response.success) {
                              if (response.steps && response.steps.length > 0) {
                                await executeStepsSequentially(
                                  response.steps,
                                  'RANGE_QUERY',
                                  'Range query operation started'
                                );
                              }
                              const keyCount = response.keys?.length || 0;
                              addLog(
                                `Range query found ${keyCount} key-value pair(s)`,
                                'success',
                                response.steps,
                                'RANGE_QUERY'
                              );
                            } else {
                              await handleOperationSuccess(response, 'RANGE_QUERY');
                            }
                          },
                            onError: (error) => handleOperationError(error as Error, 'RANGE_QUERY'),
                          }
                        );
                      } else {
                        addLog('Range query operation requires both startKey and endKey', 'error');
                      }
                    } else {
                      rangeQueryMutation.mutate(
                        { name, startKey: key, endKey },
                        {
                          onSuccess: async (response) => {
                            if (response.success) {
                              if (response.steps && response.steps.length > 0) {
                                await executeStepsSequentially(
                                  response.steps,
                                  'RANGE_QUERY',
                                  'Range query operation started'
                                );
                              }
                              const keyCount = response.keys?.length || 0;
                              addLog(
                                `Range query found ${keyCount} key-value pair(s)`,
                                'success',
                                response.steps,
                                'RANGE_QUERY'
                              );
                            } else {
                              await handleOperationSuccess(response, 'RANGE_QUERY');
                            }
                          },
                          onError: (error) => handleOperationError(error as Error, 'RANGE_QUERY'),
                        }
                      );
                    }
                    break;

                  default:
                    addLog(`Unknown operation: ${currentOperation}`, 'error');
                }
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
          {(visualTree || treeData) ? (
            <TreeCanvas 
              treeData={visualTree || treeData} 
              highlightedIds={highlighted}
              highlightedNodeId={highlightedNodeId}
              highlightedKey={highlightedKey}
              overflowNodeId={overflowNodeId}
              currentStep={currentStep}
              onStepComplete={() => {
                // Call the stored resolve function
                if ((window as any).__currentStepResolve) {
                  (window as any).__currentStepResolve();
                  (window as any).__currentStepResolve = null;
                }
              }}
              animationSpeed={animationSpeed[0]}
              config={{
                order: 3,
                pageSize: 4096,
                cacheSize: 8,
                walEnabled: true
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {connectMutation.isPending ? 'Connecting to database...' : treeLoading ? 'Loading tree structure...' : treeError ? `Error loading tree: ${treeError.message}` : 'Waiting for tree data...'}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
