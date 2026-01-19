package btree

import (
	"bplustree/internal/storage"
)

// StepType represents the type of execution step
type StepType string

const (
	// Navigation & Search Events
	StepTypeTraverseStart      StepType = "TRAVERSE_START"
	StepTypeNodeVisit          StepType = "NODE_VISIT"
	StepTypeKeyComparison      StepType = "KEY_COMPARISON"
	StepTypeChildPointerSelected StepType = "CHILD_POINTER_SELECTED"

	// Insert Logic
	StepTypeLeafFound          StepType = "LEAF_FOUND"
	StepTypeInsertEntry        StepType = "INSERT_ENTRY"
	StepTypeOverflowDetected   StepType = "OVERFLOW_DETECTED"
	StepTypeNodeSplit          StepType = "NODE_SPLIT"
	StepTypePromoteKey         StepType = "PROMOTE_KEY"
	StepTypeNewRootCreated     StepType = "NEW_ROOT_CREATED"
	StepTypeRebalanceComplete  StepType = "REBALANCE_COMPLETE"

	// Delete Logic
	StepTypeEntryRemoved       StepType = "ENTRY_REMOVED"
	StepTypeUnderflowDetected  StepType = "UNDERFLOW_DETECTED"
	StepTypeCheckSibling       StepType = "CHECK_SIBLING"
	StepTypeBorrowLeft         StepType = "BORROW_LEFT"
	StepTypeBorrowRight        StepType = "BORROW_RIGHT"
	StepTypeMergeNodes         StepType = "MERGE_NODES"
	StepTypeShrinkTree         StepType = "SHRINK_TREE"

	// Operation Lifecycle
	StepTypeOperationComplete  StepType = "OPERATION_COMPLETE"
	StepTypeSearchFound        StepType = "SEARCH_FOUND"
	StepTypeSearchNotFound     StepType = "SEARCH_NOT_FOUND"
)

// Step represents a single execution step in an operation
type Step struct {
	StepID    uint64                 `json:"step_id"`
	Type      StepType               `json:"type"`
	NodeID    string                 `json:"node_id,omitempty"`
	TargetID  string                 `json:"target_id,omitempty"`
	Key       *storage.CompositeKey   `json:"key,omitempty"`
	Value     *storage.Record         `json:"value,omitempty"`
	Depth     int                     `json:"depth"`
	Metadata  map[string]interface{}  `json:"metadata,omitempty"`
}

// StepRecorder interface for recording execution steps
type StepRecorder interface {
	// RecordStep records a single step
	RecordStep(stepType StepType, nodeID string, depth int, metadata map[string]interface{})
	
	// RecordStepWithKey records a step with a key
	RecordStepWithKey(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, metadata map[string]interface{})
	
	// RecordStepWithKeyValue records a step with key and value
	RecordStepWithKeyValue(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, value *storage.Record, metadata map[string]interface{})
	
	// RecordStepWithTarget records a step with a target node
	RecordStepWithTarget(stepType StepType, nodeID string, targetID string, depth int, metadata map[string]interface{})
	
	// RecordStepWithTargetKey records a step with target and key
	RecordStepWithTargetKey(stepType StepType, nodeID string, targetID string, depth int, key *storage.CompositeKey, metadata map[string]interface{})
	
	// GetSteps returns all recorded steps
	GetSteps() []Step
	
	// Reset clears all recorded steps
	Reset()
}

// NoOpRecorder is a no-op implementation that does nothing (zero overhead)
type NoOpRecorder struct{}

func NewNoOpRecorder() *NoOpRecorder {
	return &NoOpRecorder{}
}

func (r *NoOpRecorder) RecordStep(stepType StepType, nodeID string, depth int, metadata map[string]interface{}) {
	// No-op
}

func (r *NoOpRecorder) RecordStepWithKey(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, metadata map[string]interface{}) {
	// No-op
}

func (r *NoOpRecorder) RecordStepWithKeyValue(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, value *storage.Record, metadata map[string]interface{}) {
	// No-op
}

func (r *NoOpRecorder) RecordStepWithTarget(stepType StepType, nodeID string, targetID string, depth int, metadata map[string]interface{}) {
	// No-op
}

func (r *NoOpRecorder) RecordStepWithTargetKey(stepType StepType, nodeID string, targetID string, depth int, key *storage.CompositeKey, metadata map[string]interface{}) {
	// No-op
}

func (r *NoOpRecorder) GetSteps() []Step {
	return nil
}

func (r *NoOpRecorder) Reset() {
	// No-op
}

// BufferedRecorder collects steps in memory for visualization
type BufferedRecorder struct {
	steps  []Step
	stepID uint64
}

func NewBufferedRecorder() *BufferedRecorder {
	return &BufferedRecorder{
		steps:  make([]Step, 0),
		stepID: 0,
	}
}

func (r *BufferedRecorder) RecordStep(stepType StepType, nodeID string, depth int, metadata map[string]interface{}) {
	r.stepID++
	step := Step{
		StepID:   r.stepID,
		Type:     stepType,
		NodeID:   nodeID,
		Depth:    depth,
		Metadata: metadata,
	}
	if metadata == nil {
		step.Metadata = make(map[string]interface{})
	}
	r.steps = append(r.steps, step)
}

func (r *BufferedRecorder) RecordStepWithKey(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, metadata map[string]interface{}) {
	r.stepID++
	step := Step{
		StepID:   r.stepID,
		Type:     stepType,
		NodeID:   nodeID,
		Key:      key,
		Depth:    depth,
		Metadata: metadata,
	}
	if metadata == nil {
		step.Metadata = make(map[string]interface{})
	}
	r.steps = append(r.steps, step)
}

func (r *BufferedRecorder) RecordStepWithKeyValue(stepType StepType, nodeID string, depth int, key *storage.CompositeKey, value *storage.Record, metadata map[string]interface{}) {
	r.stepID++
	step := Step{
		StepID:   r.stepID,
		Type:     stepType,
		NodeID:   nodeID,
		Key:      key,
		Value:    value,
		Depth:    depth,
		Metadata: metadata,
	}
	if metadata == nil {
		step.Metadata = make(map[string]interface{})
	}
	r.steps = append(r.steps, step)
}

func (r *BufferedRecorder) RecordStepWithTarget(stepType StepType, nodeID string, targetID string, depth int, metadata map[string]interface{}) {
	r.stepID++
	step := Step{
		StepID:   r.stepID,
		Type:     stepType,
		NodeID:   nodeID,
		TargetID: targetID,
		Depth:    depth,
		Metadata: metadata,
	}
	if metadata == nil {
		step.Metadata = make(map[string]interface{})
	}
	r.steps = append(r.steps, step)
}

func (r *BufferedRecorder) RecordStepWithTargetKey(stepType StepType, nodeID string, targetID string, depth int, key *storage.CompositeKey, metadata map[string]interface{}) {
	r.stepID++
	step := Step{
		StepID:   r.stepID,
		Type:     stepType,
		NodeID:   nodeID,
		TargetID: targetID,
		Key:      key,
		Depth:    depth,
		Metadata: metadata,
	}
	if metadata == nil {
		step.Metadata = make(map[string]interface{})
	}
	r.steps = append(r.steps, step)
}

func (r *BufferedRecorder) GetSteps() []Step {
	return r.steps
}

func (r *BufferedRecorder) Reset() {
	r.steps = r.steps[:0]
	r.stepID = 0
}
