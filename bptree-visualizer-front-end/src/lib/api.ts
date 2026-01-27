// Serverless B+Tree operations using localStorage
import {
  getTree,
  initTree,
  insert,
  search,
  deleteKey,
  rangeQuery,
  update,
  clearTree,
  listTrees,
  getAllTrees,
  getTreeMetadata,
  deleteTree,
  canCreateTree,
  getCurrentTreeName,
  setCurrentTreeName,
  initWithRandomData,
  DEFAULT_COUNT,
  type TreeStructure,
  type OperationResponse,
  type TreeMetadata
} from './btreeSimulator';
import type { CompositeKey, Record } from '@/types/database';

// Re-export types for compatibility
export type { TreeStructure, OperationResponse, TreeMetadata };

// Simulate API interface but use localStorage
export const api = {
  // List all trees
  listTrees(): string[] {
    return listTrees();
  },

  // Get all trees with metadata
  getAllTrees(): Array<{ name: string; metadata: TreeMetadata }> {
    return getAllTrees();
  },

  // Get tree metadata
  getTreeMetadata(name: string): TreeMetadata | null {
    return getTreeMetadata(name);
  },

  // Check if can create new tree
  canCreateTree(): boolean {
    return canCreateTree();
  },

  // Create a new tree
  createTree(name: string): { success: boolean; name: string } {
    if (!canCreateTree()) {
      throw new Error('Maximum number of trees (6) reached');
    }
    if (listTrees().includes(name)) {
      throw new Error('Tree with this name already exists');
    }
    initTree(name);
    return { success: true, name };
  },

  // Delete a tree
  deleteTree(name: string): { success: boolean } {
    if (deleteTree(name)) {
      return { success: true };
    }
    throw new Error('Tree not found');
  },

  // Get current tree name
  getCurrentTreeName(): string | null {
    return getCurrentTreeName();
  },

  // Set current tree name
  setCurrentTreeName(name: string): void {
    setCurrentTreeName(name);
  },

  // Get tree structure
  async getTreeStructure(treeName: string): Promise<TreeStructure> {
    return Promise.resolve(getTree(treeName));
  },

  // Insert a key-value pair
  async insert(treeName: string, key: CompositeKey, value: Record): Promise<OperationResponse> {
    return insert(treeName, key, value);
  },

  // Update a key-value pair
  async update(treeName: string, key: CompositeKey, value: Record): Promise<OperationResponse> {
    return update(treeName, key, value);
  },

  // Delete a key-value pair
  async delete(treeName: string, key: CompositeKey): Promise<OperationResponse> {
    return deleteKey(treeName, key);
  },

  // Search for a key
  async search(treeName: string, key: CompositeKey): Promise<OperationResponse> {
    return search(treeName, key);
  },

  // Range query
  async rangeQuery(
    treeName: string,
    startKey: CompositeKey,
    endKey: CompositeKey
  ): Promise<OperationResponse> {
    return rangeQuery(treeName, startKey, endKey);
  },

  // Clear tree
  clearTree(treeName: string) {
    clearTree(treeName);
    initTree(treeName);
  },

  // Initialize tree
  initTree(treeName: string) {
    return initTree(treeName);
  },

  // Reset tree and fill with random int keys (for demo / init)
  initWithRandomData(treeName: string, count: number = DEFAULT_COUNT): OperationResponse {
    return initWithRandomData(treeName, count);
  },
};
