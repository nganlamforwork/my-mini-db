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
    
    // Compute visualization state based strictly on step semantics
    setState(prev => {
      let highlightedNodeId: number | null = prev.highlightedNodeId;
      let highlightedKey: { values: Array<{ type: string; value: any }> } | null = null;
      let overflowNodeId: number | null = prev.overflowNodeId;

      // Default: current node is the active node if we have a pageId
      if (pageId !== null) {
        highlightedNodeId = pageId;
      }

      switch (step.type) {
        case 'TRAVERSE_START':
        case 'NODE_VISIT':
          // Only highlight the node body (no key highlight)
          highlightedKey = null;
          break;

        case 'KEY_COMPARISON':
          // Highlight the compared key inside this node (blue in TreeCanvas)
          highlightedKey = (step.highlightKey || step.key) as any || null;
          break;

        case 'LEAF_FOUND':
          // Leaf found: highlight node only, keys stay normal
          highlightedKey = null;
          break;

        case 'INSERT_ENTRY':
          // Insert into leaf: use key for insert animation, but only in this leaf node
          highlightedKey = (step.key as any) || null;
          break;

        case 'PROMOTE_KEY': {
          // Promotion: highlight / animate key in the parent (target) node
          const targetId = step.target_id || step.targetNodeId;
          const targetPageId = extractPageId(targetId);
          highlightedNodeId = targetPageId !== null ? targetPageId : pageId;
          highlightedKey = (step.highlightKey || step.key) as any || null;
          break;
        }

        case 'OVERFLOW_DETECTED':
          // Overflow calc: highlight whole node + mark it as overflow
          overflowNodeId = pageId;
          highlightedKey = null;
          break;

        case 'REBALANCE_COMPLETE':
        case 'OPERATION_COMPLETE':
          // Balancing finished / operation done – clear overflow state, keep last node as context
          overflowNodeId = null;
          highlightedKey = null;
          break;

        default:
          // All other steps: node-level context only
          highlightedKey = null;
          break;
      }

      const newState: StepAnimatorState = {
        ...prev,
        currentStep: step,
        highlightedNodeId,
        highlightedKey,
        overflowNodeId,
      };

      return newState;
    });
    return visualTree;
  }, [extractPageId]);

  // Execute steps sequentially
  const executeSteps = useCallback(async (
    steps: ExecutionStep[],
    initialTree: TreeStructure | null
  ): Promise<void> => {
    
    setState(prev => {
      if (prev.isExecuting) {
        return prev;
      }
      const newState = {
        ...prev,
        isExecuting: true,
        visualTree: initialTree ? JSON.parse(JSON.stringify(initialTree)) : null,
      };
      return newState;
    });

    // Calculate delay based on animation speed (0-100 -> 2000ms to 200ms)
    const getStepDelay = () => {
      const delay = Math.max(200, 2000 - (animationSpeed * 18));
      return delay;
    };

    const stepDelay = getStepDelay();

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        if (!step.type || !step) {
          break;
        }
        
        // Play the step - update state
        setState(prev => {
          const newVisualTree = playStep(step, prev.visualTree);
          const updatedState = {
            ...prev,
            visualTree: newVisualTree,
          };
          return updatedState;
        });
        await new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          
          stepTimeoutRef.current = setTimeout(() => {
            resolve();
          }, stepDelay);

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

    } catch (error) {
      console.error('[executeSteps] ERROR: Exception during step execution:', error);
      console.error('[executeSteps] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
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
