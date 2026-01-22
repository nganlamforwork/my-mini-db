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
  async insert(treeName: string, key: CompositeKey, value: Record, enableSteps: boolean = false): Promise<OperationResponse> {
    const result = insert(treeName, key, value);
    if (enableSteps) {
      // Add simple steps for visualization
      result.steps = [
        { step_id: 1, type: 'TRAVERSE_START', node_id: 'N1', depth: 0, key },
        { step_id: 2, type: 'INSERT_ENTRY', node_id: 'N1', depth: 0, key, value },
        { step_id: 3, type: 'OPERATION_COMPLETE', node_id: 'N1', depth: 0 }
      ];
    }
    return result;
  },

  // Update a key-value pair
  async update(treeName: string, key: CompositeKey, value: Record, enableSteps: boolean = false): Promise<OperationResponse> {
    const result = update(treeName, key, value);
    if (enableSteps) {
      result.steps = [
        { step_id: 1, type: 'TRAVERSE_START', node_id: 'N1', depth: 0, key },
        { step_id: 2, type: 'UPDATE_ENTRY', node_id: 'N1', depth: 0, key, value },
        { step_id: 3, type: 'OPERATION_COMPLETE', node_id: 'N1', depth: 0 }
      ];
    }
    return result;
  },

  // Delete a key-value pair
  async delete(treeName: string, key: CompositeKey, enableSteps: boolean = false): Promise<OperationResponse> {
    const result = deleteKey(treeName, key);
    if (enableSteps) {
      result.steps = [
        { step_id: 1, type: 'TRAVERSE_START', node_id: 'N1', depth: 0, key },
        { step_id: 2, type: 'DELETE_ENTRY', node_id: 'N1', depth: 0, key },
        { step_id: 3, type: 'OPERATION_COMPLETE', node_id: 'N1', depth: 0 }
      ];
    }
    return result;
  },

  // Search for a key
  async search(treeName: string, key: CompositeKey, enableSteps: boolean = false): Promise<OperationResponse> {
    const result = search(treeName, key);
    if (enableSteps) {
      result.steps = [
        { step_id: 1, type: 'TRAVERSE_START', node_id: 'N1', depth: 0, key },
        { step_id: 2, type: result.success ? 'SEARCH_FOUND' : 'SEARCH_NOT_FOUND', node_id: 'N1', depth: 0, key },
        { step_id: 3, type: 'OPERATION_COMPLETE', node_id: 'N1', depth: 0 }
      ];
    }
    return result;
  },

  // Range query
  async rangeQuery(
    treeName: string,
    startKey: CompositeKey,
    endKey: CompositeKey,
    enableSteps: boolean = false
  ): Promise<OperationResponse> {
    const result = rangeQuery(treeName, startKey, endKey);
    if (enableSteps) {
      result.steps = [
        { step_id: 1, type: 'TRAVERSE_START', node_id: 'N1', depth: 0, key: startKey },
        { step_id: 2, type: 'RANGE_SCAN', node_id: 'N1', depth: 0 },
        { step_id: 3, type: 'OPERATION_COMPLETE', node_id: 'N1', depth: 0 }
      ];
    }
    return result;
  },

  // Clear tree
  clearTree(treeName: string) {
    clearTree(treeName);
    initTree(treeName);
  },

  // Initialize tree
  initTree(treeName: string) {
    return initTree(treeName);
  }
};
