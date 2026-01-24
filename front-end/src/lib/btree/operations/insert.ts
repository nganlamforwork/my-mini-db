// Insert operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse, TreeNode, VisualizationStep } from '../types';
import { getTree, saveTree } from '../storage';
import { compareKeys } from '../utils';
import { MAX_KEYS } from '../constants';
import { formatKey } from '@/lib/keyUtils';

export function insert(treeName: string, key: CompositeKey, value: DBRecord): OperationResponse {
  const tree = getTree(treeName);
  let nextId = Math.max(...Object.keys(tree.nodes).map(Number), 0) + 1;
  const steps: VisualizationStep[] = [];
  let stepCount = 0;

  // Helper to format key for description
  const keyStr = formatKey(key);

  if (tree.rootPage === 0) {
    // Create root leaf
    stepCount++;
    steps.push({
      step: stepCount,
      action: 'CREATE_ROOT',
      pageId: nextId,
      keys: [key],
      children: [],
      description: `Create new root page ${nextId} with key ${keyStr}`
    });

    const leaf: TreeNode = {
      pageId: nextId++,
      type: 'leaf',
      keys: [key],
      values: [value]
    };
    tree.nodes[leaf.pageId.toString()] = leaf;
    tree.rootPage = leaf.pageId;
    tree.height = 1;
    saveTree(treeName, tree);
    return { success: true, operation: 'INSERT', key, value, steps };
  }

  // 1. Traverse to Leaf
  const path: number[] = [];
  let currentId = tree.rootPage;
  
  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) return { success: false, operation: 'INSERT', error: 'Node not found', steps };
    
    path.push(currentId);
    
    // Log Visit
    stepCount++;
    steps.push({
      step: stepCount,
      action: 'NODE_VISIT',
      pageId: currentId,
      nodeType: node.type,
      description: `Visit ${node.type === 'internal' ? 'INTERNAL' : 'LEAF'} page ${currentId}${currentId === tree.rootPage ? ' (Root)' : ''}`
    });

    if (node.type === 'leaf') {
      break;
    }

    // Internal Node Logic
    let childIndex = 0;
    let comparisonDesc = "";
    const nodeKeysStr = node.keys.map(k => formatKey(k)).join(', ');
    let foundRange = false;

    for (let i = 0; i < node.keys.length; i++) {
        const cmp = compareKeys(key, node.keys[i]);
        if (cmp < 0) {
          childIndex = i;
          comparisonDesc = `${keyStr} < ${formatKey(node.keys[i])}`;
          foundRange = true;
          break;
        }
    }
    
    if (!foundRange) {
        childIndex = node.keys.length;
        if (node.keys.length > 0) {
           comparisonDesc = `${keyStr} >= ${formatKey(node.keys[node.keys.length - 1])}`;
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
      searchKey: key,
      keyValues: JSON.parse(JSON.stringify(node.keys)),
      selectedChildIndex: childIndex,
      nextPageId: nextPageId,
      description: `Compare ${keyStr} vs [${nodeKeysStr}] -> ${comparisonDesc} -> Next: page ${nextPageId}`
    });

    if (nextPageId === -1) return { success: false, operation: 'INSERT', error: 'Invalid child pointer', steps };
    currentId = nextPageId;
  }

  // 2. Leaf Insertion Logic
  const leafId = path[path.length - 1];
  const leaf = tree.nodes[leafId.toString()];
  
  // Find Position & Check Duplicate
  // "Scan [keys] -> Found X at index Y" or "Scan [keys] -> Target position: Y"
  
  let duplicateIndex = -1;
  let targetIndex = 0;
  const leafKeysStr = leaf.keys.map(k => formatKey(k)).join(', ');
  
  for (let i = 0; i < leaf.keys.length; i++) {
      const cmp = compareKeys(leaf.keys[i], key);
      if (cmp === 0) {
          duplicateIndex = i;
          break;
      }
      if (cmp < 0) {
          targetIndex = i + 1;
      } else {
          break;
      }
  }

  stepCount++;
  steps.push({
      step: stepCount,
      action: 'FIND_POS',
      pageId: leafId,
      keys: JSON.parse(JSON.stringify(leaf.keys)),
      searchKey: key,
      targetIndex: duplicateIndex !== -1 ? duplicateIndex : targetIndex,
      foundAtIndex: duplicateIndex, // For search/fail logic if needed
      description: duplicateIndex !== -1 
        ? `Scan [${leafKeysStr}] -> Found ${keyStr} at index ${duplicateIndex}`
        : `Scan [${leafKeysStr}] -> Target position: ${targetIndex}`
  });

  if (duplicateIndex !== -1) {
      stepCount++;
      steps.push({
          step: stepCount,
          action: 'INSERT_FAIL',
          pageId: leafId,
          reason: 'DUPLICATE_KEY',
          description: `Key ${keyStr} already exists -> Insert Failed`
      });
      return { success: false, operation: 'INSERT', error: 'Duplicate key', steps };
  }

  // Perform Insert into Leaf
  leaf.keys.splice(targetIndex, 0, key);
  if (leaf.values) leaf.values.splice(targetIndex, 0, value);

  // keys string after insert
  const newKeysStr = leaf.keys.map(k => formatKey(k)).join(', ');

  stepCount++;
  steps.push({
      step: stepCount,
      action: 'INSERT_LEAF',
      pageId: leafId,
      insertKey: key,
      atIndex: targetIndex,
      newKeys: JSON.parse(JSON.stringify(leaf.keys)), // Snapshot
      description: `Insert ${keyStr} at index ${targetIndex} -> Keys: [${newKeysStr}]`
  });

  // Check Overflow
  stepCount++;
  const isOverflow = leaf.keys.length > MAX_KEYS;
  steps.push({
      step: stepCount,
      action: 'CHECK_OVERFLOW',
      pageId: leafId,
      currentSize: leaf.keys.length,
      maxSize: MAX_KEYS,
      isOverflow: isOverflow,
      description: `Check size: ${leaf.keys.length} ${isOverflow ? '>' : '<='} Max ${MAX_KEYS} -> ${isOverflow ? 'OVERFLOW DETECTED' : 'OK'}`
  });

  if (!isOverflow) {
      saveTree(treeName, tree);
      return { success: true, operation: 'INSERT', key, value, steps };
  }

  // 3. Handle Split
  // We need to propagate splits up the tree
  // Current node to split: leaf
  // We need to track the 'promoted' key and the new node to insert into parent
  
  let currentNodeId = leafId;
  let currentNode = leaf;
  
  while (true) { // Loop for cascading splits
     // Perform Split
     const mid = Math.floor(currentNode.keys.length / 2);
     const isLeaf = currentNode.type === 'leaf';
     
     // For Leaf: Split [0..mid-1] and [mid..end]. Copied key is keys[mid] usually, but B+ tree leaf split keeps all keys.
     // Standard B+ Tree:
     // Leaf Split: Left [0..mid-1], Right [mid..end]. Promote keys[mid] (Copy).
     // Internal Split: Left [0..mid-1], Right [mid+1..end]. Promote keys[mid] (Move).
     
     let splitKey: CompositeKey;
     let leftKeys: CompositeKey[];
     let rightKeys: CompositeKey[];
     let newRightNode: TreeNode;
     
     if (isLeaf) {
         // Leaf Split
         splitKey = currentNode.keys[mid]; // Copy up
         leftKeys = currentNode.keys.slice(0, mid);
         rightKeys = currentNode.keys.slice(mid);
         
         newRightNode = {
             pageId: nextId++,
             type: 'leaf',
             keys: rightKeys,
             values: currentNode.values ? currentNode.values.slice(mid) : []
         };
         
         // Update current (Left)
         currentNode.keys = leftKeys;
         if (currentNode.values) currentNode.values = currentNode.values.slice(0, mid);
         
         // Link List
         if (currentNode.nextPage) {
             const nextNode = tree.nodes[currentNode.nextPage.toString()];
             if (nextNode) nextNode.prevPage = newRightNode.pageId;
         }
         newRightNode.nextPage = currentNode.nextPage;
         newRightNode.prevPage = currentNode.pageId;
         currentNode.nextPage = newRightNode.pageId;
         
     } else {
         // Internal Split
         splitKey = currentNode.keys[mid]; // Move up
         leftKeys = currentNode.keys.slice(0, mid);
         rightKeys = currentNode.keys.slice(mid + 1); // Skip mid
         
         newRightNode = {
             pageId: nextId++,
             type: 'internal',
             keys: rightKeys,
             children: currentNode.children ? currentNode.children.slice(mid + 1) : []
         };
         
         currentNode.keys = leftKeys;
         if (currentNode.children) currentNode.children = currentNode.children.slice(0, mid + 1);
     }
     
     tree.nodes[newRightNode.pageId.toString()] = newRightNode;
     
     // Log Split
     const leftStr = leftKeys.map(k => formatKey(k)).join(', ');
     const rightStr = rightKeys.map(k => formatKey(k)).join(', ');
     const promoteStr = formatKey(splitKey);

     // Determine Parent ID for Step
     let parentIdForStep: number | undefined;
     if (currentNodeId !== tree.rootPage) {
        const pathIndex = path.indexOf(currentNodeId);
        if (pathIndex > 0) {
             parentIdForStep = path[pathIndex - 1];
        }
     }
     
     stepCount++;
     steps.push({
         step: stepCount,
         action: 'SPLIT_NODE',
         pageId: currentNodeId,
         newPageId: newRightNode.pageId,
         parentId: parentIdForStep,
         splitKey: splitKey,
         leftKeys: JSON.parse(JSON.stringify(leftKeys)),
         rightKeys: JSON.parse(JSON.stringify(rightKeys)),
         promoteKey: splitKey,
         description: `Split Page ${currentNodeId} -> Left: [${leftStr}], Right: [${rightStr}] -> ${isLeaf ? 'Copy' : 'Move'} ${promoteStr} up`
     });
     
     // Check if Root
     if (currentNodeId === tree.rootPage) {
         // Create New Root
         const newRoot: TreeNode = {
             pageId: nextId++,
             type: 'internal',
             keys: [splitKey],
             children: [currentNodeId, newRightNode.pageId]
         };
         tree.rootPage = newRoot.pageId;
         tree.height++;
         tree.nodes[newRoot.pageId.toString()] = newRoot;
         
         stepCount++;
         steps.push({
             step: stepCount,
             action: 'CREATE_ROOT',
             pageId: newRoot.pageId,
             keys: [splitKey],
             children: [currentNodeId, newRightNode.pageId],
             description: `Create new root page ${newRoot.pageId} with key ${promoteStr}`
         });
         
         break; // Done
     }
     
     // Insert into Parent
     // We need to find the parent node. The 'path' array has the history.
     // But we need to know WHICH parent. We can pop from path?
     // Path includes current leaf at end.
     // If we are splitting leaf w (path[len-1]), parent is path[len-2].
     // If we split parent (path[len-2]), grand is path[len-3].
     
     // Let's rely on finding parent index in path.
     const pathIndex = path.indexOf(currentNodeId);
     if (pathIndex <= 0) {
         // Should have been root handled above
         return { success: false, operation: 'INSERT', error: 'Parent not found in path', steps };
     }
     
     const parentId = path[pathIndex - 1];
     const parent = tree.nodes[parentId.toString()];
     if (!parent) return { success: false, operation: 'INSERT', error: 'Parent node missing', steps };
     
     // Log Visit Parent
     stepCount++;
     steps.push({
         step: stepCount,
         action: 'NODE_VISIT',
         pageId: parentId,
         nodeType: 'internal',
         description: `Visit INTERNAL page ${parentId}`
     });
     
     // Find Insert Position in Parent
     // We are inserting 'splitKey' and 'newRightNode' pointer.
     // Scan [keys] -> Target position
     
     let parentInsertPos = 0;
     while (parentInsertPos < parent.keys.length && compareKeys(parent.keys[parentInsertPos], splitKey) < 0) {
         parentInsertPos++;
     }
     
     const parentKeysStr = parent.keys.map(k => formatKey(k)).join(', ');
     stepCount++;
     steps.push({
         step: stepCount,
         action: 'FIND_POS',
         pageId: parentId,
         keys: JSON.parse(JSON.stringify(parent.keys)), // snapshot before insert
         searchKey: splitKey,
         targetIndex: parentInsertPos,
         description: `Scan [${parentKeysStr}] -> Target position: ${parentInsertPos}`
     });
     
     // Execute Insert in Parent
     parent.keys.splice(parentInsertPos, 0, splitKey);
     // For pointers: children[i] is left of keys[i]. children[i+1] is right of keys[i].
     // If we insert key at i, we split the child relationship.
     // The old child (currentNodeId) is at index 'parentInsertPos' (because keys[pos-1] < key < keys[pos])
     // wait.
     // keys: [10, 20]
     // children: [C0, C1, C2]
     // Insert 15. Pos = 1.
     // New Keys: [10, 15, 20]
     // New Children: [C0, C1, NewRight, C2]
     
     // Verify child pointer at parentInsertPos is indeed currentNodeId?
     // Actually, if we followed path, parent.children[parentInsertPos] might NOT be currentNodeId if we skipped some logic?
     // But strictly, compareKeys logic for 'findPath' should align.
     // Exception: if duplicates allowed or fuzzy logic? B+ tree strict.
     
     // Let's verify.
     // parent.children[parentInsertPos] should be currentNodeId.
     // Actually, if key > all keys, pos = len. children[len] is last child.
     
     if (parent.children) {
        parent.children.splice(parentInsertPos + 1, 0, newRightNode.pageId);
     }
     
     const newParentKeysStr = parent.keys.map(k => formatKey(k)).join(', ');
     stepCount++;
     steps.push({
         step: stepCount,
         action: 'INSERT_INTERNAL',
         pageId: parentId,
         insertKey: splitKey,
         atIndex: parentInsertPos,
         newKeys: JSON.parse(JSON.stringify(parent.keys)),
         description: `Insert ${promoteStr} at index ${parentInsertPos} -> Keys: [${newParentKeysStr}]`
     });
     
     // Check Overflow for Parent
     const parentOverflow = parent.keys.length > MAX_KEYS;
     
     stepCount++;
     steps.push({
         step: stepCount,
         action: 'CHECK_OVERFLOW',
         pageId: parentId,
         currentSize: parent.keys.length,
         maxSize: MAX_KEYS,
         isOverflow: parentOverflow,

         description: `Check size: ${parent.keys.length} ${parentOverflow ? '>' : '<='} Max ${MAX_KEYS} -> ${parentOverflow ? 'OVERFLOW DETECTED' : 'OK'}`
     });
     
     if (!parentOverflow) {
         break; // Done
     }
     
     // Loop continues for parent split...
     currentNodeId = parentId;
     currentNode = parent;
  }

  saveTree(treeName, tree);
  return { success: true, operation: 'INSERT', key, value, steps };
}
