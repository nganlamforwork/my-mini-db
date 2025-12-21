package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
)

// PageManager is a simple file-backed page allocator and cache.
// Pages are allocated sequentially and stored in fixed-size slots
// inside a single database file (`minidb.db`). The PageManager also
// keeps an in-memory map for quick access and updates.
type PageManager struct {
	pages    map[uint64]interface{}
	next     uint64
	file     *os.File
	pageSize int
}

// NewPageManager creates or truncates a file-backed PageManager using
// DefaultPageSize as the page size. The file is `minidb.db` in the
// current working directory. This keeps the API compatible with
// existing callers (no arguments).
// NewPageManager opens the default `minidb.db` without truncation.
// For tests, prefer NewPageManagerWithFile to get per-test DB files.
func NewPageManager() *PageManager {
	return NewPageManagerWithFile("minidb.db", false)
}

// NewPageManagerWithFile opens or creates the given filename. If
// truncate==true the file will be truncated (fresh DB). Otherwise
// an existing DB will be opened and the meta page loaded if present.
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
		pages:    make(map[uint64]interface{}),
		file:     f,
		pageSize: DefaultPageSize,
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
		pm.pages[1] = meta
		if err := pm.writePageToFile(1, meta); err != nil {
			panic(err)
		}
		pm.next = 2
	} else {
		pgCount := int(fi.Size()) / pm.pageSize
		if pgCount >= 1 {
			p, err := pm.readPageFromFile(1)
			if err == nil {
				if m, ok := p.(*MetaPage); ok {
					pm.pages[1] = m
				}
			}
		}
		pm.next = uint64(pgCount) + 1
	}

	return pm
}

// WriteMeta persists the given meta page into slot 1 and updates cache.
func (pm *PageManager) WriteMeta(m *MetaPage) error {
	m.Header.PageID = 1
	m.Header.PageType = PageTypeMeta
	pm.pages[1] = m
	return pm.writePageToFile(1, m)
}

// ReadMeta loads the meta page from disk (or cache) and returns it.
func (pm *PageManager) ReadMeta() (*MetaPage, error) {
	if p, ok := pm.pages[1]; ok {
		if m, ok2 := p.(*MetaPage); ok2 {
			return m, nil
		}
	}
	p, err := pm.readPageFromFile(1)
	if err != nil {
		return nil, err
	}
	m, ok := p.(*MetaPage)
	if !ok {
		return nil, fmt.Errorf("page 1 is not a MetaPage")
	}
	pm.pages[1] = m
	return m, nil
}

// allocateID returns the next page id and increments the counter.
func (pm *PageManager) allocateID() uint64 {
	id := pm.next
	pm.next++
	return id
}

// NewLeaf allocates, registers, and persists a new leaf page.
func (pm *PageManager) NewLeaf() *LeafPage {
	id := pm.allocateID()
	p := newLeafPage(id)
	pm.pages[id] = p
	if err := pm.writePageToFile(id, p); err != nil {
		panic(err)
	}
	return p
}

// NewInternal allocates, registers, and persists a new internal page.
func (pm *PageManager) NewInternal() *InternalPage {
	id := pm.allocateID()
	p := newInternalPage(id)
	pm.pages[id] = p
	if err := pm.writePageToFile(id, p); err != nil {
		panic(err)
	}
	return p
}

// Get returns a page by id. If the page is not cached in memory, it
// attempts to read it from the file and cache it.
func (pm *PageManager) Get(pageID uint64) interface{} {
	if pageID == 0 {
		return nil
	}

	if page, ok := pm.pages[pageID]; ok {
		return page
	}

	// try to load from file
	page, err := pm.readPageFromFile(pageID)
	if err != nil {
		if err == io.EOF {
			return nil
		}
		panic(err)
	}
	pm.pages[pageID] = page
	return page
}

// writePageToFile serializes the given page and writes it into the
// file slot corresponding to pageID. The serialized page must not
// exceed pageSize.
func (pm *PageManager) writePageToFile(pageID uint64, page interface{}) error {
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
	// ensure data flushed
	if err := pm.file.Sync(); err != nil {
		return err
	}
	return nil
}

// readPageFromFile reads a page's bytes from disk and deserializes it
// into the appropriate page struct based on the PageHeader.PageType.
func (pm *PageManager) readPageFromFile(pageID uint64) (interface{}, error) {
	offset := int64((pageID - 1) * uint64(pm.pageSize))
	data := make([]byte, pm.pageSize)
	n, err := pm.file.ReadAt(data, offset)
	if err != nil && err != io.EOF {
		return nil, err
	}
	if n == 0 {
		return nil, io.EOF
	}

	r := bytes.NewReader(data)
	// read header first to know type
	var hdr PageHeader
	if err := hdr.ReadFromBuffer(r); err != nil {
		return nil, err
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
		return nil, fmt.Errorf("unknown page type %d for page %d", hdr.PageType, pageID)
	}
}

// Close closes the underlying file. Call when application exits.
func (pm *PageManager) Close() error {
	if pm.file != nil {
		return pm.file.Close()
	}
	return nil
}
