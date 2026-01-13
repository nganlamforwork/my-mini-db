package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

// Helper functions for tests

// K creates a simple single-column integer composite key
func K(val int64) KeyType {
	return NewCompositeKey(NewInt(val))
}

// V creates a simple single-column string row value
func V(val string) ValueType {
	return NewRow(NewString(val))
}

// KI extracts the int64 value from a single-column composite key
func KI(key KeyType) int64 {
	return key.Values[0].Value.(int64)
}

// VS extracts the string value from a single-column row value
func VS(val ValueType) string {
	return val.Columns[0].Value.(string)
}

func TestInsertWithoutSplit(t *testing.T) {
	// use a persistent per-test DB file under testdata/ so it can be inspected
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}
	out := filepath.Join(dbDir, t.Name()+".db.txt")
	defer func() {
		if err := dumpTreeStructure(tree, out); err != nil {
			t.Logf("dumpTreeStructure failed: %v", err)
		}
	}()

	// Insert keys without causing a split
	keys := []KeyType{K(10), K(20), K(30)}
	values := []ValueType{V("A"), V("B"), V("C")}

	for i, key := range keys {
		err := tree.Insert(key, values[i])
		if err != nil {
			t.Errorf("Unexpected error during insertion: %v", err)
		}
	}

	// Verify the root is a leaf and contains the inserted key/value pairs
	root := tree.pager.Get(tree.meta.RootPage)
	lp, ok := root.(*LeafPage)
	if !ok {
		t.Fatalf("expected root to be a leaf page, got %T", root)
	}

	if int(lp.Header.KeyCount) != len(lp.keys) {
		t.Fatalf("header KeyCount mismatch: header=%d, actual=%d", lp.Header.KeyCount, len(lp.keys))
	}

	for i, key := range keys {
		if lp.keys[i].Compare(key) != 0 || VS(lp.values[i]) != VS(values[i]) {
			t.Fatalf("Expected key-value pair (%v, %v), got (%v, %v)", key, values[i], lp.keys[i], lp.values[i])
		}
	}

	// Parent of root leaf should be zero
	if lp.Header.ParentPage != 0 {
		t.Fatalf("expected root leaf to have no parent, got %d", lp.Header.ParentPage)
	}
}

func TestInsertWithSplit(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}
	out := filepath.Join(dbDir, t.Name()+".db.txt")
	defer func() {
		if err := dumpTreeStructure(tree, out); err != nil {
			t.Logf("dumpTreeStructure failed: %v", err)
		}
	}()

	// Insert keys to cause a split
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	values := []ValueType{V("A"), V("B"), V("C"), V("D"), V("E")}

	for i, key := range keys {
		err := tree.Insert(key, values[i])
		if err != nil {
			t.Errorf("Unexpected error during insertion: %v", err)
		}
	}

	// Verify the root and child nodes after split
	rootP, ok := tree.pager.Get(tree.meta.RootPage).(*InternalPage)
	if !ok {
		t.Fatalf("expected root to be internal page, got %T", tree.pager.Get(tree.meta.RootPage))
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
	for i, key := range []KeyType{K(10), K(20)} {
		if KI(leftChild.keys[i]) != KI(key) {
			t.Fatalf("Expected key %v in left child, got %v", key, leftChild.keys[i])
		}
	}
	for i, key := range []KeyType{K(30), K(40), K(50)} {
		if KI(rightChild.keys[i]) != KI(key) {
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
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}
	out := filepath.Join(dbDir, t.Name()+".db.txt")
	defer func() {
		if err := dumpTreeStructure(tree, out); err != nil {
			t.Logf("dumpTreeStructure failed: %v", err)
		}
	}()

	// 20 keys (more than 15) inserted in a shuffled order to
	// provoke splits at multiple levels.
	keys := []KeyType{K(5), K(1), K(3), K(2), K(8), K(7), K(9), K(10), K(15), K(12), K(11), K(14), K(13), K(6), K(4), K(16), K(17), K(18), K(19), K(20)}

	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("unexpected insert error for %v: %v", k, err)
		}
	}

	// Find left-most leaf by walking down children[0]
	curID := tree.meta.RootPage
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
	sort.Slice(expected, func(i, j int) bool { return expected[i].Compare(expected[j]) < 0 })

	for i := range expected {
		if collected[i].Compare(expected[i]) != 0 {
			t.Fatalf("expected key %v at index %d, got %v", expected[i], i, collected[i])
		}
	}
}

