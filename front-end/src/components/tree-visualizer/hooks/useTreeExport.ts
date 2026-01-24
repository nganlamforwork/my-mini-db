import type { TreeStructure } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { drawRoundedRect, getThemeColors } from '../helpers';

interface UseTreeExportProps {
  layout: LayoutNode[];
  positionsRef: React.MutableRefObject<Map<number, NodePosition>>;
  treeData: TreeStructure;
}

export const useTreeExport = ({
  layout,
  positionsRef,
  treeData
}: UseTreeExportProps) => {

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
    
    const layoutNodeMap = new Map(layout.map(n => [n.id, n]));
    layout.forEach(node => {
      const nodeData = treeData.nodes[node.id.toString()];
      if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
      const nextLayoutNode = layoutNodeMap.get(nodeData.nextPage);
      if (!nextLayoutNode) return;
      const rightX = node.x + node.width / 2;
      const leftX = nextLayoutNode.x - nextLayoutNode.width / 2;
      ctx.beginPath();
      ctx.moveTo(rightX, node.y);
      ctx.lineTo(leftX, nextLayoutNode.y);
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
      
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      
      const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
      
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth = Math.max(100, totalKeyWidth);
      const nodeLeft = parentPos.x - nodeWidth / 2;
      const nodeRight = parentPos.x + nodeWidth / 2;
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
        if (childIndex === 0) {
          anchorX = keyLeft;
        } else {
          anchorX = keyRight;
        }
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
          if (dividerIdx < dividerPositions.length) {
            anchorX = dividerPositions[dividerIdx];
          } else {
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
      
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) return;

      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, ctx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;
      const padding = (rectW - totalKeyWidth) / 2;

      const nodeLeft = pos.x - rectW / 2;
      let currentKeyX = nodeLeft + padding;

      ctx.fillStyle = isLeaf ? colors.leafFill : colors.internalFill;
      ctx.strokeStyle = isLeaf ? colors.leafStroke : colors.internalStroke;
      ctx.lineWidth = 1.5;

      keyTexts.forEach((_keyText, idx) => {
        const keyW = keyWidths[idx];
        const isFirst = idx === 0;
        const isLast = idx === keyTexts.length - 1;
        const radius = 6;
        
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

  const handleDownloadSVG = (minX: number, minY: number, treeWidth: number, treeHeight: number, padding: number) => {
    const colors = getThemeColors();
    const isDark = document.documentElement.classList.contains('dark');
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${treeWidth}" height="${treeHeight}" viewBox="0 0 ${treeWidth} ${treeHeight}">`;
    
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
      
      const numKeys = parentNodeData.keys?.length ?? 0;
      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) return;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      
      const keyTexts = formatNodeDataForGraph(parentNodeData.keys);
      
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const nodeWidth = Math.max(100, totalKeyWidth);
      const nodeLeft = parentPos.x - nodeWidth / 2;
      const nodeRight = parentPos.x + nodeWidth / 2;
      const nodePadding = (nodeWidth - totalKeyWidth) / 2;
      const contentStartX = nodeLeft + nodePadding;
      
      let anchorX: number;
      if (numKeys === 0) {
        const childSpacing = nodeWidth / (parentChildren.length + 1);
        anchorX = nodeLeft + childSpacing * (childIndex + 1);
      } else if (numKeys === 1) {
        const keyW = keyWidths[0];
        const keyLeft = contentStartX;
        const keyRight = keyLeft + keyW;
        if (childIndex === 0) {
          anchorX = keyLeft;
        } else {
          anchorX = keyRight;
        }
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
        } else if (childIndex === parentChildren.length - 1) {
          anchorX = contentStartX + totalKeyWidth;
        } else {
          const dividerIdx = childIndex - 1;
          if (dividerIdx < dividerPositions.length) {
            anchorX = dividerPositions[dividerIdx];
          } else {
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

    const layoutNodeMapSvg = new Map(layout.map(n => [n.id, n]));
    layout.forEach(node => {
      const nodeData = treeData.nodes[node.id.toString()];
      if (!nodeData || nodeData.type !== 'leaf' || !nodeData.nextPage) return;
      const nextLayoutNode = layoutNodeMapSvg.get(nodeData.nextPage);
      if (!nextLayoutNode) return;
      const rightX = node.x + node.width / 2;
      const leftX = nextLayoutNode.x - nextLayoutNode.width / 2;
      const x1 = padding - minX + rightX;
      const y1 = padding - minY + node.y;
      const x2 = padding - minX + leftX;
      const y2 = padding - minY + nextLayoutNode.y;
      svg += `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${isDark ? '#10b981' : '#059669'}" stroke-width="2" stroke-dasharray="5,5" fill="none"/>`;
    });

    positionsRef.current.forEach(pos => {
      const nodeData = treeData.nodes[pos.id.toString()];
      if (!nodeData) return;
      if (!nodeData.keys || !Array.isArray(nodeData.keys) || nodeData.keys.length === 0) return;

      const isLeaf = nodeData.type === 'leaf';
      const keyTexts = formatNodeDataForGraph(nodeData.keys);
      if (keyTexts.length === 0) return;

      const tempCtx = document.createElement('canvas').getContext('2d');
      if (!tempCtx) return;
      tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
      
      const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
      const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
      const rectW = Math.max(100, totalKeyWidth);
      const rectH = 50;
      const nodePadding = (rectW - totalKeyWidth) / 2;

      const nodeX = padding - minX + pos.x;
      const nodeY = padding - minY + pos.y;
      const nodeLeft = nodeX - rectW / 2;
      let currentKeyX = nodeLeft + nodePadding;
      const rx = 6;

      keyTexts.forEach((keyText, idx) => {
        const keyW = keyWidths[idx];
        const keyX = currentKeyX;
        const isFirst = idx === 0;
        const isLast = idx === keyTexts.length - 1;
        const escapedKeyText = keyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        let rxLeft = 0, rxRight = 0;
        if (isFirst && isLast) {
          rxLeft = rx;
          rxRight = rx;
        } else if (isFirst) {
          rxLeft = rx;
        } else if (isLast) {
          rxRight = rx;
        }
        
        const yTop = nodeY - rectH/2;
        const yBottom = nodeY + rectH/2;
        let path = '';
        
        if (rxLeft > 0 && rxRight > 0) {
          path = `M ${keyX + rxLeft} ${yTop} L ${keyX + keyW - rxRight} ${yTop} Q ${keyX + keyW} ${yTop} ${keyX + keyW} ${yTop + rxRight} L ${keyX + keyW} ${yBottom - rxRight} Q ${keyX + keyW} ${yBottom} ${keyX + keyW - rxRight} ${yBottom} L ${keyX + rxLeft} ${yBottom} Q ${keyX} ${yBottom} ${keyX} ${yBottom - rxLeft} L ${keyX} ${yTop + rxLeft} Q ${keyX} ${yTop} ${keyX + rxLeft} ${yTop} Z`;
        } else if (rxLeft > 0) {
          path = `M ${keyX + rxLeft} ${yTop} L ${keyX + keyW} ${yTop} L ${keyX + keyW} ${yBottom} L ${keyX + rxLeft} ${yBottom} Q ${keyX} ${yBottom} ${keyX} ${yBottom - rxLeft} L ${keyX} ${yTop + rxLeft} Q ${keyX} ${yTop} ${keyX + rxLeft} ${yTop} Z`;
        } else if (rxRight > 0) {
          path = `M ${keyX} ${yTop} L ${keyX + keyW - rxRight} ${yTop} Q ${keyX + keyW} ${yTop} ${keyX + keyW} ${yTop + rxRight} L ${keyX + keyW} ${yBottom - rxRight} Q ${keyX + keyW} ${yBottom} ${keyX + keyW - rxRight} ${yBottom} L ${keyX} ${yBottom} Z`;
        } else {
          path = `M ${keyX} ${yTop} L ${keyX + keyW} ${yTop} L ${keyX + keyW} ${yBottom} L ${keyX} ${yBottom} Z`;
        }
        
        svg += `<path d="${path}" fill="${isLeaf ? colors.leafFill : colors.internalFill}" stroke="${isLeaf ? colors.leafStroke : colors.internalStroke}" stroke-width="1.5"/>`;
        svg += `<text x="${keyX + keyW/2}" y="${nodeY}" text-anchor="middle" dominant-baseline="middle" font-family="JetBrains Mono, monospace" font-size="14" font-weight="bold" fill="${colors.textPrimary}">${escapedKeyText}</text>`;
        
        if (!isLast) {
          svg += `<line x1="${keyX + keyW}" y1="${yTop}" x2="${keyX + keyW}" y2="${yBottom}" stroke="${isLeaf ? colors.leafStroke : colors.internalStroke}" stroke-width="1"/>`;
        }
        
        currentKeyX += keyW;
      });

      svg += `<text x="${nodeLeft + 15}" y="${nodeY - rectH/2 - 8}" font-family="sans-serif" font-size="10" fill="${colors.textSecondary}">P${pos.id}</text>`;
    });

    svg += '</svg>';

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

    const scale = 2;
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    tempCanvas.width = treeWidth * scale;
    tempCanvas.height = treeHeight * scale;
    ctx.scale(scale, scale);

    const withBackground = format === 'jpg';
    
    drawTreeOnCanvas(ctx, padding, minX, minY, withBackground);

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

  return { handleDownloadImage };
};
