import { useMemo } from 'react';
import type { TreeStructure } from '@/types/database';
import { formatNodeDataForGraph } from '@/lib/keyUtils';

export interface LayoutNode {
  id: number;
  x: number;
  y: number;
  parentId: number | null;
  width: number;
}

export const useTreeLayout = (treeData: TreeStructure) => {
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

    const nodes: LayoutNode[] = [];
    const LEVEL_SPACING = 150;
    const MIN_LEAF_SPACING = 80; // Minimum spacing between leaf nodes (larger to prevent edge overlap)

    const rootNode = treeData.nodes[treeData.rootPage.toString()];
    if (!rootNode) {
      return [];
    }

      // Helper to calculate node width based on keys - aligned with rendering logic
    const calculateNodeWidth = (node: any): number => {
      if (!node || !node.keys || !Array.isArray(node.keys)) return 100;
      
      const keyTexts = formatNodeDataForGraph(node.keys);
      
      // Create a temporary canvas context to measure text
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.font = 'bold 14px "JetBrains Mono", monospace';
        const keyWidths = keyTexts.map((keyText: string) => Math.max(60, tempCtx.measureText(keyText).width + 20));
        const totalKeyWidth = keyWidths.reduce((sum: number, w: number) => sum + w, 0);
        return Math.max(100, totalKeyWidth);
      }
      
      return Math.max(100, keyTexts.join(' | ').length * 10 + 40); // Better fallback estimation
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

  return { layout, isEmptyTree };
};
