// Type definitions for B+Tree operations
import type { TreeNode, TreeStructure, CompositeKey, Record as DBRecord } from '@/types/database';

// Re-export for compatibility
export type { TreeNode, TreeStructure, CompositeKey, DBRecord };

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

export interface TreeMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TreesStorage {
  trees: { [key: string]: TreeStructure }; // tree name -> tree structure
  metadata: { [key: string]: TreeMetadata }; // tree name -> metadata
}
