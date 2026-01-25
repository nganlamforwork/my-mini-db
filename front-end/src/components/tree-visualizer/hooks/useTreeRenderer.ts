import { useEffect, useRef, type RefObject } from 'react';
import type { TreeStructure, VisualizationStep } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { drawRoundedRect, getThemeColors, drawLeafSiblingLinks } from '../helpers';
// import confetti from 'canvas-confetti'; (Removed usage)

interface UseTreeRendererProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  camera: { x: number; y: number; zoom: number };
  layout: LayoutNode[];
  positionsRef: React.MutableRefObject<Map<number, NodePosition>>;
  treeData: TreeStructure;
  isEmptyTree: boolean;
  hoveredEdge: { parentId: number; childIndex: number; tooltipText: string } | null;
  tooltipPosition: { x: number; y: number } | null;
  hoveredNodeRef: React.MutableRefObject<number | null>;
  hoveredKeyRef: React.MutableRefObject<number | null>;
  activeStep?: VisualizationStep;
  playbackSpeed: number; // Add playbackSpeed prop
}

export const useTreeRenderer = ({
  canvasRef,
  containerRef,
  camera,
  layout,
  positionsRef,
  treeData,
  isEmptyTree,
  hoveredEdge,
  tooltipPosition,
  hoveredNodeRef,
  hoveredKeyRef,
  activeStep,
  playbackSpeed = 1
}: UseTreeRendererProps) => {
  // Cache for node state (keys) to maintain consistency across steps
  const nodeStateCache = useRef<Map<number, any[]>>(new Map());
  // Cache for hidden nodes (merged/deleted)
  const hiddenNodesCache = useRef<Set<number>>(new Set());
  // Cache for nextPage overrides (link updates)
  const nextPageCache = useRef<Map<number, number | null>>(new Map());
  // Cache for child-parent overrides (internal rebalancing)
  const childParentCache = useRef<Map<number, number>>(new Map());

  // Clear caches when treeData changes
  useEffect(() => {
    nodeStateCache.current.clear();
    hiddenNodesCache.current.clear();
    nextPageCache.current.clear();
    childParentCache.current.clear();
  }, [treeData]);

  // Update caches based on activeStep
  useEffect(() => {
    if (!activeStep) return;

    const cache = nodeStateCache.current;
    const hiddenCache = hiddenNodesCache.current;
    const linkCache = nextPageCache.current;
    const parentCache = childParentCache.current;
    const step = activeStep;

    // Helper to set cache
    const updateCache = (id: number, keys: any[]) => {
      if (keys) cache.set(id, keys);
    };

    // ... (Existing cache logic) ...
    // 1. Generic nodeOverrides
    if (step.nodeOverrides) {
        step.nodeOverrides.forEach(o => updateCache(o.pageId, o.keys));
    }

    // 2. newKeys (Insert/Delete)
    if ('newKeys' in step && step.newKeys) {
        updateCache(step.pageId, step.newKeys);
    }

    // 3. keys (Check, Scan, etc.)
    if ('keys' in step && step.keys) {
        updateCache(step.pageId, step.keys);
    }

    // 4. siblingKeys (Borrow)
    if ('siblingPageId' in step && 'siblingKeys' in step && step.siblingKeys) {
        updateCache(step.siblingPageId, step.siblingKeys);
    }

    // 5. SPLIT_NODE (Left/Right)
    if (step.action === 'SPLIT_NODE' && step.leftKeys && step.rightKeys) {
        updateCache(step.pageId, step.leftKeys);
        if ('newPageId' in step) {
            updateCache(step.newPageId, step.rightKeys);
        }
    }

    // 6. keyValues (Compare Range)
    if ('keyValues' in step && step.keyValues) {
        updateCache(step.pageId, step.keyValues);
    }
    
    // 7. mergedKeys (Merge)
    if ('mergedKeys' in step && step.mergedKeys) {
       updateCache(step.pageId, step.mergedKeys);
    }
    
    // --- Hidden Cache Logic ---
    if (step.action === 'MERGE_LEAF' && step.removePageId) {
        hiddenCache.add(step.removePageId);
    }
    if (step.action === 'DELETE_INDEX' && step.deleteChildPtr) {
        hiddenCache.add(step.deleteChildPtr);
    }
    
    // --- Link Cache Logic ---
    if (step.action === 'UPDATE_LINK' && step.pageId) {
        // defined in step: newNext: number | null
        if ('newNext' in step) { // TS check
             linkCache.set(step.pageId, step.newNext === undefined ? null : step.newNext);
        }
    }
    
    // --- Parent Cache Logic ---
    if (step.action === 'INTERNAL_BORROW_ROTATE' && step.movedChildId) {
        parentCache.set(step.movedChildId, step.pageId);
    }
    if (step.action === 'DELETE_INDEX' && step.mergedChildren && step.mergeTargetId) {
        step.mergedChildren.forEach(childId => {
            parentCache.set(childId, step.mergeTargetId!);
        });
    }

  }, [activeStep]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Capture start time of this effect cycle (resets when activeStep changes)
    const startTime = Date.now();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create lookup map to retrieve node width without recalculation
    const layoutNodeMap = new Map(layout.map(n => [n.id, n]));

    let animationFrame: number;
    let themeObserver: MutationObserver | null = null;

    const render = () => {
      if (!ctx || !containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const colors = getThemeColors();
      const isDark = document.documentElement.classList.contains('dark');

      // Real-time position tracking: Update node positions with faster lerp for smoother edge tracking
      const LERP_FACTOR = 0.2;
      
      layout.forEach(target => {
        let pos = positionsRef.current.get(target.id);
        if (!pos) {
          pos = { id: target.id, x: target.x, y: target.y - 50, targetX: target.x, targetY: target.y, alpha: 0 };
          positionsRef.current.set(target.id, pos);
        }
        pos.targetX = target.x;
        pos.targetY = target.y;
        
        // Real-time position update with faster lerp
        pos.x += (pos.targetX - pos.x) * LERP_FACTOR;
        pos.y += (pos.targetY - pos.y) * LERP_FACTOR;
        pos.alpha += (1 - pos.alpha) * 0.1;
      });
      
      // Clean up positions for nodes that no longer exist in layout
      const layoutNodeIds = new Set(layout.map(n => n.id));
      for (const [nodeId] of positionsRef.current) {
        if (!layoutNodeIds.has(nodeId)) {
          positionsRef.current.delete(nodeId);
        }
      }
      
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + camera.x, 100 + camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Explicitly set font for measurement to match node rendering
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      
      // Draw Leaf Node Sibling Links (dashed green lines)
      drawLeafSiblingLinks(
        ctx,
        layout,
        treeData,
        (id) => {
          if (hiddenNodesCache.current.has(id)) return null;

          const pos = positionsRef.current.get(id);
          const layoutNode = layoutNodeMap.get(id);
          if (!pos || !layoutNode) return null;
          
          return { x: pos.x, y: pos.y, width: layoutNode.width };
        },
        (id) => {
            if (nextPageCache.current.has(id)) return nextPageCache.current.get(id);
            return undefined;
        }
      );

      // Draw Connections with key-aligned anchor points
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.connectionLine;
      ctx.setLineDash([]); // Solid lines for parent-child connections
      
      // Build a map of parent -> children for efficient lookup
      const parentChildrenMap = new Map<number, number[]>();
      layout.forEach(node => {
        const overridePid = childParentCache.current.get(node.id);
        const pid = (overridePid !== undefined) ? overridePid : node.parentId;

        if (pid !== null) {
          if (!parentChildrenMap.has(pid)) {
            parentChildrenMap.set(pid, []);
          }
          parentChildrenMap.get(pid)!.push(node.id);
        }
      });
      
      layout.forEach(node => {
        // Skip hidden nodes (edges)
        if (hiddenNodesCache.current.has(node.id)) return;
        const overridePid = childParentCache.current.get(node.id);
        const pid = (overridePid !== undefined) ? overridePid : node.parentId;
        
        if (pid && hiddenNodesCache.current.has(pid)) return;

        // Get current visual position of child node (updated every frame via lerp)
        const childPos = positionsRef.current.get(node.id);
        if (!childPos || !pid) return;
        
        // Get current visual position of parent node (updated every frame via lerp)
        const parentPos = positionsRef.current.get(pid);
        if (!parentPos) return;
        
        const childX = childPos.x;
        const childY = childPos.y;
        const parentX = parentPos.x;
        const parentY = parentPos.y;
        
        // Check for SPLIT_NODE suppression
        const parentNodeData = treeData.nodes[pid.toString()];
        const parentAny = parentNodeData as any;
        if (parentAny && parentAny.pendingChildren && parentAny.pendingChildren.includes(node.id)) {
            return; 
        }

        if (!parentNodeData || parentNodeData.type !== 'internal') {
          // Fallback
          ctx.beginPath();
          ctx.moveTo(parentX, parentY + 25);
          ctx.bezierCurveTo(parentX, parentY + 70, childX, childY - 70, childX, childY - 25);
          ctx.stroke();
          return;
        }
        
        // Find child index in parent's children array
        const parentChildren = parentChildrenMap.get(pid) || [];
        const childIndex = parentChildren.indexOf(node.id);
        if (childIndex === -1) {
          ctx.beginPath();
          ctx.moveTo(parentX, parentY + 25);
          ctx.bezierCurveTo(parentX, parentY + 70, childX, childY - 70, childX, childY - 25);
          ctx.stroke();
          return;
        }
        
        // Determine keys for parent to calculate anchors
        const cachedParentKeys = nodeStateCache.current.get(pid);
        const parentKeys = cachedParentKeys || parentNodeData.keys || [];
        
        const numKeys = parentKeys.length;
        const numChildren = parentChildren.length;
        
        // Calculate node width using key groups (same as rendering)
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        
        // Prepare key texts for width calculation
        const keyTexts = formatNodeDataForGraph(parentKeys);
        
        const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        const nodeWidth = Math.max(100, totalKeyWidth);
        const nodeLeft = parentX - nodeWidth / 2;
        const nodeRight = parentX + nodeWidth / 2;
        const padding = (nodeWidth - totalKeyWidth) / 2;
        const contentStartX = nodeLeft + padding;
        
        // Calculate anchor points
        let anchorX: number;
        if (numKeys === 0) {
          const childSpacing = nodeWidth / (numChildren + 1);
          anchorX = nodeLeft + childSpacing * (childIndex + 1);
        } else if (numKeys === 1) {
          const keyW = keyWidths[0];
          const keyLeft = contentStartX;
          const keyRight = keyLeft + keyW;
          anchorX = childIndex === 0 ? keyLeft : keyRight;
        } else {
          const dividerPositions: number[] = [];
          let currentX = contentStartX;
          keyWidths.forEach((keyWidth: number, idx: number) => {
            currentX += keyWidth;
            if (idx < numKeys - 1) {
              dividerPositions.push(currentX);
            }
          });
          
          if (childIndex === 0) {
            anchorX = contentStartX;
          } else if (childIndex === numChildren - 1) {
            anchorX = contentStartX + totalKeyWidth;
          } else {
            const dividerIdx = childIndex - 1;
            anchorX = dividerIdx < dividerPositions.length ? dividerPositions[dividerIdx] : nodeRight - padding / 2;
          }
        }
        
        // Draw the edge
        ctx.beginPath();
        const startX = anchorX;
        const startY = parentY + 25;
        const endX = childX;
        const endY = childY - 25;
        const control1X = anchorX;
        const control1Y = parentY + 70;
        const control2X = childX;
        const control2Y = childY - 70;
        
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
        ctx.stroke();
      });

      // Draw Nodes
      positionsRef.current.forEach(pos => {
        // Hidden check
        if (hiddenNodesCache.current.has(pos.id)) {
             let isExempt = false;
             if (activeStep && 'removePageId' in activeStep && activeStep.removePageId === pos.id) {
                 // Still show it while the merge action is happening (it will be Red)
                 isExempt = true;
             }
             if (!isExempt) return;
        }

        ctx.save(); // Save context state for each node (handles transforms etc)
        
        const nodeData = treeData.nodes[pos.id.toString()];
        if (!nodeData) {
            ctx.restore();
            return;
        }

        const isLeaf = nodeData.type === 'leaf';
        // USE CACHED KEYS IF AVAILABLE
        let currentKeys = nodeStateCache.current.get(pos.id) || nodeData.keys;

        // --- VISUALIZATION OVERRIDES ---
        let isActive = false;
        let activeNodeFill = '';
        let activeStroke = '';
        const activeKeyIndices = new Set<number>();
        const amberKeyIndices = new Set<number>(); // New: For "First Child" comparison check
        const greenKeyIndices = new Set<number>(); // New: For Range Query collected keys
        let foundKeyIndex = -1; // Specific index for exact match (Green)
        let shakeOffset = 0; 
        let shakeOffsetY = 0; // New Y-axis shake
        let shakeAngle = 0; // Rotation for error

        if (activeStep) {
           // Broaden active check for multi-node steps
           if (activeStep.pageId === pos.id) isActive = true;
           else if ('newPageId' in activeStep && activeStep.newPageId === pos.id) isActive = true;
           else if ('siblingPageId' in activeStep && activeStep.siblingPageId === pos.id) isActive = true;
           else if ('leftSiblingId' in activeStep && activeStep.leftSiblingId === pos.id) isActive = true;
           else if ('rightSiblingId' in activeStep && activeStep.rightSiblingId === pos.id) isActive = true;
           else if ('removePageId' in activeStep && activeStep.removePageId === pos.id) isActive = true;
           else if ('parentPageId' in activeStep && activeStep.parentPageId === pos.id) isActive = true;
           else if ('toPageId' in activeStep && activeStep.toPageId === pos.id) isActive = true;
        }

        if (isActive && activeStep) {
          isActive = true;
          const timeSinceStart = Date.now() - startTime;
          // ADAPTIVE TIMING LOGIC
          const stepDuration = 1000 / playbackSpeed;
          
          // Note: keys are already updated via cache logic above.
          // We don't need inline overrides anymore for 'currentKeys' unless purely ephemeral.
          // (Removed previous override block)


          const numKeys = currentKeys?.length || 0;
          
          // Guarantee significant time for the result state (Shake or Found)
          const reserveResultTime = Math.max(stepDuration * 0.5, 500); 
          const availableForScan = Math.max(stepDuration - reserveResultTime, 100);
          
          // Calculate duration per key
          const adaptiveScanDuration = numKeys > 0 
              ? Math.max(30, Math.min(300, availableForScan / numKeys))
              : 300;

          const KEY_SCAN_DURATION = adaptiveScanDuration; 

          // Set highlight colors based on action
          switch (activeStep.action) {
            case 'NODE_VISIT': // Blue
              // Explicitly blue for visit
              activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; // blue-900/100
              activeStroke = isDark ? '#3b82f6' : '#2563eb';   // blue-500/600
              break;

            case 'COMPARE_RANGE': 
              activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; // Blue base while comparing
              activeStroke = isDark ? '#3b82f6' : '#2563eb'; 
              
              if ('selectedChildIndex' in activeStep && typeof activeStep.selectedChildIndex === 'number') {
                 const childIdx = activeStep.selectedChildIndex;
                 const limit = childIdx - 1;
                 
                 // Only highlight "passed" keys (previous ones). 
                 // If limit < 0 (first child), we highlight nothing inside the node, just the node itself.
                 if (limit >= 0) {
                     const maxToShow = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), limit);
                     for (let i = 0; i <= maxToShow; i++) {
                         activeKeyIndices.add(i);
                     }
                 }
              }
              break;

            case 'SCAN_KEYS': 
            case 'FIND_POS': // FIND_POS behaves similar to SCAN_KEYS for visualization
              activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
              activeStroke = isDark ? '#3b82f6' : '#2563eb';
              
              // Helper vars
              let targetIdx = -1;
              let foundIdx = -1;

              if (activeStep.action === 'SCAN_KEYS' && 'foundAtIndex' in activeStep) {
                 foundIdx = activeStep.foundAtIndex ?? -1;
                 targetIdx = foundIdx; // Stop at found
              } else if (activeStep.action === 'FIND_POS') {
                 targetIdx = activeStep.targetIndex;
                 // If FIND_POS has 'foundAtIndex' (duplicate), mark it
                 if ('foundAtIndex' in activeStep && typeof activeStep.foundAtIndex === 'number' && activeStep.foundAtIndex !== -1) {
                    foundIdx = activeStep.foundAtIndex;
                    targetIdx = foundIdx;
                 }
              }

              if (foundIdx !== -1) {
                // Key FOUND (Green)
                const currentIndex = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), foundIdx);
                activeKeyIndices.add(currentIndex);
                
                if (currentIndex === foundIdx) {
                   foundKeyIndex = foundIdx; // Turns Green
                }
              } else {
                 // Scan until target (finding position or not found)
                 // Limit scan to targetIdx - 1 (only highlight PASSED keys, not the one we stop at)
                 let limit = targetIdx === -1 ? numKeys - 1 : targetIdx - 1;
                 // Clamp limit (if target is 0, limit is -1, highlight nothing)
                 limit = Math.min(limit, numKeys - 1);
                 
                 const currentIndex = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), limit);
                 if (currentIndex >= 0 && limit >= 0) { // Check limit >= 0
                     for (let k=0; k<=currentIndex; k++) {
                         activeKeyIndices.add(k);
                     }
                 }
                 
                 // If we failed to find (SCAN_KEYS) and completed scan
                 if (activeStep.action === 'SCAN_KEYS' && foundIdx === -1) {
                      const finishTime = numKeys * KEY_SCAN_DURATION;
                      if (timeSinceStart > finishTime) {
                         activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; 
                         activeStroke = isDark ? '#ef4444' : '#dc2626';
                         const SHAKE_AMPLITUDE = 8;
                         shakeOffsetY = Math.sin(timeSinceStart / 30) * SHAKE_AMPLITUDE;
                         shakeAngle = Math.cos(timeSinceStart / 30) * 0.05;
                      }
                 }
              }
              break;

            case 'INSERT_FAIL':
              // Reuse failure visualization
              activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; 
              activeStroke = isDark ? '#ef4444' : '#dc2626';
              const SHAKE_AMPLITUDE = 8;
              shakeOffsetY = Math.sin(timeSinceStart / 30) * SHAKE_AMPLITUDE;
              shakeAngle = Math.cos(timeSinceStart / 30) * 0.05;
              break;

            case 'INSERT_LEAF': 
            case 'INSERT_INTERNAL':
               // Highlight the new node/key
               activeNodeFill = isDark ? '#064e3b' : '#d1fae5'; // Green base 
               activeStroke = isDark ? '#10b981' : '#059669';
               
               if ('atIndex' in activeStep && typeof activeStep.atIndex === 'number') {
                   // Highlight the inserted key in Green
                   foundKeyIndex = activeStep.atIndex; 
               }
               break;

            case 'SPLIT_NODE':
               // Blue highlight for split
               activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; // Blue
               activeStroke = isDark ? '#3b82f6' : '#2563eb';
               break;
               
            case 'CHECK_OVERFLOW': 
              if ('isOverflow' in activeStep && activeStep.isOverflow) {
                 activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; 
                 activeStroke = isDark ? '#ef4444' : '#dc2626';
              } else {
                 activeNodeFill = isDark ? '#064e3b' : '#d1fae5'; 
                 activeStroke = isDark ? '#10b981' : '#059669';
              }
              break;
              
            case 'SCAN_RANGE': {
               activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
               activeStroke = isDark ? '#3b82f6' : '#2563eb';
               
               const nodeKeys = currentKeys || [];
               const collected = activeStep.collected || [];
               
               // Helper to check if a key is in collected list
               // We need exact match on values
               const isCollected = (k: any) => {
                   return collected.some(c => 
                       c.values.length === k.values.length && 
                       c.values.every((v: any, i: number) => v.value === k.values[i].value)
                   );
               };

               const numKeys = nodeKeys.length;
               // Calculate how many keys to show based on time
               // We want to scan linearly
               const currentIndex = Math.floor(timeSinceStart / KEY_SCAN_DURATION);
               
               // If completely stopped
               if (activeStep.stopReason === 'OUT_OF_RANGE') {
                   // Calculate when the linear scan reaches the offending key
                   // We assume keys are sorted. Offending key is the first key > endKey.
                   // Or simply, we scan until we hit the end of the node or stop?
                   // The steps usually imply we scan everything up to the stop point.
                   
                   // For visualization simple approach: scan ALL keys up to limit?
                   // Use collected list length as guide? 
                   // If OUT_OF_RANGE, we probably scanned one extra key (the one that failed).
                   // Let's deduce the "scanned count" from collected.length + 1?
                   
                   // For visualization simple approach: just let the time drive it up to numKeys
                   // Can handle visual stop here if needed.
               }
               
               for (let i = 0; i < numKeys; i++) {
                   if (i <= currentIndex) {
                       activeKeyIndices.add(i);
                       
                       // Color logic
                       if (isCollected(nodeKeys[i])) {
                           greenKeyIndices.add(i);
                       }
                   }
               }
               // No shake for OUT_OF_RANGE as per user request
               break;
               break;
            }

             case 'LINK_NEXT': {
               if (pos.id === activeStep.toPageId) {
                   isActive = true;
                   activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
                   activeStroke = isDark ? '#3b82f6' : '#2563eb';
               }
               break;
            }

            // --- DELETE OPERATIONS ---
            case 'DELETE_LEAF':
            case 'DELETE_INDEX':
               // Highlight node red-ish if becoming empty? Or standard Blue?
               // Standard Blue for visiting/acting.
               activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
               activeStroke = isDark ? '#3b82f6' : '#2563eb';
               
               // If empty (detected via numKeys maybe?), user asked for red box.
               // We can check numKeys in currentKeys.
               if (numKeys === 0) {
                   activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; 
                   activeStroke = isDark ? '#ef4444' : '#dc2626';
               }
               break;

            case 'CHECK_UNDERFLOW':
               if ('isUnderflow' in activeStep && activeStep.isUnderflow) {
                   activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; // Red
                   activeStroke = isDark ? '#ef4444' : '#dc2626';
               } else {
                   activeNodeFill = isDark ? '#064e3b' : '#d1fae5'; // Green
                   activeStroke = isDark ? '#10b981' : '#059669';
               }
               break;

            case 'CHECK_SIBLINGS':
               // Highlight siblings in Amber/Yellow
               if ((activeStep as any).leftSiblingId === pos.id || (activeStep as any).rightSiblingId === pos.id) {
                   activeNodeFill = isDark ? '#78350f' : '#fef3c7'; // Amber
                   activeStroke = isDark ? '#f59e0b' : '#d97706';
               } else {
                   // Main node Blue
                   activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
                   activeStroke = isDark ? '#3b82f6' : '#2563eb';
               }
               break;

            case 'BORROW_FROM_SIBLING':
            case 'INTERNAL_BORROW_ROTATE':
               // Sibling (Source) -> Green? Or Blue?
               // Dest (Current) -> Blue?
               // Let's use Distinct colors.
               if ((activeStep as any).siblingPageId === pos.id) {
                   activeNodeFill = isDark ? '#064e3b' : '#d1fae5'; // Source Green
                   activeStroke = isDark ? '#10b981' : '#059669';
               } else {
                   activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; // Dest Blue
                   activeStroke = isDark ? '#3b82f6' : '#2563eb';
               }
               break;

            case 'MERGE_LEAF':
               // Target (Keep) -> Blue
               // Remove -> Red
               if ((activeStep as any).removePageId === pos.id) {
                   activeNodeFill = isDark ? '#7f1d1d' : '#fee2e2'; // Red
                   activeStroke = isDark ? '#ef4444' : '#dc2626';
                   // Shake?
                   const SHAKE_AMPLITUDE = 5;
                   shakeOffsetY = Math.sin(timeSinceStart / 30) * SHAKE_AMPLITUDE;
               } else {
                   activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; // Blue
                   activeStroke = isDark ? '#3b82f6' : '#2563eb';
               }
               break;

            case 'UPDATE_SEPARATOR':
            case 'UPDATE_KEYS_ROTATION':
            case 'UPDATE_LINK':
               // Simple highlight
               activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
               activeStroke = isDark ? '#3b82f6' : '#2563eb';
               
               if (activeStep.action === 'UPDATE_SEPARATOR' && 'newKey' in activeStep) {
                   // Highlight the separator key?
                   // If we can find the index.. but strict finding is hard without index provided.
                   // Just highlight node.
               }
               break;

            case 'FINAL_STATE':
               // New Root Highlight
                activeNodeFill = isDark ? '#064e3b' : '#d1fae5'; // Green
                activeStroke = isDark ? '#10b981' : '#059669';
                break;
          }
        }
        
        // --- END OVERRIDES ---
        
        // Apply Shake/Rotate Transform
        if (shakeOffset !== 0 || shakeOffsetY !== 0 || shakeAngle !== 0) {
            ctx.translate(pos.x + shakeOffset, pos.y + shakeOffsetY);
            ctx.rotate(shakeAngle);
            ctx.translate(-pos.x, -pos.y);
        }

        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        // Use currentKeys (potentially overridden)
        const keyTexts = formatNodeDataForGraph(currentKeys);
        
        const keyWidths = keyTexts.map(keyText => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        const rectW = Math.max(100, totalKeyWidth);
        const rectH = 50;
        const padding = (rectW - totalKeyWidth) / 2;

        ctx.globalAlpha = pos.alpha;
        
        const isHovered = hoveredNodeRef.current === pos.id;
        const isRoot = pos.id === treeData.rootPage;
        
        const nodeLeft = pos.x - rectW / 2;
        let currentKeyX = nodeLeft + padding;
        
        // Determine fills/strokes ...
        // (Similar to before but using currentKeys logic for loops)
        
        const shouldUseActive = isActive && activeNodeFill && activeStroke;
        // ... (rest of rendering logic reusing computed values)

        if (isRoot) {
          const rootFill = shouldUseActive ? activeNodeFill : (isDark ? '#78350f' : '#fef3c7'); 
          const rootStroke = shouldUseActive ? activeStroke : (isDark ? '#f59e0b' : '#d97706');
          
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            // Highlight specific key if active
            const isKeyActive = isActive && activeKeyIndices.has(idx);
            const isKeyAmber = isActive && amberKeyIndices.has(idx); 
            const isKeyFound = idx === foundKeyIndex;
            const isKeyGreen = isKeyFound || (isActive && greenKeyIndices.has(idx));
            const isKeyHovered = isHovered && hoveredKeyRef.current === idx;
            
            let fill = rootFill;
            if (isKeyGreen) {
                 fill = isDark ? '#22c55e' : '#4ade80'; // Green
            } else if (isKeyAmber) {
                 fill = isDark ? '#f59e0b' : '#fcd34d'; 
            } else if (isKeyActive) {
                 fill = isDark ? '#3b82f6' : '#93c5fd'; // Blue
            } else if (isKeyHovered) {
                 fill = isDark ? '#f59e0b' : '#fcd34d';
            }

            ctx.fillStyle = fill;
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = (isHovered || isActive) ? 3 : (isRoot ? 2 : 1.5);
          
          if (isHovered || isActive) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = rootStroke + '80'; 
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          ctx.strokeStyle = rootStroke;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          drawRoundedRect(ctx, nodeLeftX, nodeTop, totalKeyWidth, rectH, radius);
          ctx.stroke();
          
          // Dividers
          currentKeyX = nodeLeft + padding;
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            if (idx < keyTexts.length - 1) {
              ctx.beginPath();
              ctx.moveTo(currentKeyX + keyW, nodeTop);
              ctx.lineTo(currentKeyX + keyW, nodeBottom);
              ctx.strokeStyle = rootStroke;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            currentKeyX += keyW;
          });
        } else {
          // Normal Node or Leaf
          const defaultFill = isLeaf ? colors.leafFill : colors.internalFill;
          const defaultStroke = isLeaf ? colors.leafStroke : colors.internalStroke;
          
          const nodeFill = shouldUseActive ? activeNodeFill : defaultFill;
          const strokeColor = shouldUseActive ? activeStroke : defaultStroke;

          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            
            const isKeyActive = isActive && activeKeyIndices.has(idx);
            const isKeyAmber = isActive && amberKeyIndices.has(idx); 
            const isKeyFound = idx === foundKeyIndex;
            const isKeyGreen = isKeyFound || (isActive && greenKeyIndices.has(idx));
            const isKeyHovered = isHovered && hoveredKeyRef.current === idx;
            
            let fill = nodeFill;
            if (isKeyGreen) {
                 fill = isDark ? 'rgba(34, 197, 94, 0.2)' : '#4ade80'; // Green (transparent in dark)
            } else if (isKeyAmber) {
                 fill = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fcd34d'; // Amber (transparent in dark)
            } else if (isKeyActive) {
                 fill = isDark ? 'rgba(59, 130, 246, 0.2)' : '#93c5fd'; // Blue (transparent in dark)
            } else if (isKeyHovered) {
                 fill = isDark ? 'rgba(59, 130, 246, 0.2)' : '#93c5fd';
            }
            
            ctx.fillStyle = fill;
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = (isHovered || isActive) ? 3 : 1.5;
          
          if (isHovered || isActive) {
             ctx.shadowBlur = 12;
             ctx.shadowColor = strokeColor + '80';
             ctx.shadowOffsetX = 0;
             ctx.shadowOffsetY = 2;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          drawRoundedRect(ctx, nodeLeftX, nodeTop, totalKeyWidth, rectH, radius);
          ctx.stroke();
          
          currentKeyX = nodeLeft + padding;
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            if (idx < keyTexts.length - 1) {
              ctx.beginPath();
              ctx.moveTo(currentKeyX + keyW, nodeTop);
              ctx.lineTo(currentKeyX + keyW, nodeBottom);
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            currentKeyX += keyW;
          });
        }
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw key text
        ctx.fillStyle = colors.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        currentKeyX = nodeLeft + padding;
        keyTexts.forEach((keyText, idx) => {
          const keyW = keyWidths[idx];
          ctx.fillStyle = colors.textPrimary;
          ctx.fillText(keyText, currentKeyX + keyW / 2, pos.y);
          currentKeyX += keyW;
        });

        // Page ID
        ctx.fillStyle = colors.textSecondary;
        ctx.font = '10px sans-serif';
        ctx.fillText(`P${pos.id}`, nodeLeft + 15, pos.y - rectH/2 - 8);
        
        ctx.restore(); // Restore context state
      });
      
      ctx.restore();
      
      animationFrame = requestAnimationFrame(render);
    };

    themeObserver = new MutationObserver(() => {
      // Theme changed, colors will update on next render
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    if (!isEmptyTree) {
      animationFrame = requestAnimationFrame(render);
    }
    return () => {
      cancelAnimationFrame(animationFrame);
      if (themeObserver) themeObserver.disconnect();
    };
  }, [layout, camera, treeData, isEmptyTree, hoveredEdge, tooltipPosition, activeStep, playbackSpeed]); // Added activeStep, playbackSpeed dependency
};
