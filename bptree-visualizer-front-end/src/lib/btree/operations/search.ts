// Search operation for B+Tree
import type { CompositeKey, OperationResponse } from '../types';
import type { VisualizationStep } from '@/types/database';
import { getTree } from '../storage';
import { compareKeys } from '../utils';
import { formatKey } from '@/lib/keyUtils';

// Search for key
export function search(treeName: string, key: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  const steps: VisualizationStep[] = [];
  let stepCount = 0;
  
  if (tree.rootPage === 0) {
    return { success: false, operation: 'SEARCH', error: 'Key not found', steps };
  }
  
  let currentId = tree.rootPage;
  
  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) {
      return { success: false, operation: 'SEARCH', error: 'Node not found', steps };
    }
    
    // 1. Visit Node Step
    stepCount++;
    steps.push({
      step: stepCount,
      action: 'NODE_VISIT',
      pageId: currentId,
      nodeType: node.type,
      description: `Visit ${node.type === 'internal' ? 'INTERNAL' : 'LEAF'} page ${currentId}`
    });
    
    if (node.type === 'leaf') {
      // Leaf Node: Scan keys
      let foundIndex = -1;
      // Convert node keys to simpler format for JSON log if needed, but keeping them as CompositeKey is fine
      // We will search for the key
      for (let i = 0; i < node.keys.length; i++) {
        if (compareKeys(node.keys[i], key) === 0) {
          foundIndex = i;
          break;
        }
      }
      
      const searchKeyStr = formatKey(key);
      const keysStr = node.keys.map(k => formatKey(k)).join(', ');
      
      stepCount++;
      steps.push({
        step: stepCount,
        action: 'SCAN_KEYS',
        pageId: currentId,
        keys: node.keys,
        searchKey: key,
        foundAtIndex: foundIndex,
        description: foundIndex !== -1 
          ? `Scan [${keysStr}] -> Found ${searchKeyStr} at index ${foundIndex}`
          : `Scan [${keysStr}] -> Key ${searchKeyStr} not found`
      });
      
      if (foundIndex !== -1) {
        return {
          success: true,
          operation: 'SEARCH',
          key,
          value: node.values ? node.values[foundIndex] : undefined,
          steps
        };
      } else {
        return { success: false, operation: 'SEARCH', error: 'Key not found', steps };
      }
    } else {
      // Internal Node: Find child
      let childIndex = 0;
      // We iterate through keys to find the range
      // Logic: 
      // K < Key[0] -> Child[0]
      // Key[i] <= K < Key[i+1] -> Child[i+1]
      // K >= Key[n] -> Child[n]
      
      // We want to describe "Compare K vs [Keys]"
      
      let comparisonDesc = "";
      const searchKeyStr = formatKey(key);
      const keysStr = node.keys.map(k => formatKey(k)).join(', ');
      
      // Find the right child
      let foundRange = false;
      for (let i = 0; i < node.keys.length; i++) {
        const cmp = compareKeys(key, node.keys[i]);
        if (cmp < 0) {
          // Key is smaller than node.keys[i]
          childIndex = i;
          comparisonDesc = `${searchKeyStr} < ${formatKey(node.keys[i])}`;
          foundRange = true;
          break;
        }
      }
      
      if (!foundRange) {
        // Key is >= all keys
        childIndex = node.keys.length;
        if (node.keys.length > 0) {
           comparisonDesc = `${searchKeyStr} >= ${formatKey(node.keys[node.keys.length - 1])}`;
        } else {
           comparisonDesc = "Empty keys";
        }
      }
      
      const nextPageId = node.children ? node.children[childIndex] : -1;
      
      stepCount++;
      steps.push({
        step: stepCount,
        action: 'COMPARE_RANGE',
        pageId: currentId,
        keyValues: node.keys, // Record available keys
        searchKey: key,
        selectedChildIndex: childIndex,
        nextPageId: nextPageId,
        description: `Compare ${searchKeyStr} vs [${keysStr}] -> ${comparisonDesc} -> Next: page ${nextPageId}`
      });
      
      if (nextPageId === -1) {
         return { success: false, operation: 'SEARCH', error: 'Invalid child pointer', steps };
      }
      currentId = nextPageId;
    }
  }
}
