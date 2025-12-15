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

	// Verify the keys and values in the leaf
	leaf, _, err := tree.findLeaf(10)
	if err != nil {
		t.Errorf("Unexpected error during findLeaf: %v", err)
	}

	for i, key := range keys {
		if leaf.keys[i] != key || leaf.values[i] != values[i] {
			t.Errorf("Expected key-value pair (%v, %v), got (%v, %v)", key, values[i], leaf.keys[i], leaf.values[i])
		}
	}
}

func TestInsertWithSplit(t *testing.T) {
	tree := &BPlusTree{
		pager: NewPageManager(),
	}

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
	root := tree.pager.Get(tree.rootPageID).(*InternalPage)
	if len(root.keys) != 1 {
		t.Errorf("Expected root to have 1 key, got %d", len(root.keys))
	}

	leftChild := tree.pager.Get(root.children[0]).(*LeafPage)
	rightChild := tree.pager.Get(root.children[1]).(*LeafPage)

	if len(leftChild.keys) != 2 || len(rightChild.keys) != 3 {
		t.Errorf("Leaf nodes not split correctly: left has %d keys, right has %d keys", len(leftChild.keys), len(rightChild.keys))
	}

	// Verify keys in left and right children
	for i, key := range []KeyType{10, 20} {
		if leftChild.keys[i] != key {
			t.Errorf("Expected key %v in left child, got %v", key, leftChild.keys[i])
		}
	}

	for i, key := range []KeyType{30, 40, 50} {
		if rightChild.keys[i] != key {
			t.Errorf("Expected key %v in right child, got %v", key, rightChild.keys[i])
		}
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
