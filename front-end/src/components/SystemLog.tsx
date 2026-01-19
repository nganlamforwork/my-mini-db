import React, { useEffect, useRef } from 'react';
import type { LogEntry, ExecutionStep } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SystemLogProps {
  logs: LogEntry[];
  fullView?: boolean; // If true, use full height (for dialog), otherwise use compact height (for sidebar)
}

const getStepColor = (stepType: string): string => {
  switch (stepType) {
    case 'TRAVERSE_NODE':
      return 'text-[#0969da] dark:text-[#58a6ff]'; // Blue
    case 'INSERT_KEY':
      return 'text-emerald-600 dark:text-emerald-400'; // Green
    case 'UPDATE_KEY':
      return 'text-yellow-600 dark:text-yellow-400'; // Amber/Yellow
    case 'DELETE_KEY':
      return 'text-red-600 dark:text-red-400'; // Red
    case 'SPLIT_NODE':
      return 'text-purple-600 dark:text-purple-400'; // Purple
    case 'MERGE_NODE':
      return 'text-pink-600 dark:text-pink-400'; // Pink
    case 'BORROW_FROM_LEFT':
    case 'BORROW_FROM_RIGHT':
      return 'text-cyan-600 dark:text-cyan-400'; // Cyan
    case 'WAL_APPEND':
      return 'text-yellow-600 dark:text-yellow-400'; // Yellow
    case 'PAGE_LOAD':
    case 'PAGE_FLUSH':
      return 'text-[#656d76] dark:text-[#6e7681]'; // Gray
    case 'CACHE_HIT':
      return 'text-emerald-600 dark:text-emerald-400'; // Green
    case 'CACHE_MISS':
      return 'text-orange-600 dark:text-orange-400'; // Orange
    case 'EVICT_PAGE':
      return 'text-rose-600 dark:text-rose-400'; // Rose
    default:
      return 'text-[#656d76] dark:text-[#6e7681]'; // Gray
  }
};

const formatStep = (step: ExecutionStep, index: number): string => {
  const stepNum = String(index + 1).padStart(3, '0');
  let message = `[${stepNum}] ${step.type}`;
  
  if (step.nodeId) {
    message += ` → ${step.nodeId}`;
  }
  
  if (step.pageId !== undefined) {
    message += ` (Page #${step.pageId})`;
  }
  
  if (step.lsn !== undefined) {
    message += ` [LSN: ${step.lsn}]`;
  }
  
  if (step.key) {
    const keyStr = step.key.values.map(v => String(v.value)).join(', ');
    message += ` | Key: ${keyStr}`;
  }
  
  if (step.highlightKey) {
    const keyStr = step.highlightKey.values.map(v => String(v.value)).join(', ');
    message += ` | Highlight: ${keyStr}`;
  }
  
  return message;
};

export const SystemLog: React.FC<SystemLogProps> = ({ logs, fullView = false }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const wasAtBottomRef = useRef(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogCountRef = useRef(0);

  // Initialize viewport reference and event listeners
  useEffect(() => {
    const findViewport = () => {
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
        if (viewport && !viewportRef.current) {
          viewportRef.current = viewport;
          
          // Track user scroll behavior
          const handleScroll = () => {
            if (viewportRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
              const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
              wasAtBottomRef.current = isAtBottom;
              
              // Clear any pending auto-scroll
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = null;
              }
              
              // Reset user scrolling flag after a delay
              isUserScrollingRef.current = false;
            }
          };

          const handleWheel = () => {
            isUserScrollingRef.current = true;
            wasAtBottomRef.current = false;
          };

          const handleTouchMove = () => {
            isUserScrollingRef.current = true;
          };

          viewport.addEventListener('scroll', handleScroll, { passive: true });
          viewport.addEventListener('wheel', handleWheel, { passive: true });
          viewport.addEventListener('touchmove', handleTouchMove, { passive: true });

          return () => {
            viewport.removeEventListener('scroll', handleScroll);
            viewport.removeEventListener('wheel', handleWheel);
            viewport.removeEventListener('touchmove', handleTouchMove);
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
          };
        }
      }
      return undefined;
    };

    // Try to find viewport immediately and on next frame
    const cleanup1 = findViewport();
    const timeout = setTimeout(findViewport, 100);

    return () => {
      cleanup1?.();
      clearTimeout(timeout);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll when logs change (only if user was at bottom or new log was added)
  useEffect(() => {
    const hasNewLogs = logs.length > lastLogCountRef.current;
    lastLogCountRef.current = logs.length;

    const scrollToBottom = () => {
      if (viewportRef.current) {
        const viewport = viewportRef.current;
        // Always scroll to bottom if new logs were added, otherwise only if user was at bottom
        if (hasNewLogs || (wasAtBottomRef.current && !isUserScrollingRef.current)) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    };

    // Check if we're at bottom before scrolling
    if (viewportRef.current) {
      const viewport = viewportRef.current;
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }

    // Delay auto-scroll slightly to ensure DOM is updated
    scrollTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToBottom);
      });
    }, 0);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [logs]);

  return (
    <div className={`${fullView ? 'h-full max-h-[80vh]' : 'h-64'} bg-white dark:bg-[#0d1117] border border-[#d1d9e0] dark:border-[#30363d] rounded-lg flex flex-col overflow-hidden`}>
      <ScrollArea ref={scrollAreaRef} className="h-full">
          <div ref={contentRef} className="font-mono text-[11px] p-3 space-y-0.5 text-[#24292f] dark:text-[#c9d1d9]">
            {logs.length === 0 ? (
              <div className="text-[#656d76] dark:text-[#6e7681] italic tracking-wider">Waiting for system events...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="space-y-0.5">
                  {/* Main log message */}
                  <div className="flex gap-2 items-start">
                    <span className="text-[#656d76] dark:text-[#6e7681]">{'>'}</span>
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
                  {log.steps && log.steps.length > 0 && (
                    <div className="ml-8 space-y-0.5">
                      {log.steps.map((step, idx) => (
                        <div 
                          key={idx} 
                          className={`${getStepColor(step.type)} font-mono text-[10px]`}
                        >
                          {formatStep(step, idx)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">_</span>
            </div>
          </div>
        </ScrollArea>
    </div>
  );
};
