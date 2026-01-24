/**
 * Tree Visualizer Helpers
 *
 * @description
 * Shared utility functions used across the tree visualizer modules:
 * - ID parsing helpers (page / node IDs)
 * - Canvas geometry helpers (rounded rectangles, etc.)
 * - Tooltip generators for edges
 * - Theme color utilities
 *
 * Keeping these helpers centralized makes `TreeCanvas`, `TreeNode`, and
 * `TreeEdge` files smaller and focused on their primary responsibilities.
 */

import type { TreeNode } from '@/types/database';
import { formatNodeDataForGraph, formatKey } from '@/lib/keyUtils';

/**
 * Extract numeric page ID from backend node_id formats.
 *
 * Supports:
 * - "N2"     -> 2   (new format)
 * - "page-9" -> 9   (legacy format)
 */
export const extractPageId = (nodeId?: string | null): number | null => {
  if (!nodeId) return null;

  // Handle new format: "N2" -> 2
  if (nodeId.startsWith('N')) {
    const match = nodeId.match(/N(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Handle legacy format: "page-9" -> 9
  const match = nodeId.match(/page-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Helper to draw rounded rectangle with selective corner rounding.
 *
 * Used by both node body rendering and download/SVG rendering.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  corners: { topLeft?: boolean; topRight?: boolean; bottomLeft?: boolean; bottomRight?: boolean } = {}
) {
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
}

/**
 * Generate tooltip text for an edge based on parent keys and child index.
 *
 * Examples:
 * - "Keys < 10"
 * - "5 <= Keys < 10"
 * - "Keys >= 42"
 */
export function generateEdgeTooltipText(
  parentKeys: Array<{ values: Array<{ type: string; value: any }> }>,
  childIndex: number,
  numChildren: number
): string {
  if (!parentKeys || parentKeys.length === 0) {
    return '';
  }

  // Extract key values using formatKey utility for safe handling
  const keyValues = parentKeys.map(key => formatKey(key)).filter(Boolean);

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
}

/**
 * Calculate anchor point for edge connection based on parent node keys.
 *
 * For N keys, there are N+1 children and thus N+1 possible anchor positions.
 */
export function calculateEdgeAnchor(
  parentNodeData: TreeNode,
  childIndex: number,
  numChildren: number,
  parentX: number,
  ctx: CanvasRenderingContext2D
): number {
  if (!parentNodeData.keys || !Array.isArray(parentNodeData.keys)) {
    return parentX;
  }

  const numKeys = parentNodeData.keys.length;

  // Calculate node width using key groups
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
  const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
  const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
  const nodeWidth = Math.max(100, totalKeyWidth);
  const nodeLeft = parentX - nodeWidth / 2;
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
    anchorX = childIndex === 0 ? keyLeft : keyRight;
  } else {
    // Multiple keys: calculate positions based on key group boundaries
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
        // Fallback to right side
        anchorX = parentX + nodeWidth / 2 - padding / 2;
      }
    }
  }

  return anchorX;
}

/**
 * Get theme-aware colors for tree visualization.
 * 
 * Returns colors based on current dark/light theme mode.
 * Used for consistent styling across all tree visualizer components.
 */
export function getThemeColors() {
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
}


/**
 * Draw dashed links between sibling leaf nodes.
 * 
 * Used for visualizing the linked-list structure of B+ Tree leaves.
 * Abstracts the position/width retrieval so it can be used by both
 * the animated renderer (using live positions) and the static export (using layout positions).
 */
export function drawLeafSiblingLinks(
  ctx: CanvasRenderingContext2D,
  layout: Array<{ id: number }>,
  treeData: { nodes: Record<string, TreeNode> },
  getNodeMetrics: (id: number) => { x: number; y: number; width: number } | null | undefined
) {
  ctx.save();
  ctx.lineWidth = 2;
  const isDark = document.documentElement.classList.contains('dark');
  ctx.strokeStyle = isDark ? '#10b981' : '#059669';
  ctx.setLineDash([5, 5]);

  layout.forEach(node => {
    const nodeData = treeData.nodes[node.id.toString()];
    if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;

    const currentMetrics = getNodeMetrics(node.id);
    const nextMetrics = getNodeMetrics(nodeData.nextPage);

    if (!currentMetrics || !nextMetrics) return;

    const rightX = currentMetrics.x + currentMetrics.width / 2;
    const leftX = nextMetrics.x - nextMetrics.width / 2;

    ctx.beginPath();
    ctx.moveTo(rightX, currentMetrics.y);
    ctx.lineTo(leftX, nextMetrics.y);
    ctx.stroke();
  });

  ctx.restore();
}

/**
 * Creates a new TreeNode with an inserted placeholder (blank) key.
 * 
 * This function handles the creation of a new node object derived from an existing one,
 * injecting a dummy key column into the keys array. It is intended for visualization purposes
 * where we want to show an "empty slot" or "new key slot" before the actual data is committed.
 *
 * @param node The original TreeNode
 * @param index The index at which to insert the placeholder (optional, defaults to end)
 */
export function createNodeWithPlaceholderKey(node: TreeNode, index?: number): TreeNode {
  if (!node.keys) return node;
  
  const newKeys = [...node.keys];
  const placeholderKey: any = { 
    values: [{ type: 'string', value: ' ' }] // Blank value with space to ensure it renders empty slot
  };
  
  if (index !== undefined && index >= 0 && index <= newKeys.length) {
    newKeys.splice(index, 0, placeholderKey);
  } else {
    newKeys.push(placeholderKey);
  }
  
  return {
    ...node,
    keys: newKeys
  };
}
