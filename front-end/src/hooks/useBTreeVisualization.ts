import { useState, useRef, useMemo, useCallback } from 'react';
import type { TreeStructure, TreeNode, ExecutionStep, Schema } from '@/types/database';
import { formatNodeDataForGraph } from '@/lib/keyUtils';

export interface VisualizationState {
  highlightedIds: number[];
  highlightColor: string;
  highlightedNodeId: number | null;
  highlightedKey: { values: Array<{ type: string; value: any }> } | null;
  overflowNodeId: number | null;
  currentStep: ExecutionStep | null;
  animationSpeed: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface NodePosition {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alpha: number;
}

export interface UseBTreeVisualizationOptions {
  treeData: TreeStructure;
  schema?: Schema | null;
  highlightedIds?: number[];
  highlightColor?: string;
  highlightedNodeId?: number | null;
  highlightedKey?: { values: Array<{ type: string; value: any }> } | null;
  overflowNodeId?: number | null;
  currentStep?: ExecutionStep | null;
  onStepComplete?: () => void;
  animationSpeed?: number;
  config?: {
    order?: number;
    pageSize?: number;
    cacheSize?: number;
    walEnabled?: boolean;
  };
}

export interface UseBTreeVisualizationReturn {
  // State
  visualizationState: VisualizationState;
  camera: CameraState;
  setCamera: React.Dispatch<React.SetStateAction<CameraState>>;
  selectedNode: TreeNode | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<TreeNode | null>>;
  dialogOpen: boolean;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredEdge: { parentId: number; childIndex: number; tooltipText: string } | null;
  setHoveredEdge: React.Dispatch<React.SetStateAction<{ parentId: number; childIndex: number; tooltipText: string } | null>>;
  tooltipPosition: { x: number; y: number } | null;
  setTooltipPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  
  // Refs
  positionsRef: React.MutableRefObject<Map<number, NodePosition>>;
  edgePositionsRef: React.MutableRefObject<Map<string, { startX: number; startY: number; endX: number; endY: number }>>;
  promotedKeyAnimationRef: React.MutableRefObject<{ startTime: number; duration: number } | null>;
  insertingKeyAnimationRef: React.MutableRefObject<{ startTime: number; opacityTransitionDuration: number } | null>;
  hoveredNodeRef: React.MutableRefObject<number | null>;
  isDragging: React.MutableRefObject<boolean>;
  lastMouse: React.MutableRefObject<{ x: number; y: number }>;
  
  // Computed
  isEmptyTree: boolean;
  layout: Array<{ id: number; x: number; y: number; parentId: number | null; width: number }>;
  
  // Methods
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetView: () => void;
  calculateBoundingBox: () => { minX: number; maxX: number; minY: number; maxY: number };
  getColors: () => {
    connectionLine: string;
    internalFill: string;
    internalStroke: string;
    leafFill: string;
    leafStroke: string;
    textPrimary: string;
    textSecondary: string;
    bgPattern: string;
    bg: string;
  };
}

export function useBTreeVisualization(
  options: UseBTreeVisualizationOptions
): UseBTreeVisualizationReturn {
  const {
    treeData,
    highlightedIds = [],
    highlightColor = '#3b82f6',
    highlightedNodeId = null,
    highlightedKey = null,
    overflowNodeId = null,
    currentStep = null,
    animationSpeed = 50,
  } = options;

  // Camera state
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 0.8 });
  
  // Node selection and dialog
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Hover states
  const hoveredNodeRef = useRef<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ parentId: number; childIndex: number; tooltipText: string } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Refs for animation and positions
  const positionsRef = useRef<Map<number, NodePosition>>(new Map());
  const edgePositionsRef = useRef<Map<string, { startX: number; startY: number; endX: number; endY: number }>>(new Map());
  const promotedKeyAnimationRef = useRef<{ startTime: number; duration: number } | null>(null);
  const insertingKeyAnimationRef = useRef<{ startTime: number; opacityTransitionDuration: number } | null>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Visualization state
  const visualizationState: VisualizationState = {
    highlightedIds,
    highlightColor,
    highlightedNodeId,
    highlightedKey,
    overflowNodeId,
    currentStep,
    animationSpeed,
  };

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
    const MIN_LEAF_SPACING = 80; // Minimum spacing between leaf nodes

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
  }, [treeData, isEmptyTree]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setCamera(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 4) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCamera(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }));
  }, []);

  const handleResetView = useCallback(() => {
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

    // We need container dimensions, but we'll calculate zoom based on layout
    const zoomX = 800 / treeWidth; // Approximate container width
    const zoomY = 600 / treeHeight; // Approximate container height
    const zoom = Math.min(zoomX, zoomY, 1.5); // Cap at 1.5x

    const x = -centerX * zoom;
    const y = 300 - centerY * zoom; // Approximate center

    setCamera({ x, y, zoom });
  }, [layout]);

  // Helper to calculate bounding box
  const calculateBoundingBox = useCallback(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    layout.forEach(node => {
      const pos = positionsRef.current.get(node.id);
      if (pos) {
        const nodeData = treeData.nodes[node.id.toString()];
        if (nodeData && nodeData.keys && Array.isArray(nodeData.keys) && nodeData.keys.length > 0) {
          // Use truncated keys for bounding box calculation
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
  }, [layout, treeData]);

  // Helper to get colors
  const getColors = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      connectionLine: isDark ? '#475569' : '#94a3b8',
      internalFill: isDark ? '#1e293b' : '#f1f5f9',
      internalStroke: isDark ? '#64748b' : '#475569',
      leafFill: isDark ? '#064e3b' : '#d1fae5',
      leafStroke: isDark ? '#10b981' : '#059669',
      textPrimary: isDark ? '#f8fafc' : '#0f172a',
      textSecondary: isDark ? '#94a3b8' : '#64748b',
      bgPattern: isDark ? '#1e293b' : '#e2e8f0',
      bg: isDark ? '#0f172a' : '#ffffff'
    };
  }, []);

  return {
    visualizationState,
    camera,
    setCamera,
    selectedNode,
    setSelectedNode,
    dialogOpen,
    setDialogOpen,
    hoveredEdge,
    setHoveredEdge,
    tooltipPosition,
    setTooltipPosition,
    positionsRef,
    edgePositionsRef,
    promotedKeyAnimationRef,
    insertingKeyAnimationRef,
    hoveredNodeRef,
    isDragging,
    lastMouse,
    isEmptyTree,
    layout,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    calculateBoundingBox,
    getColors,
  };
}