// collectLeafValues returns all values stored in the leaf-level pages
// by scanning from the left-most leaf using `NextPage` links.
func collectLeafValues(tree *BPlusTree) []ValueType {
	// find left-most leaf
	curID := tree.meta.RootPage
	var leftmost *LeafPage
	for {
		p := tree.pager.Get(curID)
		if p == nil {
			return nil
		}
		switch v := p.(type) {
		case *LeafPage:
			leftmost = v
			goto Start
		case *InternalPage:
			if len(v.children) == 0 {
				return nil
			}
			curID = v.children[0]
		default:
			return nil
		}
	}

Start:
	res := make([]ValueType, 0)
	leaf := leftmost
	for leaf != nil {
		res = append(res, leaf.values...)
		if leaf.Header.NextPage == 0 {
			break
		}
		np := tree.pager.Get(leaf.Header.NextPage)
		if np == nil {
			break
		}
		leaf = np.(*LeafPage)
	}
	return res
}

// dumpTreeStructure writes a human-readable snapshot of all allocated
// pages into `path`. It iterates pages 1..pager.next-1 and prints a
// concise description for meta, internal and leaf pages.
func dumpTreeStructure(tree *BPlusTree, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// ensure pages are loaded into the pager cache
	max := tree.pager.next - 1
	ids := make([]uint64, 0, max)
	for i := uint64(1); i <= max; i++ {
		p := tree.pager.Get(i)
		if p == nil {
			continue
		}
		ids = append(ids, i)
	}

	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })

	for _, id := range ids {
		p := tree.pager.Get(id)
		switch v := p.(type) {
		case *MetaPage:
			fmt.Fprintf(f, "Page %d META root=%d pageSize=%d order=%d version=%d\n",
				id, v.RootPage, v.PageSize, v.Order, v.Version)
		case *InternalPage:
			fmt.Fprintf(f, "Page %d INTERNAL parent=%d keyCount=%d free=%d keys=%v children=%v\n",
				id, v.Header.ParentPage, v.Header.KeyCount, v.Header.FreeSpace, v.keys, v.children)
		case *LeafPage:
			fmt.Fprintf(f, "Page %d LEAF parent=%d prev=%d next=%d keyCount=%d free=%d keys=%v values=%v\n",
				id, v.Header.ParentPage, v.Header.PrevPage, v.Header.NextPage, v.Header.KeyCount, v.Header.FreeSpace, v.keys, v.values)
		default:
			fmt.Fprintf(f, "Page %d UNKNOWN type=%T\n", id, p)
		}
	}
	return nil
}

// -----------------------------
// Test Load from disk
// -----------------------------

func TestLoadFromDisk(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	
	// Phase 1: Create and populate tree
	pm1 := NewPageManagerWithFile(dbfile, true)
	m1, err := pm1.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree1 := &BPlusTree{
		pager: pm1,
		meta:  m1,
	}

	// Insert test data
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50), K(60), K(70), K(80)}
	for _, k := range keys {
		if err := tree1.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}
	
	pm1.Close()

	// Phase 2: Load tree from disk
	pm2 := NewPageManagerWithFile(dbfile, false) // Open existing file
	defer pm2.Close()
	
	tree2 := &BPlusTree{
		pager: pm2,
	}
	
	if err := tree2.Load(); err != nil {
		t.Fatalf("failed to load tree: %v", err)
	}

	// Verify all keys can be found
	for _, k := range keys {
		val, err := tree2.Search(k)
		if err != nil {
			t.Errorf("key %d not found after load: %v", KI(k), err)
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected value %v, got %v", KI(k), expected, val)
		}
	}

	// Write dump file
	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree2, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

// -----------------------------
// Test Search
// -----------------------------

