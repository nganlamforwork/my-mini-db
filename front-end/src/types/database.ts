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
  schema?: {
    columns: Array<{ name: string; type: string }>;
    primaryKey: string[];
  };
}


// Tree Configuration
export interface TreeConfig {
  order: number;
  pageSize: number;
  cacheSize: number;
  walEnabled: boolean;
  rootPageId: number;
  height: number;
}


// Schema types for Version 7.0
export interface ColumnDefinition {
  name: string;
  type: 'INT' | 'STRING' | 'FLOAT' | 'BOOL';
}

export interface Schema {
  columns: ColumnDefinition[];
  primaryKey: string[]; // Ordered list of column names
}

// Visualization Step Types for Search/Insert process
export type StepAction = 
  | 'NODE_VISIT' // Highlighting node visited
  | 'COMPARE_RANGE' // Highlighting key found
  | 'SCAN_KEYS' // Highlighting key found
  | 'FIND_POS' // Highlighting key found
  | 'INSERT_LEAF' // Add key into leaf (highlighting key inserted).
  | 'INSERT_INTERNAL' // Add key into internal node (highlighting key inserted).
  | 'CHECK_OVERFLOW'  // Highlighting node to checkoverflow. Overflow => red,  no overflow =>green
  | 'SPLIT_NODE' // Split into 2 nodes (still connect 2 nodes by parent node)
  | 'CREATE_ROOT'  // Create root node
  | 'INSERT_FAIL'; // Duplicate key or other error

export interface CommonStepBase {
  step: number;
  action: StepAction;
  pageId: number;
  description: string;
}

export interface NodeVisitStep extends CommonStepBase {
  action: 'NODE_VISIT';
  nodeType?: 'internal' | 'leaf';
}

export interface CompareRangeStep extends CommonStepBase {
  action: 'COMPARE_RANGE';
  searchKey?: CompositeKey; 
  keyValues?: CompositeKey[]; // Keys available in node
  selectedChildIndex?: number;
  nextPageId?: number;
}

export interface ScanKeysStep extends CommonStepBase {
  action: 'SCAN_KEYS';
  searchKey?: CompositeKey;
  keyValues?: CompositeKey[]; // Legacy support
  keys?: CompositeKey[]; 
  foundAtIndex?: number; // -1 if not found
}

export interface FindPosStep extends CommonStepBase {
  action: 'FIND_POS';
  searchKey?: CompositeKey;
  keys?: CompositeKey[];
  targetIndex: number;
  foundAtIndex?: number;
}

export interface InsertLeafStep extends CommonStepBase {
  action: 'INSERT_LEAF';
  insertKey: CompositeKey;
  atIndex: number;
  newKeys: CompositeKey[];
}

export interface InsertInternalStep extends CommonStepBase {
  action: 'INSERT_INTERNAL';
  insertKey: CompositeKey;
  atIndex: number;
  newKeys: CompositeKey[];
}

export interface CheckOverflowStep extends CommonStepBase {
  action: 'CHECK_OVERFLOW';
  currentSize: number;
  maxSize: number;
  isOverflow: boolean;
  keys?: CompositeKey[]; // Added keys
}

export interface SplitNodeStep extends CommonStepBase {
  action: 'SPLIT_NODE';
  newPageId: number;
  parentId?: number; // Added parentId
  splitKey: CompositeKey;
  leftKeys: CompositeKey[];
  rightKeys: CompositeKey[];
  leftChildren?: number[]; // Added for Internal Split
  rightChildren?: number[]; // Added for Internal Split
  promoteKey: CompositeKey;
}

export interface CreateRootStep extends CommonStepBase {
  action: 'CREATE_ROOT';
  keys: CompositeKey[];
  children: number[];
}

export interface InsertFailStep extends CommonStepBase {
  action: 'INSERT_FAIL';
  reason: string;
}

export type VisualizationStep = 
  | NodeVisitStep
  | CompareRangeStep
  | ScanKeysStep
  | FindPosStep
  | InsertLeafStep
  | InsertInternalStep
  | CheckOverflowStep
  | SplitNodeStep
  | CreateRootStep
  | InsertFailStep;

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  steps?: VisualizationStep[]; 
  operation?: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
}
