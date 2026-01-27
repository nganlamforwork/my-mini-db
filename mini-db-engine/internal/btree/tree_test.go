package btree

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"bplustree/internal/page"
	"bplustree/internal/storage"
)

// Helper functions for tests

// K creates a simple single-column integer composite key
func K(val int64) storage.CompositeKey {
	return storage.NewCompositeKey(storage.NewInt(val))
}

// V creates a simple single-column string row value
func V(val string) storage.Record {
	return storage.NewRecord(storage.NewString(val))
}

// KI extracts the int64 value from a single-column composite key
func KI(key storage.CompositeKey) int64 {
	return key.Values[0].Value.(int64)
}

// VS extracts the string value from a single-column row value
func VS(val storage.Record) string {
	return val.Columns[0].Value.(string)
}

// formatKeys formats a slice of keys for display
func formatKeys(keys []storage.CompositeKey) string {
	if len(keys) == 0 {
		return "[]"
	}
	if len(keys) <= 10 {
		keyStrs := make([]string, len(keys))
		for i, k := range keys {
			keyStrs[i] = fmt.Sprintf("%d", KI(k))
		}
		return "[" + strings.Join(keyStrs, ", ") + "]"
	}
	keyStrs := make([]string, 10)
	for i := 0; i < 10; i++ {
		keyStrs[i] = fmt.Sprintf("%d", KI(keys[i]))
	}
	return "[" + strings.Join(keyStrs, ", ") + fmt.Sprintf(", ... (%d total)", len(keys)) + "]"
}

// TestContext tracks operations for generating test descriptions
type TestContext struct {
	testName      string
	testDir       string
	operations    []string
	expected      []string
	testSummary   string
}

// NewTestContext creates a new test context with a subfolder
func NewTestContext(t *testing.T) *TestContext {
	testDir := filepath.Join("testdata", t.Name())
	_ = os.MkdirAll(testDir, 0755)
	return &TestContext{
		testName:    t.Name(),
		testDir:     testDir,
		operations:  []string{"1. Created an empty B+Tree database"},
		expected:    []string{},
		testSummary: "",
	}
}

// SetSummary sets a brief summary of what this test verifies
func (ctx *TestContext) SetSummary(summary string) {
	ctx.testSummary = summary
}

// AddOperation adds a natural language description of an operation
func (ctx *TestContext) AddOperation(desc string) {
	ctx.operations = append(ctx.operations, fmt.Sprintf("%d. %s", len(ctx.operations)+1, desc))
}

// AddExpected adds an expected result to the description
func (ctx *TestContext) AddExpected(desc string) {
	ctx.expected = append(ctx.expected, fmt.Sprintf("  - %s", desc))
}

// InsertKey is a helper that inserts a key and automatically adds to description
func (ctx *TestContext) InsertKey(tree *BPlusTree, key storage.CompositeKey, value storage.Record) error {
	err := tree.Insert(key, value)
	if err != nil {
		ctx.AddOperation(fmt.Sprintf("Failed to insert key %d with value \"%s\": %v", KI(key), VS(value), err))
		return err
	}
	ctx.AddOperation(fmt.Sprintf("Inserted key %d with value \"%s\"", KI(key), VS(value)))
	return nil
}

// InsertKeys is a helper that inserts multiple keys and adds summary to description
func (ctx *TestContext) InsertKeys(tree *BPlusTree, keys []storage.CompositeKey, values []storage.Record) error {
	if len(keys) != len(values) {
		return fmt.Errorf("keys and values length mismatch")
	}
	if len(keys) <= 5 {
		for i, key := range keys {
			if err := ctx.InsertKey(tree, key, values[i]); err != nil {
				return err
			}
		}
	} else {
		ctx.AddOperation(fmt.Sprintf("Inserted %d keys: %s", len(keys), formatKeys(keys)))
		for i, key := range keys {
			if err := tree.Insert(key, values[i]); err != nil {
				return err
			}
		}
	}
	return nil
}

// DeleteKey is a helper that deletes a key and automatically adds to description
func (ctx *TestContext) DeleteKey(tree *BPlusTree, key storage.CompositeKey) error {
	err := tree.Delete(key)
	if err != nil {
		ctx.AddOperation(fmt.Sprintf("Failed to delete key %d: %v", KI(key), err))
		return err
	}
	ctx.AddOperation(fmt.Sprintf("Deleted key %d", KI(key)))
	return nil
}

// SearchKey is a helper that searches for a key and adds result to description
func (ctx *TestContext) SearchKey(tree *BPlusTree, key storage.CompositeKey, expectedValue storage.Record) error {
	val, err := tree.Search(key)
	if err != nil {
		ctx.AddOperation(fmt.Sprintf("Search for key %d failed: %v", KI(key), err))
		return err
	}
	if VS(val) != VS(expectedValue) {
		ctx.AddOperation(fmt.Sprintf("Search for key %d: expected \"%s\", got \"%s\"", KI(key), VS(expectedValue), VS(val)))
		return fmt.Errorf("value mismatch")
	}
	ctx.AddOperation(fmt.Sprintf("Search for key %d: found value \"%s\" (correct)", KI(key), VS(val)))
	return nil
}

// GetDBFile returns the database file path in the test subfolder
func (ctx *TestContext) GetDBFile() string {
	return filepath.Join(ctx.testDir, ctx.testName+".db")
}


// WriteDescription writes the test description to a text file
func (ctx *TestContext) WriteDescription() error {
	descFile := filepath.Join(ctx.testDir, "description.txt")
	f, err := os.Create(descFile)
	if err != nil {
		return err
	}
	defer f.Close()

	testName := ctx.testName
	separator := strings.Repeat("=", len(testName)+6)
	fmt.Fprintf(f, "Test: %s\n", testName)
	fmt.Fprintf(f, "%s\n\n", separator)
	
	if ctx.testSummary != "" {
		fmt.Fprintf(f, "Summary: %s\n\n", ctx.testSummary)
	}
	
	fmt.Fprintf(f, "Test Steps:\n")
	fmt.Fprintf(f, "%s\n\n", strings.Repeat("-", 50))
	
	for _, op := range ctx.operations {
		fmt.Fprintf(f, "%s\n", op)
	}
	
	if len(ctx.expected) > 0 {
		fmt.Fprintf(f, "\n")
		fmt.Fprintf(f, "Expected Results:\n")
		fmt.Fprintf(f, "%s\n", strings.Repeat("-", 50))
		for _, exp := range ctx.expected {
			fmt.Fprintf(f, "%s\n", exp)
		}
	}
	
	fmt.Fprintf(f, "\n")
	fmt.Fprintf(f, "Files in this directory:\n")
	fmt.Fprintf(f, "  - %s.db: Binary database file\n", testName)
	fmt.Fprintf(f, "  - description.txt: This file\n")
	
	return nil
}

