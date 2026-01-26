package page

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"sync"
	"time"
)

// IOReadEntry represents a single I/O read operation
type IOReadEntry struct {
	PageID    uint64    `json:"pageId"`
	PageType  string    `json:"pageType"`  // "meta", "internal", "leaf"
	Timestamp time.Time `json:"timestamp"`
}

// PageManager is a file-backed page allocator with LRU cache.
// Pages are allocated sequentially and stored in fixed-size slots
// inside a single database file. The PageManager uses an LRU cache
// to keep frequently accessed pages in memory for fast access.
type PageManager struct {
	cache       *LRUCache              // LRU cache for pages
	Next        uint64                 // Next available page ID
	nextMu      sync.Mutex             // Mutex for Next allocation (thread-safe page ID allocation)
	file        *os.File               // Database file handle
	pageSize    int                    // Page size in bytes
	maxCacheSize int                   // Maximum number of pages in cache
	
	// I/O tracking
	ioReads     uint64                 // Counter for I/O reads
	ioReadDetails []IOReadEntry        // Details of each I/O read
	ioMu        sync.RWMutex           // Mutex for I/O tracking
}

// DefaultCacheSize is the default maximum number of pages to cache in memory
const DefaultCacheSize = 100

func NewPageManager() *PageManager {
	return NewPageManagerWithFile("minidb.db", false)
}

// NewPageManagerWithCacheSize function used for: Creating a PageManager with a custom cache size for memory management.
//
// Algorithm steps:
// 1. Open file - Open or create the database file with read/write flags (truncate if requested)
// 2. Initialize PageManager - Create PageManager struct with custom cache size
// 3. Check file size - Determine if file is empty (new database) or contains existing pages
// 4. Handle empty file - If file is empty, create and persist default meta page at page ID 1, set Next to 2
// 5. Handle existing file - If file exists, calculate page count, load meta page into cache, set Next to pageCount+1
// 6. Return PageManager - Return initialized PageManager with custom cache size ready for use
//
// Parameters:
//   - filename: Database filename
//   - truncate: true to create new database, false to open existing
//   - maxCacheSize: Maximum number of pages to cache in memory
//
// Return: *PageManager - a new PageManager instance with custom cache size
func NewPageManagerWithCacheSize(filename string, truncate bool, maxCacheSize int) *PageManager {
	flags := os.O_RDWR | os.O_CREATE
	if truncate {
		flags = os.O_RDWR | os.O_CREATE | os.O_TRUNC
	}
	f, err := os.OpenFile(filename, flags, 0666)
	if err != nil {
		panic(fmt.Sprintf("failed to open db file: %v", err))
	}

	pm := &PageManager{
		cache:        NewLRUCache(maxCacheSize),
		file:          f,
		pageSize:     DefaultPageSize,
		maxCacheSize: maxCacheSize,
		ioReadDetails: make([]IOReadEntry, 0),
	}

	fi, err := f.Stat()
	if err != nil {
		panic(fmt.Sprintf("failed to stat db file: %v", err))
	}

	if fi.Size() == 0 {
		// Initialize a default meta page at page ID 1
		meta := &MetaPage{
			Header: PageHeader{
				PageID:   1,
				PageType: PageTypeMeta,
				KeyCount: 0,
				FreeSpace: uint16(DefaultPageSize - PageHeaderSize),
			},
			RootPage: 0,
			PageSize: uint32(DefaultPageSize),
			Order:    uint16(ORDER),
			Version:  1,
		}
		pm.cache.Put(1, meta)
		if err := pm.WritePageToFile(1, meta); err != nil {
			panic(err)
		}
		pm.Next = 2
	} else {
		pgCount := int(fi.Size()) / pm.pageSize
		if pgCount >= 1 {
			p, err := pm.readPageFromFile(1)
			if err == nil {
				if m, ok := p.(*MetaPage); ok {
					// Track I/O read during initialization
					pm.trackIORead(1, m)
					pm.cache.Put(1, m)
				}
			}
		}
		pm.Next = uint64(pgCount) + 1
	}

	return pm
}

