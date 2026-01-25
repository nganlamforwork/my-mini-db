import { useState, useRef, type RefObject } from 'react';
import type { TreeStructure, TreeNode } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { generateEdgeTooltipText } from '../helpers';

interface UseTreeInteractionProps {
  treeData: TreeStructure;
  layout: LayoutNode[];
  positionsRef: React.MutableRefObject<Map<number, NodePosition>>;
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export const useTreeInteraction = ({
  treeData,
  layout,
  positionsRef,
  containerRef,
  canvasRef,
}: UseTreeInteractionProps) => {
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.8 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const hoveredNodeRef = useRef<number | null>(null);
  const hoveredKeyRef = useRef<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ parentId: number; childIndex: number; tooltipText: string } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Helper to find node (and specific key) at canvas coordinates
  const findNodeAtPosition = (clientX: number, clientY: number): { nodeId: number; keyIndex: number | null } | null => {
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
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) continue;

      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) continue;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;
      
      const nodeLeft = pos.x - rectW / 2;
      const padding = (rectW - totalKeyWidth) / 2;

      // Check if click is within node bounds
      if (
        treeX >= pos.x - rectW / 2 &&
        treeX <= pos.x + rectW / 2 &&
        treeY >= pos.y - rectH / 2 &&
        treeY <= pos.y + rectH / 2
      ) {
        // Hit test for specific keys
        let currentKeyX = nodeLeft + padding;
        let foundKeyIndex: number | null = null;
        
        for (let i = 0; i < keyWidths.length; i++) {
          const keyW = keyWidths[i];
          if (treeX >= currentKeyX && treeX <= currentKeyX + keyW) {
             foundKeyIndex = i;
             break;
          }
          currentKeyX += keyW;
        }
        
        return { nodeId, keyIndex: foundKeyIndex };
      }
    }

    return null;
  };

  // Helper to find edge at canvas coordinates
  const findEdgeAtPosition = (clientX: number, clientY: number): { parentId: number; childIndex: number; tooltipText: string } | null => {
    // ... exact logic as before, just kept for context validity if needed by tool
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
    const result = findNodeAtPosition(e.clientX, e.clientY);
    if (result) {
      const { nodeId, keyIndex } = result;
      const node = treeData.nodes[nodeId.toString()];
      if (node) {
        setSelectedNode(node);
        setSelectedKeyIndex(typeof keyIndex === 'number' ? keyIndex : null);
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
    const result = findNodeAtPosition(e.clientX, e.clientY);
    const hoveredNodeId = result ? result.nodeId : null;
    const hoveredKeyIndex = result ? result.keyIndex : null;

    if (hoveredNodeId !== hoveredNodeRef.current || hoveredKeyIndex !== hoveredKeyRef.current) {
      hoveredNodeRef.current = hoveredNodeId;
      hoveredKeyRef.current = hoveredKeyIndex;
      
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
    const x = -centerX * zoom;
    const y = containerHeight / 2 - 100 - centerY * zoom;

    setCamera({ x, y, zoom });
  };

  return {
    camera,
    setCamera,
    selectedNode,
    setSelectedNode,
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
    selectedKeyIndex,
    setSelectedKeyIndex,
    hoveredKeyRef
  };
};
