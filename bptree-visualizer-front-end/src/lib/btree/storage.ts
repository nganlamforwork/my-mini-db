// Storage management for B+Tree operations
import type { TreeStructure, TreesStorage, TreeMetadata } from './types';
import { STORAGE_KEY, CURRENT_TREE_KEY, MAX_TREES } from './constants';

// Load all trees from localStorage
export function loadTreesStorage(): TreesStorage {
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
export function saveTreesStorage(storage: TreesStorage): void {
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
export function saveTree(name: string, tree: TreeStructure): void {
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

// Clear tree
export function clearTree(treeName: string): void {
  const storage = loadTreesStorage();
  delete storage.trees[treeName];
  delete storage.metadata[treeName];
  saveTreesStorage(storage);
}
