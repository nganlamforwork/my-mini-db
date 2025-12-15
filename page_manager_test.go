package main

import (
	"testing"
)

func TestPageManager_NewLeaf(t *testing.T) {
	pm := NewPageManager()
	leaf := pm.NewLeaf()

	if leaf == nil {
		t.Fatalf("Expected non-nil LeafPage")
	}

	if leaf.Header.PageType != PageTypeLeaf {
		t.Errorf("Expected PageTypeLeaf, got %v", leaf.Header.PageType)
	}

	if len(leaf.keys) != 0 || len(leaf.values) != 0 {
		t.Errorf("Expected empty keys and values, got %v and %v", leaf.keys, leaf.values)
	}
}

func TestPageManager_NewInternal(t *testing.T) {
	pm := NewPageManager()
	internal := pm.NewInternal()

	if internal == nil {
		t.Fatalf("Expected non-nil InternalPage")
	}

	if internal.Header.PageType != PageTypeInternal {
		t.Errorf("Expected PageTypeInternal, got %v", internal.Header.PageType)
	}

	if len(internal.keys) != 0 || len(internal.children) != 0 {
		t.Errorf("Expected empty keys and children, got %v and %v", internal.keys, internal.children)
	}
}

func TestPageManager_Get(t *testing.T) {
	pm := NewPageManager()
	leaf := pm.NewLeaf()
	internal := pm.NewInternal()

	if pm.Get(leaf.Header.PageID) != leaf {
		t.Errorf("Expected to retrieve LeafPage with ID %d", leaf.Header.PageID)
	}

	if pm.Get(internal.Header.PageID) != internal {
		t.Errorf("Expected to retrieve InternalPage with ID %d", internal.Header.PageID)
	}

	if pm.Get(9999) != nil {
		t.Errorf("Expected nil for non-existent page ID")
	}
}