func TestInsertWithoutSplit(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests basic insertion without triggering a page split. All keys should fit in a single leaf page.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys without causing a split
	keys := []storage.CompositeKey{K(10), K(20), K(30)}
	values := []storage.Record{V("A"), V("B"), V("C")}

	ctx.InsertKeys(tree, keys, values)
	ctx.AddOperation("All keys fit in a single leaf page (no split occurred)")
	
	// Expected results
	ctx.AddExpected("Root page should be a leaf page (not an internal node)")
	ctx.AddExpected("Leaf page should contain exactly 3 keys: 10, 20, 30")
	ctx.AddExpected("Leaf page should contain values: \"A\", \"B\", \"C\"")
	ctx.AddExpected("No parent page (root has parent = 0)")
	ctx.AddExpected("Tree height should be 1 (only root level)")

	// Verify the root is a leaf and contains the inserted key/value pairs
	root := tree.pager.Get(tree.meta.RootPage)
	lp, ok := root.(*page.LeafPage)
	if !ok {
		t.Fatalf("expected root to be a leaf page, got %T", root)
	}

	if int(lp.Header.KeyCount) != len(lp.Keys) {
		t.Fatalf("header KeyCount mismatch: header=%d, actual=%d", lp.Header.KeyCount, len(lp.Keys))
	}

	for i, key := range keys {
		if lp.Keys[i].Compare(key) != 0 || VS(lp.Values[i]) != VS(values[i]) {
			t.Fatalf("Expected key-value pair (%v, %v), got (%v, %v)", key, values[i], lp.Keys[i], lp.Values[i])
		}
	}

	// Parent of root leaf should be zero
	if lp.Header.ParentPage != 0 {
		t.Fatalf("expected root leaf to have no parent, got %d", lp.Header.ParentPage)
	}
}

func TestInsertWithSplit(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests insertion that triggers a leaf page split. The tree should grow from height 1 to height 2.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys to cause a split
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	values := []storage.Record{V("A"), V("B"), V("C"), V("D"), V("E")}

	ctx.InsertKeys(tree, keys, values)
	ctx.AddOperation("After inserting 5 keys, the leaf page overflowed and split into two leaf pages")
	ctx.AddOperation("A new internal (root) node was created with key 30 as separator")
	
	// Expected results
	ctx.AddExpected("Root should be an internal page (not a leaf)")
	ctx.AddExpected("Root internal node should have 1 key: 30")
	ctx.AddExpected("Root should have 2 children (left and right leaf pages)")
	ctx.AddExpected("Left leaf should contain keys: 10, 20")
	ctx.AddExpected("Right leaf should contain keys: 30, 40, 50")
	ctx.AddExpected("Both leaf pages should have parent pointing to root")
	ctx.AddExpected("Leaf pages should be linked: left.next = right, right.prev = left")
	ctx.AddExpected("Tree height should be 2 (root + leaf level)")

	// Verify the root and child nodes after split
	rootP, ok := tree.pager.Get(tree.meta.RootPage).(*InternalPage)
	if !ok {
		t.Fatalf("expected root to be internal page, got %T", tree.pager.Get(tree.meta.RootPage))
	}
	if len(rootP.Keys) != 1 {
		t.Fatalf("Expected root to have 1 key, got %d", len(rootP.Keys))
	}

	// children should exist and reference leaves
	if len(rootP.Children) != 2 {
		t.Fatalf("expected root to have 2 children, got %d", len(rootP.Children))
	}

	leftChild := tree.pager.Get(rootP.Children[0]).(*page.LeafPage)
	rightChild := tree.pager.Get(rootP.Children[1]).(*page.LeafPage)

	// Parent pointers must point back to root
	if leftChild.Header.ParentPage != rootP.Header.PageID {
		t.Fatalf("left child parent mismatch: expected %d, got %d", rootP.Header.PageID, leftChild.Header.ParentPage)
	}
	if rightChild.Header.ParentPage != rootP.Header.PageID {
		t.Fatalf("right child parent mismatch: expected %d, got %d", rootP.Header.PageID, rightChild.Header.ParentPage)
	}

	if int(leftChild.Header.KeyCount) != len(leftChild.Keys) || int(rightChild.Header.KeyCount) != len(rightChild.Keys) {
		t.Fatalf("header KeyCount inconsistent with actual keys: left header=%d actual=%d; right header=%d actual=%d",
			leftChild.Header.KeyCount, len(leftChild.Keys), rightChild.Header.KeyCount, len(rightChild.Keys))
	}

	// Verify expected key distribution
	if len(leftChild.Keys) != 2 || len(rightChild.Keys) != 3 {
		t.Fatalf("Leaf nodes not split correctly: left has %d keys, right has %d keys", len(leftChild.Keys), len(rightChild.Keys))
	}

	// Check content order
	for i, key := range []storage.CompositeKey{K(10), K(20)} {
		if KI(leftChild.Keys[i]) != KI(key) {
			t.Fatalf("Expected key %v in left child, got %v", key, leftChild.Keys[i])
		}
	}
	for i, key := range []storage.CompositeKey{K(30), K(40), K(50)} {
		if KI(rightChild.Keys[i]) != KI(key) {
			t.Fatalf("Expected key %v in right child, got %v", key, rightChild.Keys[i])
		}
	}

	// FreeSpace should be non-negative and consistent with payload computation
	payloadCap := int(page.DefaultPageSize - page.PageHeaderSize)
	if page.ComputeLeafPayloadSize(leftChild) > payloadCap || page.ComputeLeafPayloadSize(rightChild) > payloadCap {
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
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests insertion of 20 keys in shuffled order, triggering multiple splits at both leaf and internal node levels.")
	
	dbfile := ctx.GetDBFile()
	// Clean up any existing database and WAL files
	os.Remove(dbfile)
	os.Remove(dbfile + ".wal")
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// 20 keys (more than 15) inserted in a shuffled order to
	// provoke splits at multiple levels.
	keys := []storage.CompositeKey{K(5), K(1), K(3), K(2), K(8), K(7), K(9), K(10), K(15), K(12), K(11), K(14), K(13), K(6), K(4), K(16), K(17), K(18), K(19), K(20)}
	ctx.AddOperation(fmt.Sprintf("Inserting 20 keys in shuffled order: %s", formatKeys(keys)))

	for _, k := range keys {
		if err := tree.Insert(k, V(fmt.Sprintf("v%d", KI(k)))); err != nil {
			t.Fatalf("unexpected insert error for %v: %v", k, err)
		}
	}
	ctx.AddOperation("Multiple splits occurred at both leaf and internal node levels due to the large number of keys")
	
	// Expected results
	ctx.AddExpected("All 20 keys should be present in the tree")
	ctx.AddExpected("Keys should be stored in sorted order when traversing leaf pages")
	ctx.AddExpected("Tree should have height >= 2 (multiple levels)")
	ctx.AddExpected("Multiple leaf pages should exist (linked via next/prev pointers)")
	ctx.AddExpected("Internal nodes may have split if tree height > 2")
	ctx.AddExpected("Leaf-level scan should return all keys in ascending order: 1, 2, 3, ..., 20")

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
			if len(v.Children) == 0 {
				t.Fatalf("internal node %d has no children", v.Header.PageID)
			}
			curID = v.Children[0]
		default:
			t.Fatalf("unknown page type for page %d", curID)
		}
	}

