// Insert operation for B+Tree
import type { CompositeKey, DBRecord, OperationResponse, TreeNode, TreeStructure } from '../types';
import { getTree, saveTree } from '../storage';
import { compareKeys } from '../utils';
import { MAX_KEYS } from '../constants';

// Helper to find path from root to leaf
function findPathToLeaf(tree: TreeStructure, key: CompositeKey): number[] | null {
  if (tree.rootPage === 0) return null;
  
  const path: number[] = [];
  let currentId = tree.rootPage;
  
  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) return null;
    
    path.push(currentId);
    
    if (node.type === 'leaf') {
      return path;
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


// Insert key-value pair
export function insert(treeName: string, key: CompositeKey, value: DBRecord): OperationResponse {
  const tree = getTree(treeName);
  let nextId = Math.max(...Object.keys(tree.nodes).map(Number), 0) + 1;
  
  if (tree.rootPage === 0) {
    // Create root leaf
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
    return { success: true, operation: 'INSERT', key, value };
  }
  
  const path = findPathToLeaf(tree, key);
  if (!path || path.length === 0) {
    return { success: false, operation: 'INSERT', error: 'Could not find leaf' };
  }
  
  const leafId = path[path.length - 1];
  const leaf = tree.nodes[leafId.toString()];
  if (!leaf || leaf.type !== 'leaf') {
    return { success: false, operation: 'INSERT', error: 'Invalid leaf node' };
  }
  
  // Check for duplicate
  for (let i = 0; i < leaf.keys.length; i++) {
    if (compareKeys(leaf.keys[i], key) === 0) {
      return { success: false, operation: 'INSERT', error: 'Duplicate key' };
    }
  }
  
  // Insert into leaf
  let insertPos = 0;
  while (insertPos < leaf.keys.length && compareKeys(leaf.keys[insertPos], key) < 0) {
    insertPos++;
  }
  
  leaf.keys.splice(insertPos, 0, key);
  if (leaf.values) {
    leaf.values.splice(insertPos, 0, value);
  }
  
  // Check if split needed
  if (leaf.keys.length > MAX_KEYS) {
    // Split leaf
    const mid = Math.floor(leaf.keys.length / 2);
    const separatorKey = leaf.keys[mid]; // First key of right node becomes separator
    
    const newLeaf: TreeNode = {
      pageId: nextId++,
      type: 'leaf',
      keys: leaf.keys.slice(mid),
      values: leaf.values ? leaf.values.slice(mid) : []
    };
    
    leaf.keys = leaf.keys.slice(0, mid);
    if (leaf.values) {
      leaf.values = leaf.values.slice(0, mid);
    }
    
    // Update leaf links
    if (leaf.nextPage) {
      const nextLeaf = tree.nodes[leaf.nextPage.toString()];
      if (nextLeaf) {
        nextLeaf.prevPage = newLeaf.pageId;
      }
    }
    newLeaf.nextPage = leaf.nextPage;
    newLeaf.prevPage = leaf.pageId;
    leaf.nextPage = newLeaf.pageId;
    
    tree.nodes[newLeaf.pageId.toString()] = newLeaf;
    
    // If root split, create new root
    if (tree.rootPage === leafId) {
      const newRoot: TreeNode = {
        pageId: nextId++,
        type: 'internal',
        keys: [separatorKey],
        children: [leaf.pageId, newLeaf.pageId]
      };
      tree.rootPage = newRoot.pageId;
      tree.height++;
      tree.nodes[newRoot.pageId.toString()] = newRoot;
    } else {
      // Propagate split up the tree
      let currentSeparatorKey = separatorKey;
      let currentLeftId = leaf.pageId;
      let currentRightId = newLeaf.pageId;
      
      // Traverse up the path (skip the leaf, which is last in path)
      for (let i = path.length - 2; i >= 0; i--) {
        const parentId = path[i];
        const parent = tree.nodes[parentId.toString()];
        
        if (!parent || parent.type !== 'internal' || !parent.children) {
          return { success: false, operation: 'INSERT', error: 'Invalid parent node' };
        }
        
        // Find the child index that points to currentLeftId
        const childIndex = parent.children.indexOf(currentLeftId);
        if (childIndex === -1) {
          return { success: false, operation: 'INSERT', error: 'Could not find child in parent' };
        }
        
        // Insert separator key at the correct position
        // The separator should be inserted at childIndex (since it separates left and right children)
        let keyInsertPos = childIndex;
        while (keyInsertPos < parent.keys.length && compareKeys(parent.keys[keyInsertPos], currentSeparatorKey) < 0) {
          keyInsertPos++;
        }
        
        parent.keys.splice(keyInsertPos, 0, currentSeparatorKey);
        // Replace the child pointer at childIndex with left, and insert right after it
        parent.children[childIndex] = currentLeftId; // Keep left
        parent.children.splice(childIndex + 1, 0, currentRightId); // Insert right after left
        
        // Check if parent needs to split
        if (parent.keys.length > MAX_KEYS) {
          const mid = Math.floor(parent.keys.length / 2);
          const parentSeparatorKey = parent.keys[mid];
          
          // Create new right internal node
          const newRightParent: TreeNode = {
            pageId: nextId++,
            type: 'internal',
            keys: parent.keys.slice(mid + 1),
            children: parent.children.slice(mid + 1)
          };
          
          // Update left parent (current parent)
          parent.keys = parent.keys.slice(0, mid);
          parent.children = parent.children.slice(0, mid + 1);
          
          tree.nodes[newRightParent.pageId.toString()] = newRightParent;
          
          // If we're at the root, create new root
          if (tree.rootPage === parentId) {
            const newRoot: TreeNode = {
              pageId: nextId++,
              type: 'internal',
              keys: [parentSeparatorKey],
              children: [parentId, newRightParent.pageId]
            };
            tree.rootPage = newRoot.pageId;
            tree.height++;
            tree.nodes[newRoot.pageId.toString()] = newRoot;
            break;
          }
          
          // Continue propagating up
          currentSeparatorKey = parentSeparatorKey;
          currentLeftId = parentId;
          currentRightId = newRightParent.pageId;
        } else {
          // No more splits needed
          break;
        }
      }
    }
  }
  
  saveTree(treeName, tree);
  return { success: true, operation: 'INSERT', key, value };
}
