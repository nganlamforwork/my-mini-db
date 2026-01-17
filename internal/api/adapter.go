package api

import (
	"fmt"

	"bplustree/internal/btree"
	"bplustree/internal/common"
	"bplustree/internal/page"
	"bplustree/internal/storage"
)

// TreeAdapter wraps BPlusTree operations and collects execution steps
type TreeAdapter struct {
	tree      *btree.BPlusTree
	collector *StepCollector
}

// NewTreeAdapter creates a new tree adapter
func NewTreeAdapter(tree *btree.BPlusTree) *TreeAdapter {
	return &TreeAdapter{
		tree:      tree,
		collector: NewStepCollector(),
	}
}

// Insert performs an insert operation with step collection
func (ta *TreeAdapter) Insert(key storage.CompositeKey, value storage.Record) ([]Step, error) {
	ta.collector.Reset()

	if ta.tree.IsEmpty() {
		err := ta.tree.Insert(key, value)
		if err != nil {
			return ta.collector.GetSteps(), err
		}

		// Capture initial root creation
		meta, _ := ta.tree.GetPager().ReadMeta()
		if meta != nil && meta.RootPage != 0 {
			rootPage := ta.tree.GetPager().Get(meta.RootPage)
			if rootPage != nil {
				// Try to get page ID from page header
				if leafPage, ok := rootPage.(*page.LeafPage); ok {
					ta.collector.AddStep(Step{
						Type:   StepTypeInsertKey,
						NodeID: fmt.Sprintf("page-%d", leafPage.Header.PageID),
						Key:    &key,
					})
				}
			}
		}
		return ta.collector.GetSteps(), nil
	}

	// Find leaf path and collect traversal steps
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta == nil || meta.RootPage == 0 {
		err := ta.tree.Insert(key, value)
		return ta.collector.GetSteps(), err
	}

	// Traverse to leaf and collect steps
	err := ta.collectTraverseSteps(key, meta.RootPage)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Perform insert
	err = ta.tree.Insert(key, value)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Capture post-insert state (simplified - would need more instrumentation)
	ta.collector.AddStep(Step{
		Type:   StepTypeInsertKey,
		NodeID: "page-leaf", // Simplified - would track actual page ID
		Key:    &key,
	})

	// Note: Split steps would require more instrumentation
	// For now, we rely on introspection to detect splits after the fact

	return ta.collector.GetSteps(), nil
}

// Update performs an update operation with step collection
func (ta *TreeAdapter) Update(key storage.CompositeKey, value storage.Record) ([]Step, error) {
	ta.collector.Reset()

	// Find and traverse
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		_ = ta.collectTraverseSteps(key, meta.RootPage)
	}

	err := ta.tree.Update(key, value)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	ta.collector.AddStep(Step{
		Type:   StepTypeUpdateKey,
		NodeID: "page-leaf", // Simplified
		Key:    &key,
	})

	return ta.collector.GetSteps(), nil
}

// Delete performs a delete operation with step collection
func (ta *TreeAdapter) Delete(key storage.CompositeKey) ([]Step, error) {
	ta.collector.Reset()

	// Find and traverse
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		_ = ta.collectTraverseSteps(key, meta.RootPage)
	}

	err := ta.tree.Delete(key)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	ta.collector.AddStep(Step{
		Type:   StepTypeDeleteKey,
		NodeID: "page-leaf", // Simplified
		Key:    &key,
	})

	return ta.collector.GetSteps(), nil
}

// Search performs a search operation with step collection
func (ta *TreeAdapter) Search(key storage.CompositeKey) (storage.Record, []Step, error) {
	ta.collector.Reset()

	if ta.tree.IsEmpty() {
		return storage.Record{}, ta.collector.GetSteps(), fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find and traverse
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		_ = ta.collectTraverseSteps(key, meta.RootPage)
	}

	value, err := ta.tree.Search(key)
	if err != nil {
		ta.collector.AddStep(Step{
			Type: StepTypeSearchNotFound,
			Key:  &key,
		})
		return storage.Record{}, ta.collector.GetSteps(), err
	}

	ta.collector.AddStep(Step{
		Type:  StepTypeSearchFound,
		Key:   &key,
		Value: &value,
	})

	return value, ta.collector.GetSteps(), nil
}

// SearchRange performs a range search with step collection
func (ta *TreeAdapter) SearchRange(startKey, endKey storage.CompositeKey) ([]storage.CompositeKey, []storage.Record, []Step, error) {
	ta.collector.Reset()

	if ta.tree.IsEmpty() {
		return []storage.CompositeKey{}, []storage.Record{}, ta.collector.GetSteps(), nil
	}

	// Traverse to start
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		_ = ta.collectTraverseSteps(startKey, meta.RootPage)
	}

	keys, values, err := ta.tree.SearchRange(startKey, endKey)
	return keys, values, ta.collector.GetSteps(), err
}

// collectTraverseSteps collects traversal steps from root to leaf
func (ta *TreeAdapter) collectTraverseSteps(key storage.CompositeKey, rootID uint64) error {
	currentID := rootID

	for {
		pg := ta.tree.GetPager().Get(currentID)
		if pg == nil {
			return fmt.Errorf("page not found: %d", currentID)
		}

		switch p := pg.(type) {
		case *page.LeafPage:
			// Add final traversal step
			keys := make([]storage.CompositeKey, len(p.Keys))
			copy(keys, p.Keys)
			ta.collector.AddStep(Step{
				Type:         StepTypeTraverseNode,
				NodeID:       fmt.Sprintf("page-%d", p.Header.PageID),
				Keys:         keys,
				HighlightKey: &key,
			})
			return nil

		case *page.InternalPage:
			// Add traversal step
			keys := make([]storage.CompositeKey, len(p.Keys))
			copy(keys, p.Keys)
			children := make([]uint64, len(p.Children))
			copy(children, p.Children)
			ta.collector.AddStep(Step{
				Type:         StepTypeTraverseNode,
				NodeID:       fmt.Sprintf("page-%d", p.Header.PageID),
				Keys:         keys,
				Children:     children,
				HighlightKey: &key,
			})

			// Binary search to find next child
			pos := common.BinarySearchLastLessOrEqual(p.Keys, key)
			var childIndex int
			if pos == -1 {
				childIndex = 0
			} else {
				childIndex = pos + 1
			}

			currentID = p.Children[childIndex]

		default:
			return fmt.Errorf("unknown page type for page ID: %d", currentID)
		}
	}
}