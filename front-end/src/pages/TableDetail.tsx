import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { TreeCanvas } from '@/components/tree-visualizer/TreeCanvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OperationDialog } from '@/components/OperationDialog';
import { OperationHelpDialog } from '@/components/OperationHelpDialog';
import { SystemLog } from '@/components/SystemLog';
import { QueryResultPanel, type QueryResult } from '@/components/QueryResultPanel';
import { useTreeStructure, useCacheStats } from '@/hooks/useDatabaseOperations';
import { useBTreeStepAnimator } from '@/hooks/useBTreeStepAnimator';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { LogEntry, TreeStructure, ExecutionStep, CacheStats, TreeConfig, Schema } from '@/types/database';
import { api } from '@/lib/api';
import { formatKey } from '@/lib/keyUtils';
import { Plus, Search, Trash2, Edit, ArrowLeftRight, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// StatRow component for displaying key-value pairs with semantic coloring
interface StatRowProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

function StatRow({ label, value, variant = 'default' }: StatRowProps) {
  const valueColorClass = {
    default: 'text-gray-900 dark:text-gray-100',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  }[variant];

  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400 text-xs">{label}:</span>
      <span className={`font-semibold text-xs ${valueColorClass}`}>{value}</span>
    </div>
  );
}

// CollapsibleSection component wrapper for sidebar sections
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: LucideIcon;
}

