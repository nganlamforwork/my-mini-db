// Update operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse, VisualizationStep } from '../types';
import { getTree, saveTree } from '../storage';
import { findLeaf, compareKeys } from '../utils';
import { search } from './search';

// Update key-value pair
export function update(treeName: string, key: CompositeKey, value: DBRecord): OperationResponse {
  // 1. Execute Search to get visualization of finding the key
  const searchResult = search(treeName, key);
  
  // If search failed to find the key, we cannot update
  if (!searchResult.success) {
    return { 
        success: false, 
        operation: 'UPDATE', 
        error: 'Key not found',
        steps: searchResult.steps // Return search steps showing failure
    };
  }
  
  // 2. Prepare steps
  // Clone steps from search to avoid mutating cached result
  const steps: VisualizationStep[] = searchResult.steps ? [...searchResult.steps] : [];
  let stepCount = steps.length > 0 ? steps[steps.length - 1].step : 0;
  
  // 3. Perform Actual Update
  const tree = getTree(treeName);
  const leafId = findLeaf(tree, key);
  
  if (!leafId) {
    return { success: false, operation: 'UPDATE', error: 'Leaf not found after successful search' };
  }
  
  const leaf = tree.nodes[leafId.toString()];
  if (!leaf || leaf.type !== 'leaf') {
    return { success: false, operation: 'UPDATE', error: 'Invalid leaf node' };
  }
  
  // Find key index
  let foundIndex = -1;
  for (let i = 0; i < leaf.keys.length; i++) {
    if (compareKeys(leaf.keys[i], key) === 0) {
      foundIndex = i;
      break;
    }
  }
  
  if (foundIndex === -1) {
     return { success: false, operation: 'UPDATE', error: 'Key missing in leaf' };
  }
  
  // Update Value
  const oldValue = leaf.values && leaf.values[foundIndex] ? leaf.values[foundIndex] : null;
  
  if (!leaf.values) leaf.values = [];
  leaf.values[foundIndex] = value;
  
  // Add Visualization Step
  stepCount++;
  steps.push({
      step: stepCount,
      action: 'UPDATE_LEAF_VALUE',
      pageId: leafId,
      key: key,
      oldValue: oldValue,
      newValue: value,
      atIndex: foundIndex,
      description: `Update Value at index ${foundIndex}`
  });
  
  saveTree(treeName, tree);
  
  return { 
      success: true, 
      operation: 'UPDATE', 
      key, 
      value,
      steps
  };
}
