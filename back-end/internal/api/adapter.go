package api

import (
	"bplustree/internal/btree"
	"bplustree/internal/storage"
)

// TreeAdapter wraps BPlusTree operations and collects execution steps using the engine's inline recorder
type TreeAdapter struct {
	tree *btree.BPlusTree
}

// NewTreeAdapter creates a new tree adapter
func NewTreeAdapter(tree *btree.BPlusTree) *TreeAdapter {
	return &TreeAdapter{
		tree: tree,
	}
}

// Insert performs an insert operation with optional inline step collection from the engine
func (ta *TreeAdapter) Insert(key storage.CompositeKey, value storage.Record, enableSteps bool) ([]Step, error) {
	var recorder btree.StepRecorder
	var originalRecorder btree.StepRecorder

	if enableSteps {
		// Create a buffered recorder and set it on the tree
		recorder = btree.NewBufferedRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)

		// Reset recorder for this operation
		recorder.Reset()
	} else {
		// Use NoOpRecorder for zero overhead
		recorder = btree.NewNoOpRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
	}

	// Perform the insert operation (engine will record steps inline if enabled)
	err := ta.tree.Insert(key, value)

	// Get steps from recorder and convert to API format
	if enableSteps {
		btSteps := recorder.GetSteps()
		apiSteps := convertBTreeStepsToAPISteps(btSteps)
		return apiSteps, err
	}

	return []Step{}, err
}


// Update performs an update operation with optional inline step collection from the engine
func (ta *TreeAdapter) Update(key storage.CompositeKey, value storage.Record, enableSteps bool) ([]Step, error) {
	var recorder btree.StepRecorder
	var originalRecorder btree.StepRecorder

	if enableSteps {
		recorder = btree.NewBufferedRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
		recorder.Reset()
	} else {
		recorder = btree.NewNoOpRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
	}

	err := ta.tree.Update(key, value)

	if enableSteps {
		btSteps := recorder.GetSteps()
		apiSteps := convertBTreeStepsToAPISteps(btSteps)
		return apiSteps, err
	}

	return []Step{}, err
}

// Delete performs a delete operation with optional inline step collection from the engine
func (ta *TreeAdapter) Delete(key storage.CompositeKey, enableSteps bool) ([]Step, error) {
	var recorder btree.StepRecorder
	var originalRecorder btree.StepRecorder

	if enableSteps {
		recorder = btree.NewBufferedRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
		recorder.Reset()
	} else {
		recorder = btree.NewNoOpRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
	}

	err := ta.tree.Delete(key)

	if enableSteps {
		btSteps := recorder.GetSteps()
		apiSteps := convertBTreeStepsToAPISteps(btSteps)
		return apiSteps, err
	}

	return []Step{}, err
}


// Search performs a search operation with optional inline step collection from the engine
func (ta *TreeAdapter) Search(key storage.CompositeKey, enableSteps bool) (storage.Record, []Step, error) {
	var recorder btree.StepRecorder
	var originalRecorder btree.StepRecorder

	if enableSteps {
		recorder = btree.NewBufferedRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
		recorder.Reset()
	} else {
		recorder = btree.NewNoOpRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
	}

	value, err := ta.tree.Search(key)

	if enableSteps {
		btSteps := recorder.GetSteps()
		apiSteps := convertBTreeStepsToAPISteps(btSteps)
		return value, apiSteps, err
	}

	return value, []Step{}, err
}

// SearchRange performs a range search with optional inline step collection from the engine
func (ta *TreeAdapter) SearchRange(startKey, endKey storage.CompositeKey, enableSteps bool) ([]storage.CompositeKey, []storage.Record, []Step, error) {
	var recorder btree.StepRecorder
	var originalRecorder btree.StepRecorder

	if enableSteps {
		recorder = btree.NewBufferedRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
		recorder.Reset()
	} else {
		recorder = btree.NewNoOpRecorder()
		originalRecorder = ta.tree.GetRecorder()
		ta.tree.SetRecorder(recorder)
		defer ta.tree.SetRecorder(originalRecorder)
	}

	keys, values, err := ta.tree.SearchRange(startKey, endKey)

	if enableSteps {
		btSteps := recorder.GetSteps()
		apiSteps := convertBTreeStepsToAPISteps(btSteps)
		return keys, values, apiSteps, err
	}

	return keys, values, []Step{}, err
}

