package page

import "bplustree/internal/storage"

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
	Header PageHeader

	// payload (in-memory view)
	Keys     []KeyType 
	// Store page IDs, not the pages themselves
	Children []uint64 		
}

type LeafPage struct {
	Header PageHeader

	// payload (in-memory view)
	Keys   []KeyType   
	// Store value pairs
	Values []ValueType 
}

// -----------------------------
// Node creation helpers
// -----------------------------

// NewLeafPage constructs an in-memory leaf page with initialized
// internal slices and header metadata. It does not register the
// page with any pager — callers should use PageManager to allocate
// and track pages when persistence or shared lookup is required.
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

// NewInternalPage constructs an in-memory internal node with
// pre-sized slices for keys and child pointers. The child slice
// capacity is ORDER because an internal node with m children has
// up to m-1 keys.
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
