package main

import "fmt"

type BPlusTree struct {
	meta  *MetaPage
	pager *PageManager
}

const MAX_KEYS = ORDER - 1

// -----------------------------
// Finding the correct leaf
// -----------------------------

// findLeaf traverses the B+Tree from the root to locate the leaf page
// that should contain (or receive) `key`.
//
// Key concepts and flow:
//   - It iteratively follows internal nodes until a leaf is reached.
//   - For each internal node it performs a binary search to determine
//     which child pointer to follow (the last key <= search key).
//   - The function returns the target leaf and a slice of internal
//     page IDs representing the path from root to the leaf (excluding
//     the leaf itself). The path is used for upward propagation when
//     splits occur.
func (tree *BPlusTree) findLeaf(key KeyType) (*LeafPage, []uint64, error) {
	path := make([]uint64, 0)

	// ensure meta is loaded
	if tree.meta == nil {
		if m, err := tree.pager.ReadMeta(); err == nil {
			tree.meta = m
		}
	}

	currentID := uint64(0)
	if tree.meta != nil {
		currentID = tree.meta.RootPage
	}
	for {
		page := tree.pager.Get(currentID)
		if page == nil {
			return nil, nil, fmt.Errorf("page not found: %d", currentID)
		}

		switch p := page.(type) {
		case *LeafPage:
			return p, path, nil

		case *InternalPage:
			path = append(path, currentID)

			// binary search: last key <= key
			left, right := 0, len(p.keys)-1
			pos := -1
			for left <= right {
				mid := (left + right) / 2
				if p.keys[mid].Compare(key) <= 0 {
					pos = mid
					left = mid + 1
				} else {
					right = mid - 1
				}
			}

			// If pos == -1 then all keys in the internal node are > key,
			// so the correct child to follow is the left-most child (index 0).
			var childIndex int
			if pos == -1 {
				childIndex = 0
			} else {
				childIndex = pos + 1
			}

			currentID = p.children[childIndex]

		default:
			return nil, nil, fmt.Errorf("unknown page type for page ID: %d", currentID)
		}
	}
}

// -----------------------------
// Insert into B+ Tree
// -----------------------------

