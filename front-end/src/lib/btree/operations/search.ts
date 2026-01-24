// Search operation for B+Tree
import type { CompositeKey, OperationResponse } from '../types';
import { getTree } from '../storage';
import { findLeaf, compareKeys } from '../utils';

// Search for key
export function search(treeName: string, key: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  
  if (tree.rootPage === 0) {
    return { success: false, operation: 'SEARCH', error: 'Key not found' };
  }
  
  const leafId = findLeaf(tree, key);
  if (!leafId) {
    return { success: false, operation: 'SEARCH', error: 'Key not found' };
  }
  
  const leaf = tree.nodes[leafId.toString()];
  if (!leaf || leaf.type !== 'leaf') {
    return { success: false, operation: 'SEARCH', error: 'Key not found' };
  }
  
  for (let i = 0; i < leaf.keys.length; i++) {
    if (compareKeys(leaf.keys[i], key) === 0) {
      return {
        success: true,
        operation: 'SEARCH',
        key,
        value: leaf.values ? leaf.values[i] : undefined
      };
    }
  }
  
  return { success: false, operation: 'SEARCH', error: 'Key not found' };
}