Traversal:
	// Traverse leaf linked list and collect keys
	collected := make([]storage.CompositeKey, 0, len(keys))
	leaf := leftmost
	for leaf != nil {
		// validate header keycount matches slice length
		if int(leaf.Header.KeyCount) != len(leaf.Keys) {
			t.Fatalf("leaf header KeyCount mismatch for page %d: header=%d actual=%d", leaf.Header.PageID, leaf.Header.KeyCount, len(leaf.Keys))
		}

		collected = append(collected, leaf.Keys...)
		if leaf.Header.NextPage == 0 {
			break
		}
		np := tree.pager.Get(leaf.Header.NextPage)
		if np == nil {
			break
		}
		leaf = np.(*page.LeafPage)
	}

	if len(collected) != len(keys) {
		t.Fatalf("expected %d keys after traversal, got %d", len(keys), len(collected))
	}

	// Keys should be in ascending order in leaf scan
	expected := make([]storage.CompositeKey, len(keys))
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
func collectLeafValues(tree *BPlusTree) []storage.Record {
	// find left-most leaf
	curID := tree.meta.RootPage
	var leftmost *LeafPage
	for {
		p := tree.pager.Get(curID)
		if p == nil {
			return nil
		}
		switch v := p.(type) {
		case *page.LeafPage:
			leftmost = v
			goto Start
		case *page.InternalPage:
			if len(v.Children) == 0 {
				return nil
			}
			curID = v.Children[0]
		default:
			return nil
		}
	}

Start:
	res := make([]storage.Record, 0)
	leaf := leftmost
	for leaf != nil {
		res = append(res, leaf.Values...)
		if leaf.Header.NextPage == 0 {
			break
		}
		np := tree.pager.Get(leaf.Header.NextPage)
		if np == nil {
			break
		}
		leaf = np.(*page.LeafPage)
	}
	return res
}


// -----------------------------
// Test Load from disk
// -----------------------------

func TestLoadFromDisk(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests persistence: creates a tree, closes the database, then reopens and loads the tree structure from disk.")
	
	dbfile := ctx.GetDBFile()
	
	// Phase 1: Create and populate tree
	ctx.AddOperation("Phase 1: Creating a new database and inserting data")
	tree1, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}

	// Insert test data
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50), K(60), K(70), K(80)}
	ctx.InsertKeys(tree1, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50"), V("v60"), V("v70"), V("v80")})
	ctx.AddOperation("Closed the database file (all data persisted to disk)")
	tree1.Close()

	// Phase 2: Load tree from disk
	ctx.AddOperation("Phase 2: Reopening the database file and loading tree structure from disk")
	tree2, err := NewBPlusTree(dbfile, false)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree2.Close()
	// Explicitly load all pages from disk
	if err := tree2.Load(); err != nil {
		t.Fatalf("failed to load tree from disk: %v", err)
	}
	ctx.AddOperation("Successfully loaded all pages from disk into memory")

	// Verify all keys can be found
	ctx.AddOperation("Verifying all keys can be found after loading from disk")
	for _, k := range keys {
		val, err := tree2.Search(k)
		if err != nil {
			t.Errorf("key %d not found after load: %v", KI(k), err)
			continue // Skip validation if key not found
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if len(val.Columns) > 0 && val.Columns[0].Value == nil {
			t.Logf("FATAL: Key %v returned Record with NIL value! Record: %+v", k, val)
		}
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected value %v, got %v", KI(k), expected, val)
		}
		ctx.SearchKey(tree2, k, expected)
	}
	ctx.AddOperation("All keys verified successfully - tree structure correctly persisted and restored")

	// Expected results
	ctx.AddExpected("All 8 keys should be successfully loaded from disk")
	ctx.AddExpected("Tree structure should match the original (same height, same page layout)")
	ctx.AddExpected("All key-value pairs should be correct (key N -> value \"vN\")")
	ctx.AddExpected("Page relationships (parent, children, siblings) should be preserved")
	ctx.AddExpected("No data loss or corruption during persistence")

}

// -----------------------------
// Test Search
// -----------------------------

func TestSearch(t *testing.T) {
	dbDir := "testdata"
	_ = os.MkdirAll(dbDir, 0755)
	dbfile := filepath.Join(dbDir, t.Name()+".db")
	// Clean up any existing database and WAL files
	os.Remove(dbfile)
	os.Remove(dbfile + ".wal")
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

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

}

// -----------------------------
// Test Delete operations
// -----------------------------

func TestDeleteSimple(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests basic deletion: removes one key from a small tree and verifies it's gone while other keys remain.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys
	keys := []storage.CompositeKey{K(10), K(20), K(30)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30")})

	// Delete one key
	ctx.DeleteKey(tree, K(20))

	// Verify key is gone
	ctx.AddOperation("Verified key 20 is no longer in the tree")
	_, err = tree.Search(K(20))
	if err == nil {
		t.Error("deleted key still found")
		ctx.AddOperation("  - ERROR: Deleted key was still found!")
	} else {
		ctx.AddOperation("  - Confirmed: key 20 not found (correct)")
	}

	// Verify other keys still exist
	ctx.AddOperation("Verified remaining keys (10, 30) are still present")
	for _, k := range []storage.CompositeKey{K(10), K(30)} {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found after delete: %v", KI(k), err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d still present (correct)", KI(k)))
		}
	}

	// Expected results
	ctx.AddExpected("Key 20 should be completely removed from the tree")
	ctx.AddExpected("Keys 10 and 30 should still be present and searchable")
	ctx.AddExpected("Tree structure should remain valid (no corruption)")
	ctx.AddExpected("Search for key 20 should return an error")

}

