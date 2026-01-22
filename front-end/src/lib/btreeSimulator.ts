// Simple B+Tree simulator for frontend visualization
// Stores tree state in localStorage
import type { TreeNode, TreeStructure, CompositeKey, Record as DBRecord } from '@/types/database';

// Re-export for compatibility
export type { TreeNode, TreeStructure };

export interface OperationResponse {
  success: boolean;
  operation: string;
  key?: CompositeKey;
  value?: DBRecord;
  keys?: CompositeKey[];
  values?: DBRecord[];
  steps?: any[];
  error?: string;
}

const STORAGE_KEY = 'btree_trees'; // Store all trees
const CURRENT_TREE_KEY = 'btree_current'; // Current active tree name
const MAX_TREES = 6;
const ORDER = 4; // Max 3 keys per node
const MAX_KEYS = ORDER - 1;

export interface TreeMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreesStorage {
  trees: { [key: string]: TreeStructure }; // tree name -> tree structure
  metadata: { [key: string]: TreeMetadata }; // tree name -> metadata
}

// Helper to compare keys
function compareKeys(key1: CompositeKey, key2: CompositeKey): number {
  const v1 = key1.values;
  const v2 = key2.values;
  const minLen = Math.min(v1.length, v2.length);
  
  for (let i = 0; i < minLen; i++) {
    const val1 = v1[i].value;
    const val2 = v2[i].value;
    
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
  }
  
  return v1.length - v2.length;
}

// Load all trees from localStorage
function loadTreesStorage(): TreesStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { trees: {}, metadata: {} };
    }
    return JSON.parse(stored);
  } catch {
    return { trees: {}, metadata: {} };
  }
}

// Save all trees to localStorage
function saveTreesStorage(storage: TreesStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

// Get current tree name
export function getCurrentTreeName(): string | null {
  return localStorage.getItem(CURRENT_TREE_KEY);
}

// Set current tree name
export function setCurrentTreeName(name: string): void {
  localStorage.setItem(CURRENT_TREE_KEY, name);
}

// Load tree by name
export function loadTree(name: string): TreeStructure | null {
  const storage = loadTreesStorage();
  return storage.trees[name] || null;
}

// Save tree by name
function saveTree(name: string, tree: TreeStructure): void {
  const storage = loadTreesStorage();
  storage.trees[name] = tree;
  
  // Update metadata
  const now = new Date().toISOString();
  if (!storage.metadata[name]) {
    storage.metadata[name] = {
      name,
      createdAt: now,
      updatedAt: now
    };
  } else {
    storage.metadata[name].updatedAt = now;
  }
  
  saveTreesStorage(storage);
}

// Initialize empty tree
export function initTree(name: string): TreeStructure {
  const tree: TreeStructure = {
    rootPage: 0,
    height: 0,
    nodes: {}
  };
  saveTree(name, tree);
  return tree;
}

// Get or create tree by name
export function getTree(name: string): TreeStructure {
  const tree = loadTree(name);
  return tree || initTree(name);
}

// List all tree names
export function listTrees(): string[] {
  const storage = loadTreesStorage();
  return Object.keys(storage.trees);
}

// Get tree metadata
export function getTreeMetadata(name: string): TreeMetadata | null {
  const storage = loadTreesStorage();
  return storage.metadata[name] || null;
}

// Delete tree
export function deleteTree(name: string): boolean {
  const storage = loadTreesStorage();
  if (!storage.trees[name]) return false;
  
  delete storage.trees[name];
  delete storage.metadata[name];
  
  // If this was the current tree, clear current
  if (getCurrentTreeName() === name) {
    localStorage.removeItem(CURRENT_TREE_KEY);
  }
  
  saveTreesStorage(storage);
  return true;
}

// Check if can create new tree (max 6)
export function canCreateTree(): boolean {
  return listTrees().length < MAX_TREES;
}

// Get all trees with metadata
export function getAllTrees(): Array<{ name: string; metadata: TreeMetadata }> {
  const storage = loadTreesStorage();
  return Object.keys(storage.trees).map(name => ({
    name,
    metadata: storage.metadata[name] || {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }));
}

// Find leaf node for key
function findLeaf(tree: TreeStructure, key: CompositeKey): number | null {
  if (tree.rootPage === 0) return null;
  
  let currentId = tree.rootPage;
  
  while (true) {
    const node = tree.nodes[currentId.toString()];
    if (!node) return null;
    
    if (node.type === 'leaf') {
      return currentId;
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
  
  const leafId = findLeaf(tree, key);
  if (!leafId) {
    return { success: false, operation: 'INSERT', error: 'Could not find leaf' };
  }
  
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
    // Simple split - create new leaf
    const mid = Math.floor(leaf.keys.length / 2);
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
    
    // Update links
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
        keys: [newLeaf.keys[0]],
        children: [leaf.pageId, newLeaf.pageId]
      };
      tree.rootPage = newRoot.pageId;
      tree.height++;
      tree.nodes[newRoot.pageId.toString()] = newRoot;
    }
  }
  
  saveTree(treeName, tree);
  return { success: true, operation: 'INSERT', key, value };
}

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

// Clear tree
export function clearTree(treeName: string): void {
  const storage = loadTreesStorage();
  delete storage.trees[treeName];
  delete storage.metadata[treeName];
  saveTreesStorage(storage);
}
