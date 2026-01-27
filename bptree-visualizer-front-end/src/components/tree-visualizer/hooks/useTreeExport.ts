import type { TreeStructure } from '@/types/database';
import type { NodePosition } from '../types';
import type { LayoutNode } from './useTreeLayout';
import { formatNodeDataForGraph } from '@/lib/keyUtils';
import { getThemeColors } from '../helpers';

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

  const generateSVGString = (minX: number, minY: number, treeWidth: number, treeHeight: number, padding: number) => {
    const colors = getThemeColors();
    const isDark = document.documentElement.classList.contains('dark');
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${treeWidth}" height="${treeHeight}" viewBox="0 0 ${treeWidth} ${treeHeight}">`;
    
    // Add background rect for SVG if it's going to be converted to JPG (client requirement: "with background")
    // But since we control the conversion process, we can handle background in canvas for JPG.
    // However, users might want the SVG itself to have a background? 
    // Usually SVG export is transparent. Let's keep SVG transparent.
    // We can add a "style" block for fonts if needed, but let's stick to inline attributes as before.
    
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
    return svg;
  };

  const handleDownloadImage = (format: 'jpg' | 'png' | 'svg') => {
    if (layout.length === 0) return;

    const { minX, maxX, minY, maxY } = calculateBoundingBox();
    const padding = 40;
    const treeWidth = maxX - minX + padding * 2;
    const treeHeight = maxY - minY + padding * 2;

    const svgContent = generateSVGString(minX, minY, treeWidth, treeHeight, padding);
    
    // Download SVG immediately
    if (format === 'svg') {
       const blob = new Blob([svgContent], { type: 'image/svg+xml' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `tree-visualization-${new Date().toISOString().slice(0, 10)}.svg`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
       return;
    }

    // Convert to Image for JPG/PNG
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 2; // High resolution
      const canvas = document.createElement('canvas');
      canvas.width = treeWidth * scale; // Scale for quality
      canvas.height = treeHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.scale(scale, scale);

      // Handle Background
      if (format === 'jpg') {
        const colors = getThemeColors();
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, treeWidth, treeHeight);
        
        // Optional Pattern for JPG
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 24;
        patternCanvas.height = 24;
        const pCtx = patternCanvas.getContext('2d');
        if (pCtx) {
            pCtx.fillStyle = colors.bg;
            pCtx.fillRect(0,0,24,24);
            pCtx.fillStyle = colors.bgPattern;
            pCtx.beginPath();
            pCtx.arc(0,0,1,0, Math.PI * 2);
            pCtx.fill();
            const pattern = ctx.createPattern(patternCanvas, 'repeat');
            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fillRect(0,0,treeWidth, treeHeight);
            }
        }
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpg' ? 0.92 : undefined;
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `tree-visualization-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url); // Clean up SVG URL
      }, mimeType, quality);
    };

    img.src = url;
  };

  return { handleDownloadImage };
};
