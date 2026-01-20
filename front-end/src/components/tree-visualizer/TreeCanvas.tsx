/**
 * TreeCanvas Component
 * 
 * @description
 * Main orchestrator component for rendering B+ Tree visualizations on an HTML5 Canvas.
 * This component handles the complete tree visualization lifecycle including:
 * - Canvas rendering with hierarchical layout algorithm
 * - Interactive features (pan, zoom, node selection)
 * - Animation support for step-by-step tree operations
 * - Download functionality (JPG, PNG, SVG formats)
 * 
 * @usage
 * ```tsx
 * <TreeCanvas
 *   treeData={treeStructure}
 *   schema={schema}
 *   highlightedNodeId={currentNodeId}
 *   highlightedKey={currentKey}
 *   currentStep={executionStep}
 *   onStepComplete={handleStepComplete}
 *   animationSpeed={50}
 *   config={treeConfig}
 * />
 * ```
 * 
 * @dependencies
 * - Uses TreeNode.tsx for node rendering logic
 * - Uses TreeEdge.tsx for edge rendering logic
 * - Uses Controls.tsx for zoom/download controls
 * - Integrates with useBTreeVisualization hook for state management
 * 
 * @note
 * This component uses Canvas API for performance. For large trees, consider
 * implementing viewport culling to optimize rendering.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { TreeStructure, TreeNode, ExecutionStep, Schema } from '@/types/database';
import { formatKey, compareKeys, formatNodeDataForGraph } from '@/lib/keyUtils';
import { ZoomIn, ZoomOut, Download, RotateCcw, Info, FileImage, FileType, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { NodeDetailDialog } from '../NodeDetailDialog';
import { extractPageId, drawRoundedRect, generateEdgeTooltipText, getThemeColors } from './helpers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface TreeCanvasProps {
  treeData: TreeStructure;
  schema?: Schema | null; // Schema for rendering node details
  highlightedIds?: number[];
  highlightColor?: string;
  highlightedNodeId?: number | null; // Currently executing step's node
  highlightedKey?: { values: Array<{ type: string; value: any }> } | null; // Key being compared/operated on
  overflowNodeId?: number | null; // Node in overflow state (should be highlighted red)
  currentStep?: ExecutionStep | null; // Current step being visualized
  onStepComplete?: () => void; // Callback when step animation completes
  animationSpeed?: number; // 0-100, affects animation duration
  config?: {
    order?: number;
    pageSize?: number;
    cacheSize?: number;
    walEnabled?: boolean;
  };
}

interface NodePosition {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ 
  treeData,
  schema,
  highlightedIds = [], 
  highlightColor = '#3b82f6',
  highlightedNodeId = null,
  highlightedKey = null,
  overflowNodeId = null,
  currentStep = null,
  onStepComplete,
  animationSpeed = 50,
  config
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.8 });
  const positionsRef = useRef<Map<number, NodePosition>>(new Map());
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const hoveredNodeRef = useRef<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ parentId: number; childIndex: number; tooltipText: string } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Real-time edge position tracking - stores current visual positions for edges
  const edgePositionsRef = useRef<Map<string, { startX: number; startY: number; endX: number; endY: number }>>(new Map());
  
  // Animation state for promoted key
  const promotedKeyAnimationRef = useRef<{ startTime: number; duration: number } | null>(null);
  
  // Animation state for inserting key (INSERT_ENTRY)
  // Changed to instant appearance with opacity transition
  const insertingKeyAnimationRef = useRef<{ startTime: number; opacityTransitionDuration: number } | null>(null);
  
  // Check if tree is empty
  const isEmptyTree = useMemo(() => {
    if (!treeData || !treeData.nodes || typeof treeData.nodes !== 'object') {
      return true;
    }
    const nodeCount = Object.keys(treeData.nodes).length;
    return (
      treeData.height === 0 ||
      nodeCount === 0 ||
      treeData.rootPage === 0 ||
      treeData.rootPage === undefined ||
      treeData.rootPage === null ||
      !treeData.nodes[treeData.rootPage.toString()]
    );
  }, [treeData]);

  // Layout algorithm (Hierarchical) - improved to prevent overlaps
  const layout = useMemo(() => {
    if (isEmptyTree) {
      return [];
    }

    const nodes: { id: number; x: number; y: number; parentId: number | null; width: number }[] = [];
    const LEVEL_SPACING = 150;
    const MIN_LEAF_SPACING = 80; // Minimum spacing between leaf nodes (larger to prevent edge overlap)

    const rootNode = treeData.nodes[treeData.rootPage.toString()];
    if (!rootNode) {
      return [];
    }

    // Helper to calculate node width based on keys
    const calculateNodeWidth = (node: any): number => {
      if (!node || !node.keys || !Array.isArray(node.keys)) return 100;
      // Use truncated keys for visual width calculation
      const keyTexts = formatNodeDataForGraph(node.keys);
      const keys = keyTexts.join(' | ');
      
      // Create a temporary canvas context to measure text
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
        return Math.max(100, tempCtx.measureText(keys).width + 40);
      }
      return Math.max(100, keys.length * 8 + 40); // Fallback estimation
    };

    // First pass: collect all nodes with their widths
    const nodeWidths = new Map<number, number>();
    const collectNodes = (nodeId: number): void => {
      const node = treeData.nodes[nodeId.toString()];
      if (!node) {
        return;
      }

      const width = calculateNodeWidth(node);
      nodeWidths.set(nodeId, width);

      if (node.type === 'internal' && node.children) {
        node.children.forEach((childId: number) => {
          collectNodes(childId);
        });
      }
    };

    // Collect nodes starting from root
    collectNodes(treeData.rootPage);

    // Second pass: position nodes with proper spacing
    let leafX = 0;
    const leafNodes: number[] = [];

    const traverse = (nodeId: number, level: number, parentId: number | null): number => {
      const node = treeData.nodes[nodeId.toString()];
      if (!node) return 0;

      const nodeWidth = nodeWidths.get(nodeId) || 100;

      if (node.type === 'leaf') {
        // Position leaf nodes with increased spacing to prevent edge overlap
        const x = leafX + nodeWidth / 2;
        leafX += nodeWidth + MIN_LEAF_SPACING;
        leafNodes.push(nodeId);
        
        nodes.push({ id: nodeId, x, y: level * LEVEL_SPACING, parentId, width: nodeWidth });
        return x;
      } else {
        // Internal node: position based on children
        const childXs: number[] = [];
        node.children?.forEach((childId: number) => {
          childXs.push(traverse(childId, level + 1, nodeId));
        });
        
        let x = 0;
        if (childXs.length > 0) {
          // Position at the center of children
          x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
        } else {
          x = leafX;
        }
        
        nodes.push({ id: nodeId, x, y: level * LEVEL_SPACING, parentId, width: nodeWidth });
        return x;
      }
    };

    // Second pass: traverse and position nodes (rootPage already validated above)
    traverse(treeData.rootPage, 0, null);
    
    // Center the layout
    const root = nodes.find(n => n.id === treeData.rootPage);
    const offsetX = root ? -root.x : 0;
    return nodes.map(n => ({ ...n, x: n.x + offsetX }));
  }, [treeData]);

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

      const colors = getThemeColors()

      // Real-time position tracking: Update node positions with faster lerp for smoother edge tracking
      // Use higher lerp factor (0.2 instead of 0.1) for more responsive edge updates during animations
      const LERP_FACTOR = 0.2; // Increased from 0.1 for faster convergence and smoother edge tracking
      
      layout.forEach(target => {
        let pos = positionsRef.current.get(target.id);
        if (!pos) {
          pos = { id: target.id, x: target.x, y: target.y - 50, targetX: target.x, targetY: target.y, alpha: 0 };
          positionsRef.current.set(target.id, pos);
        }
        pos.targetX = target.x;
        pos.targetY = target.y;
        
        // Real-time position update with faster lerp
        // Positions update every frame, ensuring edges track nodes with zero lag
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
      
      // Real-time edge position tracking: Update edge positions every frame
      // This ensures edges are always in sync with node positions, even during fast animations
      edgePositionsRef.current.clear();

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
      
      // Helper to calculate node width (sum of all key group widths, no gaps)
      const calculateNodeWidth = (nodeData: any): number => {
        if (!nodeData || !nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return 100;
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        // Use truncated keys for width calculation (matches visual rendering)
        const keyTexts = formatNodeDataForGraph(nodeData.keys);
        const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        return Math.max(100, totalKeyWidth);
      };
      
      layout.forEach(node => {
        const nodeData = treeData.nodes[node.id.toString()];
        if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
        
        const pos = positionsRef.current.get(node.id);
        const nextNodeData = treeData.nodes[nodeData.nextPage.toString()];
        const nextPos = positionsRef.current.get(nodeData.nextPage);
        if (!pos || !nextPos || !nextNodeData) return;
        
        // Calculate node widths
        const nodeWidth = calculateNodeWidth(nodeData);
        const nextNodeWidth = calculateNodeWidth(nextNodeData);
        
        // Draw horizontal dashed line between leaf nodes
        ctx.beginPath();
        ctx.moveTo(pos.x + nodeWidth / 2, pos.y); // Right edge of current node
        ctx.lineTo(nextPos.x - nextNodeWidth / 2, nextPos.y); // Left edge of next node
        ctx.stroke();
      });
      ctx.restore();
      
      // Draw Connections with key-aligned anchor points
      // Real-time edge tracking: Edges are "glued" to nodes using current visual positions
      // Positions are read directly from positionsRef every frame for zero-lag rendering
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
      
      // Real-time edge rendering: Read positions directly from refs every frame
      // This ensures edges track nodes with zero lag, even during fast animations
      layout.forEach(node => {
        // Get current visual position of child node (updated every frame via lerp)
        const childPos = positionsRef.current.get(node.id);
        if (!childPos || !node.parentId) return;
        
        // Get current visual position of parent node (updated every frame via lerp)
        const parentPos = positionsRef.current.get(node.parentId);
        if (!parentPos) return;
        
        // Real-time position read: These coordinates are the current visual positions
        // on screen, updated continuously via requestAnimationFrame lerp
        const childX = childPos.x; // Current visual X position (updates every frame)
        const childY = childPos.y; // Current visual Y position (updates every frame)
        const parentX = parentPos.x; // Current visual X position (updates every frame)
        const parentY = parentPos.y; // Current visual Y position (updates every frame)
        
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
        // For N keys, we have N+1 children, so we need N+1 anchor points
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
        // Use current visual position of parent (updated every frame)
        const nodeLeft = parentX - nodeWidth / 2;
        const nodeRight = parentX + nodeWidth / 2;
        // Use same padding calculation as node rendering: center keys in node
        const padding = (nodeWidth - totalKeyWidth) / 2;
        const contentStartX = nodeLeft + padding;
        
        // Calculate anchor points: left edge, dividers, right edge
        let anchorX: number;
        if (numKeys === 0) {
          // No keys: distribute children evenly across parent width
          const childSpacing = nodeWidth / (numChildren + 1);
          anchorX = nodeLeft + childSpacing * (childIndex + 1);
        } else if (numKeys === 1) {
          // Single key: two anchor points (left and right edges of key group)
          const keyW = keyWidths[0];
          const keyLeft = contentStartX;
          const keyRight = keyLeft + keyW;
          if (childIndex === 0) {
            anchorX = keyLeft; // Left edge of key group
          } else {
            anchorX = keyRight; // Right edge of key group
          }
        } else {
          // Multiple keys: calculate positions based on key group boundaries
          // Calculate divider positions (edges between key groups)
          // For N keys, there are N-1 dividers between them
          const dividerPositions: number[] = [];
          let currentX = contentStartX;
          keyWidths.forEach((keyWidth, idx) => {
            currentX += keyWidth; // Move past the key group
            if (idx < numKeys - 1) {
              // Divider is at the right edge of this key group
              dividerPositions.push(currentX);
            }
          });
          
          // Calculate anchor points: left edge, at dividers, right edge
          if (childIndex === 0) {
            // Leftmost child: left edge of first key group
            anchorX = contentStartX;
          } else if (childIndex === numChildren - 1) {
            // Rightmost child: right edge of last key group
            anchorX = contentStartX + totalKeyWidth;
          } else {
            // Middle children: at divider positions
            // childIndex 1 corresponds to divider between key[0] and key[1]
            // childIndex 2 corresponds to divider between key[1] and key[2], etc.
            const dividerIdx = childIndex - 1;
            if (dividerIdx < dividerPositions.length) {
              // Use exact divider position (edge between key groups)
              anchorX = dividerPositions[dividerIdx];
            } else {
              // Fallback
              anchorX = nodeRight - padding / 2;
            }
          }
        }
        
        // Real-time edge rendering: Draw edge using current visual positions
        // Edge acts like a rubber band - always attached to current node positions
        ctx.beginPath();
        
        // Start point: Parent anchor (calculated from parent's current visual position)
        const startX = anchorX;
        const startY = parentY + 25; // Bottom of parent (using current visual Y position)
        
        // End point: Child node center (using current visual positions - updates every frame)
        const endX = childX; // Current visual X - reads directly from positionsRef
        const endY = childY - 25; // Top of child - current visual Y position
        
        // Bezier curve control points (also use current visual positions)
        const control1X = anchorX;
        const control1Y = parentY + 70;
        const control2X = childX; // Current visual position
        const control2Y = childY - 70; // Current visual position
        
        // Store edge position for potential hover/interaction tracking
        const edgeKey = `${node.parentId}-${node.id}`;
        edgePositionsRef.current.set(edgeKey, {
          startX,
          startY,
          endX,
          endY
        });
        
        // Draw the edge - it's "glued" to nodes via real-time position tracking
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
        ctx.stroke();
      });

      // Check if we're inserting a new key (for INSERT_ENTRY animation)
      // This needs to be checked outside the forEach loop to be accessible later
      let isInsertingNewKey = false;
      if (currentStep && currentStep.type === 'INSERT_ENTRY' && highlightedKey && highlightedNodeId !== null) {
        const targetNodeData = treeData.nodes[highlightedNodeId.toString()];
        if (targetNodeData) {
          const keyIndex = targetNodeData.keys.findIndex((k: any) => compareKeys(k, highlightedKey) === 0);
          if (keyIndex === -1) {
            // Key not found in node - this means we're inserting a NEW key
            isInsertingNewKey = true;
          }
        }
      }

      // Draw Nodes
      positionsRef.current.forEach(pos => {
        const nodeData = treeData.nodes[pos.id.toString()];
        if (!nodeData) return;

        const isLeaf = nodeData.type === 'leaf';
        const isHighlighted = highlightedIds.includes(pos.id);
        const isStepHighlighted = highlightedNodeId === pos.id; // Currently executing step's node
        const isOverflow = overflowNodeId === pos.id; // Node in overflow state
        const isDark = document.documentElement.classList.contains('dark');
        
        // Prepare keys - format and truncate for graph visualization
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        const keyTexts = formatNodeDataForGraph(nodeData.keys);
        
        // Find highlighted key index for INSERT_ENTRY animation (use compareKeys instead of indexOf)
        let highlightedKeyIndex: number | null = null;
        if (highlightedKey && (currentStep?.type === 'INSERT_ENTRY' || currentStep?.type === 'LEAF_FOUND')) {
          // Use findIndex with compareKeys instead of indexOf (which fails for composite keys)
          highlightedKeyIndex = nodeData.keys.findIndex((k: any) => compareKeys(k, highlightedKey) === 0);
          if (highlightedKeyIndex === -1) {
            // Key not found - it's being inserted (handled by inserting key animation below)
            highlightedKeyIndex = null;
          }
        }
        
        // Note: We're using hover-style highlighting (border/shadow) for step highlighting
        // For INSERT_ENTRY, we can also highlight the specific key being inserted
        
        // Calculate width for each key group
        const keyWidths = keyTexts.map(keyText => Math.max(60, ctx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        const rectW = Math.max(100, totalKeyWidth);
        const rectH = 50;
        const padding = (rectW - totalKeyWidth) / 2; // Center keys in node

        ctx.globalAlpha = pos.alpha;
        
        // Check if node is hovered and if it's root
        const isHovered = hoveredNodeRef.current === pos.id;
        const isRoot = pos.id === treeData.rootPage;
        
        // Calculate position of first key group
        const nodeLeft = pos.x - rectW / 2;
        let currentKeyX = nodeLeft + padding;
        
        // Root node gets special amber/gold colors
        if (isRoot) {
          const rootFill = isDark ? '#78350f' : '#fef3c7'; // amber-900/50 or amber-100
          const rootStroke = isDark ? '#f59e0b' : '#d97706'; // amber-500 or amber-600
          
          // Draw all key groups filled first (no borders yet)
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            // Highlight the specific key being inserted (for INSERT_ENTRY when key already exists in node)
            const isInsertedKey = highlightedKeyIndex === idx && highlightedKeyIndex !== null && (currentStep?.type === 'INSERT_ENTRY' || currentStep?.type === 'LEAF_FOUND');
            ctx.fillStyle = isInsertedKey ? (isDark ? '#065f46' : '#a7f3d0') : rootFill; // Green tint for inserted key
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          // Draw outer border with rounded corners (only on outside)
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = isRoot ? (isHighlighted ? 3 : (isHovered || isStepHighlighted ? 3 : 2)) : (isHighlighted ? 3 : (isHovered || isStepHighlighted ? 3 : 1.5));
          
          // Set shadow for step highlighting - use hover-style
          // Overflow state takes priority (red highlighting)
          if (isOverflow) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.7)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHighlighted) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = highlightColor;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHovered || isStepHighlighted) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = isDark ? 'rgba(245, 158, 11, 0.6)' : 'rgba(217, 119, 6, 0.5)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          // Overflow nodes get red border
          const strokeColor = isOverflow 
            ? (isDark ? '#ef4444' : '#dc2626') // red-500 or red-600
            : (isHighlighted ? highlightColor : rootStroke);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          drawRoundedRect(ctx, nodeLeftX, nodeTop, totalKeyWidth, rectH, radius);
          ctx.stroke();
          
          // Reset shadow before drawing divider lines to keep them sharp
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw divider lines between key groups (inner separators, no rounded corners)
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
          // Node Body - use theme colors for non-root nodes
          const nodeFill = isLeaf ? colors.leafFill : colors.internalFill;
          
          // Draw all key groups filled first (no borders yet)
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            // Highlight the specific key being inserted (for INSERT_ENTRY when key already exists in node)
            const isInsertedKey = highlightedKeyIndex === idx && highlightedKeyIndex !== null && (currentStep?.type === 'INSERT_ENTRY' || currentStep?.type === 'LEAF_FOUND');
            ctx.fillStyle = isInsertedKey ? (isLeaf ? (isDark ? '#065f46' : '#a7f3d0') : (isDark ? '#1e3a8a' : '#bfdbfe')) : nodeFill; // Green/blue tint for inserted key
            ctx.fillRect(currentKeyX, pos.y - rectH/2, keyW, rectH);
            currentKeyX += keyW;
          });
          
          // Draw outer border with rounded corners (only on outside)
          const nodeTop = pos.y - rectH/2;
          const nodeBottom = pos.y + rectH/2;
          const nodeLeftX = nodeLeft + padding;
          const radius = 6;
          const lineWidth = isHighlighted ? 3 : (isHovered || isStepHighlighted ? 3 : 1.5);
          
          // Set shadow only for outer border - use hover-style for step highlighting
          // Overflow state takes priority (red highlighting)
          if (isOverflow) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = isDark ? 'rgba(239, 68, 68, 0.8)' : 'rgba(220, 38, 38, 0.7)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHighlighted) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = highlightColor;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHovered || isStepHighlighted) {
            // Enhanced hover effect with more contrast (same style for hover and step highlighting)
            ctx.shadowBlur = 12; // Bigger shadow
            ctx.shadowColor = isLeaf 
              ? (isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.5)') 
              : (isDark ? 'rgba(100, 116, 139, 0.6)' : 'rgba(71, 85, 105, 0.5)');
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2; // Slight shadow offset for depth
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          // Overflow nodes get red border
          const strokeColor = isOverflow 
            ? (isDark ? '#ef4444' : '#dc2626') // red-500 or red-600
            : (isHighlighted ? highlightColor : (isLeaf ? colors.leafStroke : colors.internalStroke));
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          drawRoundedRect(ctx, nodeLeftX, nodeTop, totalKeyWidth, rectH, radius);
          ctx.stroke();
          
          // Reset shadow before drawing divider lines to keep them sharp
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          // Draw divider lines between key groups (inner separators, no rounded corners)
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
        
        // Reset shadow after drawing
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw key text in each group
        ctx.fillStyle = colors.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        currentKeyX = nodeLeft + padding;
        keyTexts.forEach((keyText, idx) => {
          const keyW = keyWidths[idx];
          // Highlight inserted key text with stronger color (only if key already exists in node)
          const isInsertedKey = highlightedKeyIndex === idx && highlightedKeyIndex !== null && (currentStep?.type === 'INSERT_ENTRY' || currentStep?.type === 'LEAF_FOUND');
          if (isInsertedKey) {
            ctx.fillStyle = isDark ? '#10b981' : '#059669'; // Emerald green for inserted key text
          } else {
            ctx.fillStyle = colors.textPrimary;
          }
          ctx.fillText(keyText, currentKeyX + keyW / 2, pos.y);
          currentKeyX += keyW;
        });

        // Page ID
        ctx.fillStyle = colors.textSecondary;
        ctx.font = '10px sans-serif';
        ctx.fillText(`P${pos.id}`, nodeLeft + 15, pos.y - rectH/2 - 8);
      });

      // Draw Promoted Key Animation (for NODE_SPLIT and PROMOTE_KEY steps)
      if (currentStep && (currentStep.type === 'NODE_SPLIT' || currentStep.type === 'PROMOTE_KEY')) {
        const promotedKey = currentStep.separatorKey || currentStep.key || currentStep.metadata?.promotedKey || currentStep.metadata?.separatorKey;
        
        if (promotedKey && highlightedNodeId !== null) {
          // Initialize animation timing if not already started
          if (!promotedKeyAnimationRef.current) {
            // Calculate animation duration based on animation speed (same as step delay)
            const stepDelay = Math.max(200, 2000 - (animationSpeed * 18));
            promotedKeyAnimationRef.current = {
              startTime: Date.now(),
              duration: stepDelay
            };
          }
          
          // Get source node position (the node being split)
          const sourcePos = positionsRef.current.get(highlightedNodeId);
          
          // Get target node position (parent node, if available)
          const targetNodeId = currentStep.target_id || currentStep.targetNodeId;
          const targetPageId = targetNodeId ? extractPageId(targetNodeId) : null;
          const targetPos = targetPageId !== null ? positionsRef.current.get(targetPageId) : null;
          
          if (sourcePos) {
            // Format the promoted key safely using formatKey utility
            const promotedKeyText = formatKey(promotedKey);
            
            if (promotedKeyText) {
              ctx.save();
              ctx.font = 'bold 14px "JetBrains Mono", monospace';
              
              // Calculate promoted key width using measureText (proper geometry calculation)
              const textWidth = ctx.measureText(promotedKeyText).width;
              const promotedKeyWidth = Math.max(60, textWidth + 20);
              const promotedKeyHeight = 40;
              
              // Calculate source position (center of the split node)
              const sourceX = sourcePos.x;
              const sourceY = sourcePos.y;
              
              // Calculate target position (if parent exists, use it; otherwise animate upward)
              let targetX = sourceX;
              let targetY = sourceY - 100; // Default: animate upward
              
              if (targetPos) {
                targetX = targetPos.x;
                targetY = targetPos.y + 25; // Bottom of parent node
              }
              
              // Calculate animation progress based on elapsed time
              const now = Date.now();
              const elapsed = now - (promotedKeyAnimationRef.current.startTime || now);
              const progress = Math.min(1, Math.max(0, elapsed / promotedKeyAnimationRef.current.duration));
              
              // Use easing function for smoother animation
              const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
              const easedProgress = easeInOutQuad(progress);
              
              // Interpolate position
              const currentX = sourceX + (targetX - sourceX) * easedProgress;
              const currentY = sourceY + (targetY - sourceY) * easedProgress;
              
              // Draw promoted key with glow effect
              const isDark = document.documentElement.classList.contains('dark');
              ctx.shadowBlur = 15;
              ctx.shadowColor = isDark ? 'rgba(245, 158, 11, 0.8)' : 'rgba(217, 119, 6, 0.7)'; // Amber glow
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Draw background
              const keyLeft = currentX - promotedKeyWidth / 2;
              const keyTop = currentY - promotedKeyHeight / 2;
              ctx.fillStyle = isDark ? '#78350f' : '#fef3c7'; // Amber background
              ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706'; // Amber border
              ctx.lineWidth = 2;
              
              // Draw rounded rectangle
              const radius = 6;
              ctx.beginPath();
              ctx.moveTo(keyLeft + radius, keyTop);
              ctx.lineTo(keyLeft + promotedKeyWidth - radius, keyTop);
              ctx.arcTo(keyLeft + promotedKeyWidth, keyTop, keyLeft + promotedKeyWidth, keyTop + radius, radius);
              ctx.lineTo(keyLeft + promotedKeyWidth, keyTop + promotedKeyHeight - radius);
              ctx.arcTo(keyLeft + promotedKeyWidth, keyTop + promotedKeyHeight, keyLeft + promotedKeyWidth - radius, keyTop + promotedKeyHeight, radius);
              ctx.lineTo(keyLeft + radius, keyTop + promotedKeyHeight);
              ctx.arcTo(keyLeft, keyTop + promotedKeyHeight, keyLeft, keyTop + promotedKeyHeight - radius, radius);
              ctx.lineTo(keyLeft, keyTop + radius);
              ctx.arcTo(keyLeft, keyTop, keyLeft + radius, keyTop, radius);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              
              // Reset shadow
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
              
              // Draw text
              ctx.fillStyle = colors.textPrimary;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(promotedKeyText, currentX, currentY);
              
              ctx.restore();
              
            } 
          } 
        }
      } else {
        // Reset animation ref when step changes
        if (promotedKeyAnimationRef.current) {
          promotedKeyAnimationRef.current = null;
        }
      }
      
      // Draw Inserting Key Animation (for INSERT_ENTRY when key is not yet in node)
      // REFACTORED: Instant appearance with opacity transition, no gradual entry
      if (currentStep && currentStep.type === 'INSERT_ENTRY' && highlightedKey && highlightedNodeId !== null && isInsertingNewKey) {
        // Initialize animation timing if not already started
        if (!insertingKeyAnimationRef.current) {
          // Brief opacity transition duration (much shorter than before)
          const opacityTransitionDuration = 150; // 150ms for opacity snap
          insertingKeyAnimationRef.current = {
            startTime: Date.now(),
            opacityTransitionDuration: opacityTransitionDuration
          };
        }
        
        // Get target node position (the node we're inserting into)
        const targetPos = positionsRef.current.get(highlightedNodeId);
        
        if (targetPos) {
          // Format the inserting key safely using formatKey utility
          const insertingKeyText = formatKey(highlightedKey);
          
          if (insertingKeyText) {
            ctx.save();
            ctx.font = 'bold 14px "JetBrains Mono", monospace';
            
            // Calculate inserting key width using measureText (proper geometry calculation)
            const textWidth = ctx.measureText(insertingKeyText).width;
            const insertingKeyWidth = Math.max(60, textWidth + 20);
            const insertingKeyHeight = 40;
            
            // Calculate target position (center of the target node) - INSTANT POSITION, NO INTERPOLATION
            const targetX = targetPos.x;
            const targetY = targetPos.y;
            
            // Calculate opacity transition: start at 0.5 (temporary state), snap to 1.0 after brief moment
            const now = Date.now();
            const elapsed = now - (insertingKeyAnimationRef.current.startTime || now);
            const opacityProgress = Math.min(1, Math.max(0, elapsed / insertingKeyAnimationRef.current.opacityTransitionDuration));
            
            // Opacity: start at 0.5 (temporary state), then snap to 1.0
            // Use a step function: opacity stays at 0.5 for a brief moment, then snaps to 1.0
            const initialOpacity = 0.5;
            const finalOpacity = 1.0;
            const opacitySnapThreshold = 0.3; // After 30% of transition duration, snap to full opacity
            const currentOpacity = opacityProgress < opacitySnapThreshold 
              ? initialOpacity 
              : finalOpacity; // Instant snap, no gradual transition
            
            // Draw inserting key with glow effect (reduced when at temporary opacity)
            const isDark = document.documentElement.classList.contains('dark');
            ctx.shadowBlur = currentOpacity < 1.0 ? 8 : 15; // Less glow during temporary state
            ctx.shadowColor = isDark ? 'rgba(16, 185, 129, 0.8)' : 'rgba(5, 150, 105, 0.7)'; // Emerald green glow
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw background with opacity
            const keyLeft = targetX - insertingKeyWidth / 2;
            const keyTop = targetY - insertingKeyHeight / 2;
            ctx.globalAlpha = currentOpacity;
            ctx.fillStyle = isDark ? '#065f46' : '#a7f3d0'; // Emerald green background
            ctx.strokeStyle = isDark ? '#10b981' : '#059669'; // Emerald border
            ctx.lineWidth = 2;
            
            // Draw rounded rectangle
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(keyLeft + radius, keyTop);
            ctx.lineTo(keyLeft + insertingKeyWidth - radius, keyTop);
            ctx.arcTo(keyLeft + insertingKeyWidth, keyTop, keyLeft + insertingKeyWidth, keyTop + radius, radius);
            ctx.lineTo(keyLeft + insertingKeyWidth, keyTop + insertingKeyHeight - radius);
            ctx.arcTo(keyLeft + insertingKeyWidth, keyTop + insertingKeyHeight, keyLeft + insertingKeyWidth - radius, keyTop + insertingKeyHeight, radius);
            ctx.lineTo(keyLeft + radius, keyTop + insertingKeyHeight);
            ctx.arcTo(keyLeft, keyTop + insertingKeyHeight, keyLeft, keyTop + insertingKeyHeight - radius, radius);
            ctx.lineTo(keyLeft, keyTop + radius);
            ctx.arcTo(keyLeft, keyTop, keyLeft + radius, keyTop, radius);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Reset shadow and opacity
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw text with opacity
            ctx.fillStyle = colors.textPrimary;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(insertingKeyText, targetX, targetY);
            
            ctx.globalAlpha = 1.0; // Reset global alpha
            ctx.restore();
            
            // After opacity transition completes, the key is fully inserted
            // Overflow detection will happen automatically via the next step (OVERFLOW_DETECTED or NODE_SPLIT)
            // The step animator will handle triggering the split/promote animation sequence
          } 
        } 
      } else {
        // Reset animation ref when step changes
        if (insertingKeyAnimationRef.current) {
          insertingKeyAnimationRef.current = null;
        }
      }
      
      ctx.restore();
      
      // Continue animation loop if nodes are still animating or if we need to keep rendering
      // This ensures edges are continuously updated during delete/merge animations
      animationFrame = requestAnimationFrame(render);
    };

    // Observe theme changes
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
  }, [layout, camera, treeData, highlightedIds, highlightColor, isEmptyTree, hoveredEdge, tooltipPosition, highlightedNodeId, highlightedKey, overflowNodeId, currentStep, animationSpeed]);

  // Handle step completion callback after animation duration
  useEffect(() => {
    if (currentStep && onStepComplete) {
      // Convert animation speed (0-100) to delay in ms
      // Speed 0 = 2000ms, Speed 100 = 200ms
      const delay = Math.max(200, 2000 - (animationSpeed * 18));
      const timeoutId = setTimeout(() => {
        onStepComplete();
      }, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep, onStepComplete, animationSpeed]);

  // Helper to find node at canvas coordinates
  const findNodeAtPosition = (clientX: number, clientY: number): number | null => {
    if (!containerRef.current || !canvasRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Transform to tree coordinates
    const treeX = (x - containerRef.current.clientWidth / 2 - camera.x) / camera.zoom;
    const treeY = (y - 100 - camera.y) / camera.zoom;

    // Check each node's bounding box
    for (const [nodeId, pos] of positionsRef.current) {
      const nodeData = treeData.nodes[nodeId.toString()];
      if (!nodeData) continue;
      if (!nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) continue;

      // Use truncated keys for width calculation (matches visual rendering)
      // Note: The actual node data passed to modal is still full (looked up by nodeId)
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) continue;

      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) continue;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;

      // Check if click is within node bounds
      if (
        treeX >= pos.x - rectW / 2 &&
        treeX <= pos.x + rectW / 2 &&
        treeY >= pos.y - rectH / 2 &&
        treeY <= pos.y + rectH / 2
      ) {
        return nodeId;
      }
    }

    return null;
  };

  // Helper to find edge at canvas coordinates
  const findEdgeAtPosition = (clientX: number, clientY: number): { parentId: number; childIndex: number; tooltipText: string } | null => {
    if (!containerRef.current || !canvasRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Transform to tree coordinates
    const treeX = (x - containerRef.current.clientWidth / 2 - camera.x) / camera.zoom;
    const treeY = (y - 100 - camera.y) / camera.zoom;

    // Build parent-children map
    const parentChildrenMap = new Map<number, number[]>();
    layout.forEach(node => {
      if (node.parentId !== null) {
        if (!parentChildrenMap.has(node.parentId)) {
          parentChildrenMap.set(node.parentId, []);
        }
        parentChildrenMap.get(node.parentId)!.push(node.id);
      }
    });

    // Check each edge
    const EDGE_HOVER_THRESHOLD = 8; // pixels

    for (const node of layout) {
      if (!node.parentId) continue;
      
      const pos = positionsRef.current.get(node.id);
      const parentPos = positionsRef.current.get(node.parentId);
      if (!pos || !parentPos) continue;

      const parentNodeData = treeData.nodes[node.parentId.toString()];
      if (!parentNodeData || parentNodeData.type !== 'internal') continue;

      const parentChildren = parentChildrenMap.get(node.parentId) || [];
      const childIndex = parentChildren.indexOf(node.id);
      if (childIndex === -1) continue;

      if (!parentNodeData.keys || !Array.isArray(parentNodeData.keys)) continue;

      // Calculate anchor point (same logic as rendering)
      const numKeys = parentNodeData.keys.length;
      const numChildren = parentChildren.length;

      // Create temporary context for measurements
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) continue;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';

      // Use truncated keys for edge hover calculation (matches visual rendering)
      const keyTexts = formatNodeDataForGraph(parentNodeData.keys);

      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth = Math.max(100, totalKeyWidth);
      const nodeLeft = parentPos.x - nodeWidth / 2;
      const padding = (nodeWidth - totalKeyWidth) / 2;
      const contentStartX = nodeLeft + padding;

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
          anchorX = dividerIdx < dividerPositions.length ? dividerPositions[dividerIdx] : nodeLeft + nodeWidth - padding / 2;
        }
      }

      // Check if point is near the bezier curve
      // Sample points along the curve and check distance
      const startX = anchorX;
      const startY = parentPos.y + 25;
      const endX = pos.x;
      const endY = pos.y - 25;
      const control1X = anchorX;
      const control1Y = parentPos.y + 70;
      const control2X = pos.x;
      const control2Y = pos.y - 70;

      // Sample points along the bezier curve
      for (let t = 0; t <= 1; t += 0.05) {
        const bezierX = 
          Math.pow(1 - t, 3) * startX +
          3 * Math.pow(1 - t, 2) * t * control1X +
          3 * (1 - t) * Math.pow(t, 2) * control2X +
          Math.pow(t, 3) * endX;
        const bezierY = 
          Math.pow(1 - t, 3) * startY +
          3 * Math.pow(1 - t, 2) * t * control1Y +
          3 * (1 - t) * Math.pow(t, 2) * control2Y +
          Math.pow(t, 3) * endY;

        const distance = Math.sqrt(Math.pow(treeX - bezierX, 2) + Math.pow(treeY - bezierY, 2));
        if (distance < EDGE_HOVER_THRESHOLD) {
          const tooltipText = generateEdgeTooltipText(parentNodeData.keys, childIndex, numChildren);
          return { parentId: node.parentId, childIndex, tooltipText };
        }
      }
    }

    return null;
  };

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const clickedNodeId = findNodeAtPosition(e.clientX, e.clientY);
    if (clickedNodeId !== null) {
      const node = treeData.nodes[clickedNodeId.toString()];
      if (node) {
        setSelectedNode(node);
        setDialogOpen(true);
        setHoveredEdge(null);
        setTooltipPosition(null);
        return;
      }
    }
    
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setHoveredEdge(null);
    setTooltipPosition(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update hover state - triggers re-render for smooth visual transition
    const hoveredNodeId = findNodeAtPosition(e.clientX, e.clientY);
    if (hoveredNodeId !== hoveredNodeRef.current) {
      hoveredNodeRef.current = hoveredNodeId;
      // Force re-render to show hover effect smoothly via requestAnimationFrame
      if (canvasRef.current) {
        // Re-render will happen automatically on next frame
      }
      
      // Update cursor with transition
      if (containerRef.current) {
        containerRef.current.style.cursor = hoveredNodeId !== null ? 'pointer' : (isDragging.current ? 'grabbing' : 'grab');
        containerRef.current.style.transition = 'cursor 0.2s ease';
      }
    }

    // Check for edge hover (only if not dragging and not hovering over a node)
    if (!isDragging.current && hoveredNodeId === null) {
      const edge = findEdgeAtPosition(e.clientX, e.clientY);
      if (edge && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setHoveredEdge(edge);
        setTooltipPosition({ 
          x: e.clientX - rect.left, 
          y: e.clientY - rect.top 
        });
        containerRef.current.style.cursor = 'help';
      } else {
        if (hoveredEdge) {
          setHoveredEdge(null);
          setTooltipPosition(null);
        }
        if (containerRef.current && hoveredNodeId === null) {
          containerRef.current.style.cursor = isDragging.current ? 'grabbing' : 'grab';
        }
      }
    } else {
      if (hoveredEdge) {
        setHoveredEdge(null);
        setTooltipPosition(null);
      }
    }

    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Don't handle wheel events if dialog is open - let dialog handle its own scroll
    if (dialogOpen) {
      return;
    }
    
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    setCamera(prev => ({ ...prev, zoom: Math.min(Math.max(0.1, prev.zoom + delta), 4) }));
  };

  const handleZoomIn = () => {
    setCamera(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 4) }));
  };

  const handleZoomOut = () => {
    setCamera(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }));
  };

  const handleResetView = () => {
    // Calculate bounding box of all nodes
    if (layout.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 0.8 });
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layout.forEach(node => {
      const pos = positionsRef.current.get(node.id);
      if (pos) {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }
    });

    // Add padding
    const padding = 100;
    const treeWidth = maxX - minX + padding * 2;
    const treeHeight = maxY - minY + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Calculate zoom to fit tree with padding
    const zoomX = (containerWidth * 0.8) / treeWidth;
    const zoomY = (containerHeight * 0.8) / treeHeight;
    const zoom = Math.min(zoomX, zoomY, 1.5); // Cap at 1.5x

    // Center the tree in the canvas
    // The rendering uses: ctx.translate(width/2 + camera.x, 100 + camera.y)
    // After translation and zoom, tree center (centerX, centerY) appears at:
    // (width/2 + camera.x + centerX * zoom, 100 + camera.y + centerY * zoom)
    // We want this to be at screen center (width/2, height/2)
    // So: camera.x = -centerX * zoom
    // And: camera.y = height/2 - 100 - centerY * zoom
    const x = -centerX * zoom;
    const y = containerHeight / 2 - 100 - centerY * zoom;

    setCamera({ x, y, zoom });
  };

  // Helper to calculate bounding box
  const calculateBoundingBox = () => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      layout.forEach(node => {
        const pos = positionsRef.current.get(node.id);
        if (pos) {
          const nodeData = treeData.nodes[node.id.toString()];
          if (nodeData && nodeData.keys && Array.isArray(nodeData.keys) && nodeData.keys.length > 0) {
            // Use truncated keys for bounding box calculation (matches visual rendering)
            const keyTexts = formatNodeDataForGraph(nodeData.keys);
          const tempCtx = document.createElement('canvas').getContext('2d');
          if (tempCtx) {
            tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
            const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
            const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
            const rectW = Math.max(100, totalKeyWidth);
            const rectH = 50;
            minX = Math.min(minX, pos.x - rectW/2);
            maxX = Math.max(maxX, pos.x + rectW/2);
            minY = Math.min(minY, pos.y - rectH/2);
            maxY = Math.max(maxY, pos.y + rectH/2);
          }
        }
      }
    });
    return { minX, maxX, minY, maxY };
  };


  // Helper to draw tree on canvas
  const drawTreeOnCanvas = (ctx: CanvasRenderingContext2D, padding: number, minX: number, minY: number, withBackground: boolean) => {
    const colors = getThemeColors();
    const isDark = document.documentElement.classList.contains('dark');

    if (withBackground) {
      // Background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, ctx.canvas.width / 2, ctx.canvas.height / 2);

      // Draw pattern
      for (let x = 0; x < ctx.canvas.width / 2; x += 24) {
        for (let y = 0; y < ctx.canvas.height / 2; y += 24) {
          ctx.fillStyle = colors.bgPattern;
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Translate to center the tree
    ctx.save();
    ctx.translate(padding - minX, padding - minY);

    // Draw Leaf Node Sibling Links (dashed green lines)
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isDark ? '#10b981' : '#059669';
    ctx.setLineDash([5, 5]);
    
    const calculateNodeWidthForDownload = (nodeData: any): number => {
      if (!nodeData || !nodeData.keys || !Array.isArray(nodeData.keys)) return 100;
      // Use truncated keys for visual width calculation
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      return Math.max(100, totalKeyWidth);
    };
    
    layout.forEach(node => {
      const nodeData = treeData.nodes[node.id.toString()];
      if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
      
      const pos = positionsRef.current.get(node.id);
      const nextNodeData = treeData.nodes[nodeData.nextPage.toString()];
      const nextPos = positionsRef.current.get(nodeData.nextPage);
      if (!pos || !nextPos || !nextNodeData) return;
      
      const nodeWidth = calculateNodeWidthForDownload(nodeData);
      const nextNodeWidth = calculateNodeWidthForDownload(nextNodeData);
      
      ctx.beginPath();
      ctx.moveTo(pos.x + nodeWidth / 2, pos.y);
      ctx.lineTo(nextPos.x - nextNodeWidth / 2, nextPos.y);
      ctx.stroke();
    });
    ctx.restore();

    // Draw connections with key-aligned anchor points
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.connectionLine;
    ctx.setLineDash([]);
    
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
      const pos = positionsRef.current.get(node.id);
      if (!pos || !node.parentId) return;
      const parentPos = positionsRef.current.get(node.parentId);
      if (!parentPos) return;
      
      const parentNodeData = treeData.nodes[node.parentId.toString()];
      if (!parentNodeData || parentNodeData.type !== 'internal') {
        ctx.beginPath();
        ctx.moveTo(parentPos.x, parentPos.y + 25);
        ctx.bezierCurveTo(parentPos.x, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
        ctx.stroke();
        return;
      }
      
      const parentChildren = parentChildrenMap.get(node.parentId) || [];
      const childIndex = parentChildren.indexOf(node.id);
      if (childIndex === -1) {
        ctx.beginPath();
        ctx.moveTo(parentPos.x, parentPos.y + 25);
        ctx.bezierCurveTo(parentPos.x, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
        ctx.stroke();
        return;
      }
      
      if (!parentNodeData.keys || !Array.isArray(parentNodeData.keys)) return;
      const numKeys = parentNodeData.keys.length;
      const numChildren = parentChildren.length;
      
      // Calculate node width using key groups (same as rendering)
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      
      // Prepare key texts for width calculation (use truncated keys for visual rendering)
      const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
      
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth = Math.max(100, totalKeyWidth);
      const nodeLeft = parentPos.x - nodeWidth / 2;
      const nodeRight = parentPos.x + nodeWidth / 2;
      // Use same padding calculation as node rendering: center keys in node
      const padding = (nodeWidth - totalKeyWidth) / 2;
      const contentStartX = nodeLeft + padding;
      
      // Calculate anchor points: left edge, dividers, right edge
      let anchorX: number;
      if (numKeys === 0) {
        // No keys: distribute children evenly across parent width
        const childSpacing = nodeWidth / (numChildren + 1);
        anchorX = nodeLeft + childSpacing * (childIndex + 1);
      } else if (numKeys === 1) {
        // Single key: two anchor points (left and right edges of key group)
        const keyW = keyWidths[0];
        const keyLeft = contentStartX;
        const keyRight = keyLeft + keyW;
        if (childIndex === 0) {
          anchorX = keyLeft; // Left edge of key group
        } else {
          anchorX = keyRight; // Right edge of key group
        }
      } else {
        // Multiple keys: calculate positions based on key group boundaries
        // Calculate divider positions (edges between key groups)
        const dividerPositions: number[] = [];
        let currentX = contentStartX;
        keyWidths.forEach((keyWidth, idx) => {
          currentX += keyWidth; // Move past the key group
          if (idx < numKeys - 1) {
            // Divider is at the right edge of this key group
            dividerPositions.push(currentX);
          }
        });
        
        // Calculate anchor points: left edge, at dividers, right edge
        if (childIndex === 0) {
          // Leftmost child: left edge of first key group
          anchorX = contentStartX;
        } else if (childIndex === numChildren - 1) {
          // Rightmost child: right edge of last key group
          anchorX = contentStartX + totalKeyWidth;
        } else {
          // Middle children: at divider positions
          const dividerIdx = childIndex - 1;
          if (dividerIdx < dividerPositions.length) {
            // Use exact divider position (edge between key groups)
            anchorX = dividerPositions[dividerIdx];
          } else {
            // Fallback
            anchorX = nodeRight - padding / 2;
          }
        }
      }
      
      ctx.beginPath();
      ctx.moveTo(anchorX, parentPos.y + 25);
      ctx.bezierCurveTo(anchorX, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
      ctx.stroke();
    });

    // Draw nodes
    positionsRef.current.forEach(pos => {
      const nodeData = treeData.nodes[pos.id.toString()];
      if (!nodeData) return;
      if (!nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return;

      const isLeaf = nodeData.type === 'leaf';
      
      // Prepare keys - format and truncate for graph visualization only
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) return;

      // Calculate width for each key group
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;
      const padding = (rectW - totalKeyWidth) / 2; // Center keys in node

      const nodeLeft = pos.x - rectW / 2;
      let currentKeyX = nodeLeft + padding;

      ctx.fillStyle = isLeaf ? colors.leafFill : colors.internalFill;
      ctx.strokeStyle = isLeaf ? colors.leafStroke : colors.internalStroke;
      ctx.lineWidth = 1.5;

      // Draw each key group as connected rectangles (button group style)
      keyTexts.forEach((_keyText, idx) => {
        const keyW = keyWidths[idx];
        const isFirst = idx === 0;
        const isLast = idx === keyTexts.length - 1;
        const radius = 6;
        
        // Only round corners on first and last key groups
        if (isFirst && isLast) {
          drawRoundedRect(ctx, currentKeyX, pos.y - rectH/2, keyW, rectH, radius);
        } else if (isFirst) {
          drawRoundedRect(ctx, currentKeyX, pos.y - rectH/2, keyW, rectH, radius, { topLeft: true, bottomLeft: true });
        } else if (isLast) {
          drawRoundedRect(ctx, currentKeyX, pos.y - rectH/2, keyW, rectH, radius, { topRight: true, bottomRight: true });
        } else {
          drawRoundedRect(ctx, currentKeyX, pos.y - rectH/2, keyW, rectH, 0);
        }
        
        ctx.fill();
        ctx.stroke();
        
        // Draw divider line between key groups (except after last)
        if (!isLast) {
          ctx.beginPath();
          ctx.moveTo(currentKeyX + keyW, pos.y - rectH/2);
          ctx.lineTo(currentKeyX + keyW, pos.y + rectH/2);
          ctx.strokeStyle = isLeaf ? colors.leafStroke : colors.internalStroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        
        currentKeyX += keyW;
      });

      // Draw key text in each group
      ctx.fillStyle = colors.textPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      currentKeyX = nodeLeft + padding;
      keyTexts.forEach((keyText, idx) => {
        const keyW = keyWidths[idx];
        ctx.fillText(keyText, currentKeyX + keyW / 2, pos.y);
        currentKeyX += keyW;
      });

      ctx.fillStyle = colors.textSecondary;
      ctx.font = '10px sans-serif';
      ctx.fillText(`P${pos.id}`, nodeLeft + 15, pos.y - rectH/2 - 8);
    });

    ctx.restore();
  };

  const handleDownloadImage = (format: 'jpg' | 'png' | 'svg') => {
    if (layout.length === 0) return;

    const { minX, maxX, minY, maxY } = calculateBoundingBox();
    const padding = 40;
    const treeWidth = maxX - minX + padding * 2;
    const treeHeight = maxY - minY + padding * 2;

    if (format === 'svg') {
      handleDownloadSVG(minX, minY, treeWidth, treeHeight, padding);
      return;
    }

    // For JPG and PNG
    const scale = 2;
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    tempCanvas.width = treeWidth * scale;
    tempCanvas.height = treeHeight * scale;
    ctx.scale(scale, scale);

    const withBackground = format === 'jpg';
    
    drawTreeOnCanvas(ctx, padding, minX, minY, withBackground);

    // Download
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : undefined;
    
    tempCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tree-visualization-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, mimeType, quality);
  };

  const handleDownloadSVG = (minX: number, minY: number, treeWidth: number, treeHeight: number, padding: number) => {
    const colors = getThemeColors();
    const isDark = document.documentElement.classList.contains('dark');
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${treeWidth}" height="${treeHeight}" viewBox="0 0 ${treeWidth} ${treeHeight}">`;
    
    // Draw connections first (so they appear behind nodes)
    const parentChildrenMap = new Map<number, number[]>();
    layout.forEach(node => {
      if (node.parentId !== null) {
        if (!parentChildrenMap.has(node.parentId)) {
          parentChildrenMap.set(node.parentId, []);
        }
        parentChildrenMap.get(node.parentId)!.push(node.id);
      }
    });

    // Draw parent-child connections
    layout.forEach(node => {
      const pos = positionsRef.current.get(node.id);
      if (!pos || !node.parentId) return;
      const parentPos = positionsRef.current.get(node.parentId);
      if (!parentPos) return;
      
      const parentNodeData = treeData.nodes[node.parentId.toString()];
      if (!parentNodeData || parentNodeData.type !== 'internal') {
        const x1 = padding - minX + parentPos.x;
        const y1 = padding - minY + parentPos.y + 25;
        const x2 = padding - minX + pos.x;
        const y2 = padding - minY + pos.y - 25;
        const cx1 = x1;
        const cy1 = y1 + 45;
        const cx2 = x2;
        const cy2 = y2 - 45;
        svg += `<path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" stroke="${colors.connectionLine}" stroke-width="2" fill="none"/>`;
        return;
      }
      
      const parentChildren = parentChildrenMap.get(node.parentId) || [];
      const childIndex = parentChildren.indexOf(node.id);
      if (childIndex === -1) return;
      
      // Calculate anchor point (simplified for SVG)
      const numKeys = parentNodeData.keys.length;
      // Calculate node width using key groups (same as rendering)
      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) return;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      
      // Prepare key texts for width calculation (use truncated keys for visual rendering)
      const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
      
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth = Math.max(100, totalKeyWidth);
      const nodeLeft = parentPos.x - nodeWidth / 2;
      const nodeRight = parentPos.x + nodeWidth / 2;
      // Use same padding calculation as node rendering: center keys in node
      const nodePadding = (nodeWidth - totalKeyWidth) / 2;
      const contentStartX = nodeLeft + nodePadding;
      
      // Calculate anchor points: left edge, dividers, right edge
      let anchorX: number;
      if (numKeys === 0) {
        // No keys: distribute children evenly across parent width
        const childSpacing = nodeWidth / (parentChildren.length + 1);
        anchorX = nodeLeft + childSpacing * (childIndex + 1);
      } else if (numKeys === 1) {
        // Single key: two anchor points (left and right edges of key group)
        const keyW = keyWidths[0];
        const keyLeft = contentStartX;
        const keyRight = keyLeft + keyW;
        if (childIndex === 0) {
          anchorX = keyLeft; // Left edge of key group
        } else {
          anchorX = keyRight; // Right edge of key group
        }
      } else {
        // Multiple keys: calculate positions based on key group boundaries
        // Calculate divider positions (edges between key groups)
        const dividerPositions: number[] = [];
        let currentX = contentStartX;
        keyWidths.forEach((keyWidth, idx) => {
          currentX += keyWidth; // Move past the key group
          if (idx < numKeys - 1) {
            // Divider is at the right edge of this key group
            dividerPositions.push(currentX);
          }
        });
        
        // Calculate anchor points: left edge, at dividers, right edge
        if (childIndex === 0) {
          // Leftmost child: left edge of first key group
          anchorX = contentStartX;
        } else if (childIndex === parentChildren.length - 1) {
          // Rightmost child: right edge of last key group
          anchorX = contentStartX + totalKeyWidth;
        } else {
          // Middle children: at divider positions
          const dividerIdx = childIndex - 1;
          if (dividerIdx < dividerPositions.length) {
            // Use exact divider position (edge between key groups)
            anchorX = dividerPositions[dividerIdx];
          } else {
            // Fallback
            anchorX = nodeRight - nodePadding / 2;
          }
        }
      }
      
      const x1 = padding - minX + anchorX;
      const y1 = padding - minY + parentPos.y + 25;
      const x2 = padding - minX + pos.x;
      const y2 = padding - minY + pos.y - 25;
      const cx1 = x1;
      const cy1 = y1 + 45;
      const cx2 = x2;
      const cy2 = y2 - 45;
      svg += `<path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" stroke="${colors.connectionLine}" stroke-width="2" fill="none"/>`;
    });

    // Draw leaf sibling links
    layout.forEach(node => {
      const nodeData = treeData.nodes[node.id.toString()];
      if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
      
      const pos = positionsRef.current.get(node.id);
      const nextNodeData = treeData.nodes[nodeData.nextPage.toString()];
      const nextPos = positionsRef.current.get(nodeData.nextPage);
      if (!pos || !nextPos || !nextNodeData) return;
      
      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) return;
      if (!nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return;
      if (!nextNodeData.keys || !Array.isArray(nextNodeData.keys) || nextNodeData.keys.length === 0) return;
      
      // Use truncated keys for SVG export (matches visual rendering)
      const keyTexts1 = formatNodeDataForGraph(nodeData.keys);
      const keyTexts2 = formatNodeDataForGraph(nextNodeData.keys);
      if (keyTexts1.length === 0 || keyTexts2.length === 0) return;
      
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyWidths1 = keyTexts1.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const keyWidths2 = keyTexts2.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth1 = keyWidths1.reduce((sum: number, w: number) => sum + w, 0);
      const totalKeyWidth2 = keyWidths2.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth1 = Math.max(100, totalKeyWidth1);
      const nodeWidth2 = Math.max(100, totalKeyWidth2);
      
      const x1 = padding - minX + pos.x + nodeWidth1 / 2;
      const y1 = padding - minY + pos.y;
      const x2 = padding - minX + nextPos.x - nodeWidth2 / 2;
      const y2 = padding - minY + nextPos.y;
      
      svg += `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${isDark ? '#10b981' : '#059669'}" stroke-width="2" stroke-dasharray="5,5" fill="none"/>`;
    });

    // Draw nodes
    positionsRef.current.forEach(pos => {
      const nodeData = treeData.nodes[pos.id.toString()];
      if (!nodeData) return;
      if (!nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return;

      const isLeaf = nodeData.type === 'leaf';
      
      // Prepare keys - format and truncate for graph visualization
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) return;

      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) return;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      
      // Calculate width for each key group
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;
      const nodePadding = (rectW - totalKeyWidth) / 2; // Center keys in node

      const nodeX = padding - minX + pos.x;
      const nodeY = padding - minY + pos.y;
      const nodeLeft = nodeX - rectW / 2;
      let currentKeyX = nodeLeft + nodePadding;
      const rx = 6;

      // Draw each key group as connected rectangles (button group style)
      keyTexts.forEach((keyText, idx) => {
        const keyW = keyWidths[idx];
        const keyX = currentKeyX;
        const isFirst = idx === 0;
        const isLast = idx === keyTexts.length - 1;
        const escapedKeyText = keyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Only round corners on first and last key groups
        let rxLeft = 0, rxRight = 0;
        if (isFirst && isLast) {
          rxLeft = rx;
          rxRight = rx;
        } else if (isFirst) {
          rxLeft = rx;
        } else if (isLast) {
          rxRight = rx;
        }
        
        // Create path for rounded rectangle with selective corners
        const yTop = nodeY - rectH/2;
        const yBottom = nodeY + rectH/2;
        let path = '';
        
        if (rxLeft > 0 && rxRight > 0) {
          // All corners rounded
          path = `M ${keyX + rxLeft} ${yTop} L ${keyX + keyW - rxRight} ${yTop} Q ${keyX + keyW} ${yTop} ${keyX + keyW} ${yTop + rxRight} L ${keyX + keyW} ${yBottom - rxRight} Q ${keyX + keyW} ${yBottom} ${keyX + keyW - rxRight} ${yBottom} L ${keyX + rxLeft} ${yBottom} Q ${keyX} ${yBottom} ${keyX} ${yBottom - rxLeft} L ${keyX} ${yTop + rxLeft} Q ${keyX} ${yTop} ${keyX + rxLeft} ${yTop} Z`;
        } else if (rxLeft > 0) {
          // Only left corners rounded
          path = `M ${keyX + rxLeft} ${yTop} L ${keyX + keyW} ${yTop} L ${keyX + keyW} ${yBottom} L ${keyX + rxLeft} ${yBottom} Q ${keyX} ${yBottom} ${keyX} ${yBottom - rxLeft} L ${keyX} ${yTop + rxLeft} Q ${keyX} ${yTop} ${keyX + rxLeft} ${yTop} Z`;
        } else if (rxRight > 0) {
          // Only right corners rounded
          path = `M ${keyX} ${yTop} L ${keyX + keyW - rxRight} ${yTop} Q ${keyX + keyW} ${yTop} ${keyX + keyW} ${yTop + rxRight} L ${keyX + keyW} ${yBottom - rxRight} Q ${keyX + keyW} ${yBottom} ${keyX + keyW - rxRight} ${yBottom} L ${keyX} ${yBottom} Z`;
        } else {
          // No rounded corners
          path = `M ${keyX} ${yTop} L ${keyX + keyW} ${yTop} L ${keyX + keyW} ${yBottom} L ${keyX} ${yBottom} Z`;
        }
        
        svg += `<path d="${path}" fill="${isLeaf ? colors.leafFill : colors.internalFill}" stroke="${isLeaf ? colors.leafStroke : colors.internalStroke}" stroke-width="1.5"/>`;
        svg += `<text x="${keyX + keyW/2}" y="${nodeY}" text-anchor="middle" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="bold" fill="${colors.textPrimary}">${escapedKeyText}</text>`;
        
        // Draw divider line between key groups (except after last)
        if (!isLast) {
          svg += `<line x1="${keyX + keyW}" y1="${yTop}" x2="${keyX + keyW}" y2="${yBottom}" stroke="${isLeaf ? colors.leafStroke : colors.internalStroke}" stroke-width="1"/>`;
        }
        
        currentKeyX += keyW;
      });

      // Page ID
      svg += `<text x="${nodeLeft + 15}" y="${nodeY - rectH/2 - 8}" font-family="sans-serif" font-size="10" fill="${colors.textSecondary}">P${pos.id}</text>`;
    });

    svg += '</svg>';

    // Download SVG
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tree-visualization-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get pattern color based on theme
  const [patternColor, setPatternColor] = useState('#e2e8f0')
  
  useEffect(() => {
    const updatePatternColor = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setPatternColor(isDark ? '#1e293b' : '#e2e8f0')
    }
    
    updatePatternColor()
    const observer = new MutationObserver(updatePatternColor)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

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
          setHoveredEdge(null);
          setTooltipPosition(null);
        }}
        onWheel={handleWheel}
        style={{ backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
      >
      {isEmptyTree ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2 p-8">
            <div className="text-lg font-semibold text-muted-foreground">Empty Tree</div>
            <div className="text-sm text-muted-foreground">This tree has no nodes yet. Add some nodes to see the tree.</div>
          </div>
        </div>
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
      
      {/* Tree Configuration */}
      {config && (
        <div className="absolute top-6 left-6 border border-border p-3 rounded-xl backdrop-blur-md pointer-events-none select-none bg-card/80 z-10">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Tree Configuration</div>
          <div className="space-y-1.5 text-xs">
            {config.order !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Order:</span>
                <span className="font-mono font-semibold text-foreground">{config.order}</span>
              </div>
            )}
            {config.pageSize !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Page Size:</span>
                <span className="font-mono font-semibold text-foreground">{config.pageSize} bytes</span>
              </div>
            )}
            {config.cacheSize !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Cache Size:</span>
                <span className="font-mono font-semibold text-foreground">{config.cacheSize} pages</span>
              </div>
            )}
            {config.walEnabled !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">WAL:</span>
                <span className={`font-semibold ${config.walEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {config.walEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
              <span className="text-muted-foreground">Root Page:</span>
              <span className="font-mono font-semibold text-foreground">#{treeData.rootPage}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Height:</span>
              <span className="font-mono font-semibold text-foreground">{treeData.height}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 border border-border p-3 rounded-xl backdrop-blur-md pointer-events-none flex flex-col gap-2">
        <div className="flex items-center gap-3 text-xs mb-2">
          <div className="w-3 h-3 bg-amber-100 dark:bg-amber-900/50 border border-amber-500 dark:border-amber-400 rounded-sm" />
          <span className="text-foreground font-medium">Root Node (can be Leaf or Internal)</span>
        </div>
        <div className="flex items-center gap-3 text-xs mb-2">
          <div className="w-3 h-3 bg-muted border border-border rounded-sm" />
          <span className="text-foreground font-medium">Internal (Index Node)</span>
        </div>
        <div className="flex items-center gap-3 text-xs mb-2">
          <div className="w-3 h-3 bg-emerald-900/50 dark:bg-emerald-900/50 border border-emerald-500 rounded-sm" />
          <span className="text-foreground font-medium">Leaf (Data Node)</span>
        </div>
        <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Click on any node to view details</span>
        </div>
      </div>

      {/* Node Detail Dialog */}
      <NodeDetailDialog
        node={selectedNode}
        schema={schema}
        isRoot={selectedNode?.pageId === treeData.rootPage}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Zoom Controls */}
      <div className="absolute top-6 right-6 flex flex-col items-center gap-2  border border-border p-2 rounded-lg backdrop-blur-md shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="h-8 w-8"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="h-8 w-8"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-full h-px bg-border my-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleResetView}
          className="h-8 w-8"
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Download Image"
            >
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleDownloadImage('jpg')}>
              <ImageIcon className="mr-2 h-4 w-4" />
              <span>JPG (with background)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadImage('png')}>
              <FileImage className="mr-2 h-4 w-4" />
              <span>PNG (transparent)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadImage('svg')}>
              <FileType className="mr-2 h-4 w-4" />
              <span>SVG (vector)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="w-full h-px bg-border my-1" />
        <div className="text-[10px] text-muted-foreground text-center px-2 py-1">
          {Math.round(camera.zoom * 100)}%
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
};
