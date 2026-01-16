package page

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
	Pages    map[uint64]interface{} 
	Next     uint64                 
	file     *os.File
	pageSize int
}

func NewPageManager() *PageManager {
	return NewPageManagerWithFile("minidb.db", false)
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
		Pages:    make(map[uint64]interface{}),
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
		pm.Pages[1] = meta
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
					pm.Pages[1] = m
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
	pm.Pages[1] = m
	return pm.WritePageToFile(1, m)
}

// ReadMeta function used for: Loading the meta page from cache or disk (page ID 1) and returning it.
func (pm *PageManager) ReadMeta() (*MetaPage, error) {
	if p, ok := pm.Pages[1]; ok {
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
	pm.Pages[1] = m
	return m, nil
}

// allocateID function used for: Allocating the next available page ID and incrementing the allocation counter.
// Return: uint64 - the next available page ID
func (pm *PageManager) allocateID() uint64 {
	id := pm.Next
	pm.Next++
	return id
}

// NewLeaf function used for: Allocating, registering in cache, and persisting a new leaf page to disk.
func (pm *PageManager) NewLeaf() *LeafPage {
	id := pm.allocateID()
	p := NewLeafPage(id)
	pm.Pages[id] = p
	if err := pm.WritePageToFile(id, p); err != nil {
		panic(err)
	}
	return p
}

// NewInternal function used for: Allocating, registering in cache, and persisting a new internal page to disk.
func (pm *PageManager) NewInternal() *InternalPage {
	id := pm.allocateID()
	p := NewInternalPage(id)
	pm.Pages[id] = p
	if err := pm.WritePageToFile(id, p); err != nil {
		panic(err)
	}
	return p
}

// Get function used for: Retrieving a page by ID from cache or loading it from disk if not cached, then caching it in the map.
func (pm *PageManager) Get(pageID uint64) interface{} {
	if pageID == 0 {
		return nil
	}

	if page, ok := pm.Pages[pageID]; ok {
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
	pm.Pages[pageID] = page
	return page
}

// WritePageToFile function used for: Serializing a page and writing it to the database file at the slot corresponding to pageID (exported for transaction/WAL use).
func (pm *PageManager) WritePageToFile(pageID uint64, page interface{}) error {
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

// ReadPageFromDisk function used for: Reading a page directly from disk bypassing the cache to get the original unmodified state.
func (pm *PageManager) ReadPageFromDisk(pageID uint64) (interface{}, error) {
	return pm.readPageFromFile(pageID)
}

// readPageFromFile function used for: Reading a page's bytes from disk and deserializing it into the appropriate page struct based on PageType.
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
func (pm *PageManager) FlushAll() error {
	for pageID, page := range pm.Pages {
		if err := pm.WritePageToFile(pageID, page); err != nil {
			return fmt.Errorf("failed to flush page %d: %w", pageID, err)
		}
	}
	return nil
}

// GetFileName function used for: Retrieving the filename of the database file associated with this PageManager.
func (pm *PageManager) GetFileName() string {
	if pm.file == nil {
		return ""
	}
	return pm.file.Name()
}