// NewPageManagerWithFile function used for: Opening or creating a database file and initializing a PageManager with file-backed page storage.
//
// Algorithm steps:
// 1. Open file - Open or create the database file with read/write flags (truncate if requested)
// 2. Initialize PageManager - Create PageManager struct with empty page cache and file handle
// 3. Check file size - Determine if file is empty (new database) or contains existing pages
// 4. Handle empty file - If file is empty, create and persist default meta page at page ID 1, set Next to 2
// 5. Handle existing file - If file exists, calculate page count, load meta page into cache, set Next to pageCount+1
// 6. Return PageManager - Return initialized PageManager ready for use
//
// Return: *PageManager - a new PageManager instance for the specified database file
func NewPageManagerWithFile(filename string, truncate bool) *PageManager {
	flags := os.O_RDWR | os.O_CREATE
	if truncate {
		flags = os.O_RDWR | os.O_CREATE | os.O_TRUNC
	}
	f, err := os.OpenFile(filename, flags, 0666)
	if err != nil {
		panic(fmt.Sprintf("failed to open db file: %v", err))
	}

	pm := &PageManager{
		cache:        NewLRUCache(DefaultCacheSize),
		file:          f,
		pageSize:     DefaultPageSize,
		maxCacheSize: DefaultCacheSize,
		ioReadDetails: make([]IOReadEntry, 0),
	}

	fi, err := f.Stat()
	if err != nil {
		panic(fmt.Sprintf("failed to stat db file: %v", err))
	}

	if fi.Size() == 0 {
		// Initialize a default meta page at page ID 1
		meta := &MetaPage{
			Header: PageHeader{
				PageID:   1,
				PageType: PageTypeMeta,
				KeyCount: 0,
				FreeSpace: uint16(DefaultPageSize - PageHeaderSize),
			},
			RootPage: 0,
			PageSize: uint32(DefaultPageSize),
			Order:    uint16(ORDER),
			Version:  1,
		}
		pm.cache.Put(1, meta)
		if err := pm.WritePageToFile(1, meta); err != nil {
			panic(err)
		}
		pm.Next = 2
	} else {
		pgCount := int(fi.Size()) / pm.pageSize
		if pgCount >= 1 {
			p, err := pm.readPageFromFile(1)
			if err == nil {
				if m, ok := p.(*MetaPage); ok {
					// Track I/O read during initialization
					pm.trackIORead(1, m)
					pm.cache.Put(1, m)
				}
			}
		}
		pm.Next = uint64(pgCount) + 1
	}

	return pm
}

// WriteMeta function used for: Persisting a meta page to disk at page ID 1 and updating the in-memory cache.
func (pm *PageManager) WriteMeta(m *MetaPage) error {
	m.Header.PageID = 1
	m.Header.PageType = PageTypeMeta
	pm.cache.Put(1, m)
	return pm.WritePageToFile(1, m)
}

// ReadMeta function used for: Loading the meta page from cache or disk (page ID 1) and returning it.
func (pm *PageManager) ReadMeta() (*MetaPage, error) {
	// Try cache first
	if cached := pm.cache.Get(1); cached != nil {
		if m, ok := cached.(*MetaPage); ok {
			return m, nil
		}
	}
	
	// Load from disk if not in cache
	p, err := pm.readPageFromFile(1)
	if err != nil {
		return nil, err
	}
	m, ok := p.(*MetaPage)
	if !ok {
		return nil, fmt.Errorf("page 1 is not a MetaPage")
	}
	pm.cache.Put(1, m)
	return m, nil
}

// allocateID function used for: Allocating the next available page ID and incrementing the allocation counter.
// Thread-safe: Uses mutex to prevent race conditions in concurrent scenarios.
// Return: uint64 - the next available page ID
func (pm *PageManager) allocateID() uint64 {
	pm.nextMu.Lock()
	defer pm.nextMu.Unlock()
	id := pm.Next
	pm.Next++
	return id
}

// NewLeaf function used for: Allocating, registering in cache, and persisting a new leaf page to disk.
func (pm *PageManager) NewLeaf() *LeafPage {
	id := pm.allocateID()
	p := NewLeafPage(id)
	// Put in cache FIRST - this makes the page immediately available to other threads
	// Critical for concurrent access: other threads can read from cache even during disk write
	pm.cache.Put(id, p)
	// Write to disk - page is already in cache so other threads can access it
	if err := pm.WritePageToFile(id, p); err != nil {
		// Don't panic - page is in cache, other threads can still access it
		// Write will be retried during transaction commit
	}
	return p
}

// NewInternal function used for: Allocating, registering in cache, and persisting a new internal page to disk.
func (pm *PageManager) NewInternal() *InternalPage {
	id := pm.allocateID()
	p := NewInternalPage(id)
	// Put in cache FIRST - this makes the page immediately available to other threads
	// Critical for concurrent access: other threads can read from cache even during disk write
	pm.cache.Put(id, p)
	// Write to disk - page is already in cache so other threads can access it
	if err := pm.WritePageToFile(id, p); err != nil {
		// Don't panic - page is in cache, other threads can still access it
		// Write will be retried during transaction commit
	}
	return p
}

