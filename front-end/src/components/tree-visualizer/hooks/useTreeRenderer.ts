import { useEffect, type RefObject } from 'react';
import type { TreeStructure } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { drawRoundedRect, getThemeColors } from '../helpers';

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
  hoveredNodeRef
}: UseTreeRendererProps) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

      // Draw Leaf Node Sibling Links (dashed green lines)
      ctx.save();
      ctx.lineWidth = 2;
      const isDark = document.documentElement.classList.contains('dark');
      ctx.strokeStyle = isDark ? '#10b981' : '#059669'; // green-500 or green-600
      ctx.setLineDash([5, 5]); // Dashed line pattern
      
      // Explicitly set font for measurement to match node rendering
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      
      const measureNodeWidth = (nodeData: any) => {
        if (!nodeData || !nodeData.keys) return 100;
        const keyTexts = formatNodeDataForGraph(nodeData.keys);
        const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        return Math.max(100, totalKeyWidth);
      };
      
      layout.forEach(node => {
        const nodeData = treeData.nodes[node.id.toString()];
        if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
        
        // Check if next page exists in current tree
        const nextNodeData = treeData.nodes[nodeData.nextPage.toString()];
         // We need positions for both nodes
        const currentPos = positionsRef.current.get(node.id);
        const nextPos = positionsRef.current.get(nodeData.nextPage);
        
        if (!currentPos || !nextPos) return;

        // Calculate precise widths using the current render context
        const currentWidth = measureNodeWidth(nodeData);
        const nextWidth = nextNodeData ? measureNodeWidth(nextNodeData) : 100;

        const rightX = currentPos.x + currentWidth / 2;
        const leftX = nextPos.x - nextWidth / 2;
        
        ctx.beginPath();
        ctx.moveTo(rightX, currentPos.y);
        ctx.lineTo(leftX, nextPos.y);
        ctx.stroke();
      });
      ctx.restore();
      
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
        
        const nodeLeft = pos.x - rectW / 2;
        let currentKeyX = nodeLeft + padding;
        
        if (isRoot) {
          const rootFill = isDark ? '#78350f' : '#fef3c7'; // amber-900/50 or amber-100
          const rootStroke = isDark ? '#f59e0b' : '#d97706'; // amber-500 or amber-600
          
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            ctx.fillStyle = rootFill;
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = isRoot ? (isHovered ? 3 : 2) : (isHovered ? 3 : 1.5);
          
          if (isHovered) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = isDark ? 'rgba(245, 158, 11, 0.6)' : 'rgba(217, 119, 6, 0.5)';
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
          
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
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
          const nodeFill = isLeaf ? colors.leafFill : colors.internalFill;
          
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            ctx.fillStyle = nodeFill;
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = isHovered ? 3 : 1.5;
          
          if (isHovered) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = isLeaf 
              ? (isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.5)') 
              : (isDark ? 'rgba(100, 116, 139, 0.6)' : 'rgba(71, 85, 105, 0.5)');
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          const strokeColor = isLeaf ? colors.leafStroke : colors.internalStroke;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          drawRoundedRect(ctx, nodeLeftX, nodeTop, totalKeyWidth, rectH, radius);
          ctx.stroke();
          
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          currentKeyX = nodeLeft + padding;
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            if (idx < keyTexts.length - 1) {
              ctx.beginPath();
              ctx.moveTo(currentKeyX + keyW, nodeTop);
              ctx.lineTo(currentKeyX + keyW, nodeBottom);
              ctx.strokeStyle = isLeaf ? colors.leafStroke : colors.internalStroke;
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
  }, [layout, camera, treeData, isEmptyTree, hoveredEdge, tooltipPosition]);
};
