// Simple B+Tree simulator for frontend visualization
// Stores tree state in localStorage
// This file now serves as a compatibility layer, re-exporting from the modular structure

// Re-export everything from the new modular structure
export type { 
  TreeNode, 
  TreeStructure, 
  CompositeKey, 
  DBRecord,
  OperationResponse,
  TreeMetadata,
  TreesStorage
} from './btree';

export {
  // Storage functions
  getCurrentTreeName,
  setCurrentTreeName,
  loadTree,
  initTree,
  getTree,
  listTrees,
  getTreeMetadata,
  deleteTree,
  canCreateTree,
  getAllTrees,
  clearTree,
  
  // Operations
  search,
  insert,
  deleteKey,
  update,
  rangeQuery,
  initWithRandomData,
  DEFAULT_COUNT,
  MIN_COUNT,
  MAX_COUNT,
} from './btree';
