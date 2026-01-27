// Utility functions for B+Tree operations
import type { CompositeKey, TreeStructure } from './types';

// Helper to compare keys
export function compareKeys(key1: CompositeKey, key2: CompositeKey): number {
  const v1 = key1.values;
  const v2 = key2.values;
  const minLen = Math.min(v1.length, v2.length);
  
  for (let i = 0; i < minLen; i++) {
    const val1 = v1[i].value;
    const val2 = v2[i].value;
    
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
  }
  
  return v1.length - v2.length;
}

// Find leaf node for key
export function findLeaf(tree: TreeStructure, key: CompositeKey): number | null {
  if (tree.rootPage === 0) return null;
  
  let currentId = tree.rootPage;
  
  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) return null;
    
    if (node.type === 'leaf') {
      return currentId;
    }
    
    // Internal node - find child
    if (!node.children || node.children.length === 0) return null;
    
    let childIndex = 0;
    for (let i = 0; i < node.keys.length; i++) {
      if (compareKeys(key, node.keys[i]) < 0) {
        break;
      }
      childIndex = i + 1;
    }
    
    currentId = node.children[childIndex];
  }
}
