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
  | 'INSERT_FAIL' // Duplicate key or other error
  | 'SCAN_RANGE' // Range query scan on leaf: highlight key by key it scans
  | 'LINK_NEXT' // Traverse to next leaf: highlight next leaf
  // Delete Operations
  | 'DELETE_LEAF'
  | 'CHECK_UNDERFLOW'
  | 'CHECK_SIBLINGS'
  | 'BORROW_FROM_SIBLING'
  | 'UPDATE_SEPARATOR'
  | 'MERGE_LEAF'
  | 'UPDATE_LINK'
  | 'DELETE_INDEX'
  | 'INTERNAL_BORROW_ROTATE'
  | 'UPDATE_KEYS_ROTATION'
  | 'UPDATE_LEAF_VALUE'
  | 'FINAL_STATE';

export interface CommonStepBase {
  step: number;
  action: StepAction;
  pageId: number;
  description: string;
  nodeOverrides?: { pageId: number; keys: CompositeKey[] }[];
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

export interface ScanRangeStep extends CommonStepBase {
  action: 'SCAN_RANGE';
  keys?: CompositeKey[];
  rangeStart?: CompositeKey;
  rangeEnd?: CompositeKey;
  collected?: CompositeKey[];
  stopReason?: string;
}

export interface LinkNextStep extends CommonStepBase {
  action: 'LINK_NEXT';
  fromPageId: number;
  toPageId: number;
}

// --- Delete Operation Steps ---

export interface DeleteLeafStep extends CommonStepBase {
  action: 'DELETE_LEAF';
  deleteKey: CompositeKey;
  atIndex: number;
  newKeys: CompositeKey[];
}

export interface CheckUnderflowStep extends CommonStepBase {
  action: 'CHECK_UNDERFLOW';
  currentSize: number;
  minSize: number;
  isUnderflow: boolean;
  keys?: CompositeKey[];
}

export interface CheckSiblingsStep extends CommonStepBase {
  action: 'CHECK_SIBLINGS';
  leftSiblingId?: number | null;
  leftSize?: number;
  rightSiblingId?: number | null;
  rightSize?: number;
  keys?: CompositeKey[];
}

export interface BorrowFromSiblingStep extends CommonStepBase {
  action: 'BORROW_FROM_SIBLING';
  siblingPageId: number;
  borrowedKey: CompositeKey;
  direction: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  keys?: CompositeKey[]; // For current node
  siblingKeys?: CompositeKey[]; // For sibling node
}

export interface UpdateSeparatorStep extends CommonStepBase {
  action: 'UPDATE_SEPARATOR';
  oldKey: CompositeKey;
  newKey: CompositeKey;
}

export interface MergeLeafStep extends CommonStepBase {
  action: 'MERGE_LEAF';
  removePageId: number;
  direction: 'RIGHT_INTO_LEFT' | 'LEFT_INTO_RIGHT';
  mergedKeys: CompositeKey[];
}

export interface UpdateLinkStep extends CommonStepBase {
  action: 'UPDATE_LINK';
  oldNext?: number | null;
  newNext?: number | null;
}

export interface DeleteIndexStep extends CommonStepBase {
  action: 'DELETE_INDEX';
  deleteKey: CompositeKey;
  deleteChildPtr?: number;
  newKeys: CompositeKey[];
  mergedChildren?: number[];
  mergeTargetId?: number;
}

export interface InternalBorrowRotateStep extends CommonStepBase {
  action: 'INTERNAL_BORROW_ROTATE';
  siblingPageId: number;
  parentPageId: number;
  direction: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  movedChildId?: number;
  keys?: CompositeKey[];
  siblingKeys?: CompositeKey[];
}

export interface UpdateKeysRotationStep extends CommonStepBase {
  action: 'UPDATE_KEYS_ROTATION';
  parentKeyIndex: number;
  oldParentKey: CompositeKey;
  newParentKey: CompositeKey;
  movedKeyDown: CompositeKey;
}

export interface UpdateLeafValueStep extends CommonStepBase {
  action: 'UPDATE_LEAF_VALUE';
  key: CompositeKey;
  oldValue: Record | null;
  newValue: Record;
  atIndex: number;
}

export interface FinalStateStep extends CommonStepBase {
  action: 'FINAL_STATE';
  rootKeys?: CompositeKey[];
  // Flexible structure for confirming final state
  [key: string]: any;
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
  | InsertFailStep
  | ScanRangeStep
  | LinkNextStep
  | DeleteLeafStep
  | CheckUnderflowStep
  | CheckSiblingsStep
  | BorrowFromSiblingStep
  | UpdateSeparatorStep
  | MergeLeafStep
  | UpdateLinkStep
  | DeleteIndexStep
  | InternalBorrowRotateStep
  | UpdateKeysRotationStep
  | UpdateLeafValueStep
  | FinalStateStep;

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  steps?: VisualizationStep[]; 
  operation?: 'INSERT' | 'UPDATE' | 'DELETE' | 'SEARCH' | 'RANGE_QUERY';
}
