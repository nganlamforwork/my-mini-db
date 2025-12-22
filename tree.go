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
				if p.keys[mid] <= key {
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
		if existingKey == key {
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
