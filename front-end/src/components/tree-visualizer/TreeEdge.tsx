/**
 * TreeEdge Rendering Module
 * 
 * @description
 * Pure rendering functions for drawing tree edges (connections) between nodes.
 * Handles both parent-child connections and leaf node sibling links.
 * 
 * Features:
 * - Key-aligned anchor points (edges connect at key boundaries)
 * - Bezier curve rendering for smooth connections
 * - Leaf sibling links (dashed green lines)
 * - Tooltip text generation for edge hover states
 * 
 * @usage
 * ```tsx
 * import { renderTreeEdge, renderLeafSiblingLink, generateEdgeTooltipText } from './TreeEdge';
 * 
 * // Render parent-child edge:
 * renderTreeEdge({
 *   parentId: 1,
 *   childId: 2,
 *   parentPos: { x: 100, y: 50 },
 *   childPos: { x: 150, y: 150 },
 *   parentNodeData: parentNode,
 *   childIndex: 0,
 *   numChildren: 3,
 *   colors: { connectionLine: '#475569' },
 *   ctx: canvasContext
 * });
 * 
 * // Generate tooltip text:
 * const tooltip = generateEdgeTooltipText(parentKeys, childIndex, numChildren);
 * // Returns: "Keys < 10" or "5 <= Keys < 10" etc.
 * ```
 * 
 * @key-features
 * - Calculates anchor points based on parent node key positions
 * - Supports N+1 children for N keys (proper B+ Tree structure)
 * - Handles edge cases (no keys, single key, multiple keys)
 * - Real-time position tracking for smooth animations
 * 
 * @exports
 * - renderTreeEdge(): Render parent-child connection
 * - renderLeafSiblingLink(): Render dashed line between leaf siblings
 * - generateEdgeTooltipText(): Generate hover tooltip text
 * - calculateEdgeAnchor(): Calculate anchor point for edge connection
 */

import type { TreeNode } from '@/types/database';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { calculateEdgeAnchor } from './helpers';

export interface EdgeRenderProps {
  parentId: number;
  childId: number;
  parentPos: { x: number; y: number };
  childPos: { x: number; y: number };
  parentNodeData: TreeNode;
  childIndex: number;
  numChildren: number;
  colors: {
    connectionLine: string;
  };
  ctx: CanvasRenderingContext2D;
}

export interface LeafSiblingLinkProps {
  nodeId: number;
  nextNodeId: number;
  nodePos: { x: number; y: number };
  nextNodePos: { x: number; y: number };
  nodeData: TreeNode;
  nextNodeData: TreeNode;
  ctx: CanvasRenderingContext2D;
}

/**
 * Render a single edge (parent-child connection) on the canvas
 */
export function renderTreeEdge(props: EdgeRenderProps): void {
  const { parentPos, childPos, parentNodeData, childIndex, numChildren, colors, ctx } = props;
  
  const anchorX = calculateEdgeAnchor(
    parentNodeData,
    childIndex,
    numChildren,
    parentPos.x,
    ctx
  );
  
  // Start point: Parent anchor
  const startX = anchorX;
  const startY = parentPos.y + 25; // Bottom of parent
  
  // End point: Child node center
  const endX = childPos.x;
  const endY = childPos.y - 25; // Top of child
  
  // Bezier curve control points
  const control1X = anchorX;
  const control1Y = parentPos.y + 70;
  const control2X = childPos.x;
  const control2Y = childPos.y - 70;
  
  // Draw the edge
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.connectionLine;
  ctx.setLineDash([]); // Solid lines for parent-child connections
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
  ctx.stroke();
}

/**
 * Render leaf node sibling links (dashed green lines)
 */
export function renderLeafSiblingLink(props: LeafSiblingLinkProps): void {
  const { nodePos, nextNodePos, nodeData, nextNodeData, ctx } = props;
  
  const isDark = document.documentElement.classList.contains('dark');
  ctx.lineWidth = 2;
  ctx.strokeStyle = isDark ? '#10b981' : '#059669'; // green-500 or green-600
  ctx.setLineDash([5, 5]); // Dashed line pattern
  
  // Helper to calculate node width
  const calculateNodeWidth = (nodeData: TreeNode): number => {
    if (!nodeData || !nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return 100;
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    // Use truncated keys for width calculation (matches visual rendering)
    const keyTexts = formatNodeDataForGraph(nodeData.keys);
    const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
    const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
    return Math.max(100, totalKeyWidth);
  };
  
  // Calculate node widths
  const nodeWidth = calculateNodeWidth(nodeData);
  const nextNodeWidth = calculateNodeWidth(nextNodeData);
  
  // Draw horizontal dashed line between leaf nodes
  ctx.beginPath();
  ctx.moveTo(nodePos.x + nodeWidth / 2, nodePos.y); // Right edge of current node
  ctx.lineTo(nextNodePos.x - nextNodeWidth / 2, nextNodePos.y); // Left edge of next node
  ctx.stroke();
}