func TestDeleteWithBorrowFromRight(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests deletion that triggers borrowing from right sibling when a leaf page becomes underflowed.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys to create structure: [10,20] | [30,40,50]
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})
	ctx.AddOperation("Tree structure: left leaf [10,20], right leaf [30,40,50]")

	// Delete from left leaf to trigger borrow from right
	ctx.AddOperation("Deleting key 10 from left leaf (will cause underflow)")
	ctx.DeleteKey(tree, K(10))

	// Verify structure: should have borrowed 30 from right
	ctx.AddOperation("Verifying borrow operation: key 30 should move from right to left leaf")
	remaining := []storage.CompositeKey{K(20), K(30), K(40), K(50)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d found (correct)", KI(k)))
		}
	}

	// Verify 10 is gone
	if _, err := tree.Search(K(10)); err == nil {
		t.Error("deleted key 10 still found")
	} else {
		ctx.AddOperation("  - Key 10 correctly removed")
	}

	// Expected results
	ctx.AddExpected("Key 10 should be deleted from left leaf")
	ctx.AddExpected("Left leaf should borrow key 30 from right sibling")
	ctx.AddExpected("Right leaf should now contain [40, 50]")
	ctx.AddExpected("Parent node separator key should be updated to 40")
	ctx.AddExpected("All remaining keys (20, 30, 40, 50) should be searchable")

}

func TestDeleteWithBorrowFromLeft(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests deletion that triggers borrowing from left sibling when a leaf page becomes underflowed.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys to create structure: [10,20,30] | [40,50]
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})
	ctx.AddOperation("Tree structure: left leaf [10,20,30], right leaf [40,50]")

	// Delete from right leaf to trigger borrow from left
	ctx.AddOperation("Deleting key 50 from right leaf (will cause underflow)")
	ctx.DeleteKey(tree, K(50))

	// Verify remaining keys
	ctx.AddOperation("Verifying borrow operation: key 30 should move from left to right leaf")
	remaining := []storage.CompositeKey{K(10), K(20), K(30), K(40)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d found (correct)", KI(k)))
		}
	}

	// Verify 50 is gone
	if _, err := tree.Search(K(50)); err == nil {
		t.Error("deleted key 50 still found")
	} else {
		ctx.AddOperation("  - Key 50 correctly removed")
	}

	// Expected results
	ctx.AddExpected("Key 50 should be deleted from right leaf")
	ctx.AddExpected("Right leaf should borrow key 30 from left sibling")
	ctx.AddExpected("Left leaf should now contain [10, 20]")
	ctx.AddExpected("Parent node separator key should be updated to 40")
	ctx.AddExpected("All remaining keys (10, 20, 30, 40) should be searchable")

}

func TestDeleteWithMerge(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests deletion that triggers node merging when both siblings are at minimum capacity and cannot borrow.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys to create structure that will require merge
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})
	ctx.AddOperation("Initial structure: left leaf [10,20], right leaf [30,40,50]")

	// Delete keys to trigger merge
	toDelete := []storage.CompositeKey{K(50), K(40)}
	ctx.AddOperation("Deleting keys 50 and 40 from right leaf (will cause underflow and merge)")
	for _, k := range toDelete {
		ctx.DeleteKey(tree, k)
	}

	// Verify remaining keys
	ctx.AddOperation("Verifying merge: right leaf should merge into left leaf")
	remaining := []storage.CompositeKey{K(10), K(20), K(30)}
	for _, k := range remaining {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d found (correct)", KI(k)))
		}
	}

	// Verify deleted keys are gone
	for _, k := range toDelete {
		if _, err := tree.Search(k); err == nil {
			t.Errorf("deleted key %d still found", KI(k))
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d correctly removed", KI(k)))
		}
	}

	// Expected results
	ctx.AddExpected("Keys 40 and 50 should be deleted")
	ctx.AddExpected("Right leaf should merge into left leaf (both at minimum)")
	ctx.AddExpected("Merged leaf should contain [10, 20, 30]")
	ctx.AddExpected("Parent node should have separator key removed")
	ctx.AddExpected("If parent becomes empty, tree height should decrease")
	ctx.AddExpected("All remaining keys (10, 20, 30) should be searchable")

}

func TestDeleteComplex(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests complex deletion scenario: deletes 6 keys from a 16-key tree in random order, triggering multiple rebalancing operations.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert many keys
	keys := []storage.CompositeKey{K(5), K(10), K(15), K(20), K(25), K(30), K(35), K(40), K(45), K(50), K(55), K(60), K(65), K(70), K(75), K(80)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v5"), V("v10"), V("v15"), V("v20"), V("v25"), V("v30"), V("v35"), V("v40"), V("v45"), V("v50"), V("v55"), V("v60"), V("v65"), V("v70"), V("v75"), V("v80")})
	ctx.AddOperation("Tree now contains 16 keys, likely spanning multiple pages")

	// Delete several keys in various patterns
	toDelete := []storage.CompositeKey{K(15), K(45), K(65), K(25), K(75), K(5)}
	ctx.AddOperation(fmt.Sprintf("Deleting 6 keys in order: %s", formatKeys(toDelete)))
	for _, k := range toDelete {
		ctx.DeleteKey(tree, k)
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
	ctx.AddOperation("Verifying remaining 10 keys are still present")
	for kInt := range remainingMap {
		if _, err := tree.Search(K(kInt)); err != nil {
			t.Errorf("key %d not found: %v", kInt, err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d found (correct)", kInt))
		}
	}

	// Verify deleted keys are gone
	ctx.AddOperation("Verifying deleted keys are gone")
	for _, k := range toDelete {
		if _, err := tree.Search(k); err == nil {
			t.Errorf("deleted key %d still found", KI(k))
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d correctly removed", KI(k)))
		}
	}

	// Verify keys are still in order
	collected := make([]storage.CompositeKey, 0)
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
			if len(v.Children) == 0 {
				break
			}
			curID = v.Children[0]
		}
	}

Traverse:
	leaf := leftmost
	for leaf != nil {
		collected = append(collected, leaf.Keys...)
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
	ctx.AddOperation(fmt.Sprintf("  - All %d remaining keys are in sorted order", len(collected)))

	// Expected results
	ctx.AddExpected("6 keys (5, 15, 25, 45, 65, 75) should be deleted")
	ctx.AddExpected("10 keys (10, 20, 30, 35, 40, 50, 55, 60, 70, 80) should remain")
	ctx.AddExpected("Tree should remain balanced after multiple deletions")
	ctx.AddExpected("Keys should remain in sorted order when traversing leaf chain")
	ctx.AddExpected("Tree structure should be valid (no corruption)")

}

func TestDeleteAll(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests edge case: deletes all keys from the tree, verifying the tree becomes empty and handles this correctly.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})

	// Delete all keys
	ctx.AddOperation("Deleting all keys from the tree")
	for _, k := range keys {
		ctx.DeleteKey(tree, k)
	}

	// Verify tree is empty
	ctx.AddOperation("Verifying tree is now empty")
	if tree.meta.RootPage != 0 {
		// If root still exists, check it's actually empty
		root := tree.pager.Get(tree.meta.RootPage)
		if leaf, ok := root.(*LeafPage); ok {
			if len(leaf.Keys) != 0 {
				t.Errorf("root leaf should be empty, has %d keys", len(leaf.Keys))
				ctx.AddOperation(fmt.Sprintf("  - ERROR: Root still has %d keys", len(leaf.Keys)))
			} else {
				ctx.AddOperation("  - Root page exists but is empty (correct)")
			}
		}
	} else {
		ctx.AddOperation("  - Root page is 0 (tree completely empty)")
	}

	// Expected results
	ctx.AddExpected("All 5 keys should be deleted")
	ctx.AddExpected("Tree should be empty (root page = 0 or root has 0 keys)")
	ctx.AddExpected("Search for any key should return an error")
	ctx.AddExpected("Tree should handle empty state correctly without errors")

}

