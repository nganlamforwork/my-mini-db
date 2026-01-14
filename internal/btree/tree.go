package btree

import (
	"fmt"

	"bplustree/internal/page"
	"bplustree/internal/storage"
	"bplustree/internal/transaction"
)

// Type aliases for convenience
type KeyType = storage.CompositeKey
type ValueType = storage.Record

// Type aliases for page types
type LeafPage = page.LeafPage
type InternalPage = page.InternalPage

type BPlusTree struct {
	meta      *page.MetaPage
	pager     *page.PageManager
	txManager *transaction.TransactionManager
	wal       *transaction.WALManager
}

const MAX_KEYS = page.ORDER - 1

// GetPager returns the page manager (implements transaction.TreeInterface)
func (tree *BPlusTree) GetPager() *page.PageManager {
	return tree.pager
}

// NewBPlusTree creates a new B+Tree with WAL and transaction support
func NewBPlusTree(pager *page.PageManager) (*BPlusTree, error) {
	// Initialize WAL
	dbFilename := pager.GetFileName()
	if dbFilename == "" {
		dbFilename = "minidb.db"
	}
	wal, err := transaction.NewWALManager(dbFilename)
	if err != nil {
		return nil, fmt.Errorf("failed to create WAL: %w", err)
	}

	// Initialize transaction manager
	txManager := transaction.NewTransactionManager(wal)

	tree := &BPlusTree{
		pager:     pager,
		txManager: txManager,
		wal:       wal,
	}

	// Try to recover from WAL if needed
	if err := wal.Recover(pager); err != nil {
		// If recovery fails, continue anyway (might be first run)
		// In production, you'd want better error handling
	}

	// Load meta page
	meta, err := pager.ReadMeta()
	if err == nil {
		tree.meta = meta
	}

	return tree, nil
}

// Begin starts a new transaction
func (tree *BPlusTree) Begin() error {
	_, err := tree.txManager.Begin(tree)
	return err
}

// Commit commits the current transaction
func (tree *BPlusTree) Commit() error {
	return tree.txManager.Commit()
}

// Rollback rolls back the current transaction
func (tree *BPlusTree) Rollback() error {
	return tree.txManager.Rollback()
}

// Checkpoint creates a checkpoint in the WAL
func (tree *BPlusTree) Checkpoint() error {
	return tree.txManager.Checkpoint()
}

