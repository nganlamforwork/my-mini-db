package btree

import (
	"bytes"
	"os"
	"testing"

	"bplustree/internal/storage"
)

func TestBLinkMoveRight(t *testing.T) {
	dbFile := "blink_test.db"
	os.Remove(dbFile)
	defer os.Remove(dbFile)

	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("Failed to create tree: %v", err)
	}

	// 1. Manually create Page A (Leaf) and Page B (Leaf)
	// Page A will be the root initially.
	pageA := tree.pager.NewLeaf()
	pageB := tree.pager.NewLeaf()

	// 2. Setup Page A
	// Keys: [1, 5]
	// HighKey: 10
	// RightPageID: Page B
	key1 := storage.NewCompositeKey(storage.Column{Type: storage.TypeInt, Value: int64(1)})
	key5 := storage.NewCompositeKey(storage.Column{Type: storage.TypeInt, Value: int64(5)})
	key10 := storage.NewCompositeKey(storage.Column{Type: storage.TypeInt, Value: int64(10)})
	key15 := storage.NewCompositeKey(storage.Column{Type: storage.TypeInt, Value: int64(15)})

	val1 := storage.Record{Columns: []storage.Column{{Type: storage.TypeString, Value: "val1"}}}
	val5 := storage.Record{Columns: []storage.Column{{Type: storage.TypeString, Value: "val5"}}}
	val15 := storage.Record{Columns: []storage.Column{{Type: storage.TypeString, Value: "val15"}}}

	pageA.Lock()
	pageA.Keys = append(pageA.Keys, key1, key5)
	pageA.Values = append(pageA.Values, val1, val5)
	pageA.Header.KeyCount = 2
	pageA.Header.RightPageID = pageB.Header.PageID
	
	var buf bytes.Buffer
	key10.WriteTo(&buf)
	pageA.Header.HighKey = buf.Bytes()
	pageA.Unlock()

	// 3. Setup Page B
	// Keys: [15]
	pageB.Lock()
	pageB.Keys = append(pageB.Keys, key15)
	pageB.Values = append(pageB.Values, val15)
	pageB.Header.KeyCount = 1
	pageB.Header.HighKey = nil // Infinity
	pageB.Unlock()

	// 4. Force root to Page A
	tree.meta.RootPage = pageA.Header.PageID
	tree.pager.WritePageToFile(pageA.Header.PageID, pageA)
	tree.pager.WritePageToFile(pageB.Header.PageID, pageB)

	// 5. Search for key 15
	// It should go Root -> Page A -> (Move Right) -> Page B -> found!
	val, err := tree.Search(key15)
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if val.Columns[0].Value.(string) != "val15" {
		t.Errorf("Expected val15, got %v", val.Columns[0].Value)
	}

	// 6. Search for key 5 (should be in Page A)
	val, err = tree.Search(key5)
	if err != nil {
		t.Fatalf("Search for 5 failed: %v", err)
	}
	if val.Columns[0].Value.(string) != "val5" {
		t.Errorf("Expected val5, got %v", val.Columns[0].Value)
	}

	// 7. Search for key 20 (should be NOT found in Page B)
	key20 := storage.NewCompositeKey(storage.Column{Type: storage.TypeInt, Value: int64(20)})
	_, err = tree.Search(key20)
	if err == nil {
		t.Error("Expected error for non-existent key 20, but found it")
	}
}
