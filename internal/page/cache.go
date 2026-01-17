package page

import (
	"container/list"
	"sync"
)

// CacheEntry represents a single entry in the LRU cache
type CacheEntry struct {
	pageID uint64
	page   interface{}
}

// LRUCache implements a thread-safe LRU (Least Recently Used) cache for pages
type LRUCache struct {
	mu          sync.RWMutex
	maxSize     int
	cache       map[uint64]*list.Element // Maps pageID to list element
	lruList     *list.List               // Doubly-linked list for LRU ordering
	stats       CacheStats
}

// CacheStats tracks cache performance metrics
type CacheStats struct {
	Hits       uint64 // Number of cache hits
	Misses     uint64 // Number of cache misses
	Evictions  uint64 // Number of pages evicted
	Size       int    // Current cache size
}

// NewLRUCache creates a new LRU cache with the specified maximum size
func NewLRUCache(maxSize int) *LRUCache {
	if maxSize <= 0 {
		maxSize = 100 // Default cache size
	}
	return &LRUCache{
		maxSize: maxSize,
		cache:   make(map[uint64]*list.Element),
		lruList: list.New(),
		stats:   CacheStats{Size: 0},
	}
}

// Get retrieves a page from the cache, moving it to the front (most recently used)
// Returns the page if found, nil otherwise
func (c *LRUCache) Get(pageID uint64) interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[pageID]; ok {
		// Move to front (most recently used)
		c.lruList.MoveToFront(elem)
		c.stats.Hits++
		return elem.Value.(*CacheEntry).page
	}

	c.stats.Misses++
	return nil
}

// Put adds or updates a page in the cache
// If cache is full, evicts the least recently used page
func (c *LRUCache) Put(pageID uint64, page interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// If page already exists, update it and move to front
	if elem, ok := c.cache[pageID]; ok {
		elem.Value.(*CacheEntry).page = page
		c.lruList.MoveToFront(elem)
		return
	}

	// If cache is full, evict least recently used (back of list)
	if c.stats.Size >= c.maxSize {
		back := c.lruList.Back()
		if back != nil {
			evictedEntry := back.Value.(*CacheEntry)
			delete(c.cache, evictedEntry.pageID)
			c.lruList.Remove(back)
			c.stats.Evictions++
			c.stats.Size--
		}
	}

	// Add new entry to front
	entry := &CacheEntry{pageID: pageID, page: page}
	elem := c.lruList.PushFront(entry)
	c.cache[pageID] = elem
	c.stats.Size++
}

// Remove removes a page from the cache
func (c *LRUCache) Remove(pageID uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[pageID]; ok {
		delete(c.cache, pageID)
		c.lruList.Remove(elem)
		c.stats.Size--
	}
}

// Clear removes all entries from the cache
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[uint64]*list.Element)
	c.lruList = list.New()
	c.stats.Size = 0
}

// GetStats returns current cache statistics
func (c *LRUCache) GetStats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return CacheStats{
		Hits:      c.stats.Hits,
		Misses:    c.stats.Misses,
		Evictions: c.stats.Evictions,
		Size:      c.stats.Size,
	}
}

// GetMaxSize returns the maximum cache size
func (c *LRUCache) GetMaxSize() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.maxSize
}

// GetAllPageIDs returns a list of all page IDs currently in the cache
func (c *LRUCache) GetAllPageIDs() []uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	pageIDs := make([]uint64, 0, len(c.cache))
	for pageID := range c.cache {
		pageIDs = append(pageIDs, pageID)
	}
	return pageIDs
}
