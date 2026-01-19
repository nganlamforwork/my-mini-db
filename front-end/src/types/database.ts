// Column types matching backend
export type ColumnType = 'int' | 'string' | 'float' | 'bool';

export interface Column {
  type: ColumnType;
  value: number | string | boolean;
}

export interface CompositeKey {
  values: Column[];
}

export interface Record {
  columns: Column[];
}

// TreeNode matching backend API structure
export interface TreeNode {
  pageId: number;
  type: 'internal' | 'leaf';
  keys: CompositeKey[];
  // For internal nodes
  children?: number[];
  // For leaf nodes
  values?: Record[];
  nextPage?: number;
  prevPage?: number;
}

// TreeStructure matching backend API response
export interface TreeStructure {
  rootPage: number;
  height: number;
  nodes: { [key: string]: TreeNode }; // Object with pageId as string key
}

// Database Info matching backend API
export interface DatabaseInfo {
  name: string;
  filename: string;
  order: number;
  pageSize: number;
  walEnabled: boolean;
  cacheSize: number;
  rootPage: number;
  height: number;
}

// Cache Statistics
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
}

// Cache Pages
export interface CachePages {
  pageIds: number[];
  count: number;
}

// I/O Read Statistics
export interface IOReadEntry {
  pageId: number;
  pageType: 'meta' | 'internal' | 'leaf';
  timestamp: string;
}

export interface IOReadInfo {
  totalReads: number;
  details: IOReadEntry[];
}

// Step types from API - matching backend exactly
export type StepType = 
  // Navigation & Search Events
  | 'TRAVERSE_START'
  | 'NODE_VISIT'
  | 'KEY_COMPARISON'
  | 'CHILD_POINTER_SELECTED'
  // Insert Logic
  | 'LEAF_FOUND'
  | 'INSERT_ENTRY'
  | 'OVERFLOW_DETECTED'
  | 'NODE_SPLIT'
  | 'PROMOTE_KEY'
  | 'NEW_ROOT_CREATED'
  | 'REBALANCE_COMPLETE'
  // Delete Logic
  | 'ENTRY_REMOVED'
  | 'UNDERFLOW_DETECTED'
  | 'CHECK_SIBLING'
  | 'BORROW_LEFT'
  | 'BORROW_RIGHT'
  | 'MERGE_NODES'
  | 'SHRINK_TREE'
  // Operation Lifecycle
  | 'OPERATION_COMPLETE'
  | 'SEARCH_FOUND'
  | 'SEARCH_NOT_FOUND'
  // Legacy types (kept for backward compatibility during transition)
  | 'TRAVERSE_NODE'
  | 'INSERT_KEY'
  | 'UPDATE_KEY'
  | 'DELETE_KEY'
  | 'BORROW_FROM_LEFT'
  | 'BORROW_FROM_RIGHT'
  | 'BORROW_KEY'
  | 'WAL_APPEND'
  | 'BUFFER_FLUSH'
  | 'PAGE_LOAD'
  | 'PAGE_FLUSH'
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'EVICT_PAGE'
  | 'ADD_TEMP_KEY'
  | 'CHECK_OVERFLOW'
  | 'MERGE_NODE';

// Execution Step from API - matching backend structure exactly
export interface ExecutionStep {
  step_id: number;
  type: StepType;
  node_id?: string;
  target_id?: string | null;
  key?: CompositeKey | null;
  value?: Record | null;
  depth: number;
  metadata?: { [key: string]: any };
  
  // Legacy fields (for backward compatibility during transition)
  nodeId?: string;
  keys?: CompositeKey[];
  children?: number[];
  highlightKey?: CompositeKey;
  originalNode?: string;
  newNode?: string;
  newNodes?: string[];
  separatorKey?: CompositeKey;
  targetNodeId?: string;
  isOverflow?: boolean;
  order?: number;
  lsn?: number;
  pageId?: number;
}

// Operation Response from API
export interface OperationResponse {
  success: boolean;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
  key?: CompositeKey;
  value?: Record;
  keys?: CompositeKey[];
  values?: Record[];
  steps?: ExecutionStep[]; // Optional - only present when enable_steps=true
  error?: string;
}

// WAL Info
export interface WALEntryInfo {
  lsn: number;
  type: string; // "insert", "update", "delete", "checkpoint"
  pageId: number;
}

export interface WALInfo {
  nextLSN: number;
  entries?: WALEntryInfo[];
  checkpoint?: number;
}

// Log Entry for system log
export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  steps?: ExecutionStep[]; // Steps from API operation
  operation?: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
}
