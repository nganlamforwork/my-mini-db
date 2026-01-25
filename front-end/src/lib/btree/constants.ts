// Constants for B+Tree operations

export const STORAGE_KEY = 'btree_trees'; // Store all trees
export const CURRENT_TREE_KEY = 'btree_current'; // Current active tree name
export const MAX_TREES = 6;
export const ORDER = 4; // Max 3 keys per node
export const MAX_KEYS = ORDER - 1;
