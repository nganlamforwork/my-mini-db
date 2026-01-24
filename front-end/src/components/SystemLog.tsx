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
  fullView?: boolean;
  onFullView?: () => void;
  onDownload?: () => void;
  currentStep?: number;
}

const getStepColor = (stepAction: StepAction): string => {
  switch (stepAction) {
    case 'NODE_VISIT':
      return 'text-[#0969da] dark:text-[#58a6ff]';
    case 'INSERT_LEAF':
    case 'INSERT_INTERNAL':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'COMPARE_RANGE':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'CHECK_OVERFLOW':
      return 'text-orange-600 dark:text-orange-400';
    case 'SPLIT_NODE':
      return 'text-purple-600 dark:text-purple-400';
    case 'CREATE_ROOT':
      return 'text-pink-600 dark:text-pink-400';
    case 'SCAN_KEYS':
    case 'FIND_POS':
      return 'text-cyan-600 dark:text-cyan-400';
    default:
      return 'text-[#656d76] dark:text-[#6e7681]';
  }
};

const formatStep = (step: VisualizationStep, index: number): string => {
  const stepNum = String(step.step || index + 1).padStart(2, '0');
  if (step.description) {
    return `[${stepNum}] ${step.description}`;
  }
  return `[${stepNum}] ${step.action}`;
};

// Extracted LogContent to prevent remounting issues
interface LogContentProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isFullView: boolean;
  logs: LogEntry[];
  currentStep?: number;
  onMaximize?: () => void;
}

const LogContent: React.FC<LogContentProps> = ({ 
  containerRef, 
  contentRef, 
  isFullView, 
  logs, 
  currentStep, 
  onMaximize 
}) => {
  return (
    <div
      ref={containerRef}
      className={`${isFullView ? 'h-full' : 'flex-1 min-h-0'} bg-gray-50 dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-gray-800 overflow-y-auto relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-gray-700 hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-600`}
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent',
      }}
    >
      {!isFullView && onMaximize && (
        <button
          onClick={onMaximize}
          className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Open full view"
        >
          <Maximize2 className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
        </button>
      )}
      
      <div ref={contentRef} className={`font-mono text-[11px] space-y-0.5 text-[#24292f] dark:text-gray-300 min-h-full ${isFullView ? 'p-4' : 'p-3 pt-8'}`}>
        {logs.length === 0 ? (
          <div className="text-[#656d76] dark:text-gray-500 italic tracking-wider text-left">Waiting for system events...</div>
        ) : (
          logs.map(log => {
             const visibleSteps = log.steps 
                ? (currentStep !== undefined 
                    ? log.steps.filter(s => (s.step || 0) <= currentStep)
                    : log.steps)
                : undefined;

             if (log.steps && log.steps.length > 0 && visibleSteps && visibleSteps.length === 0) {
                 return null;
             }

             return (
            <div key={log.id} className="space-y-0.5 text-left">
              <div className="flex gap-2 items-start text-left">
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
              
              {visibleSteps && visibleSteps.length > 0 && (
                <div className="ml-4 space-y-0.5 text-left">
                  {visibleSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className={`${getStepColor(step.action)} font-mono text-[10px] text-left`}
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
};

export const SystemLog: React.FC<SystemLogProps> = ({ logs, fullView = false, onDownload, currentStep }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fullViewScrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullViewContentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogCountRef = useRef(0);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);

  // Auto-scroll logic
  useEffect(() => {
    const hasNewLogs = logs.length > lastLogCountRef.current;
    lastLogCountRef.current = logs.length;

    const scrollToBottom = (container: HTMLDivElement | null) => {
      if (container) {
        if (wasAtBottomRef.current || hasNewLogs) {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    // Logic relies on wasAtBottomRef being updated by scroll listener
    // We trust the ref to know if user was at bottom before this update.

    scrollTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
            scrollToBottom(scrollContainerRef.current);
            scrollToBottom(fullViewScrollContainerRef.current);
        });
    }, 100);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [logs, isFullViewOpen]); 

  // Scroll tracking
  useEffect(() => {
    const containers = [scrollContainerRef.current, fullViewScrollContainerRef.current].filter(Boolean) as HTMLDivElement[];

    const handleScroll = (container: HTMLDivElement) => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 20; 
      wasAtBottomRef.current = isAtBottom;
    };

    const cleanupFunctions = containers.map(container => {
      const scrollHandler = () => handleScroll(container);
      container.addEventListener('scroll', scrollHandler, { passive: true });
      return () => container.removeEventListener('scroll', scrollHandler);
    });

    return () => cleanupFunctions.forEach(c => c());
  }, [isFullViewOpen]);

  return (
    <>
      <div className={`${fullView ? 'h-full max-h-[80vh]' : 'flex-1 min-h-0'} flex flex-col`}>
        <LogContent 
          containerRef={scrollContainerRef} 
          contentRef={contentRef} 
          isFullView={fullView} 
          logs={logs}
          currentStep={currentStep}
          onMaximize={() => setIsFullViewOpen(true)}
        />
      </div>

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
               <LogContent 
                  containerRef={fullViewScrollContainerRef} 
                  contentRef={fullViewContentRef} 
                  isFullView={true} 
                  logs={logs}
                  currentStep={currentStep}
                />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
