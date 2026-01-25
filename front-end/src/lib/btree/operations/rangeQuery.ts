// Range query operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse, TreeNode, VisualizationStep } from '../types';
import { getTree } from '../storage';
import { compareKeys } from '../utils';

function formatKey(key: CompositeKey): string {
  return `[${key.values.map(v => v.value).join(', ')}]`;
}

function formatKeyList(keys: CompositeKey[]): string {
  return `[${keys.map(k => formatKey(k)).join(', ')}]`;
}

// Range query
export function rangeQuery(treeName: string, startKey: CompositeKey, endKey: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  const steps: VisualizationStep[] = [];
  const collectedKeys: CompositeKey[] = [];
  const collectedValues: DBRecord[] = [];
  let stepCount = 0;
  
  if (tree.rootPage === 0) {
    return { success: true, operation: 'RANGE_QUERY', keys: [], values: [], steps: [] };
  }
  
  let currentId: number | undefined = tree.rootPage;
  
  // 1. Traverse to find start leaf
  // We strictly follow the startKey to find where to begin scanning
  
  while (currentId !== undefined && currentId !== null) {
    const node: TreeNode = tree.nodes[currentId.toString()];
    if (!node) break;
    
    // Step: NODE_VISIT
    stepCount++;
    steps.push({
      step: stepCount,
      action: 'NODE_VISIT',
      pageId: currentId,
      nodeType: node.type,
      description: `Visit ${node.type === 'internal' ? 'INTERNAL' : 'LEAF'} page ${currentId}${currentId === tree.rootPage ? ' (ROOT)' : ''}${node.type === 'leaf' ? ' (Start Node)' : ''}`
    });

    if (node.type === 'leaf') {
      break; // Found start leaf, proceed to scan phase
    }

    // INTERNAL NODE: Find child
    const keys = node.keys;
    let childIndex = 0;
    let nextInfo = "";
    
    // We need to show the comparison process
    // "Compare [Start] vs [Keys] -> ..."
    let targetP = -1;
    
    for (let i = 0; i < keys.length; i++) {
        const cmp = compareKeys(startKey, keys[i]);
        if (cmp < 0) {
            childIndex = i;
            targetP = node.children ? node.children[i] : -1;
            nextInfo = `${formatKey(startKey)} < ${formatKey(keys[i])}`;
            break;
        }
        childIndex = i + 1;
    }

    if (targetP === -1) {
       // It was >= last key
       targetP = node.children ? node.children[childIndex] : -1;
       if (keys.length > 0) {
         nextInfo = `${formatKey(startKey)} >= ${formatKey(keys[keys.length - 1])}`;
       } else {
         nextInfo = "Empty keys";
       }
    }

    const nextId = node.children ? node.children[childIndex] : undefined;
    
    stepCount++;
    steps.push({
        step: stepCount,
        action: 'COMPARE_RANGE',
        pageId: currentId,
        searchKey: startKey,
        keyValues: keys,
        selectedChildIndex: childIndex,
        nextPageId: nextId,
        description: `Compare ${formatKey(startKey)} vs ${formatKeyList(keys)} -> ${nextInfo} -> Next: page ${nextId}`
    });

    currentId = nextId;
  }
  
  // 2. Scan Leaves
  while (currentId !== undefined && currentId !== null) {
      const node: TreeNode = tree.nodes[currentId.toString()];
      if (!node || node.type !== 'leaf') {
          break;
      }

      const nodeKeys = node.keys;
      const batchCollected: CompositeKey[] = [];
      let stopSearch = false; // Stop completely?
      let stopReason = "";

      for (let i = 0; i < nodeKeys.length; i++) {
          const key = nodeKeys[i];
          const cmpStart = compareKeys(key, startKey);
          const cmpEnd = compareKeys(key, endKey);
          
          if (cmpEnd > 0) {
              stopSearch = true;
              stopReason = "OUT_OF_RANGE";
              break; 
          }
          
          if (cmpStart >= 0) {
              batchCollected.push(key);
              collectedKeys.push(key);
              if (node.values) {
                  collectedValues.push(node.values[i]);
              }
          }
      }
      
      let desc = "";
      if (stopSearch) {
           desc = `Scan ${formatKeyList(nodeKeys)} -> Found key > ${formatKey(endKey)} -> STOP SEARCH`;
      } else {
           if (batchCollected.length > 0) {
               desc = `Scan ${formatKeyList(nodeKeys)} -> Collected: ${formatKeyList(batchCollected)}`;
           } else {
               desc = `Scan ${formatKeyList(nodeKeys)} -> All < ${formatKey(startKey)} (Skip)`;
           }
      }

      stepCount++;
      steps.push({
          step: stepCount,
          action: 'SCAN_RANGE',
          pageId: currentId,
          keys: nodeKeys,
          rangeStart: startKey,
          rangeEnd: endKey,
          collected: batchCollected,
          stopReason: stopSearch ? stopReason : undefined,
          description: desc
      });
      
      if (stopSearch) {
          currentId = undefined;
          break;
      }
      
      // Move to next page
      const nextPageId = node.nextPage;
      if (nextPageId !== undefined && nextPageId !== null) {
          stepCount++;
          steps.push({
              step: stepCount,
              action: 'LINK_NEXT',
              pageId: currentId, 
              fromPageId: currentId,
              toPageId: nextPageId,
              description: `Follow NextPage pointer -> Visit LEAF page ${nextPageId}`
          });
          currentId = nextPageId;
      } else {
          // No next page, and we haven't stopped via OutOfRange yet
          if (!stopSearch) {
              const lastStep = steps[steps.length - 1];
              if (lastStep.action === 'SCAN_RANGE') {
                  const s = lastStep as any; 
                  s.stopReason = "END_OF_TREE";
                  s.description += ". End of Tree.";
              }
          }
          currentId = undefined;
      }
  }
  
  return { success: true, operation: 'RANGE_QUERY', keys: collectedKeys, values: collectedValues, steps };
}
