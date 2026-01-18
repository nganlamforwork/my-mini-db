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

// Step types from API
export type StepType = 
  | 'TRAVERSE_NODE'
  | 'INSERT_KEY'
  | 'UPDATE_KEY'
  | 'DELETE_KEY'
  | 'SPLIT_NODE'
  | 'MERGE_NODE'
  | 'BORROW_FROM_LEFT'
  | 'BORROW_FROM_RIGHT'
  | 'WAL_APPEND'
  | 'PAGE_LOAD'
  | 'PAGE_FLUSH'
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'EVICT_PAGE';

// Execution Step from API
export interface ExecutionStep {
  type: StepType;
  nodeId?: string;
  keys?: CompositeKey[];
  children?: number[];
  highlightKey?: CompositeKey;
  key?: CompositeKey;
  value?: Record;
  originalNode?: TreeNode;
  newNode?: TreeNode;
  separatorKey?: CompositeKey;
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
  steps: ExecutionStep[];
  error?: string;
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
