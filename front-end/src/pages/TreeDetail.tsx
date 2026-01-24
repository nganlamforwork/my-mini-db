import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { TreeCanvas } from "@/components/tree-visualizer/TreeCanvas";
import { Button } from "@/components/ui/button";
import { OperationDialog } from "@/components/OperationDialog";
import { OperationHelpDialog } from "@/components/OperationHelpDialog";
import { SystemLog } from "@/components/SystemLog";
import {
  QueryResultPanel,
  type QueryResult,
} from "@/components/QueryResultPanel";
import {
  InitDialog,
  ClearTreeDialog,
  FullLogsDialog,
} from "@/components/dialogs";
import type { LogEntry, TreeStructure, VisualizationStep } from "@/types/database";
import { api } from "@/lib/api";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Sun,
  Moon,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { IconSwitch } from "@/components/ui/icon-switch";

// CollapsibleSection component wrapper for sidebar sections
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  icon: Icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex-1 min-h-0 flex flex-col"
    >
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

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem("theme") as "light" | "dark" | null;
  if (stored) return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function TreeDetail() {
  const navigate = useNavigate();
  const { treeName: treeNameParam } = useParams<{ treeName?: string }>();
  const [treeName, setTreeName] = useState<string>("");
  const [treeData, setTreeData] = useState<TreeStructure | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fullLogsOpen, setFullLogsOpen] = useState(false);
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<
    "insert" | "search" | "update" | "delete" | "range" | null
  >(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [operationHelpOpen, setOperationHelpOpen] = useState(false);
  const [clearTreeDialogOpen, setClearTreeDialogOpen] = useState(false);
  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const hasLoggedInitialLoadRef = useRef(false);
  // Pending operation state (waiting for visualization to complete)
  const [pendingOperation, setPendingOperation] = useState<{
    response: any;
    operation: string;
    startTime?: number;
  } | null>(null);

  // Initial Theme
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  // Playback State
  const [playbackStep, setPlaybackStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("minidb-playback-speed");
      if (stored) return parseFloat(stored);
    }
    return 0.5;
  });

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    localStorage.setItem("minidb-playback-speed", speed.toString());
  };

  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Query result state
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const getCurrentMaxSteps = () => {
    if (logs.length === 0) return 0;
    const lastLog = logs[logs.length - 1];
    return lastLog.steps?.length || 0;
  };

  // Ref to prevent double-firing of finalization
  const isFinalizingRef = useRef(false);

  // Finalize the operation after visualization completes
  const finishPendingOperation = async () => {
    if (!pendingOperation || isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    const { response, operation, startTime } = pendingOperation;
    // Clear pending operation immediately


    const executionTime = startTime ? Date.now() - startTime : undefined;
    
    let isSuccess = response.success;
    let message = "Operation completed.";
    
    // Helper to format value
    const formatValue = (v: any) => {
      if (!v) return "null";
      // Handle various structures (Key object with values, or Row object with columns)
      const parts = v.values || v.columns;
      if (Array.isArray(parts)) {
        const joined = parts.map((p: any) => p.value).join(", ");
        return `(${joined})`;
      }
      return JSON.stringify(v);
    };

    // Determine success/failure specifics for logging/results
    if (operation === "SEARCH") {
      if (response.value) {
        isSuccess = true;
        message = `Search completed. Found value: ${formatValue(response.value)}.`;
      } else {
        // Search "failed" to find key
        isSuccess = false; 
        message = `Search completed. Key not found.`;
      }
    } else if (operation === "INSERT") {
       if (isSuccess) message = `Key inserted successfully.`;
       else message = `Insert failed: ${response.error || "Unknown error"}`;
    } else {
       if (isSuccess) message = `${operation} completed successfully.`;
       else message = `${operation} failed: ${response.error || "Unknown error"}`;
    }

    // Set query result
    setQueryResult({
      operation: operation as any,
      success: isSuccess,
      message: message,
      executionTime,
      key: response.key,
      value: response.values || response.value,
      timestamp: new Date(),
      error: !isSuccess ? (response.error || "Not found") : undefined
    });

    // Add Completion Log
    addLog(
       message,
       isSuccess ? "success" : "error",
       [], 
       operation as LogEntry["operation"]
    );
    
    if (isSuccess) {
        toast.success(message);
    } else {
        toast.error(message);
    }

    // Delay highlight removal and Tree Update to let user see the final state for 3s
    setTimeout(async () => {
       await loadTreeStructure();
       // Clear pending operation ONLY after tree is reloaded and we are ready to switch
       setPendingOperation(null);
       // Set to a high number to show all logs but match no specific step (clearing highlights)
       setPlaybackStep(Number.MAX_SAFE_INTEGER);
       isFinalizingRef.current = false; // Reset for safety, though handled on new op usually
    }, 3000);
  };
  
 // ... (rest of file) ...
 


  const addLog = (
    message: string,
    type: LogEntry["type"] = "info",
    steps?: any[],
    operation?: LogEntry["operation"],
  ) => {
    setLogs((prev) => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        message,
        type,
        steps,
        operation,
      };

      const updated = [...prev, newLog];
      return updated.slice(-50);
    });

    if (steps && steps.length > 0) {
      // Reset playback for new detailed operation
      setPlaybackStep(0); // Start at 0. User must click Start.
      setIsPlaying(false); // Do NOT auto-start.
    }
  };

  // Derived logs for display (filtering steps for the last log based on playback)
  const displayLogs = useMemo(() => {
    return logs.map((log, index) => {
      // Only filter the LATEST log if it has steps
      if (index === logs.length - 1 && log.steps && log.steps.length > 0) {
        return {
          ...log,
          // Show items with step index <= playbackStep
          // Note: VisualizationStep.step is likely 1-based.
          steps: log.steps.filter((s) => (s.step || 0) <= playbackStep)
        };
      }
      return log;
    });
  }, [logs, playbackStep]);

  // Calculate the active step object for the canvas visualization
  const activeStep = useMemo(() => {
    // 1. Initial State: Before playback starts
    if (playbackStep === 0) return undefined;

    // 2. Pending Operation Source (Priority)
    // If we have a pending operation (even if waiting for cleanup), use its steps.
    // This allows us to persist the state even after the main logs have updated with "Success".
    const steps = pendingOperation?.response?.steps || (logs.length > 0 ? logs[logs.length - 1].steps : []);
    
    if (!steps || steps.length === 0) return undefined;

    // 3. Find matching step
    const step = steps.find((s: VisualizationStep) => s.step === playbackStep);
    
    // 4. End State Persistence
    // If we are past the last step (animation finished), return the LAST step
    // so the visualization holds its final state until pendingOperation is cleared.
    if (!step && playbackStep > steps.length) {
        return steps[steps.length - 1];
    }
    
    return step;
  }, [logs, playbackStep, pendingOperation]);

  // Animation Loop
  useEffect(() => {
    if (isPlaying) {
      const maxSteps = getCurrentMaxSteps();
      
      if (playbackStep >= maxSteps) {
        setIsPlaying(false);
        finishPendingOperation();
        return;
      }

      const delay = 1000 / playbackSpeed; 
      
      playbackTimeoutRef.current = setTimeout(() => {
        setPlaybackStep(prev => {
          const next = prev + 1;
          if (next >= maxSteps) {
             setIsPlaying(false);
             finishPendingOperation();
          }
          return next;
        });
      }, delay);
    }

    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, [isPlaying, playbackStep, logs, playbackSpeed, pendingOperation]); // Added pendingOperation dep



  // Helper to format key for display
  const formatKeyForMessage = (key?: {
    values: Array<{ type: string; value: any }>;
  }): string => {
    if (!key || !key.values || key.values.length === 0) return "";
    if (key.values.length === 1) {
      return String(key.values[0].value);
    }
    return `(${key.values.map((v) => String(v.value)).join(", ")})`;
  };

  // Initialize tree name from URL or current
  useEffect(() => {
    if (treeNameParam) {
      const decodedName = decodeURIComponent(treeNameParam);
      // Verify tree exists
      const allTrees = api.listTrees();
      if (!allTrees.includes(decodedName)) {
        // Tree doesn't exist, redirect to home
        toast.error("Tree not found");
        navigate("/", { replace: true });
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
        navigate("/", { replace: true });
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
        addLog(`B+ Tree root located at Page #${tree.rootPage}`, "success");
        addLog(`Tree height: ${tree.height}`, "info");
      }
    } catch (error) {
      console.error("Failed to load tree structure:", error);
    }
  };

  // Handle operation response - defer update until visualization completes
  const handleOperationResponse = async (
    response: any,
    operation: string,
    startTime?: number,
  ) => {
    const executionTime = startTime ? Date.now() - startTime : undefined;

    // If we have visualization steps, we enter "Pending/Visualizing" mode generally
    // regardless of whether the logical operation "succeeded" (e.g. Search Found) or "failed" (e.g. Not Found).
    if (response.steps && response.steps.length > 0) {
      // Store pending operation to finalize later (after visualization)
      setPendingOperation({
        response,
        operation,
        startTime,
      });

      // Log the start of the visualization sequence
      addLog(
        `${operation} operation started - Click Start to visualize`,
        "info",
        response.steps, 
        operation as LogEntry["operation"],
      );
      
      // We wait for user to click play. 
      // The "Play" button will pulse because pendingOperation is set.
      
    } else {
      // No visualization steps (e.g. pure error, or instant op). Handle immediately.
      if (response.success) {
        await loadTreeStructure();
        addLog(
          `${operation} operation completed successfully`,
          "success",
          [], 
          operation as LogEntry["operation"],
        );
        // ... (We could duplicate the SetQueryResult logic here for instant ops, but usually we have steps)
         toast.success("Operation completed");
      } else {
        // Operation failed without steps
        addLog(
          `${operation} operation failed: ${response.error || "Unknown error"}`,
          "error",
          [],
          operation as LogEntry["operation"],
        );
        toast.error(response.error || "Operation failed");
      }
      
      // Set generic query result for immediate non-visual ops
      setQueryResult({
        operation: operation as any,
        success: response.success,
        message: response.success ? "Operation completed" : (response.error || "Failed"),
        executionTime,
        error: response.error,
        timestamp: new Date(),
      });
    }
  };

  // Theme management
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load tree when treeName changes
  useEffect(() => {
    if (treeName) {
      hasLoggedInitialLoadRef.current = false;
      loadTreeStructure();
    }
  }, [treeName]);

  // Handle operation execution
  const handleExecuteOperation = async (
    operation: "insert" | "search" | "update" | "delete" | "range",
    data: any,
  ) => {
    if (!treeName) {
      toast.error("No tree selected");
      return;
    }

    const startTime = Date.now();
    setOperationDialogOpen(false);

    try {
      let response: any;

      // Temporarily inject dummy steps logic if API doesn't return them yet 
      // (Depends if backend is ready. Assuming backend returns response.steps)
      
      switch (operation) {
        case "insert":
          response = await api.insert(treeName, data.key, data.value);
          break;
        case "update":
          response = await api.update(treeName, data.key, data.value);
          break;
        case "delete":
          response = await api.delete(treeName, data.key);
          break;
        case "search":
          response = await api.search(treeName, data.key);
          break;
        case "range":
          response = await api.rangeQuery(treeName, data.startKey, data.endKey);
          break;
      }

      await handleOperationResponse(
        response,
        operation.toUpperCase(),
        startTime,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Operation failed";
      toast.error(errorMessage);
      addLog(
        `${operation.toUpperCase()} operation failed: ${errorMessage}`,
        "error",
      );
    }
  };

  const handleClearTree = () => {
    if (!treeName) {
      toast.error("No tree selected");
      return;
    }

    api.clearTree(treeName);
    api.initTree(treeName);
    setTreeData(api.initTree(treeName));
    setLogs([]);
    setQueryResult(null);
    hasLoggedInitialLoadRef.current = false;
    setClearTreeDialogOpen(false);
    toast.success("Tree cleared");
  };

  const handleInitWithRandom = async (count: number) => {
    if (!treeName) {
      toast.error("No tree selected");
      return;
    }
    const res = api.initWithRandomData(treeName, count);
    if (!res.success) {
      toast.error(res.error ?? "Init failed");
      return;
    }
    setLogs([]);
    setQueryResult(null);
    hasLoggedInitialLoadRef.current = false;
    await loadTreeStructure();
    addLog(`Tree initialized with ${count} random items`, "success");
    toast.success(`Initialized with ${count} random items`);
  };

  // Playback Handlers
  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause: Stop and Rewind to previous step (rollback animation)
      setIsPlaying(false);
      setPlaybackStep((prev) => Math.max(0, prev - 1));
    } else {
      // Play: Start (from 0 if pending, or resume)
      setIsPlaying(true);
    }
  };
  
  // onStepForward/Back removed as per request

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Simple Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
          </Button>
          {treeName && (
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-bold">{treeName}</h1>
              <span className="text-sm text-muted-foreground">
                <b>Order:</b> 4
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="pink"
            size="sm"
            onClick={() => setInitDialogOpen(true)}
            startIcon={<Sparkles className="h-4 w-4" />}
          >
            Init
          </Button>
          <ClearTreeDialog
            open={clearTreeDialogOpen}
            onOpenChange={setClearTreeDialogOpen}
            onConfirm={handleClearTree}
          />
          <IconSwitch
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase text-left">
                  Tree Operations
                </h3>
                <button
                  onClick={() => setOperationHelpOpen(true)}
                  className="p-1 rounded hover:bg-accent transition-colors"
                  title="View operation algorithms"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  {
                    id: "insert" as const,
                    label: "Insert",
                    icon: Plus,
                    variant: "emerald" as const,
                  },
                  {
                    id: "search" as const,
                    label: "Search",
                    icon: Search,
                    variant: "blue" as const,
                  },
                  {
                    id: "update" as const,
                    label: "Update",
                    icon: Edit,
                    variant: "amber" as const,
                  },
                  {
                    id: "delete" as const,
                    label: "Delete",
                    icon: Trash2,
                    variant: "red" as const,
                  },
                  {
                    id: "range" as const,
                    label: "Range Query",
                    icon: ArrowLeftRight,
                    variant: "violet" as const,
                  },
                ].map((operation) => {
                  const IconComponent = operation.icon;
                  return (
                      <Button
                        key={operation.id}
                        variant={operation.variant}
                        className="w-full justify-start transition-all duration-200 active:scale-95"
                        onClick={() => {
                          setCurrentOperation(operation.id);
                          setOperationDialogOpen(true);
                        }}
                        startIcon={<IconComponent className="h-4 w-4" />}
                      >
                        {operation.label}
                      </Button>
                  );
                })}
              </div>
            </div>

            {/* System Log */}
            <div className="flex-1 min-h-0 flex flex-col mt-2">
              <CollapsibleSection title="System Log" defaultOpen={true}>
                <div className="flex-1 min-h-0 flex flex-col">
                  <SystemLog
                    logs={displayLogs}
                    fullView={false}
                    onFullView={() => setFullLogsOpen(true)}
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
                   // Playback Props
                   isPlaying={isPlaying}
                   onPlayPause={handlePlayPause}
                   playbackSpeed={playbackSpeed}
                   onPlaybackSpeedChange={handlePlaybackSpeedChange}

                   activeStep={activeStep}
                   steps={pendingOperation?.response?.steps} // Pass full steps for cumulative state
                   hasPendingOperation={!!pendingOperation}
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
            if (currentOperation === "range") {
              // startKeyData and endKeyData are CompositeKey objects
              handleExecuteOperation(currentOperation, {
                startKey: startKeyData,
                endKey: endKeyData,
              });
            } else if (
              currentOperation === "search" ||
              currentOperation === "delete"
            ) {
              // startKeyData is a CompositeKey object
              handleExecuteOperation(currentOperation, { key: startKeyData });
            } else if (rowData && rowData.key) {
              // rowData has key and value
              handleExecuteOperation(currentOperation, {
                key: rowData.key,
                value: rowData.value,
              });
            }
          }}
        />
      )}

      {/* Help Dialog */}
      <OperationHelpDialog
        open={helpDialogOpen}
        onOpenChange={setHelpDialogOpen}
        operation={currentOperation || "insert"}
      />

      {/* Operations Section Help Dialog */}
      <OperationHelpDialog
        open={operationHelpOpen}
        onOpenChange={setOperationHelpOpen}
        operation={currentOperation || "insert"}
      />

      {/* Full Logs Dialog */}
      <FullLogsDialog
        open={fullLogsOpen}
        onOpenChange={setFullLogsOpen}
        logs={logs}
      />

      {/* Init with random data Dialog */}
      <InitDialog
        open={initDialogOpen}
        onOpenChange={setInitDialogOpen}
        onInit={handleInitWithRandom}
        defaultCount={15}
      />
    </div>
  );
}