func (tree *BPlusTree) Insert(key KeyType, value ValueType) error {
	// Insert inserts a key/value into the B+Tree, maintaining
	// balanced properties and splitting nodes as needed.
	//
	// High-level flow:
	// 1) If tree is empty, create a root leaf and insert.
	// 2) Find the target leaf and check for duplicates.
	// 3) Insert into the leaf; if it overflows, split the leaf.
	// 4) Propagate splits upward through internal nodes.
	// 5) If the root splits, create a new root internal node.

	// 1. Empty tree → create root leaf
	if tree.meta == nil {
		if m, err := tree.pager.ReadMeta(); err == nil {
			tree.meta = m
		} else {
			// fallback: create a new meta page in-memory
			tree.meta = &MetaPage{RootPage: 0, PageSize: uint32(DefaultPageSize), Order: uint16(ORDER), Version: 1}
		}
	}

	if tree.meta.RootPage == 0 {
		leaf := tree.pager.NewLeaf()
		leaf.keys = append(leaf.keys, key)
		leaf.values = append(leaf.values, value)
		leaf.Header.KeyCount = 1
		tree.meta.RootPage = leaf.Header.PageID
		// persist meta
		if err := tree.pager.WriteMeta(tree.meta); err != nil {
			return err
		}
		return nil
	}

	// 2. Find target leaf + path to parent
	leaf, path, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Check for duplicate keys
	for _, existingKey := range leaf.keys {
		if existingKey.Compare(key) == 0 {
			return fmt.Errorf("duplicate key insertion: %v", key)
		}
	}

	// Insert into the leaf in sorted order
	if err := insertIntoLeaf(leaf, key, value); err != nil {
		return err
	}

	// If the leaf does not overflow (by key count or payload), we're done
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	if len(leaf.keys) <= MAX_KEYS {
		if computeLeafPayloadSize(leaf) <= payloadCapacity {
			return nil
		}
	}

	// 3. Split leaf
	var pushKey KeyType
	newLeaf := tree.pager.NewLeaf()
	pushKey = splitLeaf(leaf, newLeaf)

	var childPageID uint64 = newLeaf.Header.PageID

	// 4. Propagate split up: insert the promoted key into parent
	//    internal nodes. If a parent overflows, split it and
	//    continue upward. `childPageID` always points to the
	//    right-side page produced by the most recent split.
	for len(path) > 0 {
		parentID := path[len(path)-1]
		path = path[:len(path)-1]

		parent := tree.pager.Get(parentID).(*InternalPage)

		// Insert the separator key and pointer into parent
		insertIntoInternal(parent, pushKey, childPageID)

		// If parent didn't overflow, split propagation stops
		if len(parent.keys) < ORDER {
			return nil
		}

		// split internal
		newInternal := tree.pager.NewInternal()
		pushKey = splitInternal(parent, newInternal, tree.pager)
		childPageID = newInternal.Header.PageID
	}

	// 5. Root split → create new root
	newRoot := tree.pager.NewInternal()
	newRoot.keys = append(newRoot.keys, pushKey)
	newRoot.children = append(
		newRoot.children,
		tree.meta.RootPage,
		childPageID,
	)

	// Ensure correct type assertions for left and right children
	if left, ok := tree.pager.Get(tree.meta.RootPage).(*InternalPage); ok {
		left.Header.ParentPage = newRoot.Header.PageID
	} else if leftLeaf, ok := tree.pager.Get(tree.meta.RootPage).(*LeafPage); ok {
		leftLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	if right, ok := tree.pager.Get(childPageID).(*InternalPage); ok {
		right.Header.ParentPage = newRoot.Header.PageID
	} else if rightLeaf, ok := tree.pager.Get(childPageID).(*LeafPage); ok {
		rightLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	newRoot.Header.KeyCount = 1
	// update meta root and persist
	tree.meta.RootPage = newRoot.Header.PageID
	if err := tree.pager.WriteMeta(tree.meta); err != nil {
		return err
	}
	return nil
}

// -----------------------------
// Load tree from disk
// -----------------------------

// Load reads the tree structure from disk into memory by starting
// from the root page and recursively loading all child pages.
// This should be called when opening an existing database.
func (tree *BPlusTree) Load() error {
	// Load meta page first
	meta, err := tree.pager.ReadMeta()
	if err != nil {
		return fmt.Errorf("failed to read meta page: %w", err)
	}
	tree.meta = meta

	// If tree is empty, nothing to load
	if tree.meta.RootPage == 0 {
		return nil
	}

	// Recursively load all pages starting from root
	return tree.loadPage(tree.meta.RootPage)
}

// loadPage recursively loads a page and all its descendants into memory
func (tree *BPlusTree) loadPage(pageID uint64) error {
	if pageID == 0 {
		return nil
	}

	// Get will load the page from disk if not already in cache
	page := tree.pager.Get(pageID)
	if page == nil {
		return fmt.Errorf("failed to load page %d", pageID)
	}

	// If it's an internal node, recursively load all children
	if internal, ok := page.(*InternalPage); ok {
		for _, childID := range internal.children {
			if err := tree.loadPage(childID); err != nil {
				return err
			}
		}
	}

	return nil
}

// -----------------------------
// Search in B+ Tree
// -----------------------------

// Search finds and returns the value associated with the given key.
// Returns an error if the key is not found.
func (tree *BPlusTree) Search(key KeyType) (ValueType, error) {
	// Empty tree
	if tree.meta == nil || tree.meta.RootPage == 0 {
		return Row{}, fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find the leaf that should contain the key
	leaf, _, err := tree.findLeaf(key)
	if err != nil {
		return Row{}, err
	}

	// Search for the key in the leaf
	for i, k := range leaf.keys {
		if k.Compare(key) == 0 {
			return leaf.values[i], nil
		}
	}

	return Row{}, fmt.Errorf("key not found: %v", key)
}

// -----------------------------
// Range Query in B+ Tree
// -----------------------------

// SearchRange returns all key-value pairs where startKey <= key <= endKey.
// The implementation leverages the leaf-level doubly-linked list for efficient
// sequential scanning without tree traversal.
//
// Time complexity: O(log n + k) where k is the number of results
func (tree *BPlusTree) SearchRange(startKey, endKey KeyType) ([]KeyType, []ValueType, error) {
	// Validate range
	if startKey.Compare(endKey) > 0 {
		return nil, nil, fmt.Errorf("invalid range: startKey %v > endKey %v", startKey, endKey)
	}

	// Empty tree
	if tree.meta == nil || tree.meta.RootPage == 0 {
		return []KeyType{}, []ValueType{}, nil
	}

	// Find the leaf containing or after startKey
	leaf, _, err := tree.findLeaf(startKey)
	if err != nil {
		return nil, nil, err
	}

	keys := make([]KeyType, 0)
	values := make([]ValueType, 0)

	// Traverse leaves using the linked list
	for leaf != nil {
		// Scan keys in current leaf
		for i, k := range leaf.keys {
			if k.Compare(startKey) >= 0 && k.Compare(endKey) <= 0 {
				keys = append(keys, k)
				values = append(values, leaf.values[i])
			}
			// Early exit if we've passed endKey
			if k.Compare(endKey) > 0 {
				return keys, values, nil
			}
		}

		// If last key in this leaf is still < endKey, continue to next leaf
		if len(leaf.keys) > 0 && leaf.keys[len(leaf.keys)-1].Compare(endKey) < 0 {
			if leaf.Header.NextPage == 0 {
				break
			}
			nextPage := tree.pager.Get(leaf.Header.NextPage)
			if nextPage == nil {
				break
			}
			leaf = nextPage.(*LeafPage)
		} else {
			break
		}
	}

	return keys, values, nil
}

// -----------------------------
// Update in B+ Tree
// -----------------------------

// Update modifies the value associated with a given key.
// This is more efficient than Delete + Insert because it:
// - Avoids tree rebalancing if the new value fits in the same space
// - Maintains page locality
// - Reduces I/O operations
//
// If the key doesn't exist, returns an error.
// If the new value doesn't fit in the page, performs delete + insert.
func (tree *BPlusTree) Update(key KeyType, newValue ValueType) error {
	// Empty tree
	if tree.meta == nil || tree.meta.RootPage == 0 {
		return fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find the leaf containing the key
	leaf, _, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Find the key in the leaf
	keyIndex := -1
	for i, k := range leaf.keys {
		if k.Compare(key) == 0 {
			keyIndex = i
			break
		}
	}

	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	oldValue := leaf.values[keyIndex]
	
	// Calculate size change
	oldSize := oldValue.Size()
	newSize := newValue.Size()
	sizeDelta := newSize - oldSize

	// Check if new value fits in current page
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	currentUsed := computeLeafPayloadSize(leaf)
	
	// If the new value fits, do in-place update
	if currentUsed + sizeDelta <= payloadCapacity {
		leaf.values[keyIndex] = newValue
		
		// Update free space
		used := computeLeafPayloadSize(leaf)
		if used > payloadCapacity {
			leaf.Header.FreeSpace = 0
		} else {
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
		}
		
		return nil
	}

	// If new value doesn't fit, fall back to delete + insert
	// This may trigger rebalancing
	if err := tree.Delete(key); err != nil {
		return fmt.Errorf("update failed during delete: %w", err)
	}
	
	if err := tree.Insert(key, newValue); err != nil {
		return fmt.Errorf("update failed during insert: %w", err)
	}

	return nil
}

// -----------------------------
// Delete from B+ Tree
// -----------------------------

// Delete removes a key from the B+Tree, maintaining balance through
// borrowing from siblings or merging nodes when necessary.
//
// High-level flow:
// 1) Find the target leaf containing the key
// 2) Remove the key from the leaf
// 3) If leaf is underflowed (< ORDER/2 keys), try to borrow from siblings
// 4) If borrowing fails, merge with a sibling
// 5) Propagate changes upward through internal nodes
// 6) Handle root special cases
func (tree *BPlusTree) Delete(key KeyType) error {
	// Empty tree
	if tree.meta == nil || tree.meta.RootPage == 0 {
		return fmt.Errorf("cannot delete from empty tree")
	}

	// Find the target leaf and path
	leaf, path, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Find and remove the key from the leaf
	keyIndex := -1
	for i, k := range leaf.keys {
		if k.Compare(key) == 0 {
			keyIndex = i
			break
		}
	}

	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	// Remove the key and value
	leaf.keys = append(leaf.keys[:keyIndex], leaf.keys[keyIndex+1:]...)
	leaf.values = append(leaf.values[:keyIndex], leaf.values[keyIndex+1:]...)
	leaf.Header.KeyCount = uint16(len(leaf.keys))

	// Recompute free space
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	used := computeLeafPayloadSize(leaf)
	leaf.Header.FreeSpace = uint16(payloadCapacity - used)

	// If this is the root and it's a leaf, we're done
	if len(path) == 0 {
		// If root is now empty, reset tree
		if len(leaf.keys) == 0 {
			tree.meta.RootPage = 0
			return tree.pager.WriteMeta(tree.meta)
		}
		return nil
	}

	// Check if leaf needs rebalancing (minimum keys = ceil(ORDER/2) - 1 for leaf)
	minKeys := (ORDER + 1) / 2 - 1 // For ORDER=4: minKeys = 1
	if len(leaf.keys) >= minKeys {
		return nil // No underflow, we're done
	}

	// Handle underflow: try to borrow or merge
	return tree.rebalanceAfterDelete(leaf, path)
}

// rebalanceAfterDelete handles underflow by borrowing from siblings or merging
func (tree *BPlusTree) rebalanceAfterDelete(leaf *LeafPage, path []uint64) error {
	minKeys := (ORDER + 1) / 2 - 1

	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*InternalPage)

	// Find the index of this leaf in parent's children
	childIndex := -1
	for i, childID := range parent.children {
		if childID == leaf.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("parent-child relationship broken")
	}

	// Try to borrow from right sibling first
	if childIndex < len(parent.children)-1 {
		rightSiblingID := parent.children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*LeafPage)

		if len(rightSibling.keys) > minKeys {
			// Borrow from right sibling
			leaf.keys = append(leaf.keys, rightSibling.keys[0])
			leaf.values = append(leaf.values, rightSibling.values[0])
			leaf.Header.KeyCount = uint16(len(leaf.keys))

			rightSibling.keys = rightSibling.keys[1:]
			rightSibling.values = rightSibling.values[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.keys))

			// Update separator key in parent
			parent.keys[childIndex] = rightSibling.keys[0]

			// Recompute free space
			payloadCapacity := int(DefaultPageSize - PageHeaderSize)
			used := computeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedRight := computeLeafPayloadSize(rightSibling)
			rightSibling.Header.FreeSpace = uint16(payloadCapacity - usedRight)

			return nil
		}
	}

	// Try to borrow from left sibling
	if childIndex > 0 {
		leftSiblingID := parent.children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*LeafPage)

		if len(leftSibling.keys) > minKeys {
			// Borrow from left sibling
			lastIdx := len(leftSibling.keys) - 1
			
			// Insert at beginning of current leaf
			leaf.keys = append([]KeyType{leftSibling.keys[lastIdx]}, leaf.keys...)
			leaf.values = append([]ValueType{leftSibling.values[lastIdx]}, leaf.values...)
			leaf.Header.KeyCount = uint16(len(leaf.keys))

			leftSibling.keys = leftSibling.keys[:lastIdx]
			leftSibling.values = leftSibling.values[:lastIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.keys))

			// Update separator key in parent
			parent.keys[childIndex-1] = leaf.keys[0]

			// Recompute free space
			payloadCapacity := int(DefaultPageSize - PageHeaderSize)
			used := computeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedLeft := computeLeafPayloadSize(leftSibling)
			leftSibling.Header.FreeSpace = uint16(payloadCapacity - usedLeft)

			return nil
		}
	}

	// Cannot borrow, must merge
	// Merge with right sibling if possible, otherwise with left
	if childIndex < len(parent.children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*LeafPage)

		// Merge right into current
		leaf.keys = append(leaf.keys, rightSibling.keys...)
		leaf.values = append(leaf.values, rightSibling.values...)
		leaf.Header.KeyCount = uint16(len(leaf.keys))
		leaf.Header.NextPage = rightSibling.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leaf.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leaf.Header.NextPage).(*LeafPage)
			nextPage.Header.PrevPage = leaf.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(DefaultPageSize - PageHeaderSize)
		used := computeLeafPayloadSize(leaf)
		leaf.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and right child from parent
		parent.keys = append(parent.keys[:childIndex], parent.keys[childIndex+1:]...)
		parent.children = append(parent.children[:childIndex+1], parent.children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.keys))

	} else {
		// Merge with left sibling
		leftSiblingID := parent.children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*LeafPage)

		// Merge current into left
		leftSibling.keys = append(leftSibling.keys, leaf.keys...)
		leftSibling.values = append(leftSibling.values, leaf.values...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.keys))
		leftSibling.Header.NextPage = leaf.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leftSibling.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leftSibling.Header.NextPage).(*LeafPage)
			nextPage.Header.PrevPage = leftSibling.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(DefaultPageSize - PageHeaderSize)
		used := computeLeafPayloadSize(leftSibling)
		leftSibling.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and current child from parent
		parent.keys = append(parent.keys[:childIndex-1], parent.keys[childIndex:]...)
		parent.children = append(parent.children[:childIndex], parent.children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.keys))
	}

	// Propagate underflow to parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}

