import { useState, useCallback, useRef } from 'react';
import type { ExecutionStep, TreeStructure } from '@/types/database';

interface UseBTreeStepAnimatorOptions {
  animationSpeed: number; // 0-100
  onStepComplete?: () => void;
}

interface StepAnimatorState {
  isExecuting: boolean;
  currentStep: ExecutionStep | null;
  highlightedNodeId: number | null;
  highlightedKey: { values: Array<{ type: string; value: any }> } | null;
  overflowNodeId: number | null;
  visualTree: TreeStructure | null;
}

/**
 * Hook for animating B+Tree operations based on backend-provided steps.
 * This hook consumes steps directly from the backend and animates them sequentially.
 * No step reconstruction or inference is performed.
 */
export function useBTreeStepAnimator(options: UseBTreeStepAnimatorOptions) {
  const { animationSpeed } = options;
  
  const [state, setState] = useState<StepAnimatorState>({
    isExecuting: false,
    currentStep: null,
    highlightedNodeId: null,
    highlightedKey: null,
    overflowNodeId: null,
    visualTree: null,
  });

  const stepTimeoutRef = useRef<number | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  // Helper to extract page ID from node_id (e.g., "N2" -> 2, "page-9" -> 9)
  const extractPageId = useCallback((nodeId?: string | null): number | null => {
    if (!nodeId) return null;
    
    // Handle new format: "N2" -> 2
    if (nodeId.startsWith('N')) {
      const match = nodeId.match(/N(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }
    
    // Handle legacy format: "page-9" -> 9
    const match = nodeId.match(/page-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, []);

  // Play a single step
  const playStep = useCallback((step: ExecutionStep, visualTree: TreeStructure | null): TreeStructure | null => {
    // Extract node ID (support both new and legacy formats)
    const nodeId = step.node_id || step.nodeId;
    const pageId = extractPageId(nodeId);
    
    // Determine overflow state from step
    let overflowNodeId: number | null = null;
    if (step.type === 'OVERFLOW_DETECTED') {
      overflowNodeId = pageId;
    } else if (step.type === 'CHECK_OVERFLOW' || step.type === 'UNDERFLOW_DETECTED') {
      // Check metadata for overflow/underflow status
      const isOverflow = step.metadata?.is_overflow || step.isOverflow;
      overflowNodeId = isOverflow ? pageId : null;
    }
    
    // Update state for visualization
    setState(prev => ({
      ...prev,
      currentStep: step,
      highlightedNodeId: pageId,
      highlightedKey: step.key || step.highlightKey || null,
      overflowNodeId: overflowNodeId !== null ? overflowNodeId : 
        (step.type === 'NODE_SPLIT' || step.type === 'REBALANCE_COMPLETE' ? null : prev.overflowNodeId),
    }));

    // Visual tree updates are handled by syncing with actual tree after operation
    // We don't mutate visual tree during animation - backend steps are authoritative
    return visualTree;
  }, [extractPageId]);

  // Execute steps sequentially
  const executeSteps = useCallback(async (
    steps: ExecutionStep[],
    initialTree: TreeStructure | null
  ): Promise<void> => {
    setState(prev => {
      if (prev.isExecuting) {
        console.warn('Step execution already in progress, skipping');
        return prev;
      }
      return {
        ...prev,
        isExecuting: true,
        visualTree: initialTree ? JSON.parse(JSON.stringify(initialTree)) : null,
      };
    });

    // Calculate delay based on animation speed (0-100 -> 2000ms to 200ms)
    const getStepDelay = () => Math.max(200, 2000 - (animationSpeed * 18));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Play the step - update state
      setState(prev => {
        const newVisualTree = playStep(step, prev.visualTree);
        return {
          ...prev,
          visualTree: newVisualTree,
        };
      });

      // Wait for step animation delay
      await new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        
        stepTimeoutRef.current = setTimeout(() => {
          resolve();
        }, getStepDelay());

        // Store resolve for external call (e.g., from TreeCanvas)
        (window as any).__currentStepResolve = () => {
          if (stepTimeoutRef.current) {
            clearTimeout(stepTimeoutRef.current);
            stepTimeoutRef.current = null;
          }
          resolve();
        };
      });

      // Clean up
      if ((window as any).__currentStepResolve) {
        delete (window as any).__currentStepResolve;
      }
      resolveRef.current = null;
    }

    // Finalize: clear animation state
    setState(prev => ({
      ...prev,
      isExecuting: false,
      currentStep: null,
      highlightedNodeId: null,
      highlightedKey: null,
      overflowNodeId: null,
    }));
  }, [animationSpeed, playStep]);

  // Reset animation state
  const resetAnimation = useCallback(() => {
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
    
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }

    setState({
      isExecuting: false,
      currentStep: null,
      highlightedNodeId: null,
      highlightedKey: null,
      overflowNodeId: null,
      visualTree: null,
    });
  }, []);

  // Initialize visual tree
  const initializeVisualTree = useCallback((tree: TreeStructure) => {
    setState(prev => ({
      ...prev,
      visualTree: JSON.parse(JSON.stringify(tree)),
    }));
  }, []);

  // Sync visual tree with actual tree (for final state)
  const syncVisualTree = useCallback((tree: TreeStructure) => {
    setState(prev => ({
      ...prev,
      visualTree: JSON.parse(JSON.stringify(tree)),
    }));
  }, []);

  return {
    ...state,
    executeSteps,
    resetAnimation,
    initializeVisualTree,
    syncVisualTree,
  };
}
