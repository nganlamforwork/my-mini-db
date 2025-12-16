package main

type KeyType int
type ValueType string

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
	keys     []KeyType
	children []uint64 // PageID
}

type LeafPage struct {
	Header PageHeader

	// payload (in-memory view)
	keys   []KeyType
	values []ValueType
}

// -----------------------------
// Node creation helpers
// -----------------------------

// newLeafPage constructs an in-memory leaf page with initialized
// internal slices and header metadata. It does not register the
// page with any pager — callers should use PageManager to allocate
// and track pages when persistence or shared lookup is required.
func newLeafPage(pageID uint64) *LeafPage {
	return &LeafPage{
		Header: PageHeader{
			PageID:   pageID,
			PageType: PageTypeLeaf,
		},
		keys:   make([]KeyType, 0, ORDER-1),
		values: make([]ValueType, 0, ORDER-1),
	}
}

// newInternalPage constructs an in-memory internal node with
// pre-sized slices for keys and child pointers. The child slice
// capacity is ORDER because an internal node with m children has
// up to m-1 keys.
func newInternalPage(pageID uint64) *InternalPage {
	return &InternalPage{
		Header: PageHeader{
			PageID:   pageID,
			PageType: PageTypeInternal,
		},
		keys:     make([]KeyType, 0, ORDER-1),
		children: make([]uint64, 0, ORDER),
	}
}
