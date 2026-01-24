// Delete operation for B+Tree
import type { CompositeKey, OperationResponse } from '../types';
import { getTree, saveTree } from '../storage';
import { findLeaf, compareKeys } from '../utils';

// Delete key
export function deleteKey(treeName: string, key: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  
  if (tree.rootPage === 0) {
    return { success: false, operation: 'DELETE', error: 'Key not found' };
  }
  
  const leafId = findLeaf(tree, key);
  if (!leafId) {
    return { success: false, operation: 'DELETE', error: 'Key not found' };
  }
  
  const leaf = tree.nodes[leafId.toString()];
  if (!leaf || leaf.type !== 'leaf') {
    return { success: false, operation: 'DELETE', error: 'Key not found' };
  }
  
  let keyIndex = -1;
  for (let i = 0; i < leaf.keys.length; i++) {
    if (compareKeys(leaf.keys[i], key) === 0) {
      keyIndex = i;
      break;
    }
  }
  
  if (keyIndex === -1) {
    return { success: false, operation: 'DELETE', error: 'Key not found' };
  }
  
  leaf.keys.splice(keyIndex, 1);
  if (leaf.values) {
    leaf.values.splice(keyIndex, 1);
  }
  
  // If leaf becomes empty and it's the root, reset tree
  if (leaf.keys.length === 0 && tree.rootPage === leafId) {
    tree.rootPage = 0;
    tree.height = 0;
    delete tree.nodes[leafId.toString()];
  }
  
  saveTree(treeName, tree);
  return { success: true, operation: 'DELETE', key };
}