// Close closes the WAL and page manager
func (tree *BPlusTree) Close() error {
	if tree.wal != nil {
		if err := tree.wal.Close(); err != nil {
			return err
		}
	}
	if tree.pager != nil {
		return tree.pager.Close()
	}
	return nil
}

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
			left, right := 0, len(p.Keys)-1
			pos := -1
			for left <= right {
				mid := (left + right) / 2
				if p.Keys[mid].Compare(key) <= 0 {
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

			currentID = p.Children[childIndex]

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
		tree.meta = &page.MetaPage{RootPage: 0, PageSize: uint32(page.DefaultPageSize), Order: uint16(page.ORDER), Version: 1}
		}
	}

	if tree.meta.RootPage == 0 {
		leaf := tree.pager.NewLeaf()
		leaf.Keys = append(leaf.Keys, key)
		leaf.Values = append(leaf.Values, value)
		leaf.Header.KeyCount = 1
		tree.meta.RootPage = leaf.Header.PageID
		
		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
			tree.txManager.TrackPageModification(1, tree.meta)
		}
		
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
	for _, existingKey := range leaf.Keys {
		if existingKey.Compare(key) == 0 {
			return fmt.Errorf("duplicate key insertion: %v", key)
		}
	}

	// Insert into the leaf in sorted order
	if err := page.InsertIntoLeaf(leaf, key, value); err != nil {
		return err
	}

	// Track page modification for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
	}

	// If the leaf does not overflow (by key count or payload), we're done
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	if len(leaf.Keys) <= MAX_KEYS {
		if page.ComputeLeafPayloadSize(leaf) <= payloadCapacity {
			return nil
		}
	}

	// 3. Split leaf
	var pushKey KeyType
	newLeaf := tree.pager.NewLeaf()
	pushKey = page.SplitLeaf(leaf, newLeaf)

	// Track page modifications for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
		tree.txManager.TrackPageModification(newLeaf.Header.PageID, newLeaf)
	}

	var childPageID uint64 = newLeaf.Header.PageID

	// 4. Propagate split up: insert the promoted key into parent
	//    internal nodes. If a parent overflows, split it and
	//    continue upward. `childPageID` always points to the
	//    right-side page produced by the most recent split.
	for len(path) > 0 {
		parentID := path[len(path)-1]
		path = path[:len(path)-1]

		parent := tree.pager.Get(parentID).(*page.InternalPage)

		// Insert the separator key and pointer into parent
		page.InsertIntoInternal(parent, pushKey, childPageID)

		// Track parent modification
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(parentID, parent)
		}

		// If parent didn't overflow, split propagation stops
		if len(parent.Keys) < page.ORDER {
			return nil
		}

		// split internal
		newInternal := tree.pager.NewInternal()
		pushKey = page.SplitInternal(parent, newInternal, tree.pager)
		
		// Track new internal page
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(newInternal.Header.PageID, newInternal)
		}
		
		childPageID = newInternal.Header.PageID
	}

	// 5. Root split → create new root
	newRoot := tree.pager.NewInternal()
	newRoot.Keys = append(newRoot.Keys, pushKey)
	newRoot.Children = append(
		newRoot.Children,
		tree.meta.RootPage,
		childPageID,
	)

	// Ensure correct type assertions for left and right children
		if left, ok := tree.pager.Get(tree.meta.RootPage).(*page.InternalPage); ok {
		left.Header.ParentPage = newRoot.Header.PageID
	} else if leftLeaf, ok := tree.pager.Get(tree.meta.RootPage).(*page.LeafPage); ok {
		leftLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	if right, ok := tree.pager.Get(childPageID).(*page.InternalPage); ok {
		right.Header.ParentPage = newRoot.Header.PageID
	} else if rightLeaf, ok := tree.pager.Get(childPageID).(*page.LeafPage); ok {
		rightLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	newRoot.Header.KeyCount = 1
	
	// Track new root and meta modifications
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(newRoot.Header.PageID, newRoot)
		tree.txManager.TrackPageModification(1, tree.meta)
	}
	
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
		for _, childID := range internal.Children {
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
		return storage.Record{}, fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find the leaf that should contain the key
	leaf, _, err := tree.findLeaf(key)
	if err != nil {
		return storage.Record{}, err
	}

	// Search for the key in the leaf
	for i, k := range leaf.Keys {
		if k.Compare(key) == 0 {
			return leaf.Values[i], nil
		}
	}

	return storage.Record{}, fmt.Errorf("key not found: %v", key)
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
		for i, k := range leaf.Keys {
			if k.Compare(startKey) >= 0 && k.Compare(endKey) <= 0 {
				keys = append(keys, k)
				values = append(values, leaf.Values[i])
			}
			// Early exit if we've passed endKey
			if k.Compare(endKey) > 0 {
				return keys, values, nil
			}
		}

		// If last key in this leaf is still < endKey, continue to next leaf
		if len(leaf.Keys) > 0 && leaf.Keys[len(leaf.Keys)-1].Compare(endKey) < 0 {
			if leaf.Header.NextPage == 0 {
				break
			}
			nextPage := tree.pager.Get(leaf.Header.NextPage)
			if nextPage == nil {
				break
			}
			leaf = nextPage.(*page.LeafPage)
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
	for i, k := range leaf.Keys {
		if k.Compare(key) == 0 {
			keyIndex = i
			break
		}
	}

	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	oldValue := leaf.Values[keyIndex]
	
	// Calculate size change
	oldSize := oldValue.Size()
	newSize := newValue.Size()
	sizeDelta := newSize - oldSize

	// Check if new value fits in current page
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	currentUsed := page.ComputeLeafPayloadSize(leaf)
	
	// If the new value fits, do in-place update
	if currentUsed + sizeDelta <= payloadCapacity {
		leaf.Values[keyIndex] = newValue
		
		// Update free space
		used := page.ComputeLeafPayloadSize(leaf)
		if used > payloadCapacity {
			leaf.Header.FreeSpace = 0
		} else {
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
		}
		
		// Track page modification for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
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
	for i, k := range leaf.Keys {
		if k.Compare(key) == 0 {
			keyIndex = i
			break
		}
	}

	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	// Remove the key and value
	leaf.Keys = append(leaf.Keys[:keyIndex], leaf.Keys[keyIndex+1:]...)
	leaf.Values = append(leaf.Values[:keyIndex], leaf.Values[keyIndex+1:]...)
	leaf.Header.KeyCount = uint16(len(leaf.Keys))

	// Recompute free space
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	used := page.ComputeLeafPayloadSize(leaf)
	leaf.Header.FreeSpace = uint16(payloadCapacity - used)

	// Track page modification for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
	}

	// If this is the root and it's a leaf, we're done
	if len(path) == 0 {
		// If root is now empty, reset tree
		if len(leaf.Keys) == 0 {
			tree.meta.RootPage = 0
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(1, tree.meta)
			}
			return tree.pager.WriteMeta(tree.meta)
		}
		return nil
	}

	// Check if leaf needs rebalancing (minimum keys = ceil(ORDER/2) - 1 for leaf)
	minKeys := (page.ORDER + 1) / 2 - 1 // For ORDER=4: minKeys = 1
	if len(leaf.Keys) >= minKeys {
		return nil // No underflow, we're done
	}

	// Handle underflow: try to borrow or merge
	return tree.rebalanceAfterDelete(leaf, path)
}

// rebalanceAfterDelete handles underflow by borrowing from siblings or merging
func (tree *BPlusTree) rebalanceAfterDelete(leaf *page.LeafPage, path []uint64) error {
	minKeys := (page.ORDER + 1) / 2 - 1

	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*InternalPage)

	// Find the index of this leaf in parent's children
	childIndex := -1
	for i, childID := range parent.Children {
		if childID == leaf.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("parent-child relationship broken")
	}

	// Try to borrow from right sibling first
	if childIndex < len(parent.Children)-1 {
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.LeafPage)

		if len(rightSibling.Keys) > minKeys {
			// Borrow from right sibling
			leaf.Keys = append(leaf.Keys, rightSibling.Keys[0])
			leaf.Values = append(leaf.Values, rightSibling.Values[0])
			leaf.Header.KeyCount = uint16(len(leaf.Keys))

			rightSibling.Keys = rightSibling.Keys[1:]
			rightSibling.Values = rightSibling.Values[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.Keys))

			// Update separator key in parent
			parent.Keys[childIndex] = rightSibling.Keys[0]

			// Recompute free space
			payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
			used := page.ComputeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedRight := page.ComputeLeafPayloadSize(rightSibling)
			rightSibling.Header.FreeSpace = uint16(payloadCapacity - usedRight)

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
				tree.txManager.TrackPageModification(rightSibling.Header.PageID, rightSibling)
				tree.txManager.TrackPageModification(parentID, parent)
			}

			return nil
		}
	}

	// Try to borrow from left sibling
	if childIndex > 0 {
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.LeafPage)

		if len(leftSibling.Keys) > minKeys {
			// Borrow from left sibling
			lastIdx := len(leftSibling.Keys) - 1
			
			// Insert at beginning of current leaf
			leaf.Keys = append([]KeyType{leftSibling.Keys[lastIdx]}, leaf.Keys...)
			leaf.Values = append([]ValueType{leftSibling.Values[lastIdx]}, leaf.Values...)
			leaf.Header.KeyCount = uint16(len(leaf.Keys))

			leftSibling.Keys = leftSibling.Keys[:lastIdx]
			leftSibling.Values = leftSibling.Values[:lastIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

			// Update separator key in parent
			parent.Keys[childIndex-1] = leaf.Keys[0]

			// Recompute free space
			payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
			used := page.ComputeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedLeft := page.ComputeLeafPayloadSize(leftSibling)
			leftSibling.Header.FreeSpace = uint16(payloadCapacity - usedLeft)

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
				tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling)
				tree.txManager.TrackPageModification(parentID, parent)
			}

			return nil
		}
	}

	// Cannot borrow, must merge
	// Merge with right sibling if possible, otherwise with left
	if childIndex < len(parent.Children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.LeafPage)

		// Merge right into current
		leaf.Keys = append(leaf.Keys, rightSibling.Keys...)
		leaf.Values = append(leaf.Values, rightSibling.Values...)
		leaf.Header.KeyCount = uint16(len(leaf.Keys))
		leaf.Header.NextPage = rightSibling.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leaf.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leaf.Header.NextPage).(*page.LeafPage)
			nextPage.Header.PrevPage = leaf.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
		used := page.ComputeLeafPayloadSize(leaf)
		leaf.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and right child from parent
		parent.Keys = append(parent.Keys[:childIndex], parent.Keys[childIndex+1:]...)
		parent.Children = append(parent.Children[:childIndex+1], parent.Children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf)
			if leaf.Header.NextPage != 0 {
				nextPage := tree.pager.Get(leaf.Header.NextPage)
				if nextPage != nil {
					tree.txManager.TrackPageModification(leaf.Header.NextPage, nextPage)
				}
			}
			tree.txManager.TrackPageModification(parentID, parent)
		}

	} else {
		// Merge with left sibling
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.LeafPage)

		// Merge current into left
		leftSibling.Keys = append(leftSibling.Keys, leaf.Keys...)
		leftSibling.Values = append(leftSibling.Values, leaf.Values...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))
		leftSibling.Header.NextPage = leaf.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leftSibling.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leftSibling.Header.NextPage).(*page.LeafPage)
			nextPage.Header.PrevPage = leftSibling.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
		used := page.ComputeLeafPayloadSize(leftSibling)
		leftSibling.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and current child from parent
		parent.Keys = append(parent.Keys[:childIndex-1], parent.Keys[childIndex:]...)
		parent.Children = append(parent.Children[:childIndex], parent.Children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling)
			if leftSibling.Header.NextPage != 0 {
				nextPage := tree.pager.Get(leftSibling.Header.NextPage)
				if nextPage != nil {
					tree.txManager.TrackPageModification(leftSibling.Header.NextPage, nextPage)
				}
			}
			tree.txManager.TrackPageModification(parentID, parent)
		}
	}

	// Propagate underflow to parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}