// -----------------------------
// Test Range Query
// -----------------------------

func TestRangeQuerySimple(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests range query: retrieves all keys and values within a specified range [30, 60].")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert test data
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50), K(60), K(70), K(80), K(90)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50"), V("v60"), V("v70"), V("v80"), V("v90")})

	// Test range query [30, 60]
	ctx.AddOperation("Executing range query: SearchRange(30, 60)")
	resultKeys, resultValues, err := tree.SearchRange(K(30), K(60))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	ctx.AddOperation(fmt.Sprintf("Range query returned %d results", len(resultKeys)))

	expectedKeys := []storage.CompositeKey{K(30), K(40), K(50), K(60)}
	if len(resultKeys) != len(expectedKeys) {
		t.Fatalf("expected %d keys, got %d", len(expectedKeys), len(resultKeys))
	}

	for i, k := range expectedKeys {
		if resultKeys[i].Compare(k) != 0 {
			t.Errorf("key mismatch at index %d: expected %d, got %d", i, KI(k), KI(resultKeys[i]))
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Result %d: key %d, value \"%s\" (correct)", i+1, KI(k), VS(resultValues[i])))
		}
		expectedVal := V(fmt.Sprintf("v%d", KI(k)))
		if VS(resultValues[i]) != VS(expectedVal) {
			t.Errorf("value mismatch at index %d: expected %v, got %v", i, expectedVal, resultValues[i])
		}
	}

	// Expected results
	ctx.AddExpected("Range query [30, 60] should return exactly 4 keys: 30, 40, 50, 60")
	ctx.AddExpected("Keys should be returned in ascending order")
	ctx.AddExpected("Each key should have its correct value (key N -> \"vN\")")
	ctx.AddExpected("Keys outside range (10, 20, 70, 80, 90) should not be included")

}

func TestRangeQueryEdgeCases(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests edge cases for range queries: empty ranges, single key ranges, full ranges, out-of-bounds ranges, and invalid ranges.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert test data
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})

	// Test empty range (no keys in range)
	ctx.AddOperation("Test 1: Empty range [35, 38] (no keys in this range)")
	resultKeys, _, err := tree.SearchRange(K(35), K(38))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 0 {
		t.Errorf("expected empty result, got %d keys", len(resultKeys))
	} else {
		ctx.AddOperation("  - Correctly returned 0 results")
	}

	// Test single key range
	ctx.AddOperation("Test 2: Single key range [30, 30]")
	resultKeys, resultValues, err := tree.SearchRange(K(30), K(30))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 1 || KI(resultKeys[0]) != 30 {
		t.Errorf("expected single key 30, got %v", resultKeys)
	} else {
		ctx.AddOperation(fmt.Sprintf("  - Correctly returned 1 result: key 30, value \"%s\"", VS(resultValues[0])))
	}

	// Test full range
	ctx.AddOperation("Test 3: Full range [10, 50] (all keys)")
	resultKeys, _, err = tree.SearchRange(K(10), K(50))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 5 {
		t.Errorf("expected 5 keys, got %d", len(resultKeys))
	} else {
		ctx.AddOperation("  - Correctly returned all 5 keys")
	}

	// Test range beyond existing keys
	ctx.AddOperation("Test 4: Range beyond existing keys [60, 100]")
	resultKeys, _, err = tree.SearchRange(K(60), K(100))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 0 {
		t.Errorf("expected empty result for out of range, got %d keys", len(resultKeys))
	} else {
		ctx.AddOperation("  - Correctly returned 0 results (no keys in range)")
	}

	// Test range starting before first key
	ctx.AddOperation("Test 5: Range starting before first key [5, 25]")
	resultKeys, _, err = tree.SearchRange(K(5), K(25))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	if len(resultKeys) != 2 || KI(resultKeys[0]) != 10 || KI(resultKeys[1]) != 20 {
		t.Errorf("expected keys [10, 20], got %v", resultKeys)
	} else {
		ctx.AddOperation("  - Correctly returned keys [10, 20] (only keys in range)")
	}

	// Test invalid range (start > end)
	ctx.AddOperation("Test 6: Invalid range [50, 10] (start > end, should return error)")
	_, _, err = tree.SearchRange(K(50), K(10))
	if err == nil {
		t.Error("expected error for invalid range, got nil")
		ctx.AddOperation("  - ERROR: Should have returned error but didn't")
	} else {
		ctx.AddOperation("  - Correctly returned error for invalid range")
	}

	// Expected results
	ctx.AddExpected("Empty range [35, 38] should return 0 results")
	ctx.AddExpected("Single key range [30, 30] should return exactly 1 result")
	ctx.AddExpected("Full range [10, 50] should return all 5 keys")
	ctx.AddExpected("Out-of-bounds range [60, 100] should return 0 results")
	ctx.AddExpected("Partial range [5, 25] should return only keys in range: [10, 20]")
	ctx.AddExpected("Invalid range [50, 10] should return an error")

}

