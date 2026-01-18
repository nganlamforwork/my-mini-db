package api

import (
	"bplustree/internal/storage"
)

// StepType represents the type of execution step
type StepType string

const (
	StepTypeTraverseNode   StepType = "TRAVERSE_NODE"
	StepTypeInsertKey      StepType = "INSERT_KEY"
	StepTypeUpdateKey      StepType = "UPDATE_KEY"
	StepTypeDeleteKey      StepType = "DELETE_KEY"
	StepTypeSplitNode      StepType = "SPLIT_NODE"
	StepTypeMergeNode      StepType = "MERGE_NODE"
	StepTypeBorrowFromLeft StepType = "BORROW_FROM_LEFT"
	StepTypeBorrowFromRight StepType = "BORROW_FROM_RIGHT"
	StepTypeWalAppend      StepType = "WAL_APPEND"
	StepTypeBufferFlush    StepType = "BUFFER_FLUSH"
	StepTypeSearchFound    StepType = "SEARCH_FOUND"
	StepTypeSearchNotFound StepType = "SEARCH_NOT_FOUND"
	// Fine-grained step types for detailed visualization
	StepTypeAddTempKey     StepType = "ADD_TEMP_KEY"
	StepTypeCheckOverflow  StepType = "CHECK_OVERFLOW"
	StepTypePromoteKey     StepType = "PROMOTE_KEY"
	StepTypeBorrowKey      StepType = "BORROW_KEY"
)

// Step represents a single execution step in an operation
type Step struct {
	Type         StepType                `json:"type"`
	NodeID       string                  `json:"nodeId,omitempty"`
	Keys         []storage.CompositeKey  `json:"keys,omitempty"`
	HighlightKey *storage.CompositeKey   `json:"highlightKey,omitempty"`
	Children     []uint64                `json:"children,omitempty"`
	OriginalNode string                  `json:"originalNode,omitempty"`
	NewNode      string                  `json:"newNode,omitempty"`
	NewNodes     []string                `json:"newNodes,omitempty"` // For SPLIT_NODE: [originalNodeId, newNodeId]
	SeparatorKey *storage.CompositeKey   `json:"separatorKey,omitempty"`
	LSN          uint64                  `json:"lsn,omitempty"`
	PageID       string                  `json:"pageId,omitempty"`
	Key          *storage.CompositeKey   `json:"key,omitempty"`
	Value        *storage.Record         `json:"value,omitempty"`
	TargetNodeID string                  `json:"targetNodeId,omitempty"` // For PROMOTE_KEY: parent node receiving the key
	IsOverflow   bool                    `json:"isOverflow,omitempty"`   // For CHECK_OVERFLOW: true if overflow detected
	Order        int                     `json:"order,omitempty"`         // For CHECK_OVERFLOW: tree order for comparison
}

// OperationResponse represents the response from an API operation
type OperationResponse struct {
	Success   bool       `json:"success"`
	Operation string     `json:"operation"`
	Key       *storage.CompositeKey `json:"key,omitempty"`
	Value     *storage.Record       `json:"value,omitempty"`
	Error     string     `json:"error,omitempty"`
	Steps     []Step     `json:"steps"`
}

// DatabaseConfig represents configuration for creating a new database
type DatabaseConfig struct {
	Order     *int  `json:"order,omitempty"`      // B+Tree order (optional, uses default if not set)
	PageSize  *int  `json:"pageSize,omitempty"`   // Page size in bytes (optional)
	WalEnabled *bool `json:"walEnabled,omitempty"` // WAL enabled flag (optional, defaults to true)
	CacheSize *int  `json:"cacheSize,omitempty"`  // Cache size in pages (optional)
}

// DatabaseInfo represents information about a database instance
type DatabaseInfo struct {
	Name      string `json:"name"`
	Filename  string `json:"filename"`
	Order     int    `json:"order"`
	PageSize  int    `json:"pageSize"`
	WalEnabled bool  `json:"walEnabled"`
	CacheSize int    `json:"cacheSize"`
	RootPage  uint64 `json:"rootPage"`
	Height    int    `json:"height"`
}

// TreeNode represents a node in the B+Tree for visualization
type TreeNode struct {
	PageID    uint64            `json:"pageId"`
	Type      string            `json:"type"` // "internal" or "leaf"
	Keys      []JSONCompositeKey `json:"keys"`
	Children  []uint64          `json:"children,omitempty"` // For internal nodes
	Values    []JSONRecord      `json:"values,omitempty"`   // For leaf nodes
	NextPage  *uint64           `json:"nextPage,omitempty"` // For leaf nodes
	PrevPage  *uint64           `json:"prevPage,omitempty"` // For leaf nodes
}

// TreeStructure represents the full tree structure for visualization
type TreeStructure struct {
	RootPage  uint64                  `json:"rootPage"`
	Height    int                     `json:"height"`
	Nodes     map[uint64]TreeNode     `json:"nodes"`
}

// WALEntryInfo represents information about a WAL entry
type WALEntryInfo struct {
	LSN    uint64 `json:"lsn"`
	Type   string `json:"type"` // "insert", "update", "delete", "checkpoint"
	PageID uint64 `json:"pageId"`
}

// WALInfo represents WAL state information
type WALInfo struct {
	NextLSN    uint64         `json:"nextLSN"`
	Entries    []WALEntryInfo `json:"entries,omitempty"`
	Checkpoint *uint64        `json:"checkpoint,omitempty"`
}

// CacheStatsInfo represents cache statistics
type CacheStatsInfo struct {
	Size      int    `json:"size"`
	MaxSize   int    `json:"maxSize"`
	Hits      uint64 `json:"hits"`
	Misses    uint64 `json:"misses"`
	Evictions uint64 `json:"evictions"`
}

// StepCollector collects execution steps during an operation
type StepCollector struct {
	steps []Step
}

// NewStepCollector creates a new step collector
func NewStepCollector() *StepCollector {
	return &StepCollector{
		steps: make([]Step, 0),
	}
}

// AddStep adds a step to the collector
func (sc *StepCollector) AddStep(step Step) {
	sc.steps = append(sc.steps, step)
}

// GetSteps returns all collected steps
func (sc *StepCollector) GetSteps() []Step {
	return sc.steps
}

// Reset clears all collected steps
func (sc *StepCollector) Reset() {
	sc.steps = sc.steps[:0]
}