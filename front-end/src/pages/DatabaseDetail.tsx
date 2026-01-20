import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { TreeCanvas } from '@/components/tree-visualizer/TreeCanvas';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import { QueryResultPanel, type QueryResult } from '@/components/QueryResultPanel';
import { useConnectDatabase, useCloseDatabase, useTreeStructure, useCacheStats } from '@/hooks/useDatabaseOperations';
import { useBTreeStepAnimator } from '@/hooks/useBTreeStepAnimator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { LogEntry, TreeStructure, ExecutionStep, CacheStats, TreeConfig, Schema } from '@/types/database';
import { api } from '@/lib/api';
import { formatKey } from '@/lib/keyUtils';
import { Plus, Search, Trash2, Edit, ArrowLeftRight, ExternalLink, HelpCircle, Download, RotateCcw, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function DatabaseDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [treeData, setTreeData] = useState<TreeStructure | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [fullLogsOpen, setFullLogsOpen] = useState(false)
  const [operationDialogOpen, setOperationDialogOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpOperation, setHelpOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const isConnectedRef = useRef(false)
  const hasLoggedInitialLoadRef = useRef(false)
  
  // Persisted user preferences
  const [animationSpeed, setAnimationSpeed] = useLocalStorage<number[]>('app_anim_speed', [50]) // 0-100, default 50
  const [enableSteps, setEnableSteps] = useLocalStorage<boolean>('app_anim_enabled', true) // Global toggle for step animation (default: ON)
  const [showVisualizer, setShowVisualizer] = useLocalStorage<boolean>('app_show_graph', false) // Visualizer visibility toggle (default: OFF - prioritize data view)
  
  // Query result state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  
  // Tree configuration state
  const [treeConfig, setTreeConfig] = useState<TreeConfig | null>(null)
  
  // Schema state (Version 7.0)
  // null = not loaded yet, undefined = checked and doesn't exist (shouldn't happen in v7.0)
  const [schema, setSchema] = useState<Schema | null | undefined>(undefined)
  
  // Hooks for database operations
  const connectMutation = useConnectDatabase()
  const closeMutation = useCloseDatabase()
  const { data: treeStructureData, error: treeError, isLoading: treeLoading, refetch: refetchTreeStructure } = useTreeStructure(name)
  const { data: cacheStatsData, refetch: refetchCacheStats } = useCacheStats(name)
  
  // Note: Operation hooks are no longer used directly - we use api methods instead for schema-based operations
  
  // Step animator hook
  const stepAnimator = useBTreeStepAnimator({
    animationSpeed: animationSpeed[0],
    onStepComplete: () => {
      if ((window as any).__currentStepResolve) {
        (window as any).__currentStepResolve();
        (window as any).__currentStepResolve = null;
      }
    },
  })
  
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    size: 0,
    maxSize: 100,
    hits: 0,
    misses: 0,
    evictions: 0
  })

  const addLog = (message: string, type: LogEntry['type'] = 'info', steps?: ExecutionStep[], operation?: LogEntry['operation']) => {
    setLogs(prev => {
      // Create new log entry (append to end for chronological order: oldest first, newest last)
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        message,
        type,
        steps,
        operation
      }
      
      // Append new log to end (oldest first, newest last) and keep last 50
      const updated = [...prev, newLog]
      return updated.slice(-50)
    })
  }


  // Helper to format key for display
  const formatKeyForMessage = (key?: { values: Array<{ type: string; value: any }> }): string => {
    if (!key || !key.values || key.values.length === 0) return '';
    if (key.values.length === 1) {
      return String(key.values[0].value);
    }
    return `(${key.values.map(v => String(v.value)).join(', ')})`;
  };

  // Handle operation response and execute steps if available
  const handleOperationResponse = async (
    response: any,
    operation: string,
    startTime?: number
  ) => {
    const executionTime = startTime ? Date.now() - startTime : undefined;
    
    if (response.success) {
      // Execute steps if available and animation is enabled
      if (enableSteps && response.steps && response.steps.length > 0) {
        // Initialize visual tree before animation
        if (treeData) {
          stepAnimator.initializeVisualTree(treeData);
        }

        // Execute steps sequentially
        await stepAnimator.executeSteps(response.steps, treeData);

        // Wait for tree structure to refetch after query invalidation
        // Explicitly refetch and wait for completion to ensure we have the latest tree data
        try {
          const { data: updatedTreeData } = await refetchTreeStructure();
          if (updatedTreeData) {
            stepAnimator.syncVisualTree(updatedTreeData);
            setTreeData(updatedTreeData);
          } else if (treeStructureData) {
            // Fallback to existing data if refetch didn't return new data
            stepAnimator.syncVisualTree(treeStructureData);
            setTreeData(treeStructureData);
          }
        } catch (error) {
          console.error('Failed to refetch tree structure after operation:', error);
          // Fallback to existing data on error
          if (treeStructureData) {
            stepAnimator.syncVisualTree(treeStructureData);
            setTreeData(treeStructureData);
          }
        }
      }

      // Log operation completion (only after animation/steps are finished)
      addLog(
        `${operation} operation completed successfully`,
        'success',
        response.steps || [],
        operation as LogEntry['operation']
      );

      // Set query result for result panel
      if (operation === 'INSERT' || operation === 'UPDATE' || operation === 'DELETE') {
        const keyStr = formatKeyForMessage(response.key);
        setQueryResult({
          operation: operation as 'INSERT' | 'UPDATE' | 'DELETE',
          success: true,
          message: `${operation === 'INSERT' ? 'Key' : operation === 'UPDATE' ? 'Key' : 'Key'} ${keyStr} ${operation === 'INSERT' ? 'inserted' : operation === 'UPDATE' ? 'updated' : 'deleted'} successfully.`,
          executionTime,
          key: response.key,
          value: response.value,
          timestamp: new Date(),
        });
      } else if (operation === 'SEARCH') {
        if (response.value) {
          setQueryResult({
            operation: 'SEARCH',
            success: true,
            message: `Search completed. Found 1 record.`,
            executionTime,
            key: response.key,
            value: response.value,
            timestamp: new Date(),
          });
        } else {
          const keyStr = formatKeyForMessage(response.key);
          setQueryResult({
            operation: 'SEARCH',
            success: true,
            message: `Search completed. Key ${keyStr} not found.`,
            executionTime,
            key: response.key,
            timestamp: new Date(),
          });
        }
      } else if (operation === 'RANGE_QUERY') {
        const count = response.keys?.length || 0;
        setQueryResult({
          operation: 'RANGE_QUERY',
          success: true,
          message: `Range query completed. Found ${count} record(s).`,
          executionTime,
          keys: response.keys,
          values: response.values,
          timestamp: new Date(),
        });
      }
    } else {
      // Operation failed
      if (enableSteps && response.steps && response.steps.length > 0) {
        // Still animate failed operations if steps are available
        if (treeData) {
          stepAnimator.initializeVisualTree(treeData);
        }
        await stepAnimator.executeSteps(response.steps, treeData);
        // Sync tree even on failure to show current state
        try {
          const { data: updatedTreeData } = await refetchTreeStructure();
          if (updatedTreeData) {
            stepAnimator.syncVisualTree(updatedTreeData);
            setTreeData(updatedTreeData);
          } else if (treeStructureData) {
            stepAnimator.syncVisualTree(treeStructureData);
            setTreeData(treeStructureData);
          }
        } catch (error) {
          console.error('Failed to refetch tree structure after failed operation:', error);
          if (treeStructureData) {
            stepAnimator.syncVisualTree(treeStructureData);
            setTreeData(treeStructureData);
          }
        }
      }
      
      addLog(
        `${operation} operation failed: ${response.error || 'Unknown error'}`,
        'error',
        response.steps || [],
        operation as LogEntry['operation']
      );

      // Set error result
      setQueryResult({
        operation: operation as 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY',
        success: false,
        message: `${operation} operation failed.`,
        executionTime,
        error: response.error || 'Unknown error',
        timestamp: new Date(),
      });
    }
  }

  const downloadLogsAsCSV = () => {
    const csvHeaders = ['Timestamp', 'Type', 'Operation', 'Message', 'Steps Count', 'Steps Details']
    const csvRows = logs.map(log => {
      const timestamp = log.timestamp.toISOString()
      const type = log.type
      const operation = log.operation || ''
      const message = log.message.replace(/"/g, '""') // Escape quotes
      const stepsCount = log.steps?.length || 0
      const stepsDetails = log.steps?.map((step) => {
        const stepNum = String(step.step_id || 0).padStart(3, '0')
        const nodeId = step.node_id || step.nodeId || 'unknown'
        let stepStr = `[${stepNum}] ${step.type}`
        if (nodeId !== 'unknown') stepStr += ` → ${nodeId}`
        if (step.depth !== undefined) stepStr += ` (depth: ${step.depth})`
        if (step.target_id) stepStr += ` → target: ${step.target_id}`
        const key = step.key || step.highlightKey
        if (key) {
          // Use formatKey utility to handle all key formats safely
          const keyStr = formatKey(key)
          if (keyStr) {
            stepStr += ` | Key: ${keyStr}`
          }
        }
        if (step.metadata && Object.keys(step.metadata).length > 0) {
          const metaStr = Object.entries(step.metadata)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          stepStr += ` | ${metaStr}`
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
    setSchema(undefined) // Reset schema to "not loaded" state when switching databases
    setTreeConfig(null) // Clear tree config when switching databases
    
    if (name) {
      connectMutation.mutate(
        { name, config: { cacheSize: 100 } },
        {
          onSuccess: async () => {
            isConnectedRef.current = true
            addLog(`Database "${name}" connected successfully.`, 'success')
            
            // Fetch schema and config immediately after successful connection
            try {
              const schemaData = await api.getSchema(name)
              setSchema(schemaData)
            } catch (error) {
              console.error('Failed to fetch schema:', error)
              setSchema(null)
            }
            
            try {
              const config = await api.getTreeConfig(name)
              setTreeConfig(config)
            } catch (error) {
              console.error('Failed to fetch tree config:', error)
              setTreeConfig({
                order: 4,
                pageSize: 4096,
                cacheSize: 100,
                walEnabled: true,
                rootPageId: 0,
                height: 0
              })
            }
          },
          onError: (error: Error) => {
            isConnectedRef.current = false
            addLog(`Failed to connect to database: ${error.message}`, 'error')
          },
        }
      )
    }
  }, [name])

  // Extract stable methods from stepAnimator - methods are wrapped in useCallback so they're stable
  const { initializeVisualTree, syncVisualTree, isExecuting: isExecutingSteps } = stepAnimator

  // Load tree structure from API - update when data changes (on load or after operations)
  useEffect(() => {
    if (treeStructureData) {
      const isInitialLoad = !treeData
      
      if (isInitialLoad) {
        // Initial load - update immediately
        setTreeData(treeStructureData)
        initializeVisualTree(treeStructureData)
        if (!hasLoggedInitialLoadRef.current) {
          hasLoggedInitialLoadRef.current = true
          addLog(`B+ Tree root located at Page #${treeStructureData.rootPage}`, 'success')
          addLog(`Tree height: ${treeStructureData.height}`, 'info')
        }
      } else if (!isExecutingSteps) {
        // Not executing steps - update immediately (e.g., manual refresh or after operation completes)
        setTreeData(treeStructureData)
        syncVisualTree(treeStructureData)
      } else {
        // During step execution, wait for animation to complete
        // Tree will be synced after animation finishes in handleOperationResponse
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Note: Schema and tree config are primarily fetched in the connection success callback
  // This useEffect serves as a fallback/refresh mechanism when name changes
  // Note: We can't use isConnectedRef.current in dependencies (refs don't trigger re-renders)
  // Instead, schema/config are fetched immediately when connection succeeds
  useEffect(() => {
    if (!name) return

    // Only fetch if not already loaded (fallback mechanism)
    const fetchTreeConfig = async () => {
      if (treeConfig) return // Already loaded
      try {
        const config = await api.getTreeConfig(name)
        setTreeConfig(config)
      } catch (error) {
        console.error('Failed to fetch tree config:', error)
        if (!treeConfig) {
          setTreeConfig({
            order: 4,
            pageSize: 4096,
            cacheSize: 100,
            walEnabled: true,
            rootPageId: 0,
            height: 0
          })
        }
      }
    }

    const fetchSchema = async () => {
      // Only fetch if schema hasn't been loaded yet (undefined = not loaded, null = loaded but doesn't exist)
      if (schema !== undefined) return
      try {
        const schemaData = await api.getSchema(name)
        setSchema(schemaData) // Will be null if no schema exists, or Schema object if it exists
      } catch (error) {
        console.error('Failed to fetch schema:', error)
        setSchema(null) // Mark as checked but doesn't exist
      }
    }

    // Only fetch if connected (check ref, but don't include in deps)
    if (isConnectedRef.current) {
      fetchTreeConfig()
      fetchSchema()
    }
  }, [name]) // Only depend on name - connection state is handled in success callback

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
        <DatabaseHeader 
          databaseName={name} 
          onBackClick={handleNavigateAway}
          showVisualizer={showVisualizer}
          onVisualizerToggle={setShowVisualizer}
        />
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

      <DatabaseHeader 
        databaseName={name} 
        onBackClick={handleNavigateAway}
        showVisualizer={showVisualizer}
        onVisualizerToggle={setShowVisualizer}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-card border-r border-border flex flex-col shadow-lg z-20">
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Global Step Animation Toggle - Only show when visualizer is active */}
            {showVisualizer && (
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Animate B+Tree Operations
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Switch
                            checked={enableSteps}
                            onCheckedChange={setEnableSteps}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-xs">
                          {enableSteps 
                            ? 'Animations enabled - operations will show step-by-step execution'
                            : 'Animations disabled - operations will update instantly'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Animation Speed Control */}
                {enableSteps && (
                  <div className="space-y-2">
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
                )}
              </div>
            )}

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
                          if (schema === undefined) {
                            toast.error('Schema not loaded', {
                              description: 'Please wait for the database schema to load before performing operations.',
                            })
                            return
                          }
                          if (schema === null) {
                            toast.error('Schema not found', {
                              description: 'This database does not have a schema. Schema is required for operations.',
                            })
                            return
                          }
                          setCurrentOperation('insert');
                          setOperationDialogOpen(true);
                        }}
                        disabled={schema === undefined || schema === null || connectMutation.isPending}
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
                          if (schema === undefined) {
                            toast.error('Schema not loaded', {
                              description: 'Please wait for the database schema to load before performing operations.',
                            })
                            return
                          }
                          if (schema === null) {
                            toast.error('Schema not found', {
                              description: 'This database does not have a schema. Schema is required for operations.',
                            })
                            return
                          }
                          setCurrentOperation('search');
                          setOperationDialogOpen(true);
                        }}
                        disabled={schema === undefined || schema === null || connectMutation.isPending}
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
                          if (schema === undefined) {
                            toast.error('Schema not loaded', {
                              description: 'Please wait for the database schema to load before performing operations.',
                            })
                            return
                          }
                          if (schema === null) {
                            toast.error('Schema not found', {
                              description: 'This database does not have a schema. Schema is required for operations.',
                            })
                            return
                          }
                          setCurrentOperation('update');
                          setOperationDialogOpen(true);
                        }}
                        disabled={schema === undefined || schema === null || connectMutation.isPending}
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
                          if (schema === undefined) {
                            toast.error('Schema not loaded', {
                              description: 'Please wait for the database schema to load before performing operations.',
                            })
                            return
                          }
                          if (schema === null) {
                            toast.error('Schema not found', {
                              description: 'This database does not have a schema. Schema is required for operations.',
                            })
                            return
                          }
                          setCurrentOperation('delete');
                          setOperationDialogOpen(true);
                        }}
                        disabled={schema === undefined || schema === null || connectMutation.isPending}
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
                        if (schema === undefined) {
                          toast.error('Schema not loaded', {
                            description: 'Please wait for the database schema to load before performing operations.',
                          })
                          return
                        }
                        if (schema === null) {
                          toast.error('Schema not found', {
                            description: 'This database does not have a schema. Schema is required for operations.',
                          })
                          return
                        }
                        setCurrentOperation('range');
                        setOperationDialogOpen(true);
                      }}
                      disabled={schema === undefined || schema === null || connectMutation.isPending}
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-muted-foreground">Size:</span>
                          <Info size={12} className="text-muted-foreground/60" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Number of pages currently loaded in the buffer pool vs. maximum capacity.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-muted-foreground">Hits:</span>
                          <Info size={12} className="text-muted-foreground/60" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Total requests where the page was found in memory (no disk I/O required).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">{cacheStats.hits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-muted-foreground">Misses:</span>
                          <Info size={12} className="text-muted-foreground/60" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Total requests where the page was not in memory and had to be fetched from disk.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-mono text-orange-600 dark:text-orange-400">{cacheStats.misses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-muted-foreground">Hit Rate:</span>
                          <Info size={12} className="text-muted-foreground/60" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Percentage of requests served from cache. Higher is better (Formula: Hits / (Hits + Misses)).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="font-mono">
                    {cacheStats.hits + cacheStats.misses > 0
                      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-muted-foreground">Evictions:</span>
                          <Info size={12} className="text-muted-foreground/60" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">Number of pages removed from the cache to make space for new pages (usually via LRU policy).</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
              schema={schema}
              onSubmit={(rowData, startKeyData, endKeyData) => {
                if (!name) return;

                const handleOperationError = (error: Error, operation: string) => {
                  addLog(
                    `${operation} operation failed: ${error.message}`,
                    'error',
                    [],
                    operation as LogEntry['operation']
                  );
                };

                // Schema-based operations (Version 7.0)
                switch (currentOperation) {
                  case 'insert':
                    if (!rowData) {
                      addLog('Insert operation requires row data', 'error');
                      return;
                    }
                    const insertStartTime = Date.now();
                    api.insertRow(name!, rowData, enableSteps)
                      .then((response) => handleOperationResponse(response, 'INSERT', insertStartTime))
                      .catch((error) => handleOperationError(error as Error, 'INSERT'));
                    break;

                  case 'update':
                    if (!rowData) {
                      addLog('Update operation requires row data', 'error');
                      return;
                    }
                    const updateStartTime = Date.now();
                    api.updateRow(name!, rowData, enableSteps)
                      .then((response) => handleOperationResponse(response, 'UPDATE', updateStartTime))
                      .catch((error) => handleOperationError(error as Error, 'UPDATE'));
                    break;

                  case 'delete':
                    if (!startKeyData) {
                      addLog('Delete operation requires primary key data', 'error');
                      return;
                    }
                    const deleteStartTime = Date.now();
                    api.deleteByKey(name!, startKeyData, enableSteps)
                      .then((response) => handleOperationResponse(response, 'DELETE', deleteStartTime))
                      .catch((error) => handleOperationError(error as Error, 'DELETE'));
                    break;

                  case 'search':
                    if (!startKeyData) {
                      addLog('Search operation requires primary key data', 'error');
                      return;
                    }
                    const searchStartTime = Date.now();
                    api.searchByKey(name!, startKeyData, enableSteps)
                      .then(async (response) => {
                        await handleOperationResponse(response, 'SEARCH', searchStartTime);
                        if (response.success && response.value) {
                          addLog(
                            `Search operation found value for key`,
                            'success',
                            response.steps,
                            'SEARCH'
                          );
                        } else {
                          addLog(
                            `Search operation: key not found`,
                            'warning',
                            response.steps || [],
                            'SEARCH'
                          );
                        }
                      })
                      .catch((error) => handleOperationError(error as Error, 'SEARCH'));
                    break;

                  case 'range':
                    if (!startKeyData || !endKeyData) {
                      addLog('Range query operation requires both start key and end key data', 'error');
                      return;
                    }
                    const rangeStartTime = Date.now();
                    api.rangeQueryByKeys(name!, startKeyData, endKeyData, enableSteps)
                      .then(async (response) => {
                        await handleOperationResponse(response, 'RANGE_QUERY', rangeStartTime);
                        if (response.success) {
                          const keyCount = response.keys?.length || 0;
                          addLog(
                            `Range query found ${keyCount} key-value pair(s)`,
                            'success',
                            response.steps,
                            'RANGE_QUERY'
                          );
                        }
                      })
                      .catch((error) => handleOperationError(error as Error, 'RANGE_QUERY'));
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
            <DialogContent className="max-w-4xl max-h-[80vh]">
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
              <div className="overflow-hidden">
                <SystemLog logs={logs} fullView={true} />
              </div>
            </DialogContent>
          </Dialog>
        </aside>

        {/* Main Content Area - Always contains Canvas and Query Panel */}
        <main className="flex-1 relative flex flex-col bg-background">
          {/* Canvas - Hidden when visualizer is off */}
          <div 
            className={cn(
              "flex-1 relative min-h-0",
              showVisualizer ? "block" : "hidden"
            )}
          >
            {(stepAnimator.visualTree || treeData) ? (
              <TreeCanvas 
                treeData={stepAnimator.visualTree || treeData}
                schema={schema || undefined}
                highlightedIds={[]}
                highlightedNodeId={stepAnimator.highlightedNodeId}
                highlightedKey={stepAnimator.highlightedKey}
                overflowNodeId={stepAnimator.overflowNodeId}
                currentStep={stepAnimator.currentStep}
                onStepComplete={() => {
                  // Call the stored resolve function
                  if ((window as any).__currentStepResolve) {
                    (window as any).__currentStepResolve();
                    (window as any).__currentStepResolve = null;
                  }
                }}
                animationSpeed={animationSpeed[0]}
                config={treeConfig ? {
                  order: treeConfig.order,
                  pageSize: treeConfig.pageSize,
                  cacheSize: treeConfig.cacheSize,
                  walEnabled: treeConfig.walEnabled
                } : {
                  order: 4,
                  pageSize: 4096,
                  cacheSize: 100,
                  walEnabled: true
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {connectMutation.isPending ? 'Connecting to database...' : treeLoading ? 'Loading tree structure...' : treeError ? `Error loading tree: ${treeError.message}` : 'Waiting for tree data...'}
              </div>
            )}
          </div>
          
          {/* Query Result Panel - Always present, behavior changes based on view mode */}
          <QueryResultPanel 
            result={queryResult}
            schema={schema || undefined}
            onClear={() => setQueryResult(null)}
            fullHeight={!showVisualizer}
            isLockedOpen={!showVisualizer}
            defaultExpanded={false}
          />
        </main>
      </div>
    </div>
  )
}