// rebalanceInternalAfterDelete handles underflow in internal nodes
func (tree *BPlusTree) rebalanceInternalAfterDelete(node *page.InternalPage, path []uint64) error {
	minKeys := (page.ORDER + 1) / 2 - 1

	// If this is the root
	if len(path) == 0 {
		// If root has no keys and one child, make that child the new root
		if len(node.Keys) == 0 && len(node.Children) == 1 {
			tree.meta.RootPage = node.Children[0]
			
			// Update parent pointer of new root
			newRoot := tree.pager.Get(tree.meta.RootPage)
			switch r := newRoot.(type) {
			case *page.InternalPage:
				r.Header.ParentPage = 0
				if tree.txManager != nil {
					tree.txManager.TrackPageModification(r.Header.PageID, r)
				}
			case *page.LeafPage:
				r.Header.ParentPage = 0
				if tree.txManager != nil {
					tree.txManager.TrackPageModification(r.Header.PageID, r)
				}
			}
			
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(1, tree.meta)
			}
			
			return tree.pager.WriteMeta(tree.meta)
		}
		return nil
	}

	// Check if node has enough keys
	if len(node.Keys) >= minKeys {
		return nil
	}

	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*page.InternalPage)

	// Find the index of this node in parent's children
	childIndex := -1
	for i, childID := range parent.Children {
		if childID == node.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("parent-child relationship broken in internal node")
	}

	// Try to borrow from right sibling
	if childIndex < len(parent.Children)-1 {
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.InternalPage)

		if len(rightSibling.Keys) > minKeys {
			// Borrow from right sibling
			// Pull separator from parent
			separatorKey := parent.Keys[childIndex]
			node.Keys = append(node.Keys, separatorKey)
			node.Children = append(node.Children, rightSibling.Children[0])
			node.Header.KeyCount = uint16(len(node.Keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(rightSibling.Children[0])
			switch c := movedChild.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push first key of right sibling to parent
			parent.Keys[childIndex] = rightSibling.Keys[0]

			// Remove first key and child from right sibling
			rightSibling.Keys = rightSibling.Keys[1:]
			rightSibling.Children = rightSibling.Children[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.Keys))

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(node.Header.PageID, node)
				tree.txManager.TrackPageModification(rightSibling.Header.PageID, rightSibling)
				tree.txManager.TrackPageModification(parentID, parent)
				if movedChild != nil {
					switch c := movedChild.(type) {
					case *page.InternalPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c)
					case *page.LeafPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c)
					}
				}
			}

			return nil
		}
	}

	// Try to borrow from left sibling
	if childIndex > 0 {
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.InternalPage)

		if len(leftSibling.Keys) > minKeys {
			// Borrow from left sibling
			// Pull separator from parent
			separatorKey := parent.Keys[childIndex-1]
			
			// Insert at beginning of current node
			node.Keys = append([]KeyType{separatorKey}, node.Keys...)
			lastChildIdx := len(leftSibling.Children) - 1
			node.Children = append([]uint64{leftSibling.Children[lastChildIdx]}, node.Children...)
			node.Header.KeyCount = uint16(len(node.Keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(leftSibling.Children[lastChildIdx])
			switch c := movedChild.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push last key of left sibling to parent
			lastKeyIdx := len(leftSibling.Keys) - 1
			parent.Keys[childIndex-1] = leftSibling.Keys[lastKeyIdx]

			// Remove last key and child from left sibling
			leftSibling.Keys = leftSibling.Keys[:lastKeyIdx]
			leftSibling.Children = leftSibling.Children[:lastChildIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(node.Header.PageID, node)
				tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling)
				tree.txManager.TrackPageModification(parentID, parent)
				if movedChild != nil {
					switch c := movedChild.(type) {
					case *page.InternalPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c)
					case *page.LeafPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c)
					}
				}
			}

			return nil
		}
	}

	// Cannot borrow, must merge
	if childIndex < len(parent.Children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.InternalPage)

		// Pull separator from parent
		separatorKey := parent.Keys[childIndex]
		node.Keys = append(node.Keys, separatorKey)
		node.Keys = append(node.Keys, rightSibling.Keys...)
		node.Children = append(node.Children, rightSibling.Children...)
		node.Header.KeyCount = uint16(len(node.Keys))

		// Update parent pointers of all moved children
		for _, childID := range rightSibling.Children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}
		}

		// Remove separator key and right child from parent
		parent.Keys = append(parent.Keys[:childIndex], parent.Keys[childIndex+1:]...)
		parent.Children = append(parent.Children[:childIndex+1], parent.Children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

	} else {
		// Merge with left sibling
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.InternalPage)

		// Pull separator from parent
		separatorKey := parent.Keys[childIndex-1]
		leftSibling.Keys = append(leftSibling.Keys, separatorKey)
		leftSibling.Keys = append(leftSibling.Keys, node.Keys...)
		leftSibling.Children = append(leftSibling.Children, node.Children...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

		// Update parent pointers of all moved children
		for _, childID := range node.Children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			}
		}

		// Remove separator key and current child from parent
		parent.Keys = append(parent.Keys[:childIndex-1], parent.Keys[childIndex:]...)
		parent.Children = append(parent.Children[:childIndex], parent.Children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling)
			tree.txManager.TrackPageModification(parentID, parent)
			// Track all moved children
			for _, childID := range node.Children {
				child := tree.pager.Get(childID)
				if child != nil {
					tree.txManager.TrackPageModification(childID, child)
				}
			}
		}
	}

	// Propagate underflow to parent's parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}