function CollapsibleSection({ title, children, defaultOpen = true, icon: Icon }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-gray-100 dark:border-gray-800">
      <CollapsibleTrigger className="w-full flex items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 transition-colors">
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
      <CollapsibleContent className="pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TableDetail() {
  const { dbName, tableName } = useParams<{ dbName: string; tableName: string }>();
  const navigate = useNavigate();
  const [treeData, setTreeData] = useState<TreeStructure | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fullLogsOpen, setFullLogsOpen] = useState(false);
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [helpOperation] = useState<'insert' | 'search' | 'update' | 'delete' | 'range' | null>(null);
  const isConnectedRef = useRef(false);
  const hasLoggedInitialLoadRef = useRef(false);
  
  // Persisted user preferences
  const [animationSpeed, setAnimationSpeed] = useLocalStorage<number[]>('app_anim_speed', [50]);
  const [enableSteps, setEnableSteps] = useLocalStorage<boolean>('app_anim_enabled', true);
  const [showVisualizer, setShowVisualizer] = useLocalStorage<boolean>('app_show_graph', false);
  
  // Ensure animation speed is within valid range (10-100)
  const currentSpeed = Math.max(10, Math.min(100, animationSpeed[0] || 50));
  
  // Query result state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  
  // Tree configuration state
  const [treeConfig, setTreeConfig] = useState<TreeConfig | null>(null);
  
  // Schema state
  const [schema, setSchema] = useState<Schema | null | undefined>(undefined);
  
  // Hooks for table operations
  const { data: treeStructureData, refetch: refetchTreeStructure } = useTreeStructure(dbName, tableName);
  const { data: cacheStatsData, refetch: refetchCacheStats } = useCacheStats(dbName, tableName);
  
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
  
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    size: 0,
    maxSize: 100,
    hits: 0,
    misses: 0,
    evictions: 0
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
          console.error('Failed to refetch tree structure after operation:', error);
          if (treeStructureData) {
            stepAnimator.syncVisualTree(treeStructureData);
            setTreeData(treeStructureData);
          }
        }
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
      if (enableSteps && response.steps && response.steps.length > 0) {
        if (treeData) {
          stepAnimator.initializeVisualTree(treeData);
        }
        await stepAnimator.executeSteps(response.steps, treeData);
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

  // Load schema and config on mount
  useEffect(() => {
    if (!dbName || !tableName) return;
    
    isConnectedRef.current = false;
    hasLoggedInitialLoadRef.current = false;
    setTreeData(null);
    setSchema(undefined);
    setTreeConfig(null);
    
    const loadTableData = async () => {
      try {
        // Fetch schema
        const schemaData = await api.getSchema(dbName, tableName);
        setSchema(schemaData);
      } catch (error) {
        console.error('Failed to fetch schema:', error);
        setSchema(null);
      }
      
      try {
        // Fetch tree config
        const config = await api.getTreeConfig(dbName, tableName);
        setTreeConfig(config);
      } catch (error) {
        console.error('Failed to fetch tree config:', error);
        setTreeConfig({
          order: 4,
          pageSize: 4096,
          cacheSize: 100,
          walEnabled: true,
          rootPageId: 0,
          height: 0
        });
      }
    };

    loadTableData();
  }, [dbName, tableName]);

  // Extract stable methods from stepAnimator
  const { initializeVisualTree, syncVisualTree, isExecuting: isExecutingSteps } = stepAnimator;

  // Load tree structure from API
  useEffect(() => {
    if (treeStructureData) {
      const isInitialLoad = !treeData;
      
      if (isInitialLoad) {
        setTreeData(treeStructureData);
        initializeVisualTree(treeStructureData);
        if (!hasLoggedInitialLoadRef.current) {
          hasLoggedInitialLoadRef.current = true;
          addLog(`B+ Tree root located at Page #${treeStructureData.rootPage}`, 'success');
          addLog(`Tree height: ${treeStructureData.height}`, 'info');
        }
      } else if (!isExecutingSteps) {
        setTreeData(treeStructureData);
        syncVisualTree(treeStructureData);
      }
    }
  }, [treeStructureData, initializeVisualTree, syncVisualTree, isExecutingSteps]);

  // Update cache stats
  useEffect(() => {
    if (cacheStatsData) {
      setCacheStats(cacheStatsData);
    }
  }, [cacheStatsData]);

  // Handle operation execution
  const handleExecuteOperation = async (
    operation: 'insert' | 'search' | 'update' | 'delete' | 'range',
    data: any
  ) => {
    if (!dbName || !tableName) {
      toast.error('Database or table name is missing');
      return;
    }

    if (!schema) {
      toast.error('Schema not loaded. Please wait...');
      return;
    }

    const startTime = Date.now();
    setOperationDialogOpen(false);

    try {
      let response: any;

      switch (operation) {
        case 'insert':
          response = await api.insertRow(dbName, tableName, data, enableSteps);
          break;
        case 'update':
          response = await api.updateRow(dbName, tableName, data, enableSteps);
          break;
        case 'delete':
          response = await api.deleteByKey(dbName, tableName, data, enableSteps);
          break;
        case 'search':
          response = await api.searchByKey(dbName, tableName, data, enableSteps);
          break;
        case 'range':
          response = await api.rangeQueryByKeys(dbName, tableName, data.startKey, data.endKey, enableSteps);
          break;
      }

      await handleOperationResponse(response, operation.toUpperCase(), startTime);
      
      // Refetch cache stats after operation
      refetchCacheStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      toast.error(errorMessage);
      addLog(`${operation.toUpperCase()} operation failed: ${errorMessage}`, 'error');
    }
  };

  if (!dbName || !tableName) {
    return <div>Database and table names are required</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DatabaseHeader 
        dbName={dbName}
        tableName={tableName}
        showVisualizer={showVisualizer}
        onVisualizerToggle={setShowVisualizer}
        onBackClick={() => navigate(`/databases/${dbName}`)}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Operations */}
          <div className="w-64 border-r p-4 space-y-4 overflow-y-auto">
            {/* Tree Operations Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-500 uppercase tracking-wider">Tree Operations</h3>
              <div className="space-y-2">
                {[
                  {
                    id: 'insert' as const,
                    label: 'Insert',
                    icon: Plus,
                    colorStyles: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/20',
                  },
                  {
                    id: 'search' as const,
                    label: 'Search',
                    icon: Search,
                    colorStyles: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 dark:hover:bg-blue-500/20',
                  },
                  {
                    id: 'update' as const,
                    label: 'Update',
                    icon: Edit,
                    colorStyles: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 dark:hover:bg-amber-500/20',
                  },
                  {
                    id: 'delete' as const,
                    label: 'Delete',
                    icon: Trash2,
                    colorStyles: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20',
                  },
                  {
                    id: 'range' as const,
                    label: 'Range Query',
                    icon: ArrowLeftRight,
                    colorStyles: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:border-violet-300 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 dark:hover:bg-purple-500/20',
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


            {/* Cache Stats */}
            <CollapsibleSection title="Cache Statistics" defaultOpen={false}>
              <div className="space-y-1">
                <StatRow
                  label="Size"
                  value={`${cacheStats.size} / ${cacheStats.maxSize}`}
                  variant="default"
                />
                <StatRow
                  label="Hits"
                  value={cacheStats.hits}
                  variant="success"
                />
                <StatRow
                  label="Misses"
                  value={cacheStats.misses}
                  variant="danger"
                />
                <StatRow
                  label="Hit Rate"
                  value={
                    cacheStats.hits + cacheStats.misses > 0
                      ? `${Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)}%`
                      : '0%'
                  }
                  variant="success"
                />
                <StatRow
                  label="Evictions"
                  value={cacheStats.evictions}
                  variant="warning"
                />
              </div>
            </CollapsibleSection>

            {/* Tree Config */}
            {treeConfig && (
              <CollapsibleSection title="Tree Configuration" defaultOpen={false}>
                <div className="space-y-1">
                  <StatRow
                    label="Order"
                    value={treeConfig.order}
                    variant="default"
                  />
                  <StatRow
                    label="Page Size"
                    value={`${treeConfig.pageSize} bytes`}
                    variant="default"
                  />
                  <StatRow
                    label="Cache Size"
                    value={`${treeConfig.cacheSize} pages`}
                    variant="default"
                  />
                  <StatRow
                    label="WAL"
                    value={treeConfig.walEnabled ? 'Enabled' : 'Disabled'}
                    variant={treeConfig.walEnabled ? 'success' : 'danger'}
                  />
                  <StatRow
                    label="Root Page"
                    value={treeConfig.rootPageId}
                    variant="default"
                  />
                  <StatRow
                    label="Height"
                    value={treeConfig.height}
                    variant="default"
                  />
                </div>
              </CollapsibleSection>
            )}

            {/* System Log */}
            <CollapsibleSection title="System Log" defaultOpen={true}>
              <SystemLog
                logs={logs}
                onFullView={() => setFullLogsOpen(true)}
                onDownload={() => {
                  const csvHeaders = ['Timestamp', 'Type', 'Operation', 'Message', 'Steps Count', 'Steps Details'];
                  const csvRows = logs.map(log => {
                    const timestamp = log.timestamp.toISOString();
                    const type = log.type;
                    const operation = log.operation || '';
                    const message = log.message.replace(/"/g, '""');
                    const stepsCount = log.steps?.length || 0;
                    const stepsDetails = log.steps?.map((step) => {
                      const stepNum = String(step.step_id || 0).padStart(3, '0');
                      const nodeId = step.node_id || step.nodeId || 'unknown';
                      let stepStr = `[${stepNum}] ${step.type}`;
                      if (nodeId !== 'unknown') stepStr += ` → ${nodeId}`;
                      if (step.depth !== undefined) stepStr += ` (depth: ${step.depth})`;
                      if (step.target_id) stepStr += ` → target: ${step.target_id}`;
                      const key = step.key || step.highlightKey;
                      if (key) {
                        const keyStr = formatKey(key);
                        if (keyStr) {
                          stepStr += ` | Key: ${keyStr}`;
                        }
                      }
                      if (step.metadata && Object.keys(step.metadata).length > 0) {
                        const metaStr = Object.entries(step.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ');
                        stepStr += ` | ${metaStr}`;
                      }
                      return stepStr;
                    }).join('; ') || '';
                    
                    return [timestamp, type, operation, message, stepsCount, stepsDetails]
                      .map(field => `"${String(field).replace(/"/g, '""')}"`)
                      .join(',');
                  });

                  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `system-log-${dbName}-${tableName}-${new Date().toISOString().split('T')[0]}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
              />
            </CollapsibleSection>
          </div>

          {/* Center - Visualization or Data View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {showVisualizer && treeData && (
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
                  schema={schema || undefined}
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
              schema={schema || undefined}
              onClear={() => setQueryResult(null)}
              fullHeight={!showVisualizer}
              isLockedOpen={!showVisualizer}
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
          schema={schema || undefined}
          onSubmit={(rowData, startKeyData, endKeyData) => {
            if (currentOperation === 'range') {
              handleExecuteOperation(currentOperation, { startKey: startKeyData, endKey: endKeyData });
            } else if (currentOperation === 'search' || currentOperation === 'delete') {
              handleExecuteOperation(currentOperation, startKeyData);
            } else {
              handleExecuteOperation(currentOperation, rowData);
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
