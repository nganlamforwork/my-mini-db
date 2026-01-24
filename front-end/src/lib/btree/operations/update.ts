// Update operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse } from '../types';
import { getTree, saveTree } from '../storage';
import { findLeaf, compareKeys } from '../utils';
import { search } from './search';

// Update key-value pair
export function update(treeName: string, key: CompositeKey, value: DBRecord): OperationResponse {
  const searchResult = search(treeName, key);
  if (!searchResult.success) {
    return { success: false, operation: 'UPDATE', error: 'Key not found' };
  }
  
  const tree = getTree(treeName);
  const leafId = findLeaf(tree, key);
  if (!leafId) {
    return { success: false, operation: 'UPDATE', error: 'Key not found' };
  }
  
  const leaf = tree.nodes[leafId.toString()];
  if (!leaf || leaf.type !== 'leaf') {
    return { success: false, operation: 'UPDATE', error: 'Key not found' };
  }
  
  for (let i = 0; i < leaf.keys.length; i++) {
    if (compareKeys(leaf.keys[i], key) === 0) {
      if (leaf.values) {
        leaf.values[i] = value;
      }
      saveTree(treeName, tree);
      return { success: true, operation: 'UPDATE', key, value };
    }
  }
  
  return { success: false, operation: 'UPDATE', error: 'Key not found' };
}