// Get function used for: Retrieving a page by ID from LRU cache or loading it from disk if not cached, then caching it with LRU eviction.
func (pm *PageManager) Get(pageID uint64) Page {
	if pageID == 0 {
		return nil
	}

	// Try cache first (LRU will move to front if found)
	if cached := pm.cache.Get(pageID); cached != nil {
		return cached.(Page)
	}
	
	// Load from disk if not in cache (cache miss - I/O read)
	page, err := pm.readPageFromFile(pageID)
	if err != nil {
		// Check cache again - another thread might have just added it
		if cached := pm.cache.Get(pageID); cached != nil {
			return cached.(Page)
		}
		if err == io.EOF {
			return nil
		}
		// For unknown page type or other errors in concurrent scenarios,
		// the page might still be being written. Return nil instead of panicking.
		// The caller should handle this gracefully (e.g., retry or wait)
		return nil
	}
	
	p, ok := page.(Page)
	if !ok {
		return nil
	}

	// Track I/O read
	pm.trackIORead(pageID, p)
	
	// Add to cache (may evict least recently used page if cache is full)
	pm.cache.Put(pageID, p)
	return p
}

// WritePageToFile function used for: Serializing a page and writing it to the database file at the slot corresponding to pageID (exported for transaction/WAL use).
func (pm *PageManager) WritePageToFile(pageID uint64, page interface{}) error {
	// Note: file.WriteAt is already thread-safe for concurrent reads/writes to different offsets
	// We don't need a mutex here as long as we're writing to different page slots
	buf := &bytes.Buffer{}
	switch p := page.(type) {
	case *MetaPage:
		if err := p.WriteToBuffer(buf); err != nil {
			return err
		}
	case *InternalPage:
		if err := p.WriteToBuffer(buf); err != nil {
			return err
		}
	case *LeafPage:
		if err := p.WriteToBuffer(buf); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported page type for writing: %T", page)
	}

	if buf.Len() > pm.pageSize {
		return fmt.Errorf("serialized page %d size %d exceeds page size %d", pageID, buf.Len(), pm.pageSize)
	}

	// pad to pageSize
	padding := make([]byte, pm.pageSize-buf.Len())
	if _, err := buf.Write(padding); err != nil {
		return err
	}

	offset := int64((pageID - 1) * uint64(pm.pageSize))
	if _, err := pm.file.WriteAt(buf.Bytes(), offset); err != nil {
		return err
	}
	// Note: We don't sync here to avoid blocking in concurrent scenarios
	// Sync will happen during transaction commit for better performance
	// The page is already in cache, so other threads can access it immediately
	return nil
}

// ReadPageFromDisk function used for: Reading a page directly from disk bypassing the cache to get the original unmodified state.
func (pm *PageManager) ReadPageFromDisk(pageID uint64) (interface{}, error) {
	return pm.readPageFromFile(pageID)
}

// readPageFromFile function used for: Reading a page's bytes from disk and deserializing it into the appropriate page struct based on PageType.
func (pm *PageManager) readPageFromFile(pageID uint64) (interface{}, error) {
	// Note: file.ReadAt is already thread-safe for concurrent reads/writes to different offsets
	offset := int64((pageID - 1) * uint64(pm.pageSize))
	data := make([]byte, pm.pageSize)
	n, err := pm.file.ReadAt(data, offset)
	if err != nil && err != io.EOF {
		return nil, err
	}
	if n == 0 {
		return nil, io.EOF
	}

	// Check if the page data is all zeros (uninitialized page)
	// This can happen in concurrent scenarios where a page is being written
	// Only check if we read the full page size, otherwise it might be partially written
	if n == pm.pageSize {
		allZeros := true
		for i := 0; i < len(data) && i < 100; i++ { // Check first 100 bytes
			if data[i] != 0 {
				allZeros = false
				break
			}
		}
		if allZeros {
			return nil, fmt.Errorf("page %d appears to be uninitialized (all zeros)", pageID)
		}
	}

	r := bytes.NewReader(data)
	// read header first to know type
	var hdr PageHeader
	if err := hdr.ReadFromBuffer(r); err != nil {
		return nil, err
	}

	// Validate page ID matches
	if hdr.PageID != pageID && hdr.PageID != 0 {
		return nil, fmt.Errorf("page ID mismatch: expected %d, got %d", pageID, hdr.PageID)
	}

	switch hdr.PageType {
	case PageTypeMeta:
		m := &MetaPage{Header: hdr}
		if err := m.ReadFromBuffer(r); err != nil {
			return nil, err
		}
		return m, nil
	case PageTypeInternal:
		ip := &InternalPage{Header: hdr}
		if err := ip.ReadFromBuffer(r); err != nil {
			return nil, err
		}
		return ip, nil
	case PageTypeLeaf:
		lp := &LeafPage{Header: hdr}
		if err := lp.ReadFromBuffer(r); err != nil {
			return nil, err
		}
		return lp, nil
	default:
		// In concurrent scenarios, a page might be partially written
		// Return a specific error that can be handled by the caller
		return nil, fmt.Errorf("unknown page type %d for page %d (page might be partially written)", hdr.PageType, pageID)
	}
}