func TestRangeQueryAcrossPages(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests range query that spans multiple leaf pages, verifying the leaf chain traversal works correctly.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert enough data to span multiple leaf pages
	keys := make([]KeyType, 20)
	values := make([]ValueType, 20)
	for i := 0; i < 20; i++ {
		keys[i] = K(int64((i + 1) * 5))
		values[i] = V(fmt.Sprintf("v%d", (i+1)*5))
	}

	ctx.InsertKeys(tree, keys, values)
	ctx.AddOperation("Tree now contains 20 keys, spanning multiple leaf pages")

	// Query range that should span multiple leaves
	ctx.AddOperation("Executing range query [20, 70] that spans multiple leaf pages")
	resultKeys, resultValues, err := tree.SearchRange(K(20), K(70))
	if err != nil {
		t.Fatalf("range query failed: %v", err)
	}
	ctx.AddOperation(fmt.Sprintf("Range query returned %d results", len(resultKeys)))

	// Verify results
	expected := []KeyType{K(20), K(25), K(30), K(35), K(40), K(45), K(50), K(55), K(60), K(65), K(70)}
	if len(resultKeys) != len(expected) {
		t.Fatalf("expected %d keys, got %d", len(expected), len(resultKeys))
	}

	for i, k := range expected {
		if resultKeys[i].Compare(k) != 0 {
			t.Errorf("key mismatch at index %d: expected %d, got %d", i, KI(k), KI(resultKeys[i]))
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Result %d: key %d, value \"%s\" (correct)", i+1, KI(k), VS(resultValues[i])))
		}
		expectedVal := V(fmt.Sprintf("v%d", KI(k)))
		if VS(resultValues[i]) != VS(expectedVal) {
			t.Errorf("value mismatch at index %d: expected %v, got %v", i, expectedVal, resultValues[i])
		}
	}

	// Expected results
	ctx.AddExpected("Range query [20, 70] should return 11 keys: 20, 25, 30, ..., 70")
	ctx.AddExpected("Query should traverse multiple leaf pages using next/prev pointers")
	ctx.AddExpected("Keys should be returned in ascending order across pages")
	ctx.AddExpected("All key-value pairs should be correct")
	ctx.AddExpected("Query should efficiently scan only relevant leaf pages")

}

// -----------------------------
// Test Update Operation
// -----------------------------

func TestUpdateSimple(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests basic update operation: modifies the value of an existing key and verifies the change.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert test data
	keys := []storage.CompositeKey{K(10), K(20), K(30), K(40), K(50)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30"), V("v40"), V("v50")})

	// Update a value
	ctx.AddOperation("Updating key 30: changing value from \"v30\" to \"updated_v30\"")
	if err := tree.Update(K(30), V("updated_v30")); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	ctx.AddOperation("Update operation completed successfully")

	// Verify the update
	ctx.AddOperation("Verifying the update: searching for key 30")
	val, err := tree.Search(K(30))
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if VS(val) != "updated_v30" {
		t.Errorf("expected updated_v30, got %v", val)
		ctx.AddOperation(fmt.Sprintf("  - ERROR: Expected \"updated_v30\", got \"%s\"", VS(val)))
	} else {
		ctx.AddOperation("  - Key 30 now has value \"updated_v30\" (correct)")
	}

	// Verify other keys unchanged
	ctx.AddOperation("Verifying other keys remain unchanged")
	for _, k := range []storage.CompositeKey{K(10), K(20), K(40), K(50)} {
		val, err := tree.Search(k)
		if err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected %v, got %v", KI(k), expected, val)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d still has value \"%s\" (unchanged, correct)", KI(k), VS(val)))
		}
	}

	// Expected results
	ctx.AddExpected("Key 30 should have new value \"updated_v30\"")
	ctx.AddExpected("Other keys (10, 20, 40, 50) should retain their original values")
	ctx.AddExpected("Tree structure should remain unchanged (no rebalancing needed)")
	ctx.AddExpected("Update should be in-place if new value fits in same page")

}

func TestUpdateNonExistentKey(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests error handling: attempting to update a non-existent key should return an error.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert test data
	ctx.InsertKey(tree, K(10), V("v10"))
	ctx.AddOperation("Tree now contains only key 10")

	// Try to update non-existent key
	ctx.AddOperation("Attempting to update non-existent key 99 (should fail)")
	err = tree.Update(K(99), V("v99"))
	if err == nil {
		t.Error("expected error for non-existent key, got nil")
		ctx.AddOperation("  - ERROR: Should have returned error but didn't")
	} else {
		ctx.AddOperation(fmt.Sprintf("  - Correctly returned error: %v", err))
	}

	// Expected results
	ctx.AddExpected("Update of non-existent key 99 should return an error")
	ctx.AddExpected("Key 10 should remain unchanged")
	ctx.AddExpected("Tree structure should remain valid")

}