func TestSearch(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	testData := map[string]string{
		"10": "ten",
		"20": "twenty",
		"30": "thirty",
		"40": "forty",
		"50": "fifty",
	}

	for kStr, vStr := range testData {
		var kInt int64
		fmt.Sscanf(kStr, "%d", &kInt)
		if err := tree.Insert(K(kInt), V(vStr)); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Test successful searches
	for kStr, expectedVal := range testData {
		var kInt int64
		fmt.Sscanf(kStr, "%d", &kInt)
		val, err := tree.Search(K(kInt))
		if err != nil {
			t.Errorf("search for key %d failed: %v", kInt, err)
		}
		if VS(val) != expectedVal {
			t.Errorf("key %d: expected %v, got %v", kInt, expectedVal, val)
		}
	}

	// Test search for non-existent key
	_, err = tree.Search(K(99))
	if err == nil {
		t.Error("expected error for non-existent key, got nil")
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

// -----------------------------
// Test Delete operations
// -----------------------------

func TestDeleteSimple(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys
	keys := []KeyType{K(10), K(20), K(30)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete one key
	if err := tree.Delete(K(20)); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Verify key is gone
	_, err = tree.Search(K(20))
	if err == nil {
		t.Error("deleted key still found")
	}

	// Verify other keys still exist
	for _, k := range []KeyType{K(10), K(30)} {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found after delete: %v", k, err)
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestDeleteWithBorrowFromRight(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys to create structure: [10,20] | [30,40,50]
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete from left leaf to trigger borrow from right
	if err := tree.Delete(K(10)); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Verify structure: should have borrowed 30 from right
	remaining := []KeyType{K(20), K(30), K(40), K(50)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", k, err)
		}
	}

	// Verify 10 is gone
	if _, err := tree.Search(K(10)); err == nil {
		t.Error("deleted key 10 still found")
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestDeleteWithBorrowFromLeft(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys to create structure: [10,20,30] | [40,50]
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete from right leaf to trigger borrow from left
	if err := tree.Delete(K(50)); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Verify remaining keys
	remaining := []KeyType{K(10), K(20), K(30), K(40)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", k, err)
		}
	}

	// Verify 50 is gone
	if _, err := tree.Search(K(50)); err == nil {
		t.Error("deleted key 50 still found")
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestDeleteWithMerge(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys to create structure that will require merge
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete keys to trigger merge
	toDelete := []KeyType{K(50), K(40)}
	for _, k := range toDelete {
		if err := tree.Delete(k); err != nil {
			t.Fatalf("delete %d failed: %v", k, err)
		}
	}

	// Verify remaining keys
	remaining := []KeyType{K(10), K(20), K(30)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", k, err)
		}
	}

	// Verify deleted keys are gone
	for _, k := range toDelete {
		if _, err := tree.Search(k); err == nil {
			t.Errorf("deleted key %d still found", k)
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestDeleteComplex(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert many keys
	keys := []KeyType{K(5), K(10), K(15), K(20), K(25), K(30), K(35), K(40), K(45), K(50), K(55), K(60), K(65), K(70), K(75), K(80)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete several keys in various patterns
	toDelete := []KeyType{K(15), K(45), K(65), K(25), K(75), K(5)}
	for _, k := range toDelete {
		if err := tree.Delete(k); err != nil {
			t.Fatalf("delete %d failed: %v", KI(k), err)
		}
	}

	// Build expected remaining keys
	remainingMap := make(map[int64]bool)
	for _, k := range keys {
		remainingMap[KI(k)] = true
	}
	for _, k := range toDelete {
		delete(remainingMap, KI(k))
	}

	// Verify remaining keys
	for kInt := range remainingMap {
		if _, err := tree.Search(K(kInt)); err != nil {
			t.Errorf("key %d not found: %v", kInt, err)
		}
	}

	// Verify deleted keys are gone
	for _, k := range toDelete {
		if _, err := tree.Search(k); err == nil {
			t.Errorf("deleted key %d still found", k)
		}
	}

	// Verify keys are still in order
	collected := make([]KeyType, 0)
	curID := tree.meta.RootPage
	var leftmost *LeafPage
	for {
		p := tree.pager.Get(curID)
		if p == nil {
			break
		}
		switch v := p.(type) {
		case *LeafPage:
			leftmost = v
			goto Traverse
		case *InternalPage:
			if len(v.children) == 0 {
				break
			}
			curID = v.children[0]
		}
	}

Traverse:
	leaf := leftmost
	for leaf != nil {
		collected = append(collected, leaf.keys...)
		if leaf.Header.NextPage == 0 {
			break
		}
		leaf = tree.pager.Get(leaf.Header.NextPage).(*LeafPage)
	}

	// Verify collected keys are sorted
	for i := 1; i < len(collected); i++ {
		if collected[i].Compare(collected[i-1]) <= 0 {
			t.Errorf("keys not in order: %v", collected)
			break
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestDeleteAll(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Delete all keys
	for _, k := range keys {
		if err := tree.Delete(k); err != nil {
			t.Fatalf("delete %d failed: %v", k, err)
		}
	}

	// Verify tree is empty
	if tree.meta.RootPage != 0 {
		// If root still exists, check it's actually empty
		root := tree.pager.Get(tree.meta.RootPage)
		if leaf, ok := root.(*LeafPage); ok {
			if len(leaf.keys) != 0 {
				t.Errorf("root leaf should be empty, has %d keys", len(leaf.keys))
			}
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

// -----------------------------
// Test Range Query
// -----------------------------

func TestRangeQuerySimple(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50), K(60), K(70), K(80), K(90)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Test range query [30, 60]
	resultKeys, resultValues, err := tree.SearchRange(K(30), K(60))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}

	expectedKeys := []KeyType{K(30), K(40), K(50), K(60)}
	if len(resultKeys) != len(expectedKeys) {
		t.Fatalf("expected %d keys, got %d", len(expectedKeys), len(resultKeys))
	}

	for i, k := range expectedKeys {
		if resultKeys[i].Compare(k) != 0 {
			t.Errorf("key mismatch at index %d: expected %d, got %d", i, KI(k), KI(resultKeys[i]))
		}
		expectedVal := V(fmt.Sprintf("v%d", KI(k)))
		if VS(resultValues[i]) != VS(expectedVal) {
			t.Errorf("value mismatch at index %d: expected %v, got %v", i, expectedVal, resultValues[i])
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestRangeQueryEdgeCases(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Test empty range (no keys in range)
	resultKeys, _, err := tree.SearchRange(K(35), K(38))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 0 {
		t.Errorf("expected empty result, got %d keys", len(resultKeys))
	}

	// Test single key range
	resultKeys, resultValues, err := tree.SearchRange(K(30), K(30))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 1 || KI(resultKeys[0]) != 30 {
		t.Errorf("expected single key 30, got %v", resultKeys)
	}
	if VS(resultValues[0]) != "v30" {
		t.Errorf("expected value v30, got %v", resultValues[0])
	}

	// Test full range
	resultKeys, _, err = tree.SearchRange(K(10), K(50))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 5 {
		t.Errorf("expected 5 keys, got %d", len(resultKeys))
	}

	// Test range beyond existing keys
	resultKeys, _, err = tree.SearchRange(K(60), K(100))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 0 {
		t.Errorf("expected empty result for out of range, got %d keys", len(resultKeys))
	}

	// Test range starting before first key
	resultKeys, _, err = tree.SearchRange(K(5), K(25))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 2 || KI(resultKeys[0]) != 10 || KI(resultKeys[1]) != 20 {
		t.Errorf("expected keys [10, 20], got %v", resultKeys)
	}

	// Test invalid range (start > end)
	_, _, err = tree.SearchRange(K(50), K(10))
	if err == nil {
		t.Error("expected error for invalid range, got nil")
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestRangeQueryAcrossPages(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert enough data to span multiple leaf pages
	keys := make([]KeyType, 20)
	for i := 0; i < 20; i++ {
		keys[i] = K(int64((i + 1) * 5))
	}

	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Query range that should span multiple leaves
	resultKeys, resultValues, err := tree.SearchRange(K(20), K(70))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}

	// Verify results
	expected := []KeyType{K(20), K(25), K(30), K(35), K(40), K(45), K(50), K(55), K(60), K(65), K(70)}
	if len(resultKeys) != len(expected) {
		t.Fatalf("expected %d keys, got %d", len(expected), len(resultKeys))
	}

	for i, k := range expected {
		if resultKeys[i].Compare(k) != 0 {
			t.Errorf("key mismatch at index %d: expected %d, got %d", i, KI(k), KI(resultKeys[i]))
		}
		expectedVal := V(fmt.Sprintf("v%d", KI(k)))
		if VS(resultValues[i]) != VS(expectedVal) {
			t.Errorf("value mismatch at index %d: expected %v, got %v", i, expectedVal, resultValues[i])
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

// -----------------------------
// Test Update Operation
// -----------------------------

func TestUpdateSimple(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	keys := []KeyType{K(10), K(20), K(30), K(40), K(50)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Update a value
	if err := tree.Update(K(30), V("updated_v30")); err != nil {
		t.Fatalf("update failed: %v", err)
	}

	// Verify the update
	val, err := tree.Search(K(30))
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if VS(val) != "updated_v30" {
		t.Errorf("expected updated_v30, got %v", val)
	}

	// Verify other keys unchanged
	for _, k := range []KeyType{K(10), K(20), K(40), K(50)} {
		val, err := tree.Search(k)
		if err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected %v, got %v", KI(k), expected, val)
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestUpdateNonExistentKey(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	if err := tree.Insert(K(10), V("v10")); err != nil {
		t.Fatalf("insert failed: %v", err)
	}

	// Try to update non-existent key
	err = tree.Update(K(99), V("v99"))
	if err == nil {
		t.Error("expected error for non-existent key, got nil")
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestUpdateWithLargeValue(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert keys with small values
	keys := []KeyType{K(10), K(20), K(30)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Update with a much larger value (should trigger delete + insert)
	largeValue := V(fmt.Sprintf("%0*d", 1000, 30))
	if err := tree.Update(K(20), largeValue); err != nil {
		t.Fatalf("update with large value failed: %v", err)
	}

	// Verify the update
	val, err := tree.Search(K(20))
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if VS(val) != VS(largeValue) {
		t.Errorf("value mismatch after update with large value")
	}

	// Verify all keys still exist
	for _, k := range keys {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found after update: %v", KI(k), err)
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}

func TestUpdateMultiple(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	pm := NewPageManagerWithFile(dbfile, true)
	defer pm.Close()
	
	m, err := pm.ReadMeta()
	if err != nil {
		t.Fatalf("failed to read meta: %v", err)
	}
	tree := &BPlusTree{
		pager: pm,
		meta:  m,
	}

	// Insert test data
	keys := []KeyType{K(5), K(10), K(15), K(20), K(25), K(30), K(35), K(40)}
	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Update multiple keys
	toUpdate := map[int64]string{
		10: "updated_10",
		25: "updated_25",
		40: "updated_40",
	}

	for kInt, vStr := range toUpdate {
		if err := tree.Update(K(kInt), V(vStr)); err != nil {
			t.Fatalf("update %d failed: %v", kInt, err)
		}
	}

	// Verify all updates
	for kInt, expectedVal := range toUpdate {
		val, err := tree.Search(K(kInt))
		if err != nil {
			t.Errorf("key %d not found: %v", kInt, err)
		}
		if VS(val) != expectedVal {
			t.Errorf("key %d: expected %v, got %v", kInt, expectedVal, val)
		}
	}

	// Verify non-updated keys unchanged
	for _, k := range []KeyType{K(5), K(15), K(20), K(30), K(35)} {
		val, err := tree.Search(k)
		if err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected %v, got %v", KI(k), expected, val)
		}
	}

	out := filepath.Join(dbDir, t.Name()+".db.txt")
	if err := dumpTreeStructure(tree, out); err != nil {
		t.Logf("dumpTreeStructure failed: %v", err)
	}
}
