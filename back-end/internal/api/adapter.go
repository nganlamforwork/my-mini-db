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

// Insert performs an insert operation with fine-grained step collection
func (ta *TreeAdapter) Insert(key storage.CompositeKey, value storage.Record) ([]Step, error) {
	ta.collector.Reset()

	// Handle empty tree
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
				if leafPage, ok := rootPage.(*page.LeafPage); ok {
					// Capture ADD_TEMP_KEY step (key added to new root)
					keys := make([]storage.CompositeKey, len(leafPage.Keys))
					copy(keys, leafPage.Keys)
					ta.collector.AddStep(Step{
						Type:   StepTypeAddTempKey,
						NodeID: fmt.Sprintf("page-%d", leafPage.Header.PageID),
						Keys:   keys,
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
	leaf, path, err := ta.collectTraverseStepsWithPath(key, meta.RootPage)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Capture state before insert
	leafID := fmt.Sprintf("page-%d", leaf.Header.PageID)
	keysBefore := make([]storage.CompositeKey, len(leaf.Keys))
	copy(keysBefore, leaf.Keys)

	// Perform insert operation (this will modify the tree)
	err = ta.tree.Insert(key, value)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Reload leaf to see current state
	leafAfter := ta.tree.GetPager().Get(leaf.Header.PageID)
	if leafAfter == nil {
		return ta.collector.GetSteps(), fmt.Errorf("leaf page disappeared after insert")
	}

	leafAfterTyped, ok := leafAfter.(*page.LeafPage)
	if !ok {
		return ta.collector.GetSteps(), fmt.Errorf("page type changed unexpectedly")
	}

	// Capture ADD_TEMP_KEY step (key added, may cause overflow)
	keysAfter := make([]storage.CompositeKey, len(leafAfterTyped.Keys))
	copy(keysAfter, leafAfterTyped.Keys)
	ta.collector.AddStep(Step{
		Type:   StepTypeAddTempKey,
		NodeID: leafID,
		Keys:   keysAfter,
		Key:    &key,
	})

	// Check for overflow
	order := int(meta.Order)
	if order == 0 {
		order = page.ORDER // fallback to default
	}
	isOverflow := len(keysAfter) > order-1 || page.ComputeLeafPayloadSize(leafAfterTyped) > int(page.DefaultPageSize-page.PageHeaderSize)

	ta.collector.AddStep(Step{
		Type:       StepTypeCheckOverflow,
		NodeID:     leafID,
		Keys:       keysAfter,
		IsOverflow: isOverflow,
		Order:      order,
	})

	// If overflow occurred, capture split and promotion steps
	if isOverflow {
		ta.captureSplitSteps(leaf.Header.PageID, path, key, meta.RootPage)
	}

	return ta.collector.GetSteps(), nil
}

// captureSplitSteps captures split and promotion steps after an insert
func (ta *TreeAdapter) captureSplitSteps(originalLeafID uint64, path []uint64, insertedKey storage.CompositeKey, rootID uint64) {
	pager := ta.tree.GetPager()

	// Reload the original leaf to see if it was split
	originalLeaf := pager.Get(originalLeafID)
	if originalLeaf == nil {
		return
	}

	originalLeafTyped, ok := originalLeaf.(*page.LeafPage)
	if !ok {
		return
	}

	// Check if a new leaf was created (split occurred)
	// We can detect this by checking if the original leaf has fewer keys than before
	// or by checking if there's a next page that might be new
	nextPageID := originalLeafTyped.Header.NextPage

	// If there's a next page, check if it's new (wasn't there before)
	if nextPageID != 0 {
		nextLeaf := pager.Get(nextPageID)
		if nextLeaf != nil {
			if nextLeafTyped, ok := nextLeaf.(*page.LeafPage); ok {
				// Check if this next leaf starts with a key that would indicate a split
				if len(nextLeafTyped.Keys) > 0 {
					// This is likely the new right leaf from the split
					separatorKey := nextLeafTyped.Keys[0]

					// Capture SPLIT_NODE step
					originalKeys := make([]storage.CompositeKey, len(originalLeafTyped.Keys))
					copy(originalKeys, originalLeafTyped.Keys)
					newKeys := make([]storage.CompositeKey, len(nextLeafTyped.Keys))
					copy(newKeys, nextLeafTyped.Keys)

					ta.collector.AddStep(Step{
						Type:         StepTypeSplitNode,
						NodeID:       fmt.Sprintf("page-%d", originalLeafID),
						Keys:         originalKeys,
						OriginalNode: fmt.Sprintf("page-%d", originalLeafID),
						NewNode:      fmt.Sprintf("page-%d", nextPageID),
						NewNodes:     []string{fmt.Sprintf("page-%d", originalLeafID), fmt.Sprintf("page-%d", nextPageID)},
						SeparatorKey: &separatorKey,
					})

					// Capture PROMOTE_KEY step
					if len(path) > 0 {
						parentID := path[len(path)-1]
						parent := pager.Get(parentID)
						if parent != nil {
							if parentTyped, ok := parent.(*page.InternalPage); ok {
								ta.collector.AddStep(Step{
									Type:         StepTypePromoteKey,
									Key:          &separatorKey,
									TargetNodeID: fmt.Sprintf("page-%d", parentID),
									NodeID:       fmt.Sprintf("page-%d", parentID),
									Keys:         make([]storage.CompositeKey, len(parentTyped.Keys)),
								})
								// Copy parent keys
								copy(ta.collector.GetSteps()[len(ta.collector.GetSteps())-1].Keys, parentTyped.Keys)
							}
						}
					} else {
						// Root split - new root was created
						meta, _ := pager.ReadMeta()
						if meta != nil && meta.RootPage != rootID {
							newRoot := pager.Get(meta.RootPage)
							if newRoot != nil {
								if rootTyped, ok := newRoot.(*page.InternalPage); ok {
									ta.collector.AddStep(Step{
										Type:         StepTypePromoteKey,
										Key:          &separatorKey,
										TargetNodeID: fmt.Sprintf("page-%d", meta.RootPage),
										NodeID:       fmt.Sprintf("page-%d", meta.RootPage),
										Keys:         make([]storage.CompositeKey, len(rootTyped.Keys)),
									})
									// Copy root keys
									copy(ta.collector.GetSteps()[len(ta.collector.GetSteps())-1].Keys, rootTyped.Keys)
								}
							}
						}
					}

					// Check if parent also overflowed (recursive split)
					if len(path) > 0 {
						parentID := path[len(path)-1]
						parent := pager.Get(parentID)
						if parent != nil {
							if parentTyped, ok := parent.(*page.InternalPage); ok {
								meta, _ := pager.ReadMeta()
								order := int(page.ORDER)
								if meta != nil && meta.Order != 0 {
									order = int(meta.Order)
								}
								if len(parentTyped.Keys) >= order {
									// Parent also overflowed, capture its split
									ta.captureInternalSplitSteps(parentID, path[:len(path)-1], separatorKey, rootID)
								}
							}
						}
					}
				}
			}
		}
	}
}

// captureInternalSplitSteps captures split steps for internal nodes
func (ta *TreeAdapter) captureInternalSplitSteps(nodeID uint64, path []uint64, promotedKey storage.CompositeKey, rootID uint64) {
	pager := ta.tree.GetPager()
	node := pager.Get(nodeID)
	if node == nil {
		return
	}

	nodeTyped, ok := node.(*page.InternalPage)
	if !ok {
		return
	}

	// Find the new sibling (check children to find new page)
	// This is a heuristic - we look for a new page that might be the split result
	meta, _ := pager.ReadMeta()
	order := int(page.ORDER)
	if meta != nil && meta.Order != 0 {
		order = int(meta.Order)
	}

	// Check if node still has overflow (indicating split happened)
	if len(nodeTyped.Keys) < order {
		// Split already resolved, capture the promotion step
		keys := make([]storage.CompositeKey, len(nodeTyped.Keys))
		copy(keys, nodeTyped.Keys)
		ta.collector.AddStep(Step{
			Type:         StepTypePromoteKey,
			Key:          &promotedKey,
			TargetNodeID: fmt.Sprintf("page-%d", nodeID),
			NodeID:       fmt.Sprintf("page-%d", nodeID),
			Keys:         keys,
		})
	}
}

// Update performs an update operation with step collection
func (ta *TreeAdapter) Update(key storage.CompositeKey, value storage.Record) ([]Step, error) {
	ta.collector.Reset()

	// Traverse to find the key
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		leaf, path, err := ta.collectTraverseStepsWithPath(key, meta.RootPage)
		if err != nil {
			return ta.collector.GetSteps(), err
		}

		// Capture state before update
		leafID := fmt.Sprintf("page-%d", leaf.Header.PageID)
		keysBefore := make([]storage.CompositeKey, len(leaf.Keys))
		copy(keysBefore, leaf.Keys)

		// Perform update
		err = ta.tree.Update(key, value)
		if err != nil {
			return ta.collector.GetSteps(), err
		}

		// Reload to see current state
		leafAfter := ta.tree.GetPager().Get(leaf.Header.PageID)
		if leafAfter != nil {
			if leafAfterTyped, ok := leafAfter.(*page.LeafPage); ok {
				keysAfter := make([]storage.CompositeKey, len(leafAfterTyped.Keys))
				copy(keysAfter, leafAfterTyped.Keys)

				ta.collector.AddStep(Step{
					Type:   StepTypeUpdateKey,
					NodeID: leafID,
					Keys:   keysAfter,
					Key:    &key,
				})

				// Check if update caused a delete+insert (rebalancing)
				// This happens when the new value doesn't fit
				if len(keysAfter) != len(keysBefore) {
					// Keys changed, might have triggered delete+insert
					// Check if we need to capture split/merge steps
					order := int(meta.Order)
					if order == 0 {
						order = page.ORDER
					}
					isOverflow := len(keysAfter) > order-1
					if isOverflow {
						ta.captureSplitSteps(leaf.Header.PageID, path, key, meta.RootPage)
					}
				}
			}
		} else {
			// Leaf was removed (merged), update caused delete+insert
			ta.collector.AddStep(Step{
				Type:   StepTypeUpdateKey,
				NodeID: leafID,
				Key:    &key,
			})
		}
	} else {
		// Fallback: just perform update
		err := ta.tree.Update(key, value)
		if err != nil {
			return ta.collector.GetSteps(), err
		}

		ta.collector.AddStep(Step{
			Type: StepTypeUpdateKey,
			Key:  &key,
		})
	}

	return ta.collector.GetSteps(), nil
}

// Delete performs a delete operation with fine-grained step collection
func (ta *TreeAdapter) Delete(key storage.CompositeKey) ([]Step, error) {
	ta.collector.Reset()

	// Traverse to find the key
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta == nil || meta.RootPage == 0 {
		err := ta.tree.Delete(key)
		return ta.collector.GetSteps(), err
	}

	leaf, path, err := ta.collectTraverseStepsWithPath(key, meta.RootPage)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Capture state before delete
	leafID := fmt.Sprintf("page-%d", leaf.Header.PageID)
	keysBefore := make([]storage.CompositeKey, len(leaf.Keys))
	copy(keysBefore, leaf.Keys)

	// Perform delete
	err = ta.tree.Delete(key)
	if err != nil {
		return ta.collector.GetSteps(), err
	}

	// Reload leaf to see current state
	leafAfter := ta.tree.GetPager().Get(leaf.Header.PageID)
	if leafAfter == nil {
		// Leaf was merged, capture merge step
		ta.collector.AddStep(Step{
			Type:         StepTypeDeleteKey,
			NodeID:       leafID,
			Key:         &key,
			OriginalNode: leafID,
		})
		ta.collector.AddStep(Step{
			Type: StepTypeMergeNode,
			OriginalNode: leafID,
		})
		return ta.collector.GetSteps(), nil
	}

	leafAfterTyped, ok := leafAfter.(*page.LeafPage)
	if !ok {
		return ta.collector.GetSteps(), fmt.Errorf("page type changed unexpectedly")
	}

	// Capture DELETE_KEY step
	keysAfter := make([]storage.CompositeKey, len(leafAfterTyped.Keys))
	copy(keysAfter, leafAfterTyped.Keys)
	ta.collector.AddStep(Step{
		Type:   StepTypeDeleteKey,
		NodeID: leafID,
		Keys:   keysAfter,
		Key:    &key,
	})

	// Check for underflow
	order := int(meta.Order)
	if order == 0 {
		order = page.ORDER
	}
	minKeys := (order - 1) / 2
	isUnderflow := len(keysAfter) < minKeys

	ta.collector.AddStep(Step{
		Type:       StepTypeCheckOverflow,
		NodeID:     leafID,
		Keys:       keysAfter,
		IsOverflow: isUnderflow,
		Order:      order,
	})

	// If underflow occurred, capture borrow/merge steps
	if isUnderflow && len(path) > 0 {
		ta.captureRebalanceSteps(leaf.Header.PageID, path, key)
	}

	return ta.collector.GetSteps(), nil
}

// captureRebalanceSteps captures borrow and merge steps after a delete
func (ta *TreeAdapter) captureRebalanceSteps(leafID uint64, path []uint64, deletedKey storage.CompositeKey) {
	pager := ta.tree.GetPager()
	parentID := path[len(path)-1]
	parent := pager.Get(parentID)
	if parent == nil {
		return
	}

	parentTyped, ok := parent.(*page.InternalPage)
	if !ok {
		return
	}

	// Find leaf index in parent
	leafIndex := -1
	for i, childID := range parentTyped.Children {
		if childID == leafID {
			leafIndex = i
			break
		}
	}

	if leafIndex == -1 {
		return
	}

	// Check if borrow or merge occurred by examining siblings
	leafAfter := pager.Get(leafID)
	if leafAfter == nil {
		// Leaf was merged
		ta.collector.AddStep(Step{
			Type:         StepTypeMergeNode,
			OriginalNode: fmt.Sprintf("page-%d", leafID),
		})
		return
	}

	leafAfterTyped, ok := leafAfter.(*page.LeafPage)
	if !ok {
		return
	}

	// Check right sibling
	if leafIndex < len(parentTyped.Children)-1 {
		rightSiblingID := parentTyped.Children[leafIndex+1]
		rightSibling := pager.Get(rightSiblingID)
		if rightSibling != nil {
			if rightSiblingTyped, ok := rightSibling.(*page.LeafPage); ok {
				// If right sibling has fewer keys than before, borrow occurred
				// (heuristic: if leaf has more keys than min, borrow likely happened)
				order := int(page.ORDER)
				minKeys := (order - 1) / 2
				if len(leafAfterTyped.Keys) > minKeys && len(rightSiblingTyped.Keys) < len(leafAfterTyped.Keys)+1 {
					ta.collector.AddStep(Step{
						Type:   StepTypeBorrowKey,
						NodeID: fmt.Sprintf("page-%d", leafID),
						Key:    &deletedKey,
					})
				}
			}
		}
	}

	// Check left sibling
	if leafIndex > 0 {
		leftSiblingID := parentTyped.Children[leafIndex-1]
		leftSibling := pager.Get(leftSiblingID)
		if leftSibling != nil {
			if leftSiblingTyped, ok := leftSibling.(*page.LeafPage); ok {
				order := int(page.ORDER)
				minKeys := (order - 1) / 2
				if len(leafAfterTyped.Keys) > minKeys && len(leftSiblingTyped.Keys) < len(leafAfterTyped.Keys)+1 {
					ta.collector.AddStep(Step{
						Type:   StepTypeBorrowKey,
						NodeID: fmt.Sprintf("page-%d", leafID),
						Key:    &deletedKey,
					})
				}
			}
		}
	}
}

// Search performs a search operation with step collection
func (ta *TreeAdapter) Search(key storage.CompositeKey) (storage.Record, []Step, error) {
	ta.collector.Reset()

	if ta.tree.IsEmpty() {
		return storage.Record{}, ta.collector.GetSteps(), fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Traverse to find the key
	meta, _ := ta.tree.GetPager().ReadMeta()
	if meta != nil && meta.RootPage != 0 {
		_, _, err := ta.collectTraverseStepsWithPath(key, meta.RootPage)
		if err != nil {
			return storage.Record{}, ta.collector.GetSteps(), err
		}
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
		_, _, err := ta.collectTraverseStepsWithPath(startKey, meta.RootPage)
		if err != nil {
			return nil, nil, ta.collector.GetSteps(), err
		}
	}

	keys, values, err := ta.tree.SearchRange(startKey, endKey)
	return keys, values, ta.collector.GetSteps(), err
}

// collectTraverseStepsWithPath collects traversal steps and returns the leaf and path
func (ta *TreeAdapter) collectTraverseStepsWithPath(key storage.CompositeKey, rootID uint64) (*page.LeafPage, []uint64, error) {
	path := make([]uint64, 0)
	currentID := rootID

	for {
		pg := ta.tree.GetPager().Get(currentID)
		if pg == nil {
			return nil, nil, fmt.Errorf("page not found: %d", currentID)
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
			return p, path, nil

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

			path = append(path, currentID)

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
			return nil, nil, fmt.Errorf("unknown page type for page ID: %d", currentID)
		}
	}
}