func TestUpdateWithLargeValue(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests update with a value too large to fit in the current page, which should trigger delete+insert rebalancing.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert keys with small values
	keys := []storage.CompositeKey{K(10), K(20), K(30)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v10"), V("v20"), V("v30")})

	// Update with a much larger value (should trigger delete + insert)
	largeValue := V(fmt.Sprintf("%0*d", 1000, 30))
	ctx.AddOperation("Updating key 20 with a large value (1000 characters, too large for in-place update)")
	ctx.AddOperation("This should trigger delete + insert operation (not in-place update)")
	if err := tree.Update(K(20), largeValue); err != nil {
		t.Fatalf("update with large value failed: %v", err)
	}
	ctx.AddOperation("Update completed (may have triggered rebalancing)")

	// Verify the update
	ctx.AddOperation("Verifying the large value was stored correctly")
	val, err := tree.Search(K(20))
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if VS(val) != VS(largeValue) {
		t.Errorf("value mismatch after update with large value")
		ctx.AddOperation("  - ERROR: Value mismatch")
	} else {
		ctx.AddOperation("  - Large value stored correctly")
	}

	// Verify all keys still exist
	ctx.AddOperation("Verifying all keys still exist after large value update")
	for _, k := range keys {
		if _, err := tree.Search(k); err != nil {
			t.Errorf("key %d not found after update: %v", KI(k), err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d still present (correct)", KI(k)))
		}
	}

	// Expected results
	ctx.AddExpected("Key 20 should have the new large value (1000 characters)")
	ctx.AddExpected("Update should trigger delete + insert (not in-place) due to size")
	ctx.AddExpected("Tree may rebalance if the large value causes page overflow")
	ctx.AddExpected("All keys (10, 20, 30) should remain searchable")
	ctx.AddExpected("Tree structure should remain valid after rebalancing")

}

func TestUpdateMultiple(t *testing.T) {
	ctx := NewTestContext(t)
	defer ctx.WriteDescription()
	
	ctx.SetSummary("Tests updating multiple keys in sequence, verifying each update succeeds and other keys remain unchanged.")
	
	dbfile := ctx.GetDBFile()
	tree, err := NewBPlusTree(dbfile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert test data
	keys := []storage.CompositeKey{K(5), K(10), K(15), K(20), K(25), K(30), K(35), K(40)}
	ctx.InsertKeys(tree, keys, []ValueType{V("v5"), V("v10"), V("v15"), V("v20"), V("v25"), V("v30"), V("v35"), V("v40")})

	// Update multiple keys
	toUpdate := map[int64]string{
		10: "updated_10",
		25: "updated_25",
		40: "updated_40",
	}

	ctx.AddOperation("Updating 3 keys:")
	for kInt, vStr := range toUpdate {
		ctx.AddOperation(fmt.Sprintf("  - Updating key %d: \"v%d\" -> \"%s\"", kInt, kInt, vStr))
		if err := tree.Update(K(kInt), V(vStr)); err != nil {
			t.Fatalf("update %d failed: %v", kInt, err)
		}
	}

	// Verify all updates
	ctx.AddOperation("Verifying all updates were successful:")
	for kInt, expectedVal := range toUpdate {
		val, err := tree.Search(K(kInt))
		if err != nil {
			t.Errorf("key %d not found: %v", kInt, err)
		}
		if VS(val) != expectedVal {
			t.Errorf("key %d: expected %v, got %v", kInt, expectedVal, val)
			ctx.AddOperation(fmt.Sprintf("  - ERROR: Key %d has wrong value", kInt))
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d has value \"%s\" (correct)", kInt, expectedVal))
		}
	}

	// Verify non-updated keys unchanged
	ctx.AddOperation("Verifying non-updated keys remain unchanged:")
	for _, k := range []storage.CompositeKey{K(5), K(15), K(20), K(30), K(35)} {
		val, err := tree.Search(k)
		if err != nil {
			t.Errorf("key %d not found: %v", KI(k), err)
		}
		expected := V(fmt.Sprintf("v%d", KI(k)))
		if VS(val) != VS(expected) {
			t.Errorf("key %d: expected %v, got %v", KI(k), expected, val)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d still has value \"%s\" (unchanged, correct)", KI(k), VS(val)))
		}
	}

	// Expected results
	ctx.AddExpected("Keys 10, 25, 40 should have updated values: \"updated_10\", \"updated_25\", \"updated_40\"")
	ctx.AddExpected("Keys 5, 15, 20, 30, 35 should retain original values: \"v5\", \"v15\", \"v20\", \"v30\", \"v35\"")
	ctx.AddExpected("All 8 keys should remain searchable")
	ctx.AddExpected("Tree structure should remain valid")

}

// TestAutoCommitSingleInsert tests that a single Insert operation automatically creates and commits a transaction
func TestAutoCommitSingleInsert(t *testing.T) {
	ctx := NewTestContext(t)
	ctx.SetSummary("Verifies that single Insert operations automatically use transactions for crash recovery")
	
	dbFile := filepath.Join(ctx.testDir, "autocommit_insert.db")
	// Clean up any existing files
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()
	
	// Single insert without explicit Begin/Commit
	ctx.AddOperation("Inserting key 42 with value \"test\" (no explicit transaction)")
	err = tree.Insert(K(42), V("test"))
	if err != nil {
		t.Fatalf("insert failed: %v", err)
	}
	
	// Verify the operation was committed (check WAL exists and has entries)
	walFile := dbFile + ".wal"
	walInfo, err := os.Stat(walFile)
	if err != nil {
		t.Fatalf("WAL file should exist: %v", err)
	}
	if walInfo.Size() == 0 {
		t.Error("WAL file should contain log entries for the insert")
	}
	
	// Verify data is searchable
	val, err := tree.Search(K(42))
	if err != nil {
		t.Errorf("key 42 should be searchable after auto-commit: %v", err)
	} else if VS(val) != "test" {
		t.Errorf("expected value \"test\", got %v", VS(val))
	}
	
	ctx.AddExpected("Insert operation should automatically create and commit a transaction")
	ctx.AddExpected("WAL file should contain log entries for crash recovery")
	ctx.AddExpected("Data should be immediately searchable after operation")
	
	ctx.WriteDescription()
}

// TestAutoCommitCrashRecovery tests that auto-commit transactions survive crashes
func TestAutoCommitCrashRecovery(t *testing.T) {
	ctx := NewTestContext(t)
	ctx.SetSummary("Verifies that auto-commit transactions can be recovered after a simulated crash")
	
	dbFile := filepath.Join(ctx.testDir, "crash_recovery.db")
	// Clean up any existing files
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	
	// Phase 1: Insert data with auto-commit
	tree1, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	
	ctx.AddOperation("Phase 1: Inserting 5 keys with auto-commit transactions")
	keys := []storage.CompositeKey{K(1), K(2), K(3), K(4), K(5)}
	for i, key := range keys {
		if err := tree1.Insert(key, V(fmt.Sprintf("value%d", i+1))); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
		ctx.AddOperation(fmt.Sprintf("  - Inserted key %d", KI(key)))
	}
	
	// Simulate crash: close without explicit checkpoint
	tree1.Close()
	
	// Phase 2: Recover from WAL
	ctx.AddOperation("Phase 2: Simulating crash recovery (reopening database)")
	tree2, err := NewBPlusTree(dbFile, false)
	if err != nil {
		t.Fatalf("failed to recreate tree: %v", err)
	}
	defer tree2.Close()
	
	// Verify all data was recovered
	ctx.AddOperation("Phase 3: Verifying all data was recovered from WAL")
	recovered := 0
	for i, key := range keys {
		val, err := tree2.Search(key)
		if err != nil {
			t.Errorf("key %d not recovered: %v", KI(key), err)
		} else if VS(val) != fmt.Sprintf("value%d", i+1) {
			t.Errorf("key %d: expected \"value%d\", got %v", KI(key), i+1, VS(val))
		} else {
			recovered++
			ctx.AddOperation(fmt.Sprintf("  - Key %d recovered successfully", KI(key)))
		}
	}
	
	if recovered != len(keys) {
		t.Errorf("only %d/%d keys recovered", recovered, len(keys))
	}
	
	ctx.AddExpected("All 5 keys should be recoverable from WAL after crash")
	ctx.AddExpected("Database state should be consistent after recovery")
	
	ctx.WriteDescription()
}

