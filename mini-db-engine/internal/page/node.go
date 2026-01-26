package page

import (
	"bplustree/internal/storage"
	"sync"
)

// Type aliases for composite keys and structured rows (exported for convenience)
type KeyType = storage.CompositeKey
type ValueType = storage.Record

const (
	PageTypeMeta     PageType = 0
	PageTypeInternal PageType = 1
	PageTypeLeaf     PageType = 2
)
 
// Page interface for thread-safe access to pages
type Page interface {
	RLock()
	RUnlock()
	Lock()
	Unlock()
	GetHeader() *PageHeader
}

var _ Page = (*InternalPage)(nil)
var _ Page = (*LeafPage)(nil)

// Maximum number of children in an internal node (m = 4)
// So leaf nodes can have up to ORDER-1 keys
const ORDER = 4

type InternalPage struct {
	Header PageHeader
	mu     sync.RWMutex		// For thread-safe access

	// payload (in-memory view)
	Keys     []KeyType 
	// Store page IDs, not the pages themselves
	Children []uint64 		
}

// Implements Page interface
func (p *InternalPage) RLock()               { p.mu.RLock() }
func (p *InternalPage) RUnlock()             { p.mu.RUnlock() }
func (p *InternalPage) Lock()                { p.mu.Lock() }
func (p *InternalPage) Unlock()              { p.mu.Unlock() }
func (p *InternalPage) GetHeader() *PageHeader { return &p.Header }

type LeafPage struct {
	Header PageHeader
	mu     sync.RWMutex		// For thread-safe access

	// payload (in-memory view)
	Keys   []KeyType   
	// Store value pairs
	Values []ValueType 
}

// Implements Page interface
func (p *LeafPage) RLock()               { p.mu.RLock() }
func (p *LeafPage) RUnlock()             { p.mu.RUnlock() }
func (p *LeafPage) Lock()                { p.mu.Lock() }
func (p *LeafPage) Unlock()              { p.mu.Unlock() }
func (p *LeafPage) GetHeader() *PageHeader { return &p.Header }

// NewLeafPage function used for: Constructing an in-memory leaf page with initialized slices and header metadata for B+Tree leaf nodes.
func NewLeafPage(pageID uint64) *LeafPage {
	return &LeafPage{
		Header: PageHeader{
			PageID:   pageID,
			PageType: PageTypeLeaf,
			FreeSpace: uint16(DefaultPageSize - PageHeaderSize),
		},
		Keys:   make([]KeyType, 0, ORDER-1),
		Values: make([]ValueType, 0, ORDER-1),
	}
}

// NewInternalPage function used for: Constructing an in-memory internal node with pre-sized slices for keys and child pointers.
func NewInternalPage(pageID uint64) *InternalPage {
	return &InternalPage{
		Header: PageHeader{
			PageID:   pageID,
			PageType: PageTypeInternal,
			FreeSpace: uint16(DefaultPageSize - PageHeaderSize),
		},
		Keys:     make([]KeyType, 0, ORDER-1),
		Children: make([]uint64, 0, ORDER),
	}
}
