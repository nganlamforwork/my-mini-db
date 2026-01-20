/**
 * TreeNode Rendering Module
 * 
 * @description
 * Pure rendering functions for drawing individual B+ Tree nodes on a Canvas.
 * Handles all visual aspects of node rendering including:
 * - Node body rendering (internal vs leaf nodes)
 * - Key highlighting (for step-by-step visualization)
 * - Root node special styling (amber/gold colors)
 * - Overflow state visualization (red highlighting)
 * - Hover and selection states
 * 
 * @usage
 * ```tsx
 * import { renderTreeNode, findHighlightedKeyIndex } from './TreeNode';
 * 
 * // In your render loop:
 * renderTreeNode({
 *   nodeData: treeNode,
 *   position: { x: 100, y: 200, alpha: 1.0 },
 *   highlightStatus: {
 *     isHighlighted: true,
 *     isStepHighlighted: false,
 *     isOverflow: false,
 *     isHovered: false,
 *     isRoot: true,
 *     highlightedKeyIndex: 0,
 *     currentStep: executionStep,
 *     highlightColor: '#3b82f6'
 *   },
 *   colors: themeColors,
 *   ctx: canvasContext
 * });
 * ```
 * 
 * @key-features
 * - Uses compareKeys() for accurate key matching (fixes ID vs Value bug)
 * - Supports selective corner rounding for connected key groups
 * - Theme-aware (dark/light mode support)
 * - Handles composite keys correctly
 * 
 * @exports
 * - renderTreeNode(): Main rendering function
 * - findHighlightedKeyIndex(): Helper to find key index using compareKeys
 * - drawRoundedRect(): Utility for drawing rounded rectangles
 */

import type { TreeNode, CompositeKey, ExecutionStep } from '@/types/database';
import { formatNodeDataForGraph, compareKeys } from '@/lib/keyUtils';
import { drawRoundedRect } from './helpers';

export interface NodeRenderProps {
  nodeData: TreeNode;
  position: { x: number; y: number; alpha: number };
  highlightStatus: {
    isHighlighted: boolean;
    isStepHighlighted: boolean;
    isOverflow: boolean;
    isHovered: boolean;
    isRoot: boolean;
    highlightedKeyIndex: number | null;
    currentStep: ExecutionStep | null;
    highlightColor: string;
  };
  colors: {
    internalFill: string;
    internalStroke: string;
    leafFill: string;
    leafStroke: string;
    textPrimary: string;
    textSecondary: string;
  };
  ctx: CanvasRenderingContext2D;
}

/**
 * Find highlighted key index using compareKeys (fixes ID vs Value bug)
 */
export function findHighlightedKeyIndex(
  nodeData: TreeNode,
  highlightedKey: CompositeKey | null,
  currentStep: ExecutionStep | null
): number | null {
  if (!highlightedKey || !currentStep) return null;
  
  if (currentStep.type === 'INSERT_ENTRY' || currentStep.type === 'LEAF_FOUND') {
    // Use findIndex with compareKeys instead of indexOf (which fails for composite keys)
    const index = nodeData.keys.findIndex((k) => compareKeys(k, highlightedKey) === 0);
    return index !== -1 ? index : null;
  }
  
  return null;
}

/**
 * Render a single tree node on the canvas
 */
export function renderTreeNode(props: NodeRenderProps): void {
  const { nodeData, position, highlightStatus, colors, ctx } = props;
  const { isRoot, isHighlighted, isStepHighlighted, isOverflow, isHovered, highlightedKeyIndex, currentStep } = highlightStatus;
  const isLeaf = nodeData.type === 'leaf';
  
  const isDark = document.documentElement.classList.contains('dark');
  
  // Prepare keys - format and truncate for graph visualization
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  const keyTexts = formatNodeDataForGraph(nodeData.keys);
  
  // Calculate width for each key group
  const keyWidths = keyTexts.map(keyText => Math.max(60, ctx.measureText(keyText).width + 20));
  const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
  const rectW = Math.max(100, totalKeyWidth);
  const rectH = 50;
  const padding = (rectW - totalKeyWidth) / 2; // Center keys in node

  ctx.globalAlpha = position.alpha;
  
  // Calculate position of first key group
  const nodeLeft = position.x - rectW / 2;
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
      ctx.fillRect(currentKeyX, position.y - rectH/2, keyW, rectH);
      currentKeyX += keyW;
    });
    
    // Draw outer border with rounded corners (only on outside)
    const nodeTop = position.y - rectH/2;
    const nodeBottom = position.y + rectH/2;
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
      ctx.shadowColor = highlightStatus.highlightColor;
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
      : (isHighlighted ? highlightStatus.highlightColor : rootStroke);
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
      ctx.fillRect(currentKeyX, position.y - rectH/2, keyW, rectH);
      currentKeyX += keyW;
    });
    
    // Draw outer border with rounded corners (only on outside)
    const nodeTop = position.y - rectH/2;
    const nodeBottom = position.y + rectH/2;
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
      ctx.shadowColor = highlightStatus.highlightColor;
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
      : (isHighlighted ? highlightStatus.highlightColor : (isLeaf ? colors.leafStroke : colors.internalStroke));
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
    ctx.fillText(keyText, currentKeyX + keyW / 2, position.y);
    currentKeyX += keyW;
  });

  // Page ID
  ctx.fillStyle = colors.textSecondary;
  ctx.font = '10px sans-serif';
  ctx.fillText(`P${nodeData.pageId}`, nodeLeft + 15, position.y - rectH/2 - 8);
}
