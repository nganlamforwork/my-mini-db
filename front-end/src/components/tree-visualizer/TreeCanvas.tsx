/**
 * TreeCanvas Component
 * 
 * @description
 * Main orchestrator component for rendering B+ Tree visualizations on an HTML5 Canvas.
 * Refactored to use modular hooks and components for better maintainability.
 */

import React, { useRef, useState, useEffect } from 'react';
import { NodeDetailDialog } from '../NodeDetailDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

import type { TreeCanvasProps, NodePosition } from './types';
import { useTreeLayout } from './hooks/useTreeLayout';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { useTreeRenderer } from './hooks/useTreeRenderer';
import { useTreeExport } from './hooks/useTreeExport';
import { TreeControls } from './components/TreeControls';
import { TreeConfig } from './components/TreeConfig';
import { TreeLegend } from './components/TreeLegend';
import { EmptyTreeMessage } from './components/EmptyTreeMessage';

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ 
  treeData,
  schema,
  config,
  activeStep,
  hasPendingOperation,
  isPlaying,
  onPlayPause,

  playbackSpeed,
  onPlaybackSpeedChange,
  steps, // Add steps to destructuring
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<number, NodePosition>>(new Map());



  // 1. Calculate Layout (with CUMULATIVE Step-based overrides)
  // We need to replay steps up to the current active step to build the correct ephemeral tree structure.
  const visualTreeData = React.useMemo(() => {
     if (!activeStep || !treeData) return treeData;
     
     // 1. Start with a clone of the base tree
     const newNodes = { ...treeData.nodes };
     // Deep clone keys/values of mutable nodes is expensive, but necessary for structural changes.
     // Optimization: Only clone nodes we touch.
     
     let rootPage = treeData.rootPage;
     let height = treeData.height;
     let hasChanges = false;
     
     // 2. Identify the range of steps to replay
     // If we have 'steps' prop, use it. Otherwise, we can only do single-step override (legacy).
     const stepsList = steps || [];
     const targetStepIndex = activeStep.step; // 1-based index
     
     if (stepsList.length === 0) {
         // Fallback to single-step override logic (previous implementation)
         // ... (Keep existing simple override logic if no steps provided)
         // For brevity, using the same logic block below but just for activeStep if stepsList empty?
         // No, simpler to just use activeStep as single item array if missing stepsList, 
         // BUT stepsList is required for history.
     }
     
     // Filter steps up to current
     const stepsToReplay = stepsList.filter((s: any) => s.step <= targetStepIndex);
     
     // If no full history, fallback to just activeStep (will lose history but better than nothing)
     const sequence = stepsToReplay.length > 0 ? stepsToReplay : [activeStep];

     // 3. Replay Sequence
     for (const step of sequence) {
         const targetId = step.pageId;
         
         // Helper to ensure we have a mutable copy of the node
         const ensureMutable = (id: number) => {
             if (newNodes[id]) {
                 newNodes[id] = { ...newNodes[id] }; // Shallow copy node structure
             }
         };

         if (step.action === 'SPLIT_NODE') {
             // Permanent structural change (until end of animation)
             // 1. Update Left Node (current)
             if (newNodes[targetId] && step.leftKeys) {
                 ensureMutable(targetId);
                 newNodes[targetId].keys = step.leftKeys; // Update keys to post-split state
                 hasChanges = true;
             }
             
             // 2. Create Right Node (new)
             if (step.newPageId && step.rightKeys) {
                 const original = newNodes[targetId];
                 // Infer type from original
                 newNodes[step.newPageId] = {
                     ...original, // Copy props like type
                     pageId: step.newPageId,
                     keys: step.rightKeys,
                     children: step.rightChildren || [], // Use captured right children
                     values: []
                 };
                 hasChanges = true;
                 
                 // Update Left Node Children if available
                 if (step.leftChildren && newNodes[targetId]) {
                     ensureMutable(targetId);
                     newNodes[targetId].children = step.leftChildren;
                 }
                 
                 // 3. Link to Parent (Structural Link)
                 // If we have parentId, insert into parent's children list
                 if (step.parentId && newNodes[step.parentId]) {
                     ensureMutable(step.parentId);
                     const parent = newNodes[step.parentId];
                     if (parent.children) {
                         const newChildren = [...parent.children];
                         // Find insertion point: after targetId
                         const idx = newChildren.indexOf(targetId);
                         if (idx !== -1 && !newChildren.includes(step.newPageId)) {
                             newChildren.splice(idx + 1, 0, step.newPageId);
                             parent.children = newChildren;
                         }
                         
                         // Mark this edge as pending (don't draw yet) until INSERT_INTERNAL
                         // We attach a temporary property to the node (casting to any to avoid type errors in TS for ephemeral props)
                         const parentAny = parent as any;
                         if (!parentAny.pendingChildren) parentAny.pendingChildren = [];
                         parentAny.pendingChildren.push(step.newPageId);
                     }
                 } else if (step.pageId === rootPage) {
                      // Handle Root Split (No Parent yet): Create transient ghost root to hold both halves
                      // This ensures the Right Node (orphan) is visible and connected during the split animation
                      const ghostRootId = -9999;
                      newNodes[ghostRootId] = {
                           pageId: ghostRootId,
                           type: 'internal',
                           keys: [], // Empty (visual only container)
                           children: [step.pageId, step.newPageId],
                           values: []
                      };
                      
                      // Also mark pending for Ghost Root if desired? 
                      // User said "only after insert into internal complete". 
                      // For Root Split, the "complete" is CREATE_ROOT which replaces this entire node.
                      // So we can arguably leave it visible or hide it. 
                      // Given user intent: "new node don't have EDGE connect... only when parent finished".
                      // Ghost Root IS the parent here (albeit temporary). 
                      // Let's hide it too for consistency.
                      const ghostAny = newNodes[ghostRootId] as any;
                      ghostAny.pendingChildren = [step.newPageId];
                      
                      rootPage = ghostRootId;
                      height++;
                      hasChanges = true;
                 }
             }
         }
         
         else if (step.action === 'CREATE_ROOT') {
             // New Root
             if (step.pageId && step.children) {
                 newNodes[step.pageId] = {
                     pageId: step.pageId,
                     type: 'internal',
                     keys: step.keys || [],
                     children: step.children
                 };
                 // No pendingChildren on new root (fresh start)
                 rootPage = step.pageId;
                 height++;
                 hasChanges = true;
             }
         }
         
         else if (step.action === 'INSERT_LEAF' || step.action === 'INSERT_INTERNAL') {
             // Update keys
             if (step.newKeys && newNodes[targetId]) {
                 ensureMutable(targetId);
                 newNodes[targetId].keys = step.newKeys;
                 hasChanges = true;
                 
                 // If INSERT_INTERNAL, this implies the key insertion logic is done.
                 // We should finalize/commit any pending children edges on this node.
                 if (step.action === 'INSERT_INTERNAL') {
                     const nodeAny = newNodes[targetId] as any;
                     if (nodeAny.pendingChildren) {
                         delete nodeAny.pendingChildren; // Clear pending status, edges will now draw
                     }
                 }
             }
             // NOTE: INSERT_INTERNAL usually implies adding a child pointer too. 
             // Visualization of keys is enough for most cases, but strict layout might need child count match.
             // Our layout engine usually handles mismatch gracefully (rendering curves).
         }
         
         // Transient overrides for the FINAL step (CHECK_OVERFLOW, FIND_POS)
         // These shouldn't permanently mutate the tree for *future* steps if we were replaying past them,
         // but since we stop AT activeStep, we apply them last.
         if (step === activeStep) {
             if (step.action === 'CHECK_OVERFLOW' && step.keys) {
                  if (newNodes[targetId]) {
                      ensureMutable(targetId);
                      newNodes[targetId].keys = step.keys; // Show overflow state
                      hasChanges = true;
                  }
             }
             // For FIND_POS, we might want to show the "search state" keys if provided?
             // Usually FIND_POS keys == current node keys.
         }
     }

     if (!hasChanges) return treeData;

     return {
         ...treeData,
         nodes: newNodes,
         rootPage,
         height
     };

  }, [treeData, activeStep, steps]);

  const { layout, isEmptyTree } = useTreeLayout(visualTreeData);

  // 2. Handle Interactions (Camera, Selection, Hover)
  const {
    camera,
    selectedNode,
    // setSelectedNode,
    dialogOpen,
    setDialogOpen,
    hoveredEdge,
    tooltipPosition,
    handleMouseDown,
    handleMouseMove,
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    isDragging,
    hoveredNodeRef,
    hoveredKeyRef
  } = useTreeInteraction({
    treeData: visualTreeData, // Use visualTreeData
    layout,
    positionsRef,
    containerRef,
    canvasRef
  });

  // 3. Handle Rendering Loop
  useTreeRenderer({
    canvasRef,
    containerRef,
    camera,
    layout,
    positionsRef,
    treeData: visualTreeData, // Use visualTreeData
    isEmptyTree,
    hoveredEdge,
    tooltipPosition,
    hoveredNodeRef,
    hoveredKeyRef,

    activeStep, // Pass activeStep to renderer
    playbackSpeed: playbackSpeed || 1, // Pass playbackSpeed for adaptive timing
  });

  // 4. Handle Export
  const { handleDownloadImage } = useTreeExport({
    layout,
    positionsRef,
    treeData
  });

  // 5. Pattern Background Theme Observer
  const [patternColor, setPatternColor] = useState('#e2e8f0');
  
  useEffect(() => {
    const updatePatternColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setPatternColor(isDark ? '#1e293b' : '#e2e8f0');
    }
    
    updatePatternColor();
    const observer = new MutationObserver(updatePatternColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-background overflow-hidden cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => isDragging.current = false}
        onMouseLeave={() => {
          isDragging.current = false;
        }}
        onWheel={handleWheel}
        style={{ backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
      >
        {isEmptyTree ? (
          <EmptyTreeMessage />
        ) : (
          <>
            <canvas ref={canvasRef} className="absolute inset-0" />
            {/* Edge tooltip */}
            {hoveredEdge && tooltipPosition && (
              <Tooltip open={true}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: tooltipPosition.x,
                      top: tooltipPosition.y,
                      width: 1,
                      height: 1,
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="font-mono text-xs"
                >
                  {hoveredEdge.tooltipText}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        
        <TreeConfig config={config} treeData={treeData} />
        <TreeLegend />
        
        <NodeDetailDialog
          node={selectedNode}
          schema={schema}
          isRoot={selectedNode?.pageId === treeData.rootPage}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />

        <TreeControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onDownload={handleDownloadImage}
          zoomLevel={camera.zoom}
          // Playback controls
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={onPlaybackSpeedChange}
          hasPendingOperation={hasPendingOperation}
        />
      </div>
    </TooltipProvider>
  );
};