// rebalanceInternalAfterDelete handles underflow in internal nodes
func (tree *BPlusTree) rebalanceInternalAfterDelete(node *InternalPage, path []uint64) error {
	minKeys := (ORDER + 1) / 2 - 1

	// If this is the root
	if len(path) == 0 {
		// If root has no keys and one child, make that child the new root
		if len(node.keys) == 0 && len(node.children) == 1 {
			tree.meta.RootPage = node.children[0]
			
			// Update parent pointer of new root
			newRoot := tree.pager.Get(tree.meta.RootPage)
			switch r := newRoot.(type) {
			case *InternalPage:
				r.Header.ParentPage = 0
			case *LeafPage:
				r.Header.ParentPage = 0
			}
			
			return tree.pager.WriteMeta(tree.meta)
		}
		return nil
	}

	// Check if node has enough keys
	if len(node.keys) >= minKeys {
		return nil
	}

	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*InternalPage)

	// Find the index of this node in parent's children
	childIndex := -1
	for i, childID := range parent.children {
		if childID == node.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("parent-child relationship broken in internal node")
	}

	// Try to borrow from right sibling
	if childIndex < len(parent.children)-1 {
		rightSiblingID := parent.children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*InternalPage)

		if len(rightSibling.keys) > minKeys {
			// Borrow from right sibling
			// Pull separator from parent
			separatorKey := parent.keys[childIndex]
			node.keys = append(node.keys, separatorKey)
			node.children = append(node.children, rightSibling.children[0])
			node.Header.KeyCount = uint16(len(node.keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(rightSibling.children[0])
			switch c := movedChild.(type) {
			case *InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push first key of right sibling to parent
			parent.keys[childIndex] = rightSibling.keys[0]

			// Remove first key and child from right sibling
			rightSibling.keys = rightSibling.keys[1:]
			rightSibling.children = rightSibling.children[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.keys))

			return nil
		}
	}

	// Try to borrow from left sibling
	if childIndex > 0 {
		leftSiblingID := parent.children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*InternalPage)

		if len(leftSibling.keys) > minKeys {
			// Borrow from left sibling
			// Pull separator from parent
			separatorKey := parent.keys[childIndex-1]
			
			// Insert at beginning of current node
			node.keys = append([]KeyType{separatorKey}, node.keys...)
			lastChildIdx := len(leftSibling.children) - 1
			node.children = append([]uint64{leftSibling.children[lastChildIdx]}, node.children...)
			node.Header.KeyCount = uint16(len(node.keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(leftSibling.children[lastChildIdx])
			switch c := movedChild.(type) {
			case *InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push last key of left sibling to parent
			lastKeyIdx := len(leftSibling.keys) - 1
			parent.keys[childIndex-1] = leftSibling.keys[lastKeyIdx]

			// Remove last key and child from left sibling
			leftSibling.keys = leftSibling.keys[:lastKeyIdx]
			leftSibling.children = leftSibling.children[:lastChildIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.keys))

			return nil
		}
	}

	// Cannot borrow, must merge
	if childIndex < len(parent.children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*InternalPage)

		// Pull separator from parent
		separatorKey := parent.keys[childIndex]
		node.keys = append(node.keys, separatorKey)
		node.keys = append(node.keys, rightSibling.keys...)
		node.children = append(node.children, rightSibling.children...)
		node.Header.KeyCount = uint16(len(node.keys))

		// Update parent pointers of all moved children
		for _, childID := range rightSibling.children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}
		}

		// Remove separator key and right child from parent
		parent.keys = append(parent.keys[:childIndex], parent.keys[childIndex+1:]...)
		parent.children = append(parent.children[:childIndex+1], parent.children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.keys))

	} else {
		// Merge with left sibling
		leftSiblingID := parent.children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*InternalPage)

		// Pull separator from parent
		separatorKey := parent.keys[childIndex-1]
		leftSibling.keys = append(leftSibling.keys, separatorKey)
		leftSibling.keys = append(leftSibling.keys, node.keys...)
		leftSibling.children = append(leftSibling.children, node.children...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.keys))

		// Update parent pointers of all moved children
		for _, childID := range node.children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *InternalPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			case *LeafPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			}
		}

		// Remove separator key and current child from parent
		parent.keys = append(parent.keys[:childIndex-1], parent.keys[childIndex:]...)
		parent.children = append(parent.children[:childIndex], parent.children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.keys))
	}

	// Propagate underflow to parent's parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}