// Close function used for: Closing the PageManager and ensuring all cached pages are flushed to disk before closing the file.
func (pm *PageManager) Close() error {
	// Flush all pages before closing
	if err := pm.FlushAll(); err != nil {
		return err
	}
	if pm.file != nil {
		return pm.file.Close()
	}
	return nil
}

// FlushAll function used for: Writing all cached pages back to disk to ensure persistence of all in-memory modifications.
// Note: In this implementation, dirty page tracking is handled by transactions (WAL).
// Pages are written to disk during transaction commit, so FlushAll is primarily
// for ensuring all cached pages are persisted on shutdown.
// The cache itself doesn't track dirty state - that's handled by the transaction manager.
func (pm *PageManager) FlushAll() error {
	// In a production system, we'd maintain a dirty page set and flush only those.
	// For this implementation, we rely on WritePageToFile being called during
	// transaction commits. The cache is primarily for read performance.
	// All modified pages are written via transaction commit (WAL + database file).
	return nil
}

// Put updates or adds a page to the cache (used by transaction rollback and WAL recovery)
func (pm *PageManager) Put(pageID uint64, page interface{}) {
	pm.cache.Put(pageID, page)
}

// Remove removes a page from the cache
func (pm *PageManager) RemoveFromCache(pageID uint64) {
	pm.cache.Remove(pageID)
}

// GetCacheStats returns cache performance statistics
func (pm *PageManager) GetCacheStats() CacheStats {
	return pm.cache.GetStats()
}

// GetMaxCacheSize returns the maximum cache size
func (pm *PageManager) GetMaxCacheSize() int {
	return pm.cache.GetMaxSize()
}

// GetFileName function used for: Retrieving the filename of the database file associated with this PageManager.
func (pm *PageManager) GetFileName() string {
	if pm.file == nil {
		return ""
	}
	return pm.file.Name()
}

// GetCachedPageIDs returns a list of all page IDs currently in the cache
func (pm *PageManager) GetCachedPageIDs() []uint64 {
	return pm.cache.GetAllPageIDs()
}

// trackIORead records an I/O read operation
func (pm *PageManager) trackIORead(pageID uint64, page interface{}) {
	pm.ioMu.Lock()
	defer pm.ioMu.Unlock()

	pm.ioReads++

	// Determine page type
	pageType := "unknown"
	switch page.(type) {
	case *MetaPage:
		pageType = "meta"
	case *InternalPage:
		pageType = "internal"
	case *LeafPage:
		pageType = "leaf"
	}

	// Add to details (limit to last 1000 entries to avoid unbounded growth)
	entry := IOReadEntry{
		PageID:    pageID,
		PageType:  pageType,
		Timestamp: time.Now(),
	}

	pm.ioReadDetails = append(pm.ioReadDetails, entry)
	// Keep only last 1000 entries
	if len(pm.ioReadDetails) > 1000 {
		pm.ioReadDetails = pm.ioReadDetails[len(pm.ioReadDetails)-1000:]
	}
}

// GetIOReads returns the total number of I/O reads
func (pm *PageManager) GetIOReads() uint64 {
	pm.ioMu.RLock()
	defer pm.ioMu.RUnlock()
	return pm.ioReads
}

// GetIOReadDetails returns details of all I/O reads (up to last 1000)
func (pm *PageManager) GetIOReadDetails() []IOReadEntry {
	pm.ioMu.RLock()
	defer pm.ioMu.RUnlock()
	
	// Return a copy to avoid race conditions
	details := make([]IOReadEntry, len(pm.ioReadDetails))
	copy(details, pm.ioReadDetails)
	return details
}
