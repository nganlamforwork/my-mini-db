package main

import (
	"fmt"
	"sort"
	"testing"
)

func TestInsertWithoutSplit(t *testing.T) {
	tree := &BPlusTree{
		pager: NewPageManager(),
	}

	// Insert keys without causing a split
	keys := []KeyType{10, 20, 30}
	values := []ValueType{"A", "B", "C"}

	for i, key := range keys {
		err := tree.Insert(key, values[i])
		if err != nil {
			t.Errorf("Unexpected error during insertion: %v", err)
		}
	}

	// Verify the root is a leaf and contains the inserted key/value pairs
	root := tree.pager.Get(tree.rootPageID)
	lp, ok := root.(*LeafPage)
	if !ok {
		t.Fatalf("expected root to be a leaf page, got %T", root)
	}

	if int(lp.Header.KeyCount) != len(lp.keys) {
		t.Fatalf("header KeyCount mismatch: header=%d, actual=%d", lp.Header.KeyCount, len(lp.keys))
	}

	for i, key := range keys {
		if lp.keys[i] != key || lp.values[i] != values[i] {
			t.Fatalf("Expected key-value pair (%v, %v), got (%v, %v)", key, values[i], lp.keys[i], lp.values[i])
		}
	}

	// Parent of root leaf should be zero
	if lp.Header.ParentPage != 0 {
		t.Fatalf("expected root leaf to have no parent, got %d", lp.Header.ParentPage)
	}
}

func TestInsertWithSplit(t *testing.T) {
	tree := &BPlusTree{
		pager: NewPageManager(),
	}
	print("TestInsertWithSplit starting...\n")
	print("Initial rootPageID: ", tree.rootPageID, "\n")

	// Insert keys to cause a split
	keys := []KeyType{10, 20, 30, 40, 50}
	values := []ValueType{"A", "B", "C", "D", "E"}

	for i, key := range keys {
		err := tree.Insert(key, values[i])
		if err != nil {
			t.Errorf("Unexpected error during insertion: %v", err)
		}
	}

	// Verify the root and child nodes after split
	rootP, ok := tree.pager.Get(tree.rootPageID).(*InternalPage)
	if !ok {
		t.Fatalf("expected root to be internal page, got %T", tree.pager.Get(tree.rootPageID))
	}
	if len(rootP.keys) != 1 {
		t.Fatalf("Expected root to have 1 key, got %d", len(rootP.keys))
	}

	// children should exist and reference leaves
	if len(rootP.children) != 2 {
		t.Fatalf("expected root to have 2 children, got %d", len(rootP.children))
	}

	leftChild := tree.pager.Get(rootP.children[0]).(*LeafPage)
	rightChild := tree.pager.Get(rootP.children[1]).(*LeafPage)

	// Parent pointers must point back to root
	if leftChild.Header.ParentPage != rootP.Header.PageID {
		t.Fatalf("left child parent mismatch: expected %d, got %d", rootP.Header.PageID, leftChild.Header.ParentPage)
	}
	if rightChild.Header.ParentPage != rootP.Header.PageID {
		t.Fatalf("right child parent mismatch: expected %d, got %d", rootP.Header.PageID, rightChild.Header.ParentPage)
	}

	if int(leftChild.Header.KeyCount) != len(leftChild.keys) || int(rightChild.Header.KeyCount) != len(rightChild.keys) {
		t.Fatalf("header KeyCount inconsistent with actual keys: left header=%d actual=%d; right header=%d actual=%d",
			leftChild.Header.KeyCount, len(leftChild.keys), rightChild.Header.KeyCount, len(rightChild.keys))
	}

	// Verify expected key distribution
	if len(leftChild.keys) != 2 || len(rightChild.keys) != 3 {
		t.Fatalf("Leaf nodes not split correctly: left has %d keys, right has %d keys", len(leftChild.keys), len(rightChild.keys))
	}

	// Check content order
	for i, key := range []KeyType{10, 20} {
		if leftChild.keys[i] != key {
			t.Fatalf("Expected key %v in left child, got %v", key, leftChild.keys[i])
		}
	}
	for i, key := range []KeyType{30, 40, 50} {
		if rightChild.keys[i] != key {
			t.Fatalf("Expected key %v in right child, got %v", key, rightChild.keys[i])
		}
	}

	// FreeSpace should be non-negative and consistent with payload computation
	payloadCap := int(DefaultPageSize - PageHeaderSize)
	if computeLeafPayloadSize(leftChild) > payloadCap || computeLeafPayloadSize(rightChild) > payloadCap {
		t.Fatalf("one of the children exceeds payload capacity after split")
	}
}

// TestInsertManyComplex inserts a larger set of keys (20) in a
// non-sequential order to exercise multiple splits across the
// tree (leaf and internal splits). The test verifies:
//   - All inserted keys appear in the leaf-level scan.
//   - The keys are returned in ascending order when traversing
//     the leaf linked list.
//   - The number of collected keys equals the number inserted.
func TestInsertManyComplex(t *testing.T) {
	tree := &BPlusTree{
		pager: NewPageManager(),
	}

	// 20 keys (more than 15) inserted in a shuffled order to
	// provoke splits at multiple levels.
	keys := []KeyType{5, 1, 3, 2, 8, 7, 9, 10, 15, 12, 11, 14, 13, 6, 4, 16, 17, 18, 19, 20}

	for _, k := range keys {
		if err := tree.Insert(k, ValueType(fmt.Sprintf("v%d", k))); err != nil {
			t.Fatalf("unexpected insert error for %v: %v", k, err)
		}
	}

	// Find left-most leaf by walking down children[0]
	curID := tree.rootPageID
	var leftmost *LeafPage
	for {
		p := tree.pager.Get(curID)
		if p == nil {
			t.Fatalf("page %d not found", curID)
		}
		switch v := p.(type) {
		case *LeafPage:
			leftmost = v
			goto Traversal
		case *InternalPage:
			// follow the left-most child
			if len(v.children) == 0 {
				t.Fatalf("internal node %d has no children", v.Header.PageID)
			}
			curID = v.children[0]
		default:
			t.Fatalf("unknown page type for page %d", curID)
		}
	}

Traversal:
	// Traverse leaf linked list and collect keys
	collected := make([]KeyType, 0, len(keys))
	leaf := leftmost
	for leaf != nil {
		// validate header keycount matches slice length
		if int(leaf.Header.KeyCount) != len(leaf.keys) {
			t.Fatalf("leaf header KeyCount mismatch for page %d: header=%d actual=%d", leaf.Header.PageID, leaf.Header.KeyCount, len(leaf.keys))
		}

		collected = append(collected, leaf.keys...)
		if leaf.Header.NextPage == 0 {
			break
		}
		np := tree.pager.Get(leaf.Header.NextPage)
		if np == nil {
			break
		}
		leaf = np.(*LeafPage)
	}

	if len(collected) != len(keys) {
		t.Fatalf("expected %d keys after traversal, got %d", len(keys), len(collected))
	}

	// Keys should be in ascending order in leaf scan
	expected := make([]KeyType, len(keys))
	copy(expected, keys)
	sort.Slice(expected, func(i, j int) bool { return expected[i] < expected[j] })

	for i := range expected {
		if collected[i] != expected[i] {
			t.Fatalf("expected key %v at index %d, got %v", expected[i], i, collected[i])
		}
	}
}
