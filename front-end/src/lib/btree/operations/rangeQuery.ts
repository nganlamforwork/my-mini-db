// Range query operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse, TreeNode } from '../types';
import { getTree } from '../storage';
import { findLeaf, compareKeys } from '../utils';

// Range query
export function rangeQuery(treeName: string, startKey: CompositeKey, endKey: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  
  if (tree.rootPage === 0) {
    return { success: true, operation: 'RANGE_QUERY', keys: [], values: [] };
  }
  
  const startLeafId = findLeaf(tree, startKey);
  if (!startLeafId) {
    return { success: true, operation: 'RANGE_QUERY', keys: [], values: [] };
  }
  
  const keys: CompositeKey[] = [];
  const values: DBRecord[] = [];
  
  let currentId: number | undefined = startLeafId;
  
  while (currentId !== undefined && currentId !== null) {
    const node: TreeNode | undefined = tree.nodes[currentId.toString()];
    if (!node || node.type !== 'leaf') break;
    
    for (let i = 0; i < node.keys.length; i++) {
      const key = node.keys[i];
      const cmpStart = compareKeys(key, startKey);
      const cmpEnd = compareKeys(key, endKey);
      
      if (cmpStart >= 0 && cmpEnd <= 0) {
        keys.push(key);
        if (node.values) {
          values.push(node.values[i]);
        }
      }
      
      if (cmpEnd > 0) {
        currentId = undefined;
        break;
      }
    }
    
    if (currentId !== undefined && node.nextPage) {
      currentId = node.nextPage;
    } else {
      currentId = undefined;
    }
  }
  
  return { success: true, operation: 'RANGE_QUERY', keys, values };
}
