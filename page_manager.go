package main

// PageManager is an in-memory page allocator used by tests and by
// the B+Tree during in-memory operations. It provides simple
// lifecycle management for pages (create and lookup) without
// persisting to disk.
type PageManager struct {
	pages map[uint64]interface{}
	next  uint64
}

// NewPageManager returns a fresh PageManager with its page id
// counter initialized. This is intentionally lightweight and
// suitable for unit tests and early-stage in-memory trees.
func NewPageManager() *PageManager {
	return &PageManager{
		pages: make(map[uint64]interface{}),
		next:  1,
	}
}

// NewLeaf allocates and registers a new leaf page and returns it.
// The returned page is already tracked in the manager's map so
// callers can rely on retrieving it via `Get` immediately.
func (pm *PageManager) NewLeaf() *LeafPage {
	id := pm.next
	pm.next++
	p := newLeafPage(id)
	pm.pages[id] = p
	return p
}

// NewInternal allocates and registers a new internal page.
func (pm *PageManager) NewInternal() *InternalPage {
	id := pm.next
	pm.next++
	p := newInternalPage(id)
	pm.pages[id] = p
	return p
}

// Get returns a page by id or nil if not present. The returned
// value must be type-asserted by the caller to the expected page
// type (*LeafPage or *InternalPage).
func (pm *PageManager) Get(pageID uint64) interface{} {
	page, exists := pm.pages[pageID]
	if !exists {
		return nil
	}
	return page
}
