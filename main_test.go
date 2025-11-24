package main

import (
	"testing"
)

// helper: check if leaf contains key/value
func leafContains(leaf *Node, key KeyType, value ValueType) bool {
	for i, k := range leaf.keys {
		if k == key && leaf.values[i] == value {
			return true
		}
	}
	return false
}

func TestBPlusTreeInsertAndFind(t *testing.T) {
	tree := &BPlusTree{}

	// ------------------------------
	// Insert without split
	// ------------------------------
	tree.Insert(10, "A")
	tree.Insert(20, "B")
	tree.Insert(5, "C") // leaf keys: [5,10,20]

	leaf := tree.findLeaf(10)
	if !leafContains(leaf, 10, "A") {
		t.Errorf("Leaf does not contain inserted key 10")
	}
	if !leafContains(leaf, 5, "C") || !leafContains(leaf, 20, "B") {
		t.Errorf("Leaf keys/values incorrect for no split case")
	}

	// ------------------------------
	// Insert causing leaf split
	// ORDER = 4 → max keys = 3
	// Insert 15 → triggers leaf split
	// ------------------------------
	tree.Insert(15, "D")
	
	// After split, leafs linked list:
	// leaf1: [5,10] → leaf2: [15,20]
	leaf1 := tree.root
	if !leaf1.isLeaf {
		// root may be internal now after split
		leaf1 = tree.root.children[0]
	}
	leaf2 := leaf1.next

	if !leafContains(leaf2, 15, "D") || !leafContains(leaf2, 20, "B") {
		t.Errorf("Leaf split failed, second leaf keys incorrect")
	}

	// ------------------------------
	// Insert causing root split
	// Insert more keys to trigger internal node split
	// ------------------------------
	tree.Insert(25, "E")
	tree.Insert(30, "F") // Should trigger root split eventually

	if tree.root == nil {
		t.Errorf("Root should not be nil after inserts")
	}
	if tree.root.isLeaf {
		t.Errorf("Root should be internal after splits")
	}
	if len(tree.root.keys) == 0 {
		t.Errorf("Root keys should not be empty after split")
	}

	// Verify all keys exist via findLeaf
	keysToCheck := map[KeyType]ValueType{
		5:  "C",
		10: "A",
		15: "D",
		20: "B",
		25: "E",
		30: "F",
	}

	for k, v := range keysToCheck {
		leaf := tree.findLeaf(k)
		if !leafContains(leaf, k, v) {
			t.Errorf("Key %d not found in leaf or value mismatch", k)
		}
	}
}
