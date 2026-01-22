import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TreeCanvas } from '@/components/tree-visualizer/TreeCanvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { OperationDialog } from '@/components/OperationDialog';
import { OperationHelpDialog } from '@/components/OperationHelpDialog';
import { SystemLog } from '@/components/SystemLog';
import { QueryResultPanel, type QueryResult } from '@/components/QueryResultPanel';
import { useBTreeStepAnimator } from '@/hooks/useBTreeStepAnimator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { LogEntry, TreeStructure, ExecutionStep } from '@/types/database';
import { api } from '@/lib/api';
import { Plus, Search, Trash2, Edit, ArrowLeftRight, ChevronDown, ChevronRight, ArrowLeft, RotateCcw, Sun, Moon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IconSwitch } from '@/components/ui/icon-switch';

// CollapsibleSection component wrapper for sidebar sections
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

function CollapsibleSection({ title, children, defaultOpen = true, icon: Icon }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1 min-h-0 flex flex-col">
      <CollapsibleTrigger className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase flex-shrink-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3 w-3" />}
          <span>{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex-1 min-h-0 flex flex-col">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  
  const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (stored) return stored
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function TreeDetail() {
  const navigate = useNavigate();
  const { treeName: treeNameParam } = useParams<{ treeName?: string }>();
  const [treeName, setTreeName] = useState<string>('');
  const [treeData, setTreeData] = useState<TreeStructure | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fullLogsOpen, setFullLogsOpen] = useState(false);
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [clearTreeDialogOpen, setClearTreeDialogOpen] = useState(false);
  const hasLoggedInitialLoadRef = useRef(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  
  // Persisted user preferences
  const [animationSpeed, setAnimationSpeed] = useLocalStorage<number[]>('app_anim_speed', [50]);
  const [enableSteps, setEnableSteps] = useLocalStorage<boolean>('app_anim_enabled', true);
  
  // Ensure animation speed is within valid range (10-100)
  const currentSpeed = Math.max(10, Math.min(100, animationSpeed[0] || 50));
  
  // Query result state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  
  // Step animator hook
  const stepAnimator = useBTreeStepAnimator({
    animationSpeed: currentSpeed,
    onStepComplete: () => {
      if ((window as any).__currentStepResolve) {
        (window as any).__currentStepResolve();
        (window as any).__currentStepResolve = null;
      }
    },
  });

  const addLog = (message: string, type: LogEntry['type'] = 'info', steps?: ExecutionStep[], operation?: LogEntry['operation']) => {
    setLogs(prev => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        message,
        type,
        steps,
        operation
      };
      
      const updated = [...prev, newLog];
      return updated.slice(-50);
    });
  };

  // Helper to format key for display
  const formatKeyForMessage = (key?: { values: Array<{ type: string; value: any }> }): string => {
    if (!key || !key.values || key.values.length === 0) return '';
    if (key.values.length === 1) {
      return String(key.values[0].value);
    }
    return `(${key.values.map(v => String(v.value)).join(', ')})`;
  };

  // Initialize tree name from URL or current
  useEffect(() => {
    if (treeNameParam) {
      const decodedName = decodeURIComponent(treeNameParam);
      // Verify tree exists
      const allTrees = api.listTrees();
      if (!allTrees.includes(decodedName)) {
        // Tree doesn't exist, redirect to home
        toast.error('Tree not found');
        navigate('/', { replace: true });
        return;
      }
      setTreeName(decodedName);
      api.setCurrentTreeName(decodedName);
    } else {
      // If no tree name in URL, try to get current or redirect to home
      const current = api.getCurrentTreeName();
      if (current) {
        navigate(`/tree/${encodeURIComponent(current)}`, { replace: true });
      } else {
        // No tree selected, redirect to home
        navigate('/', { replace: true });
      }
    }
  }, [treeNameParam, navigate]);

  // Load tree structure
  const loadTreeStructure = async () => {
    if (!treeName) return;
    
    try {
      const tree = await api.getTreeStructure(treeName);
      setTreeData(tree);
      
      if (!hasLoggedInitialLoadRef.current && tree.rootPage !== 0) {
        hasLoggedInitialLoadRef.current = true;
        addLog(`B+ Tree root located at Page #${tree.rootPage}`, 'success');
        addLog(`Tree height: ${tree.height}`, 'info');
      }
    } catch (error) {
      console.error('Failed to load tree structure:', error);
    }
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
        if (treeData) {
          stepAnimator.initializeVisualTree(treeData);
        }

        await stepAnimator.executeSteps(response.steps, treeData);

        // Reload tree structure
        await loadTreeStructure();
      } else {
        // Just reload tree structure
        await loadTreeStructure();
      }

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
      addLog(
        `${operation} operation failed: ${response.error || 'Unknown error'}`,
        'error',
        response.steps || [],
        operation as LogEntry['operation']
      );

      setQueryResult({
        operation: operation as 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY',
        success: false,
        message: `${operation} operation failed.`,
        executionTime,
        error: response.error || 'Unknown error',
        timestamp: new Date(),
      });
    }
  };

  // Theme management
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load tree when treeName changes
  useEffect(() => {
    if (treeName) {
      hasLoggedInitialLoadRef.current = false;
      loadTreeStructure();
    }
  }, [treeName]);

  // Initialize visual tree when treeData changes
  useEffect(() => {
    if (treeData && treeData.rootPage !== 0) {
      stepAnimator.initializeVisualTree(treeData);
    }
  }, [treeData]);

  // Handle operation execution
  const handleExecuteOperation = async (
    operation: 'insert' | 'search' | 'update' | 'delete' | 'range',
    data: any
  ) => {
    if (!treeName) {
      toast.error('No tree selected');
      return;
    }

    const startTime = Date.now();
    setOperationDialogOpen(false);

    try {
      let response: any;

      switch (operation) {
        case 'insert':
          response = await api.insert(treeName, data.key, data.value, enableSteps);
          break;
        case 'update':
          response = await api.update(treeName, data.key, data.value, enableSteps);
          break;
        case 'delete':
          response = await api.delete(treeName, data.key, enableSteps);
          break;
        case 'search':
          response = await api.search(treeName, data.key, enableSteps);
          break;
        case 'range':
          response = await api.rangeQuery(treeName, data.startKey, data.endKey, enableSteps);
          break;
      }

      await handleOperationResponse(response, operation.toUpperCase(), startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      toast.error(errorMessage);
      addLog(`${operation.toUpperCase()} operation failed: ${errorMessage}`, 'error');
    }
  };

  const handleClearTree = () => {
    if (!treeName) {
      toast.error('No tree selected');
      return;
    }

    api.clearTree(treeName);
    api.initTree(treeName);
    setTreeData(api.initTree(treeName));
    setLogs([]);
    setQueryResult(null);
    hasLoggedInitialLoadRef.current = false;
    setClearTreeDialogOpen(false);
    toast.success('Tree cleared');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Simple Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
          </Button>
          {treeName && (
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold">{treeName}</h1>
              <span className="text-sm text-muted-foreground"><b>Order:</b> 4</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog open={clearTreeDialogOpen} onOpenChange={setClearTreeDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear Tree
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Tree</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to clear the tree? This will delete all data and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearTree}>
                  Clear Tree
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <IconSwitch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            activeIcon={Moon}
            inactiveIcon={Sun}
            aria-label="Toggle theme"
          />
        </div>
      </header>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Operations */}
          <div className="w-64 border-r p-4 flex flex-col overflow-hidden">
            {/* Tree Operations Section */}
            <div className="space-y-3 flex-shrink-0">
              <h3 className="text-xs font-semibold mb-2 uppercase text-left">Tree Operations</h3>
              <div className="space-y-2">
                {[
                  {
                    id: 'insert' as const,
                    label: 'Insert',
                    icon: Plus,
                    colorStyles: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300',
                  },
                  {
                    id: 'search' as const,
                    label: 'Search',
                    icon: Search,
                    colorStyles: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20 dark:hover:text-blue-300',
                  },
                  {
                    id: 'update' as const,
                    label: 'Update',
                    icon: Edit,
                    colorStyles: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/20 dark:hover:text-amber-300',
                  },
                  {
                    id: 'delete' as const,
                    label: 'Delete',
                    icon: Trash2,
                    colorStyles: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20 dark:hover:text-red-300',
                  },
                  {
                    id: 'range' as const,
                    label: 'Range Query',
                    icon: ArrowLeftRight,
                    colorStyles: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:text-violet-800 hover:border-violet-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 dark:hover:bg-purple-500/20 dark:hover:text-purple-300',
                  },
                ].map((operation) => {
                  const IconComponent = operation.icon;
                  return (
                    <Button
                      key={operation.id}
                      variant="outline"
                      className={`w-full justify-start transition-all duration-200 active:scale-95 ${operation.colorStyles}`}
                      onClick={() => {
                        setCurrentOperation(operation.id);
                        setOperationDialogOpen(true);
                      }}
                    >
                      <IconComponent className="h-4 w-4 mr-2" />
                      {operation.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* System Log */}
            <div className="flex-1 min-h-0 flex flex-col mt-2">
              <CollapsibleSection title="System Log" defaultOpen={true}>
                <div className="flex-1 min-h-0">
                  <SystemLog
                    logs={logs}
                    fullView={false}
                    onFullView={() => setFullLogsOpen(true)}
                    onDownload={() => {
                  const csvHeaders = ['Timestamp', 'Type', 'Operation', 'Message', 'Steps Count'];
                  const csvRows = logs.map(log => {
                    const timestamp = log.timestamp.toISOString();
                    const type = log.type;
                    const operation = log.operation || '';
                    const message = log.message.replace(/"/g, '""');
                    const stepsCount = log.steps?.length || 0;
                    
                    return [timestamp, type, operation, message, stepsCount]
                      .map(field => `"${String(field).replace(/"/g, '""')}"`)
                      .join(',');
                  });

                  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `system-log-${new Date().toISOString().split('T')[0]}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                  />
                </div>
              </CollapsibleSection>
            </div>
          </div>

          {/* Center - Visualization or Data View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {treeData && (
              <div className="flex-1 relative">
                <TreeCanvas
                  treeData={treeData}
                  highlightedIds={stepAnimator.highlightedNodeId ? [stepAnimator.highlightedNodeId] : []}
                  highlightColor="#3b82f6"
                  highlightedNodeId={stepAnimator.highlightedNodeId}
                  highlightedKey={stepAnimator.highlightedKey}
                  overflowNodeId={stepAnimator.overflowNodeId}
                  currentStep={stepAnimator.currentStep}
                  animationSpeed={currentSpeed}
                  onStepComplete={() => {
                    if ((window as any).__currentStepResolve) {
                      (window as any).__currentStepResolve();
                    }
                  }}
                  enableSteps={enableSteps}
                  onEnableStepsChange={setEnableSteps}
                  currentSpeed={currentSpeed}
                  onSpeedChange={(speed) => setAnimationSpeed([speed])}
                />
              </div>
            )}

            {/* Query Result Panel */}
            <QueryResultPanel
              result={queryResult}
              onClear={() => setQueryResult(null)}
              fullHeight={false}
              isLockedOpen={false}
              defaultExpanded={false}
            />
          </div>
        </div>
      </main>

      {/* Operation Dialog */}
      {currentOperation && (
        <OperationDialog
          open={operationDialogOpen}
          onOpenChange={setOperationDialogOpen}
          operation={currentOperation}
          onSubmit={(rowData, startKeyData, endKeyData) => {
            if (currentOperation === 'range') {
              // startKeyData and endKeyData are CompositeKey objects
              handleExecuteOperation(currentOperation, { startKey: startKeyData, endKey: endKeyData });
            } else if (currentOperation === 'search' || currentOperation === 'delete') {
              // startKeyData is a CompositeKey object
              handleExecuteOperation(currentOperation, { key: startKeyData });
            } else if (rowData && rowData.key) {
              // rowData has key and value
              handleExecuteOperation(currentOperation, { key: rowData.key, value: rowData.value });
            }
          }}
        />
      )}

      {/* Help Dialog */}
      <OperationHelpDialog
        open={helpDialogOpen}
        onOpenChange={setHelpDialogOpen}
        operation={currentOperation || 'insert'}
      />

      {/* Full Logs Dialog */}
      <Dialog open={fullLogsOpen} onOpenChange={setFullLogsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>System Log (Full View)</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh]">
            <SystemLog logs={logs} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
