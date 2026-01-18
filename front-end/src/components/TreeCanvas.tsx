import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { TreeStructure, TreeNode } from '@/types/database';
import { ZoomIn, ZoomOut, Download, RotateCcw, Info, FileImage, FileType, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { NodeDetailDialog } from './NodeDetailDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface TreeCanvasProps {
  treeData: TreeStructure;
  highlightedIds?: number[];
  highlightColor?: string;
  highlightedNodeId?: number | null; // Currently executing step's node
  highlightedKey?: { values: Array<{ type: string; value: any }> } | null; // Key being compared/operated on
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
  highlightedIds = [], 
  highlightColor = '#3b82f6',
  highlightedNodeId = null,
  highlightedKey = null,
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

  // Helper to draw rounded rectangle with selective corner rounding
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    corners: { topLeft?: boolean; topRight?: boolean; bottomLeft?: boolean; bottomRight?: boolean } = {}
  ) => {
    const { topLeft = true, topRight = true, bottomLeft = true, bottomRight = true } = corners;
    
    ctx.beginPath();
    ctx.moveTo(x + (topLeft ? radius : 0), y);
    ctx.lineTo(x + width - (topRight ? radius : 0), y);
    if (topRight) {
      ctx.arcTo(x + width, y, x + width, y + radius, radius);
    }
    ctx.lineTo(x + width, y + height - (bottomRight ? radius : 0));
    if (bottomRight) {
      ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    }
    ctx.lineTo(x + (bottomLeft ? radius : 0), y + height);
    if (bottomLeft) {
      ctx.arcTo(x, y + height, x, y + height - radius, radius);
    }
    ctx.lineTo(x, y + (topLeft ? radius : 0));
    if (topLeft) {
      ctx.arcTo(x, y, x + radius, y, radius);
    }
    ctx.closePath();
  };

  // Generate tooltip text for an edge based on parent keys and child index
  const generateEdgeTooltipText = (
    parentKeys: Array<{ values: Array<{ type: string; value: any }> }>,
    childIndex: number,
    numChildren: number
  ): string => {
    if (!parentKeys || parentKeys.length === 0) {
      return '';
    }

    // Extract key values (handle single values and tuples)
    const keyValues = parentKeys.map(key => {
      if (key.values.length === 1) {
        return String(key.values[0].value);
      }
      return `(${key.values.map(v => String(v.value)).join(', ')})`;
    });

    if (childIndex === 0) {
      // Leftmost edge: Keys < [First Parent Key]
      return `Keys < ${keyValues[0]}`;
    } else if (childIndex === numChildren - 1) {
      // Rightmost edge: Keys >= [Last Parent Key]
      return `Keys >= ${keyValues[keyValues.length - 1]}`;
    } else {
      // Inner edge: [Left Key] <= Keys < [Right Key]
      const leftKey = keyValues[childIndex - 1];
      const rightKey = keyValues[childIndex];
      return `${leftKey} <= Keys < ${rightKey}`;
    }
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
    const MIN_LEAF_SPACING = 80; // Minimum spacing between leaf nodes (larger to prevent edge overlap)

    const rootNode = treeData.nodes[treeData.rootPage.toString()];
    if (!rootNode) {
      return [];
    }

    // Helper to calculate node width based on keys
    const calculateNodeWidth = (node: any): number => {
      if (!node) return 100;
      const keys = node.keys.map((k: { values: Array<{ type: string; value: any }> }) => {
        if (k.values.length === 1) {
          return String(k.values[0].value);
        }
        return `(${k.values.map(v => String(v.value)).join(', ')})`;
      }).join(' | ');
      
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

    const getThemeColors = () => {
      // Get colors from CSS variables, with fallbacks
      const isDark = document.documentElement.classList.contains('dark')
      
      return {
        connectionLine: isDark ? '#475569' : '#94a3b8',
        internalFill: isDark ? '#1e293b' : '#f1f5f9',
        internalStroke: isDark ? '#64748b' : '#475569',
        leafFill: isDark ? '#064e3b' : '#d1fae5',
        leafStroke: isDark ? '#10b981' : '#059669',
        textPrimary: isDark ? '#f8fafc' : '#0f172a',
        textSecondary: isDark ? '#94a3b8' : '#64748b',
        bgPattern: isDark ? '#1e293b' : '#e2e8f0'
      }
    }

    const render = () => {
      if (!ctx || !containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const colors = getThemeColors()

      // Update positions with lerp (smooth transitions)
      layout.forEach(target => {
        let pos = positionsRef.current.get(target.id);
        if (!pos) {
          pos = { id: target.id, x: target.x, y: target.y - 50, targetX: target.x, targetY: target.y, alpha: 0 };
          positionsRef.current.set(target.id, pos);
        }
        pos.targetX = target.x;
        pos.targetY = target.y;
        // Smooth lerp for positions
        pos.x += (pos.targetX - pos.x) * 0.1;
        pos.y += (pos.targetY - pos.y) * 0.1;
        pos.alpha += (1 - pos.alpha) * 0.1;
      });

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
        if (!nodeData || !nodeData.keys || nodeData.keys.length === 0) return 100;
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        const keyTexts = nodeData.keys.map((k: { values: Array<{ type: string; value: any }> }) => {
          if (k.values.length === 1) {
            return String(k.values[0].value);
          }
          return `(${k.values.map(v => String(v.value)).join(', ')})`;
        });
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
        const pos = positionsRef.current.get(node.id);
        if (!pos || !node.parentId) return;
        const parentPos = positionsRef.current.get(node.parentId);
        if (!parentPos) return;
        
        // Get parent node data to calculate key positions
        const parentNodeData = treeData.nodes[node.parentId.toString()];
        if (!parentNodeData || parentNodeData.type !== 'internal') {
          // Fallback for non-internal or missing parent
          ctx.beginPath();
          ctx.moveTo(parentPos.x, parentPos.y + 25);
          ctx.bezierCurveTo(parentPos.x, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
          ctx.stroke();
          return;
        }
        
        // Find child index in parent's children array
        const parentChildren = parentChildrenMap.get(node.parentId) || [];
        const childIndex = parentChildren.indexOf(node.id);
        if (childIndex === -1) {
          // Fallback if child not found
          ctx.beginPath();
          ctx.moveTo(parentPos.x, parentPos.y + 25);
          ctx.bezierCurveTo(parentPos.x, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
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
        
        // Prepare key texts for width calculation
        const keyTexts = parentNodeData.keys.map((key: { values: Array<{ type: string; value: any }> }) => {
          if (key.values.length === 1) {
            return String(key.values[0].value);
          }
          return `(${key.values.map(v => String(v.value)).join(', ')})`;
        });
        
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
        
        // Draw edge from calculated anchor point
        ctx.beginPath();
        ctx.moveTo(anchorX, parentPos.y + 25);
        ctx.bezierCurveTo(anchorX, parentPos.y + 70, pos.x, pos.y - 70, pos.x, pos.y - 25);
        ctx.stroke();
      });

      // Draw Nodes
      positionsRef.current.forEach(pos => {
        const nodeData = treeData.nodes[pos.id.toString()];
        if (!nodeData) return;

        const isLeaf = nodeData.type === 'leaf';
        const isHighlighted = highlightedIds.includes(pos.id);
        const isStepHighlighted = highlightedNodeId === pos.id; // Currently executing step's node
        
        // Prepare keys - format each key individually
        ctx.font = 'bold 14px "JetBrains Mono", monospace';
        const keyTexts = nodeData.keys.map((k: { values: Array<{ type: string; value: any }> }) => {
          if (k.values.length === 1) {
            return String(k.values[0].value);
          }
          return `(${k.values.map(v => String(v.value)).join(', ')})`;
        });
        
        // Note: We're using hover-style highlighting (border/shadow) for step highlighting
        // No need to track individual key indices since we highlight the entire node
        
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
          const isDarkMode = document.documentElement.classList.contains('dark');
          const rootFill = isDarkMode ? '#78350f' : '#fef3c7'; // amber-900/50 or amber-100
          const rootStroke = isDarkMode ? '#f59e0b' : '#d97706'; // amber-500 or amber-600
          
          // Draw all key groups filled first (no borders yet)
          keyTexts.forEach((_keyText, idx) => {
            const keyW = keyWidths[idx];
            ctx.fillStyle = rootFill;
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
          if (isHighlighted) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = highlightColor;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHovered || isStepHighlighted) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = isDarkMode ? 'rgba(245, 158, 11, 0.6)' : 'rgba(217, 119, 6, 0.5)';
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          ctx.strokeStyle = isHighlighted ? highlightColor : rootStroke;
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
            ctx.fillStyle = nodeFill;
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
          if (isHighlighted) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = highlightColor;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (isHovered || isStepHighlighted) {
            // Enhanced hover effect with more contrast (same style for hover and step highlighting)
            const isDarkMode = document.documentElement.classList.contains('dark');
            ctx.shadowBlur = 12; // Bigger shadow
            ctx.shadowColor = isLeaf 
              ? (isDarkMode ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.5)') 
              : (isDarkMode ? 'rgba(100, 116, 139, 0.6)' : 'rgba(71, 85, 105, 0.5)');
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2; // Slight shadow offset for depth
          } else {
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }
          
          ctx.strokeStyle = isHighlighted ? highlightColor : (isLeaf ? colors.leafStroke : colors.internalStroke);
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
  }, [layout, camera, treeData, highlightedIds, highlightColor, isEmptyTree, hoveredEdge, tooltipPosition, highlightedNodeId, highlightedKey]);

  // Handle step completion callback after animation duration
  useEffect(() => {
    if (highlightedNodeId !== null && onStepComplete) {
      // Convert animation speed (0-100) to delay in ms
      // Speed 0 = 2000ms, Speed 100 = 200ms
      const delay = Math.max(200, 2000 - (animationSpeed * 18));
      const timeoutId = setTimeout(() => {
        onStepComplete();
      }, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [highlightedNodeId, highlightedKey, onStepComplete, animationSpeed]);

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

      const keys = nodeData.keys
        .map((k: { values?: Array<{ type: string; value: any }> }) => {
          if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
          if (k.values.length === 1) {
            return String(k.values[0].value);
          }
          return `(${k.values.map(v => String(v.value)).join(', ')})`;
        })
        .filter(Boolean)
        .join(' | ');
      
      if (!keys || keys.length === 0) continue;

      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) continue;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      const rectW = Math.max(100, tempCtx.measureText(keys).width + 40);
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

      const keyTexts = parentNodeData.keys.map((key: { values: Array<{ type: string; value: any }> }) => {
        if (key.values.length === 1) {
          return String(key.values[0].value);
        }
        return `(${key.values.map(v => String(v.value)).join(', ')})`;
      });

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
            const keys = nodeData.keys
              .map((k: { values?: Array<{ type: string; value: any }> }) => {
                if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
                if (k.values.length === 1) {
                  return String(k.values[0].value);
                }
            return `(${k.values.map(v => String(v.value)).join(', ')})`;
          }).join(' | ');
          const tempCtx = document.createElement('canvas').getContext('2d');
          if (tempCtx) {
            tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
            const rectW = Math.max(100, tempCtx.measureText(keys).width + 40);
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

  // Helper to get colors
  const getColors = () => {
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
  };

  // Helper to draw tree on canvas
  const drawTreeOnCanvas = (ctx: CanvasRenderingContext2D, padding: number, minX: number, minY: number, withBackground: boolean) => {
    const colors = getColors();
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
      if (!nodeData) return 100;
      const keys = nodeData.keys.map((k: { values: Array<{ type: string; value: any }> }) => {
        if (k.values.length === 1) {
          return String(k.values[0].value);
        }
        return `(${k.values.map(v => String(v.value)).join(', ')})`;
      }).join(' | ');
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      return Math.max(100, ctx.measureText(keys).width + 40);
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
      
      // Prepare key texts for width calculation
      const keyTexts = parentNodeData.keys.map((key: { values: Array<{ type: string; value: any }> }) => {
        if (key.values.length === 1) {
          return String(key.values[0].value);
        }
        return `(${key.values.map(v => String(v.value)).join(', ')})`;
      });
      
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
      
      // Prepare keys - format each key individually
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyTexts = nodeData.keys.map((k: { values?: Array<{ type: string; value: any }> }) => {
        if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
        if (k.values.length === 1) {
          return String(k.values[0].value);
        }
        return `(${k.values.map(v => String(v.value)).join(', ')})`;
      }).filter(Boolean);
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
    const colors = getColors();
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
      
      // Prepare key texts for width calculation
      const keyTexts = parentNodeData.keys.map((key: { values: Array<{ type: string; value: any }> }) => {
        if (key.values.length === 1) {
          return String(key.values[0].value);
        }
        return `(${key.values.map(v => String(v.value)).join(', ')})`;
      });
      
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
      
      const keys1 = nodeData.keys
        .map((k: { values?: Array<{ type: string; value: any }> }) => {
          if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
          if (k.values.length === 1) return String(k.values[0].value);
          return `(${k.values.map(v => String(v.value)).join(', ')})`;
        })
        .filter(Boolean)
        .join(' | ');
      const keys2 = nextNodeData.keys
        .map((k: { values?: Array<{ type: string; value: any }> }) => {
          if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
          if (k.values.length === 1) return String(k.values[0].value);
          return `(${k.values.map(v => String(v.value)).join(', ')})`;
        })
        .filter(Boolean)
        .join(' | ');
      if (!keys1 || keys1.length === 0 || !keys2 || keys2.length === 0) return;
      
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      const nodeWidth1 = Math.max(100, tempCtx.measureText(keys1).width + 40);
      const nodeWidth2 = Math.max(100, tempCtx.measureText(keys2).width + 40);
      
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
      
      // Prepare keys - format each key individually
      const keyTexts = nodeData.keys.map((k: { values?: Array<{ type: string; value: any }> }) => {
        if (!k || !k.values || !Array.isArray(k.values) || k.values.length === 0) return '';
        if (k.values.length === 1) {
          return String(k.values[0].value);
        }
        return `(${k.values.map(v => String(v.value)).join(', ')})`;
      }).filter(Boolean);
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
