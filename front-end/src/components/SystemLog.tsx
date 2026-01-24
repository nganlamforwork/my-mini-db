import React, { useEffect, useRef, useState } from 'react';
import type { LogEntry, VisualizationStep, StepAction } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Maximize2, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SystemLogProps {
  logs: LogEntry[];
  fullView?: boolean; // If true, use full height (for dialog), otherwise use compact height (for sidebar)
  onFullView?: () => void; // Callback for opening full view (deprecated - using internal state now)
  onDownload?: () => void; // Callback for downloading logs
  currentStep?: number; // Current visualization step to limit display
}

const getStepColor = (stepAction: StepAction): string => {
  switch (stepAction) {
    case 'NODE_VISIT':
      return 'text-[#0969da] dark:text-[#58a6ff]'; // Blue
    case 'INSERT_LEAF':
    case 'INSERT_INTERNAL':
      return 'text-emerald-600 dark:text-emerald-400'; // Green
    case 'COMPARE_RANGE':
      return 'text-yellow-600 dark:text-yellow-400'; // Amber/Yellow
    case 'CHECK_OVERFLOW':
      return 'text-orange-600 dark:text-orange-400'; // Orange
    case 'SPLIT_NODE':
      return 'text-purple-600 dark:text-purple-400'; // Purple
    case 'CREATE_ROOT':
      return 'text-pink-600 dark:text-pink-400'; // Pink
    case 'SCAN_KEYS':
    case 'FIND_POS':
      return 'text-cyan-600 dark:text-cyan-400'; // Cyan
    default:
      return 'text-[#656d76] dark:text-[#6e7681]'; // Gray
  }
};

const formatStep = (step: VisualizationStep, index: number): string => {
  const stepNum = String(step.step || index + 1).padStart(2, '0');
  
  // New steps have explicit description field
  if (step.description) {
    return `[${stepNum}] ${step.description}`;
  }
  
  return `[${stepNum}] ${step.action}`;
};

export const SystemLog: React.FC<SystemLogProps> = ({ logs, fullView = false, onDownload, currentStep }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fullViewScrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullViewContentRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogCountRef = useRef(0);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);

  // Auto-scroll when logs change (only if user was at bottom or new log was added)
  useEffect(() => {
    const hasNewLogs = logs.length > lastLogCountRef.current;
    lastLogCountRef.current = logs.length;

    const scrollToBottom = (container: HTMLDivElement | null) => {
      if (container) {
        // Always scroll to bottom if new logs were added, otherwise only if user was at bottom
        if (hasNewLogs || (wasAtBottomRef.current && !isUserScrollingRef.current)) {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    // Check if we're at bottom before scrolling
    const activeContainer = isFullViewOpen ? fullViewScrollContainerRef.current : scrollContainerRef.current;
    if (activeContainer) {
      const { scrollTop, scrollHeight, clientHeight } = activeContainer;
      wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }

    // Delay auto-scroll slightly to ensure DOM is updated
    scrollTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom(scrollContainerRef.current);
          scrollToBottom(fullViewScrollContainerRef.current);
        });
      });
    }, 0);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [logs, isFullViewOpen]);

  // Track user scroll behavior for both containers
  useEffect(() => {
    const containers = [scrollContainerRef.current, fullViewScrollContainerRef.current].filter(Boolean) as HTMLDivElement[];

    const handleScroll = (container: HTMLDivElement) => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      wasAtBottomRef.current = isAtBottom;
      
      // Clear any pending auto-scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      
      // Reset user scrolling flag after a delay
      isUserScrollingRef.current = false;
    };

    const handleWheel = () => {
      isUserScrollingRef.current = true;
      wasAtBottomRef.current = false;
    };

    const cleanupFunctions = containers.map(container => {
      const scrollHandler = () => handleScroll(container);
      container.addEventListener('scroll', scrollHandler, { passive: true });
      container.addEventListener('wheel', handleWheel, { passive: true });
      
      return () => {
        container.removeEventListener('scroll', scrollHandler);
        container.removeEventListener('wheel', handleWheel);
      };
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [isFullViewOpen]);

  const LogContent = ({ containerRef, contentRef, isFullView }: { containerRef: React.RefObject<HTMLDivElement | null>, contentRef: React.RefObject<HTMLDivElement | null>, isFullView: boolean }) => (
    <div
      ref={containerRef}
      className={`${isFullView ? 'h-full' : 'flex-1 min-h-0'} bg-gray-50 dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-gray-800 overflow-y-auto relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-600`}
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent',
      }}
    >
      {/* Maximize Icon (only in sidebar view) */}
      {!isFullView && (
        <button
          onClick={() => setIsFullViewOpen(true)}
          className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Open full view"
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
        </button>
      )}
      
      <div ref={contentRef} className={`font-mono text-[11px] space-y-0.5 text-[#24292f] dark:text-gray-300 min-h-full ${isFullView ? 'p-4' : 'p-3 pt-8'}`}>
        {logs.length === 0 ? (
          <div className="text-[#656d76] dark:text-gray-500 italic tracking-wider">Waiting for system events...</div>
        ) : (
          logs.map(log => {
             // Filter steps if currentStep is provided
             const visibleSteps = log.steps 
                ? (currentStep !== undefined 
                    ? log.steps.filter(s => (s.step || 0) <= currentStep)
                    : log.steps)
                : undefined;

             // If log has steps but none are visible, and it's not a generic message, maybe we should hide it?
             if (log.steps && log.steps.length > 0 && visibleSteps && visibleSteps.length === 0) {
                 return null;
             }

             return (
            <div key={log.id} className="space-y-0.5">
              {/* Main log message */}
              <div className="flex gap-2 items-start">
                <span className="text-[#656d76] dark:text-gray-500">{'>'}</span>
                <span className={`text-left ${
                  log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 
                  log.type === 'error' ? 'text-red-600 dark:text-red-400' : 
                  log.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-[#0969da] dark:text-[#58a6ff]'
                }`}>
                  {log.message}
                </span>
              </div>
              
              {/* Execution steps */}
              {visibleSteps && visibleSteps.length > 0 && (
                <div className="ml-8 space-y-0.5">
                  {visibleSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={`${getStepColor(step.action)} font-mono text-[10px]`}
                    >
                      {formatStep(step, idx)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          })
        )}
        <div className="mt-1 flex items-center gap-1">
          <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">_</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={`${fullView ? 'h-full max-h-[80vh]' : 'flex-1 min-h-0'} flex flex-col`}>
        <LogContent containerRef={scrollContainerRef} contentRef={contentRef} isFullView={fullView} />
      </div>

      {/* Full View Dialog */}
      {!fullView && (
        <Dialog open={isFullViewOpen} onOpenChange={setIsFullViewOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex flex-col items-start gap-2 justify-between ">
              <DialogTitle>System Log History</DialogTitle>
              {onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDownload}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export to CSV
                </Button>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-hidden min-h-0">
              <LogContent containerRef={fullViewScrollContainerRef} contentRef={fullViewContentRef} isFullView={true} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
