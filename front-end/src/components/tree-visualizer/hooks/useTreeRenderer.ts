import { useEffect, type RefObject } from 'react';
import type { TreeStructure, VisualizationStep } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { drawRoundedRect, getThemeColors, drawLeafSiblingLinks } from '../helpers';
import { compareKeys, extractKeyValues } from '@/lib/keyUtils';
import confetti from 'canvas-confetti';

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
  activeStep
}: UseTreeRendererProps) => {
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
          const pos = positionsRef.current.get(id);
          const layoutNode = layoutNodeMap.get(id);
          if (!pos || !layoutNode) return null;
          
          return { x: pos.x, y: pos.y, width: layoutNode.width };
        }
      );

      // Draw Connections with key-aligned anchor points
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.connectionLine;
      ctx.setLineDash([]); // Solid lines for parent-child connections
      
      // Build a map of parent -> children for efficient lookup
      const parentChildrenMap = new Map<number, number[]>();
      layout.forEach(node => {
        if (node.parentId !== null) {
          if (!parentChildrenMap.has(node.parentId)) {
            parentChildrenMap.set(node.parentId, []);
          }
          parentChildrenMap.get(node.parentId)!.push(node.id);
        }
      });
      
      layout.forEach(node => {
        // Get current visual position of child node (updated every frame via lerp)
        const childPos = positionsRef.current.get(node.id);
        if (!childPos || !node.parentId) return;
        
        // Get current visual position of parent node (updated every frame via lerp)
        const parentPos = positionsRef.current.get(node.parentId);
        if (!parentPos) return;
        
        const childX = childPos.x;
        const childY = childPos.y;
        const parentX = parentPos.x;
        const parentY = parentPos.y;
        
        // Get parent node data to calculate key positions
        const parentNodeData = treeData.nodes[node.parentId.toString()];
        if (!parentNodeData || parentNodeData.type !== 'internal') {
          // Fallback for non-internal or missing parent - use current visual positions
          ctx.beginPath();
          ctx.moveTo(parentX, parentY + 25);
          ctx.bezierCurveTo(parentX, parentY + 70, childX, childY - 70, childX, childY - 25);
          ctx.stroke();
          return;
        }
        
        // Find child index in parent's children array
        const parentChildren = parentChildrenMap.get(node.parentId) || [];
        const childIndex = parentChildren.indexOf(node.id);
        if (childIndex === -1) {
          // Fallback if child not found - use current visual positions
          ctx.beginPath();
          ctx.moveTo(parentX, parentY + 25);
          ctx.bezierCurveTo(parentX, parentY + 70, childX, childY - 70, childX, childY - 25);
          ctx.stroke();
          return;
        }
        
        // Calculate anchor point based on key positions
        if (!parentNodeData.keys || !Array.isArray(parentNodeData.keys)) return;
        const numKeys = parentNodeData.keys.length;
        const numChildren = parentChildren.length;
        
        // Calculate node width using key groups (same as rendering)
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        
        // Prepare key texts for width calculation (use truncated keys to match visual rendering)
        const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
        
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
          keyWidths.forEach((keyWidth, idx) => {
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
        const nodeData = treeData.nodes[pos.id.toString()];
        if (!nodeData) return;

        const isLeaf = nodeData.type === 'leaf';
        
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        const keyTexts = formatNodeDataForGraph(nodeData.keys);
        
        const keyWidths = keyTexts.map(keyText => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        const rectW = Math.max(100, totalKeyWidth);
        const rectH = 50;
        const padding = (rectW - totalKeyWidth) / 2;

        ctx.globalAlpha = pos.alpha;
        
        const isHovered = hoveredNodeRef.current === pos.id;
        const isRoot = pos.id === treeData.rootPage;
        
        // --- VISUALIZATION OVERRIDES ---
        let isActive = false;
        let activeNodeFill = '';
        let activeStroke = '';
        const activeKeyIndices = new Set<number>();
        let foundKeyIndex = -1; // Specific index for exact match (Green)

        if (activeStep && activeStep.pageId === pos.id) {
          isActive = true;
          const timeSinceStart = Date.now() - startTime;
          const KEY_SCAN_DURATION = 600; // ms per key

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

                 
                 // If we selected childIdx, it means we passed keys 0 to childIdx-1 (inclusive)
                 // because they were <= SearchKey.
                 // Key[childIdx] was > SearchKey (or end of list), so we stopped before it.
                 // Highlight only the keys we "accepted" as <= SearchKey.
                 const limit = childIdx - 1;
                 
                 // Only add if currentIndex >= 0 (e.g. childIdx=0 -> limit=-1 -> loop doesn't run)
                 // And ensure we don't go beyond our limit
                 // Correction: Use simple loop based on time-stepped index
                 if (limit >= 0) {
                     // We want to animate from 0 to limit.
                     // The max index we can show right now is 'currentIndex'.
                     // But strictly up to 'limit'.
                     const maxToShow = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), limit);
                     for (let i = 0; i <= maxToShow; i++) {
                         activeKeyIndices.add(i);
                     }
                 }
              }
              break;

            case 'SCAN_KEYS': 
              activeNodeFill = isDark ? '#134e4a' : '#ccfbf1'; // teal base (or maybe blue per request?)
              // User said "traverse key -> blue". 
              // "search" usually scans keys. 
              // Let's use blue base for the node, but maybe Cyan for the active operation?
              // User: "traverse key -> blue", "founded key -> green".
              
              activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
              activeStroke = isDark ? '#3b82f6' : '#2563eb';
              
              if ('foundAtIndex' in activeStep && typeof activeStep.foundAtIndex === 'number') {
                  const foundIdx = activeStep.foundAtIndex;
                  if (foundIdx !== -1) {
                    // Start 0 -> foundIdx
                    const currentIndex = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), foundIdx);
                    activeKeyIndices.add(currentIndex);
                    
                    // If we reached the target and it is found
                    if (currentIndex === foundIdx) {
                       foundKeyIndex = foundIdx; // Turns Green
                       
                       // Fire confetti ONCE when we hit the key
                       // To avoid infinite confetti in the render loop, we need a flag or check time
                       // Actually, we can just fire it if timeSinceStart / Duration is roughly just reached.
                       // Or better, checking if we just transitioned. 
                       // Render loop runs 60fps.
                       // We can use a ref to track if we fired for this step?
                       // We don't have a stable step ID to reference easily without a specialized hook.
                       
                       // Simplification: Fire every frame? No.
                       // Let's just calculate random chance? No.
                       
                       // How about: 
                       const justReached = Math.floor(timeSinceStart / KEY_SCAN_DURATION) === foundIdx;
                       const stepElapsed = timeSinceStart % KEY_SCAN_DURATION;
                       // Fire at the start of the key highlight (first 100ms)
                       if (justReached && stepElapsed < 50) {
                           // Calculate screen coordinates
                           // Canvas center = width/2, 100
                           // Node position = pos.x, pos.y relative to canvas origin
                           // Transform: (pos.x * zoom + centerX + cameraX), (pos.y * zoom + centerY + cameraY)
                           
                           const centerX = width / 2;
                           const visualX = (pos.x * camera.zoom) + centerX + (camera.x * camera.zoom);
                           const visualY = (pos.y * camera.zoom) + 100 + (camera.y * camera.zoom);
                           
                           // Normalize to 0-1 for confetti
                           const normX = visualX / window.innerWidth;
                           const normY = visualY / window.innerHeight;
                           
                           if (Math.random() > 0.8) { // Throttle slightly
                               confetti({
                                   particleCount: 5,
                                   spread: 30,
                                   origin: { x: normX, y: normY },
                                   colors: ['#22c55e', '#3b82f6'], // Green and Blue
                                   disableForReducedMotion: true,
                                   zIndex: 9999
                               });
                           }
                       }
                    }
                  } else {
                     // Not found: scanned all
                     const numKeys = nodeData.keys?.length || 0;
                     const currentIndex = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), numKeys - 1);
                     if (currentIndex >= 0 && currentIndex < numKeys) {
                         activeKeyIndices.add(currentIndex);
                     }
                  }
              }
              break;

            case 'FIND_POS': 
              activeNodeFill = isDark ? '#1e3a8a' : '#dbeafe'; 
              activeStroke = isDark ? '#3b82f6' : '#2563eb'; 
              if ('targetIndex' in activeStep && typeof activeStep.targetIndex === 'number') {
                 const target = activeStep.targetIndex;
                 const numKeys = nodeData.keys?.length || 0;
                 const limit = Math.min(target, numKeys - 1);
                 
                 const currentIndex = Math.min(Math.floor(timeSinceStart / KEY_SCAN_DURATION), limit);
                 if (currentIndex >= 0 && currentIndex <= limit) {
                     activeKeyIndices.add(currentIndex);
                 }
              }
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
             default:
               isActive = false;
          }
        }
        
        // --- END OVERRIDES ---

        const nodeLeft = pos.x - rectW / 2;
        let currentKeyX = nodeLeft + padding;
        
        // Determine fills/strokes
        // Priority: Active Step > Hover > Root/Default
        
        const shouldUseActive = isActive && activeNodeFill && activeStroke;
        
        if (isRoot) {
          const rootFill = shouldUseActive ? activeNodeFill : (isDark ? '#78350f' : '#fef3c7'); 
          const rootStroke = shouldUseActive ? activeStroke : (isDark ? '#f59e0b' : '#d97706');
          
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            
            // Highlight specific key if active
            const isKeyActive = isActive && activeKeyIndices.has(idx);
            const isKeyFound = idx === foundKeyIndex;
            const isKeyHovered = isHovered && hoveredKeyRef.current === idx;
            
            let fill = rootFill;
            if (isKeyFound) {
                 fill = isDark ? '#22c55e' : '#4ade80'; // Green
            } else if (isKeyActive) {
                 // URGENT: ALWAYS BLUE for active traversing keys
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
            ctx.shadowColor = rootStroke + '80'; // Add transparency
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
          // Don't override stroke if not active, keeps Leaf vs Internal distinction? 
          // Actually if active, we want to pop.
          const strokeColor = shouldUseActive ? activeStroke : defaultStroke;

          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            
            const isKeyActive = isActive && activeKeyIndices.has(idx);
            const isKeyFound = idx === foundKeyIndex;
            const isKeyHovered = isHovered && hoveredKeyRef.current === idx;
            
            let fill = nodeFill;
            if (isKeyFound) {
                 fill = isDark ? '#22c55e' : '#4ade80'; // Green for found
            } else if (isKeyActive) {
                 // URGENT: ALWAYS BLUE for active traversing keys
                 fill = isDark ? '#3b82f6' : '#93c5fd'; // Blue
            } else if (isKeyHovered) {
                 fill = isDark ? '#3b82f6' : '#93c5fd';
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
  }, [layout, camera, treeData, isEmptyTree, hoveredEdge, tooltipPosition, activeStep]); // Added activeStep dependency
};
