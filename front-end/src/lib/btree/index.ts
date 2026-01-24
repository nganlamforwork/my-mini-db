// Main export file for B+Tree simulator
// Re-export types
export type { 
  TreeNode, 
  TreeStructure, 
  CompositeKey, 
  DBRecord,
  OperationResponse,
  TreeMetadata,
  TreesStorage
} from './types';

// Re-export constants
export { 
  STORAGE_KEY, 
  CURRENT_TREE_KEY, 
  MAX_TREES, 
  ORDER, 
  MAX_KEYS 
} from './constants';

// Re-export storage functions
export {
  loadTreesStorage,
  saveTreesStorage,
  getCurrentTreeName,
  setCurrentTreeName,
  loadTree,
  saveTree,
  initTree,
  getTree,
  listTrees,
  getTreeMetadata,
  deleteTree,
  canCreateTree,
  getAllTrees,
  clearTree
} from './storage';

// Re-export utility functions
export { compareKeys, findLeaf } from './utils';

// Re-export operations
export { 
  search, 
  insert, 
  deleteKey, 
  update, 
  rangeQuery,
  initWithRandomData,
  DEFAULT_COUNT,
  MIN_COUNT,
  MAX_COUNT,
} from './operations';
