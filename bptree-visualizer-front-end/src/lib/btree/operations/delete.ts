// Delete operation for B+Tree
import type { CompositeKey, OperationResponse, VisualizationStep } from '../types';
import { getTree, saveTree } from '../storage';
import { compareKeys } from '../utils';
import { formatKey } from '@/lib/keyUtils';
import { ORDER } from '../constants';

export function deleteKey(treeName: string, key: CompositeKey): OperationResponse {
  const tree = getTree(treeName);
  const steps: VisualizationStep[] = [];
  let stepCount = 0;
  
  const keyStr = formatKey(key);

  if (tree.rootPage === 0) {
    return { success: false, operation: 'DELETE', error: 'Tree is empty', steps };
  }

  // 1. Traverse to Leaf
  const path: number[] = [];
  let currentId = tree.rootPage;
  const parentMap = new Map<number, number>();

  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) return { success: false, operation: 'DELETE', error: 'Node not found', steps };
    
    path.push(currentId);
    
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

    if (nextPageId === -1) return { success: false, operation: 'DELETE', error: 'Invalid child pointer', steps };
    
    parentMap.set(nextPageId, currentId);
    currentId = nextPageId;
  }

  // 2. Leaf Deletion
  const leafId = path[path.length - 1];
  const leaf = tree.nodes[leafId.toString()];
  
  let foundIndex = -1;
  const leafKeysStr = leaf.keys.map(k => formatKey(k)).join(', ');
  
  for (let i = 0; i < leaf.keys.length; i++) {
      if (compareKeys(leaf.keys[i], key) === 0) {
          foundIndex = i;
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
      targetIndex: foundIndex,
      foundAtIndex: foundIndex,
      description: foundIndex !== -1 
        ? `Scan [${leafKeysStr}] -> Found ${keyStr} at index ${foundIndex}`
        : `Scan [${leafKeysStr}] -> Key ${keyStr} not found`
  });

  if (foundIndex === -1) {
    return { success: false, operation: 'DELETE', error: 'Key not found', steps };
  }

  leaf.keys.splice(foundIndex, 1);
  if (leaf.values) leaf.values.splice(foundIndex, 1);
  
  const newKeysStr = leaf.keys.map(k => formatKey(k)).join(', ');
  
  stepCount++;
  steps.push({
      step: stepCount,
      action: 'DELETE_LEAF',
      pageId: leafId,
      deleteKey: key,
      atIndex: foundIndex,
      newKeys: JSON.parse(JSON.stringify(leaf.keys)),
      description: `Delete ${keyStr} -> Remaining keys: [${newKeysStr}]`
  });
  
  // 3. Check Underflow & Rebalance
  const MIN_KEYS = Math.ceil(ORDER / 2) - 1; // 1 for order 4
  
  let currentNodeId = leafId;
  
  while (true) {
      const currentNode = tree.nodes[currentNodeId.toString()];
      // Root check
      const isRoot = currentNodeId === tree.rootPage;
      const currentSize = currentNode.keys.length;

      // Check Underflow
      const isUnderflow = !isRoot && currentSize < MIN_KEYS;
      
      stepCount++;
      steps.push({
          step: stepCount,
          action: 'CHECK_UNDERFLOW',
          pageId: currentNodeId,
          currentSize: currentSize,
          minSize: MIN_KEYS,
          isUnderflow: isUnderflow,
          keys: JSON.parse(JSON.stringify(currentNode.keys)),
          description: isUnderflow 
             ? `Check size: ${currentSize} < Min ${MIN_KEYS} -> UNDERFLOW DETECTED`
             : `Check size: ${currentSize} >= Min ${MIN_KEYS} -> ${isRoot ? 'OK (Root)' : 'OK'}`
      });

      if (!isUnderflow) {
          if (isRoot && currentSize === 0) {
             // Special case: Empty root (handled at end OR here if leaf root became empty)
             if (currentNode.type === 'leaf') {
                 tree.rootPage = 0;
                 tree.height = 0;
                 delete tree.nodes[currentNodeId.toString()];
                 // Log final state?
             } else {
                 // Warning: Internal root with 0 keys (children?)
                 // If root has 0 keys but >0 children (should have 1 child if it was merged down to 0 keys)
                 // This usually happens during rebalance below.
             }
          }
          break; // Done
      }

      // Handle Underflow
      const parentId = parentMap.get(currentNodeId);
      if (!parentId) break; // Should be root if no parent, handled above.
      
      const parent = tree.nodes[parentId.toString()];
      if (!parent.children) break; // Should not happen
      
      const myIndex = parent.children.indexOf(currentNodeId);
      let borrowed = false;

      // Siblings
      const leftSiblingId = myIndex > 0 ? parent.children[myIndex - 1] : null;
      const rightSiblingId = myIndex < parent.children.length - 1 ? parent.children[myIndex + 1] : null;
      
      const leftSibling = leftSiblingId ? tree.nodes[leftSiblingId.toString()] : null;
      const rightSibling = rightSiblingId ? tree.nodes[rightSiblingId.toString()] : null;
      
      stepCount++;
      steps.push({
          step: stepCount,
          action: 'CHECK_SIBLINGS',
          pageId: currentNodeId,
          leftSiblingId: leftSiblingId,
          leftSize: leftSibling?.keys.length,
          rightSiblingId: rightSiblingId,
          rightSize: rightSibling?.keys.length,
          keys: JSON.parse(JSON.stringify(currentNode.keys)),
          description: `Check siblings -> Left: ${leftSibling ? `Page ${leftSiblingId} (${leftSibling.keys.length})` : 'None'}, Right: ${rightSibling ? `Page ${rightSiblingId} (${rightSibling.keys.length})` : 'None'}`
      });

      // Strategy 1: Borrow from Left
      if (leftSibling && leftSibling.keys.length > MIN_KEYS) {
          // Visual Step: Select key to borrow
          const borrowIdx = leftSibling.keys.length - 1;
          const borrowKeyCandidate = leftSibling.keys[borrowIdx];
          
          stepCount++;
          steps.push({
             step: stepCount,
             action: 'SCAN_KEYS',
             pageId: leftSiblingId!,
             keys: JSON.parse(JSON.stringify(leftSibling.keys)),
             foundAtIndex: borrowIdx,
             description: `Select key ${formatKey(borrowKeyCandidate)} from Left Sibling`
          });

          // Borrow
          const borrowKey = leftSibling.keys.pop()!;
          let borrowValue: any; 
          let parentKeyIdx = myIndex - 1;
          const separator = parent.keys[parentKeyIdx]; // Key separating left and current

          if (currentNode.type === 'leaf') {
               borrowValue = leftSibling.values!.pop()!;
               currentNode.keys.unshift(borrowKey);
               currentNode.values!.unshift(borrowValue);
               
               // Update separator: New separator is the FIRST key of current node (which is borrowKey)
               // In B+ tree, separator is smallest key in right subtree. 
               // Wait, 'separator' in parent usually >= all in left, < all in right (or <=).
               // Standard: parent key separates children.
               // parent.keys[parentKeyIdx] should be updated to copy of borrowKey (new first key of right)
               parent.keys[parentKeyIdx] = JSON.parse(JSON.stringify(borrowKey));
               
               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'BORROW_FROM_SIBLING',
                   pageId: currentNodeId,
                   siblingPageId: leftSiblingId!,
                   borrowedKey: borrowKey,
                   direction: 'LEFT_TO_RIGHT',
                   keys: JSON.parse(JSON.stringify(currentNode.keys)),
                   siblingKeys: JSON.parse(JSON.stringify(leftSibling.keys)),
                   description: `Move key ${formatKey(borrowKey)} from Page ${leftSiblingId} to Page ${currentNodeId}`
               });
               
               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'UPDATE_SEPARATOR',
                   pageId: parentId,
                   oldKey: separator,
                   newKey: borrowKey,
                   description: `Update separator index ${parentKeyIdx} to ${formatKey(borrowKey)}`,
                   nodeOverrides: [
                       { pageId: currentNodeId, keys: JSON.parse(JSON.stringify(currentNode.keys)) },
                       { pageId: leftSiblingId!, keys: JSON.parse(JSON.stringify(leftSibling.keys)) }
                   ]
               });
          } else {
               // Internal Borrow (Rotate)
               // Left Sibling Key -> Parent; Parent Key -> Current
               const parentKey = parent.keys[parentKeyIdx];
               const movedChild = leftSibling.children!.pop()!;
               
               currentNode.keys.unshift(parentKey);
               currentNode.children!.unshift(movedChild);
               parent.keys[parentKeyIdx] = borrowKey; // Borrowed from left goes to parent
               
               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'INTERNAL_BORROW_ROTATE',
                   pageId: currentNodeId,
                   siblingPageId: leftSiblingId!,
                   parentPageId: parentId,
                   direction: 'LEFT_TO_RIGHT',
                   movedChildId: movedChild,
                   keys: JSON.parse(JSON.stringify(currentNode.keys)),
                   siblingKeys: JSON.parse(JSON.stringify(leftSibling.keys)),
                   description: `ROTATION: Move Child ${movedChild} from P${leftSiblingId} to P${currentNodeId}`
               });
               
               stepCount++;
               steps.push({
                  step: stepCount,
                  action: 'UPDATE_KEYS_ROTATION',
                  pageId: parentId, // Context
                  parentKeyIndex: parentKeyIdx,
                  oldParentKey: parentKey,
                  newParentKey: borrowKey,
                  movedKeyDown: parentKey,
                  description: `Key ${formatKey(borrowKey)} moves UP to Parent. Key ${formatKey(parentKey)} moves DOWN to Node.`
               });
          }
          borrowed = true;
      }
      // Strategy 2: Borrow from Right
      else if (!borrowed && rightSibling && rightSibling.keys.length > MIN_KEYS) {
           // Visual Step: Select key to borrow
           const borrowIdx = 0;
           const borrowKeyCandidate = rightSibling.keys[borrowIdx];

          stepCount++;
          steps.push({
             step: stepCount,
             action: 'SCAN_KEYS',
             pageId: rightSiblingId!,
             keys: JSON.parse(JSON.stringify(rightSibling.keys)),
             foundAtIndex: borrowIdx,
             description: `Select key ${formatKey(borrowKeyCandidate)} from Right Sibling`
          });

           const borrowKey = rightSibling.keys.shift()!;
           let parentKeyIdx = myIndex; // Separator between current and right
           const separator = parent.keys[parentKeyIdx];

           if (currentNode.type === 'leaf') {
               const borrowValue = rightSibling.values!.shift()!;
               currentNode.keys.push(borrowKey);
               currentNode.values!.push(borrowValue);
               
               // Separator becomes the NEW first key of rightSibling
               const newSeparator = rightSibling.keys[0];
               parent.keys[parentKeyIdx] = JSON.parse(JSON.stringify(newSeparator));

                stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'BORROW_FROM_SIBLING',
                   pageId: currentNodeId,
                   siblingPageId: rightSiblingId!,
                   borrowedKey: borrowKey,
                   direction: 'RIGHT_TO_LEFT',
                   keys: JSON.parse(JSON.stringify(currentNode.keys)),
                   siblingKeys: JSON.parse(JSON.stringify(rightSibling.keys)),
                   description: `Move key ${formatKey(borrowKey)} from Page ${rightSiblingId} to Page ${currentNodeId}`
               });
               
               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'UPDATE_SEPARATOR',
                   pageId: parentId,
                   oldKey: separator,
                   newKey: newSeparator,
                   description: `Update separator index ${parentKeyIdx} to ${formatKey(newSeparator)}`,
                   nodeOverrides: [
                       { pageId: currentNodeId, keys: JSON.parse(JSON.stringify(currentNode.keys)) },
                       { pageId: rightSiblingId!, keys: JSON.parse(JSON.stringify(rightSibling.keys)) }
                   ]
               });
           } else {
               // Internal Borrow
               const parentKey = parent.keys[parentKeyIdx];
               const movedChild = rightSibling.children!.shift()!;
               
               currentNode.keys.push(parentKey);
               currentNode.children!.push(movedChild);
               parent.keys[parentKeyIdx] = borrowKey;

               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'INTERNAL_BORROW_ROTATE',
                   pageId: currentNodeId,
                   siblingPageId: rightSiblingId!,
                   parentPageId: parentId,
                   direction: 'RIGHT_TO_LEFT',
                   movedChildId: movedChild,
                   keys: JSON.parse(JSON.stringify(currentNode.keys)),
                   siblingKeys: JSON.parse(JSON.stringify(rightSibling.keys)),
                   description: `ROTATION: Move Child ${movedChild} from P${rightSiblingId} to P${currentNodeId}`
               });
               
               stepCount++;
               steps.push({
                  step: stepCount,
                  action: 'UPDATE_KEYS_ROTATION',
                  pageId: parentId,
                  parentKeyIndex: parentKeyIdx,
                  oldParentKey: parentKey,
                  newParentKey: borrowKey,
                  movedKeyDown: parentKey,
                  description: `Key ${formatKey(borrowKey)} moves UP. Key ${formatKey(parentKey)} moves DOWN.`
               });
           }
           borrowed = true;
      }

      if (borrowed) {
          // Rebalanced successfully
          saveTree(treeName, tree);
          return { success: true, operation: 'DELETE', key, steps };
      }

      // Strategy 3: Merge
      // If we are here, we couldn't borrow. Merge with a sibling.
      // Prefer Left merge.
      if (leftSibling) {
          // Merge [Left] + [Separator] + [Current] -> [Left]
          // (Left becomes the merged node, Current is deleted)
          
          let parentKeyIdx = myIndex - 1;
          const separatorKey = parent.keys[parentKeyIdx];

          if (currentNode.type === 'leaf') {
             // Merge keys/values from Current -> Left
             leftSibling.keys.push(...currentNode.keys);
             leftSibling.values!.push(...currentNode.values!);
             leftSibling.nextPage = currentNode.nextPage; // Link fix
             
             stepCount++;
             steps.push({
                 step: stepCount,
                 action: 'MERGE_LEAF',
                 pageId: leftSiblingId!,
                 removePageId: currentNodeId,
                 direction: 'RIGHT_INTO_LEFT',
                 mergedKeys: JSON.parse(JSON.stringify(leftSibling.keys)),
                 description: `Merge Page ${currentNodeId} into Page ${leftSiblingId}`
             });
             
             stepCount++;
             steps.push({
                 step: stepCount,
                 action: 'UPDATE_LINK',
                 pageId: leftSiblingId!,
                 oldNext: currentNodeId,
                 newNext: currentNode.nextPage || null,
                 description: `Update Next Link: ${currentNodeId} -> ${currentNode.nextPage || 'null'}`
             });

          } else {
             // Internal Merge
             // Pull Separator from Parent down
             leftSibling.keys.push(separatorKey);
             leftSibling.keys.push(...currentNode.keys);
             leftSibling.children!.push(...currentNode.children!);
             
             // No UPDATE_LINK for internal
          }

          // Remove Current Node
          delete tree.nodes[currentNodeId.toString()];
          
          // Remove Separator and Child Pointer from Parent
          // Note: Removing parentKeyIdx removes the separator. 
          // Removing child at myIndex removes the pointer to Current.
          parent.keys.splice(parentKeyIdx, 1);
          parent.children.splice(myIndex, 1); 
          
          stepCount++;
          steps.push({
              step: stepCount,
              action: 'DELETE_INDEX',
              pageId: parentId,
              deleteKey: separatorKey,
              deleteChildPtr: currentNodeId,
              newKeys: JSON.parse(JSON.stringify(parent.keys)),
              mergedChildren: currentNode.children ? [...currentNode.children] : undefined,
              mergeTargetId: leftSiblingId!,
              description: `Remove separator ${formatKey(separatorKey)} and pointer to ${currentNodeId}`
          });
          
          currentNodeId = parentId; // Propagate up

      } else if (rightSibling) {
          // Merge [Current] + [Separator] + [Right] -> [Current]
          // (Right is deleted)
          
          let parentKeyIdx = myIndex;
          const separatorKey = parent.keys[parentKeyIdx];
          
          if (currentNode.type === 'leaf') {
              currentNode.keys.push(...rightSibling.keys);
              currentNode.values!.push(...rightSibling.values!);
              currentNode.nextPage = rightSibling.nextPage;

              stepCount++;
             steps.push({
                 step: stepCount,
                 action: 'MERGE_LEAF',
                 pageId: currentNodeId,
                 removePageId: rightSiblingId!,
                 direction: 'LEFT_INTO_RIGHT', // Actually importing right
                 mergedKeys: JSON.parse(JSON.stringify(currentNode.keys)),
                 description: `Merge Page ${rightSiblingId} into Page ${currentNodeId}`
             });
             
             stepCount++;
             steps.push({
                 step: stepCount,
                 action: 'UPDATE_LINK',
                 pageId: currentNodeId,
                 oldNext: rightSiblingId!,
                 newNext: rightSibling.nextPage || null,
                 description: `Update Next Link`
             });
          } else {
             // Internal
             currentNode.keys.push(separatorKey);
             currentNode.keys.push(...rightSibling.keys);
             currentNode.children!.push(...rightSibling.children!);
          }

          delete tree.nodes[rightSiblingId!.toString()];
          
          parent.keys.splice(parentKeyIdx, 1);
          parent.children.splice(myIndex + 1, 1); // remove pointer to Right

          stepCount++;
          steps.push({
              step: stepCount,
              action: 'DELETE_INDEX',
              pageId: parentId,
              deleteKey: separatorKey,
              deleteChildPtr: rightSiblingId!,
              newKeys: JSON.parse(JSON.stringify(parent.keys)),
              mergedChildren: rightSibling.children ? [...rightSibling.children] : undefined,
              mergeTargetId: currentNodeId,
              description: `Remove separator and pointer to ${rightSiblingId}`
          });
          
          currentNodeId = parentId;
      }
      
      // Check Parent Underflow in loop
      // Handle Root becoming empty if it was the parent
      if (currentNodeId === tree.rootPage && tree.nodes[currentNodeId.toString()].keys.length === 0) {
           // Root is empty. 
           // If it has a child (should have 1 after merge), make that child the new root.
           const rootNode = tree.nodes[currentNodeId.toString()];
           if (rootNode.children && rootNode.children.length > 0) {
               const newRootId = rootNode.children[0];
               tree.rootPage = newRootId;
               tree.height--;
               delete tree.nodes[currentNodeId.toString()];
               
               stepCount++;
               steps.push({
                   step: stepCount,
                   action: 'FINAL_STATE',
                   pageId: newRootId,
                   description: `Root collapsed. New Root is Page ${newRootId}`
               });
           }
           break; // Done
      }
  }
  
  saveTree(treeName, tree);
  return { success: true, operation: 'DELETE', key, steps };
}
