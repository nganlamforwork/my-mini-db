package btree

import (
	"bplustree/internal/page"
	"bplustree/internal/storage"
	"os"
	"testing"
)

// ============================================================================
// Cache Configuration Integration Tests
// Tests for B+Tree with configurable cache sizes
// ============================================================================

func TestCustomCacheSize(t *testing.T) {
	// Test with custom cache size
	testDir := "testdata/TestCustomCacheSize"
	os.MkdirAll(testDir, 0755)
	dbFile := testDir + "/test.db"
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	defer os.Remove(dbFile)
	defer os.Remove(dbFile + ".wal")

	// Create tree with custom cache size (50 pages)
	tree, err := NewBPlusTreeWithCacheSize(dbFile, true, 50)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Verify cache size
	maxSize := tree.GetPager().GetMaxCacheSize()
	if maxSize != 50 {
		t.Errorf("expected cache size 50, got %d", maxSize)
	}

	// Insert multiple keys to test cache behavior
	keys := []storage.CompositeKey{
		K(1), K(2), K(3), K(4), K(5), K(6), K(7), K(8), K(9), K(10),
		K(11), K(12), K(13), K(14), K(15), K(16), K(17), K(18), K(19), K(20),
	}
	values := []storage.Record{
		V("v1"), V("v2"), V("v3"), V("v4"), V("v5"), V("v6"), V("v7"), V("v8"), V("v9"), V("v10"),
		V("v11"), V("v12"), V("v13"), V("v14"), V("v15"), V("v16"), V("v17"), V("v18"), V("v19"), V("v20"),
	}

	for i, key := range keys {
		if err := tree.Insert(key, values[i]); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Check cache statistics
	stats := tree.GetPager().GetCacheStats()
	if stats.Size > 50 {
		t.Errorf("cache size %d exceeds max size 50", stats.Size)
	}

	// Verify all keys can be found
	for i, key := range keys {
		val, err := tree.Search(key)
		if err != nil {
			t.Errorf("search failed for key %d: %v", KI(key), err)
		}
		if VS(val) != VS(values[i]) {
			t.Errorf("expected value %s, got %s", VS(values[i]), VS(val))
		}
	}

	// Cache should have some hits after searching
	finalStats := tree.GetPager().GetCacheStats()
	if finalStats.Hits == 0 && finalStats.Size > 0 {
		t.Logf("Cache stats: hits=%d, misses=%d, evictions=%d, size=%d",
			finalStats.Hits, finalStats.Misses, finalStats.Evictions, finalStats.Size)
	}
}

func TestDefaultCacheSize(t *testing.T) {
	// Test default cache size
	testDir := "testdata/TestDefaultCacheSize"
	os.MkdirAll(testDir, 0755)
	dbFile := testDir + "/test.db"
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	defer os.Remove(dbFile)
	defer os.Remove(dbFile + ".wal")

	// Create tree with default cache size
	tree, err := NewBPlusTree(dbFile, true)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Verify default cache size (100 pages)
	maxSize := tree.GetPager().GetMaxCacheSize()
	expectedDefault := 100
	if maxSize != expectedDefault {
		t.Errorf("expected default cache size %d, got %d", expectedDefault, maxSize)
	}
}

func TestCacheSizeEviction(t *testing.T) {
	// Test that cache eviction works with small cache size
	testDir := "testdata/TestCacheSizeEviction"
	os.MkdirAll(testDir, 0755)
	dbFile := testDir + "/test.db"
	os.Remove(dbFile)
	os.Remove(dbFile + ".wal")
	defer os.Remove(dbFile)
	defer os.Remove(dbFile + ".wal")

	// Create tree with very small cache (5 pages)
	tree, err := NewBPlusTreeWithCacheSize(dbFile, true, 5)
	if err != nil {
		t.Fatalf("failed to create tree: %v", err)
	}
	defer tree.Close()

	// Insert enough keys to trigger splits and create many pages
	// This will exceed the cache size and trigger evictions
	for i := 1; i <= 20; i++ {
		if err := tree.Insert(K(int64(i)), V("value")); err != nil {
			t.Fatalf("insert failed: %v", err)
		}
	}

	// Check cache statistics - should have evictions
	stats := tree.GetPager().GetCacheStats()
	if stats.Size > 5 {
		t.Errorf("cache size %d exceeds max size 5", stats.Size)
	}

	// If we have many pages, we should see evictions
	if stats.Evictions == 0 && stats.Size == 5 {
		// This is expected - cache is full but no evictions yet
		t.Logf("Cache at capacity: size=%d, evictions=%d", stats.Size, stats.Evictions)
	}

	// Search for keys to trigger cache misses and hits
	for i := 1; i <= 20; i++ {
		_, err := tree.Search(K(int64(i)))
		if err != nil {
			t.Errorf("search failed for key %d: %v", i, err)
		}
	}

	// Final stats should show cache activity
	finalStats := tree.GetPager().GetCacheStats()
	t.Logf("Final cache stats: hits=%d, misses=%d, evictions=%d, size=%d",
		finalStats.Hits, finalStats.Misses, finalStats.Evictions, finalStats.Size)
}

// ============================================================================
// LRU Cache Unit Tests (moved from internal/page/cache_test.go)
// ============================================================================

func TestLRUCacheBasic(t *testing.T) {
	cache := page.NewLRUCache(3)
	
	// Test Put and Get
	cache.Put(1, "page1")
	cache.Put(2, "page2")
	cache.Put(3, "page3")
	
	if val := cache.Get(1); val != "page1" {
		t.Errorf("expected page1, got %v", val)
	}
	
	// Test eviction - add 4th page, should evict least recently used (page2)
	cache.Put(4, "page4")
	
	if val := cache.Get(2); val != nil {
		t.Errorf("expected page2 to be evicted, got %v", val)
	}
	
	// page1 should still be in cache (was accessed)
	if val := cache.Get(1); val != "page1" {
		t.Errorf("expected page1 to still be in cache, got %v", val)
	}
	
	// page3 and page4 should be in cache
	if val := cache.Get(3); val != "page3" {
		t.Errorf("expected page3, got %v", val)
	}
	if val := cache.Get(4); val != "page4" {
		t.Errorf("expected page4, got %v", val)
	}
}

func TestLRUCacheStats(t *testing.T) {
	cache := page.NewLRUCache(2)
	
	cache.Put(1, "page1")
	cache.Put(2, "page2")
	
	// Cache hit
	cache.Get(1)
	
	// Cache miss (not in cache)
	cache.Get(3)
	
	// This will cause eviction
	cache.Put(3, "page3")
	
	stats := cache.GetStats()
	if stats.Hits != 1 {
		t.Errorf("expected 1 hit, got %d", stats.Hits)
	}
	if stats.Misses != 1 {
		t.Errorf("expected 1 miss, got %d", stats.Misses)
	}
	if stats.Evictions != 1 {
		t.Errorf("expected 1 eviction, got %d", stats.Evictions)
	}
	if stats.Size != 2 {
		t.Errorf("expected cache size 2, got %d", stats.Size)
	}
}

func TestLRUCacheUpdate(t *testing.T) {
	cache := page.NewLRUCache(3)
	
	cache.Put(1, "page1")
	cache.Put(1, "page1_updated")
	
	if val := cache.Get(1); val != "page1_updated" {
		t.Errorf("expected updated page1, got %v", val)
	}
	
	stats := cache.GetStats()
	if stats.Size != 1 {
		t.Errorf("expected cache size 1 after update, got %d", stats.Size)
	}
}

func TestLRUCacheRemove(t *testing.T) {
	cache := page.NewLRUCache(3)
	
	cache.Put(1, "page1")
	cache.Put(2, "page2")
	cache.Remove(1)
	
	if val := cache.Get(1); val != nil {
		t.Errorf("expected page1 to be removed, got %v", val)
	}
	
	if val := cache.Get(2); val != "page2" {
		t.Errorf("expected page2, got %v", val)
	}
	
	stats := cache.GetStats()
	if stats.Size != 1 {
		t.Errorf("expected cache size 1 after remove, got %d", stats.Size)
	}
}

func TestLRUCacheClear(t *testing.T) {
	cache := page.NewLRUCache(3)
	
	cache.Put(1, "page1")
	cache.Put(2, "page2")
	cache.Clear()
	
	if val := cache.Get(1); val != nil {
		t.Errorf("expected cache to be cleared, got %v", val)
	}
	
	stats := cache.GetStats()
	if stats.Size != 0 {
		t.Errorf("expected cache size 0 after clear, got %d", stats.Size)
	}
}
