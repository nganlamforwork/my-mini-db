package page

import (
	"sync"
	"bplustree/internal/storage"
)

// Type aliases for composite keys and structured rows (exported for convenience)
type KeyType = storage.CompositeKey
type ValueType = storage.Record

const (
	PageTypeMeta     PageType = 0
	PageTypeInternal PageType = 1
	PageTypeLeaf     PageType = 2
)

// Maximum number of children in an internal node (m = 4)
// So leaf nodes can have up to ORDER-1 keys
const ORDER = 4

type InternalPage struct {
	Mu       sync.RWMutex // Phase 2: Fine-grained locking for concurrent reads (exported for btree package)
	Header PageHeader

	// payload (in-memory view)
	Keys     []KeyType 
	// Store page IDs, not the pages themselves
	Children []uint64 		
}

type LeafPage struct {
	Mu       sync.RWMutex // Phase 2: Fine-grained locking for concurrent reads (exported for btree package)
	Header PageHeader

	// payload (in-memory view)
	Keys   []KeyType   
	// Store value pairs
	Values []ValueType 
}

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
