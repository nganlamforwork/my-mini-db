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
    
    // VERBOSE LOGGING: Log step execution details
    console.log('[playStep] Executing step:', {
      stepIndex: step.step_id,
      type: step.type,
      nodeId: nodeId,
      pageId: pageId,
      targetId: step.target_id || step.targetNodeId,
      depth: step.depth,
      hasKey: !!(step.key || step.highlightKey),
      metadata: step.metadata,
      fullStep: step
    });
    
    // Check if target node exists in visual tree
    if (step.target_id || step.targetNodeId) {
      const targetNodeId = step.target_id || step.targetNodeId;
      const targetPageId = extractPageId(targetNodeId);
      if (targetPageId !== null && visualTree) {
        const targetNodeExists = visualTree.nodes && visualTree.nodes[targetPageId.toString()] !== undefined;
        if (!targetNodeExists) {
          console.warn(`[playStep] WARN: Target node ${targetNodeId} (pageId: ${targetPageId}) not found in visual tree!`, {
            availableNodes: visualTree.nodes ? Object.keys(visualTree.nodes) : [],
            rootPage: visualTree.rootPage
          });
        } else {
          console.log(`[playStep] Target node ${targetNodeId} (pageId: ${targetPageId}) found in visual tree`);
        }
      }
    }
    
    // Check if primary node exists in visual tree
    if (pageId !== null && visualTree) {
      const nodeExists = visualTree.nodes && visualTree.nodes[pageId.toString()] !== undefined;
      if (!nodeExists) {
        console.warn(`[playStep] WARN: Node ${nodeId} (pageId: ${pageId}) not found in visual tree!`, {
          availableNodes: visualTree.nodes ? Object.keys(visualTree.nodes) : [],
          rootPage: visualTree.rootPage,
          stepType: step.type
        });
      } else {
        console.log(`[playStep] Node ${nodeId} (pageId: ${pageId}) found in visual tree`);
      }
    }
    
    // Early return check: If visual tree is null and step requires tree access
    if (!visualTree && (pageId !== null || step.target_id || step.targetNodeId)) {
      console.warn(`[playStep] WARN: Returning early - visual tree is null but step requires tree access`, {
        stepType: step.type,
        stepId: step.step_id,
        pageId: pageId
      });
      // Still update state for visualization even if tree is null
    }
    
    // Determine overflow state from step
    let overflowNodeId: number | null = null;
    if (step.type === 'OVERFLOW_DETECTED') {
      overflowNodeId = pageId;
      console.log(`[playStep] Overflow detected for node ${pageId}`);
    } else if (step.type === 'CHECK_OVERFLOW' || step.type === 'UNDERFLOW_DETECTED') {
      // Check metadata for overflow/underflow status
      const isOverflow = step.metadata?.is_overflow || step.isOverflow;
      overflowNodeId = isOverflow ? pageId : null;
      console.log(`[playStep] ${step.type} - isOverflow: ${isOverflow}, overflowNodeId: ${overflowNodeId}`);
    }
    
    // Update state for visualization
    setState(prev => {
      const newState = {
        ...prev,
        currentStep: step,
        highlightedNodeId: pageId,
        highlightedKey: step.key || step.highlightKey || null,
        overflowNodeId: overflowNodeId !== null ? overflowNodeId : 
          (step.type === 'NODE_SPLIT' || step.type === 'REBALANCE_COMPLETE' ? null : prev.overflowNodeId),
      };
      console.log(`[playStep] State updated:`, {
        highlightedNodeId: newState.highlightedNodeId,
        overflowNodeId: newState.overflowNodeId,
        hasHighlightedKey: !!newState.highlightedKey
      });
      return newState;
    });

    // Visual tree updates are handled by syncing with actual tree after operation
    // We don't mutate visual tree during animation - backend steps are authoritative
    console.log(`[playStep] Step ${step.step_id} (${step.type}) completed successfully`);
    return visualTree;
  }, [extractPageId]);

  // Execute steps sequentially
  const executeSteps = useCallback(async (
    steps: ExecutionStep[],
    initialTree: TreeStructure | null
  ): Promise<void> => {
    console.log('[executeSteps] Starting step execution:', {
      totalSteps: steps.length,
      animationSpeed: animationSpeed,
      hasInitialTree: !!initialTree,
      initialTreeRootPage: initialTree?.rootPage,
      initialTreeHeight: initialTree?.height,
      initialTreeNodeCount: initialTree?.nodes ? Object.keys(initialTree.nodes).length : 0
    });
    
    setState(prev => {
      if (prev.isExecuting) {
        console.warn('[executeSteps] WARN: Step execution already in progress, skipping new execution');
        return prev;
      }
      const newState = {
        ...prev,
        isExecuting: true,
        visualTree: initialTree ? JSON.parse(JSON.stringify(initialTree)) : null,
      };
      console.log('[executeSteps] State initialized:', {
        isExecuting: newState.isExecuting,
        hasVisualTree: !!newState.visualTree
      });
      return newState;
    });

    // Calculate delay based on animation speed (0-100 -> 2000ms to 200ms)
    const getStepDelay = () => {
      const delay = Math.max(200, 2000 - (animationSpeed * 18));
      return delay;
    };

    const stepDelay = getStepDelay();
    console.log(`[executeSteps] Step delay calculated: ${stepDelay}ms (animationSpeed: ${animationSpeed})`);

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepIndex = i + 1;
        
        console.log(`[executeSteps] ===== Step ${stepIndex}/${steps.length} =====`);
        console.log(`[executeSteps] Executing Step:`, stepIndex, step.type, step);
        
        // Check if we should return early
        if (!step) {
          console.warn(`[executeSteps] WARN: Returning early - step ${stepIndex} is null or undefined`);
          break;
        }
        
        if (!step.type) {
          console.warn(`[executeSteps] WARN: Returning early - step ${stepIndex} has no type`, step);
          break;
        }
        
        // Play the step - update state
        setState(prev => {
          console.log(`[executeSteps] Current visual tree state before step ${stepIndex}:`, {
            hasVisualTree: !!prev.visualTree,
            rootPage: prev.visualTree?.rootPage,
            nodeCount: prev.visualTree?.nodes ? Object.keys(prev.visualTree.nodes).length : 0
          });
          console.log(`[executeSteps] Calling playStep for step ${stepIndex} (${step.type})`);
          const newVisualTree = playStep(step, prev.visualTree);
          const updatedState = {
            ...prev,
            visualTree: newVisualTree,
          };
          console.log(`[executeSteps] State updated after playStep ${stepIndex}:`, {
            hasVisualTree: !!updatedState.visualTree,
            highlightedNodeId: updatedState.highlightedNodeId,
            overflowNodeId: updatedState.overflowNodeId
          });
          return updatedState;
        });

        // Wait for step animation delay
        console.log(`[executeSteps] Waiting ${stepDelay}ms for step ${stepIndex} animation delay...`);
        await new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          
          stepTimeoutRef.current = setTimeout(() => {
            console.log(`[executeSteps] Step ${stepIndex} delay timeout completed`);
            resolve();
          }, stepDelay);

          // Store resolve for external call (e.g., from TreeCanvas)
          (window as any).__currentStepResolve = () => {
            console.log(`[executeSteps] Step ${stepIndex} resolved externally (via TreeCanvas)`);
            if (stepTimeoutRef.current) {
              clearTimeout(stepTimeoutRef.current);
              stepTimeoutRef.current = null;
            }
            resolve();
          };
        });

        console.log(`[executeSteps] Step ${stepIndex} (${step.type}) completed, moving to next step`);

        // Clean up
        if ((window as any).__currentStepResolve) {
          delete (window as any).__currentStepResolve;
        }
        resolveRef.current = null;
      }

      console.log('[executeSteps] All steps completed successfully');
    } catch (error) {
      console.error('[executeSteps] ERROR: Exception during step execution:', error);
      console.error('[executeSteps] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }

    // Finalize: clear animation state
    console.log('[executeSteps] Finalizing - clearing animation state');
    setState(prev => ({
      ...prev,
      isExecuting: false,
      currentStep: null,
      highlightedNodeId: null,
      highlightedKey: null,
      overflowNodeId: null,
    }));
    console.log('[executeSteps] Step execution finished');
  }, [animationSpeed, playStep]);

  // Reset animation state
  const resetAnimation = useCallback(() => {
    console.log('[resetAnimation] Resetting animation state');
    if (stepTimeoutRef.current) {
      console.log('[resetAnimation] Clearing pending timeout');
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
    
    if (resolveRef.current) {
      console.log('[resetAnimation] Resolving pending promise');
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
    console.log('[resetAnimation] Animation state reset complete');
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