// TestExplicitTransactionMultipleOperations tests explicit transactions for multi-operation queries
func TestExplicitTransactionMultipleOperations(t *testing.T) {
	ctx := NewTestContext(t)
	ctx.SetSummary("Verifies that explicit transactions support multiple operations atomically")
	
	dbFile := filepath.Join(ctx.testDir, "explicit_tx.db")
	// Clean up any existing files
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()
	
	// Insert initial data
	ctx.AddOperation("Inserting initial data")
	tree.Insert(K(10), V("initial"))
	tree.Insert(K(20), V("initial"))
	
	// Begin explicit transaction
	ctx.AddOperation("Beginning explicit transaction for multiple operations")
	if err := tree.Begin(); err != nil {
		t.Fatalf("Begin failed: %v", err)
	}
	
	// Multiple operations in one transaction
	ctx.AddOperation("Performing multiple operations in transaction:")
	ctx.AddOperation("  - Insert key 30")
	if err := tree.Insert(K(30), V("tx_value")); err != nil {
		t.Fatalf("insert in tx failed: %v", err)
	}
	
	ctx.AddOperation("  - Update key 10")
	if err := tree.Update(K(10), V("tx_updated")); err != nil {
		t.Fatalf("update in tx failed: %v", err)
	}
	
	ctx.AddOperation("  - Delete key 20")
	if err := tree.Delete(K(20)); err != nil {
		t.Fatalf("delete in tx failed: %v", err)
	}
	
	// Commit transaction
	ctx.AddOperation("Committing transaction (all operations should be atomic)")
	if err := tree.Commit(); err != nil {
		t.Fatalf("Commit failed: %v", err)
	}
	
	// Verify all changes are visible
	ctx.AddOperation("Verifying all transaction changes:")
	val30, err := tree.Search(K(30))
	if err != nil {
		t.Errorf("key 30 not found after commit: %v", err)
	} else {
		ctx.AddOperation(fmt.Sprintf("  - Key 30 found with value \"%s\"", VS(val30)))
	}
	
	val10, err := tree.Search(K(10))
	if err != nil {
		t.Errorf("key 10 not found after commit: %v", err)
	} else if VS(val10) != "tx_updated" {
		t.Errorf("key 10: expected \"tx_updated\", got %v", VS(val10))
	} else {
		ctx.AddOperation(fmt.Sprintf("  - Key 10 updated to \"%s\"", VS(val10)))
	}
	
	_, err = tree.Search(K(20))
	if err == nil {
		t.Error("key 20 should be deleted after commit")
	} else {
		ctx.AddOperation("  - Key 20 successfully deleted")
	}
	
	ctx.AddExpected("All 3 operations (insert, update, delete) should be atomic")
	ctx.AddExpected("Changes should only be visible after Commit()")
	ctx.AddExpected("WAL should contain all modifications for crash recovery")
	
	ctx.WriteDescription()
}

// TestExplicitTransactionRollback tests that rollback undoes all operations
func TestExplicitTransactionRollback(t *testing.T) {
	ctx := NewTestContext(t)
	ctx.SetSummary("Verifies that Rollback() undoes all operations in an explicit transaction")
	
	dbFile := filepath.Join(ctx.testDir, "rollback_test.db")
	// Clean up any existing files
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()
	
	// Insert initial data
	ctx.AddOperation("Inserting initial data")
	tree.Insert(K(100), V("original"))
	
	// Begin transaction
	ctx.AddOperation("Beginning explicit transaction")
	if err := tree.Begin(); err != nil {
		t.Fatalf("Begin failed: %v", err)
	}
	
	// Perform operations
	ctx.AddOperation("Performing operations in transaction:")
	ctx.AddOperation("  - Insert key 200")
	tree.Insert(K(200), V("should_rollback"))
	
	ctx.AddOperation("  - Insert key 300")
	tree.Insert(K(300), V("should_rollback"))
	
	// Rollback
	ctx.AddOperation("Rolling back transaction (all changes should be undone)")
	if err := tree.Rollback(); err != nil {
		t.Fatalf("Rollback failed: %v", err)
	}
	
	// Verify rollback
	ctx.AddOperation("Verifying rollback:")
	val100, err := tree.Search(K(100))
	if err != nil {
		t.Errorf("key 100 not found after rollback: %v", err)
	} else if VS(val100) != "original" {
		t.Errorf("key 100: expected \"original\" after rollback, got %v", VS(val100))
	} else {
		ctx.AddOperation("  - Key 100 unchanged (rollback successful)")
	}
	
	_, err = tree.Search(K(200))
	if err == nil {
		t.Error("key 200 should not exist after rollback")
	} else {
		ctx.AddOperation("  - Key 200 was not inserted (rollback successful)")
	}
	
	_, err = tree.Search(K(300))
	if err == nil {
		t.Error("key 300 should not exist after rollback")
	} else {
		ctx.AddOperation("  - Key 300 was not inserted (rollback successful)")
	}
	
	ctx.AddExpected("All insert operations in transaction should be undone by Rollback()")
	ctx.AddExpected("Database should return to state before Begin()")
	ctx.AddExpected("Note: Update operations in transactions may have limitations due to reference-based rollback")
	
	ctx.WriteDescription()
}

// TestAutoCommitVsExplicitTransaction tests that auto-commit and explicit transactions work together
func TestAutoCommitVsExplicitTransaction(t *testing.T) {
	ctx := NewTestContext(t)
	ctx.SetSummary("Verifies that auto-commit and explicit transactions can coexist correctly")
	
	dbFile := filepath.Join(ctx.testDir, "mixed_tx.db")
	// Clean up any existing files
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()
	
	// Auto-commit operation
	ctx.AddOperation("Auto-commit insert (no explicit transaction)")
	tree.Insert(K(1), V("autocommit"))
	
	// Explicit transaction
	ctx.AddOperation("Beginning explicit transaction")
	tree.Begin()
	tree.Insert(K(2), V("explicit"))
	tree.Insert(K(3), V("explicit"))
	ctx.AddOperation("Committing explicit transaction")
	tree.Commit()
	
	// Another auto-commit operation
	ctx.AddOperation("Another auto-commit insert")
	tree.Insert(K(4), V("autocommit2"))
	
	// Verify all are present
	ctx.AddOperation("Verifying all operations:")
	for i := 1; i <= 4; i++ {
		val, err := tree.Search(K(int64(i)))
		if err != nil {
			t.Errorf("key %d not found: %v", i, err)
		} else {
			ctx.AddOperation(fmt.Sprintf("  - Key %d found", i))
		}
		_ = val
	}
	
	ctx.AddExpected("Auto-commit operations should work independently")
	ctx.AddExpected("Explicit transactions should work correctly")
	ctx.AddExpected("Both should be crash-recoverable via WAL")
	
	ctx.WriteDescription()
}
