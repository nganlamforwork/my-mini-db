package page

import (
	"bytes"
	"encoding/binary"
	"sync"
)

// DefaultPageSize is the default page size used by in-memory pages
const DefaultPageSize = 4096 // bytes (4KB)

type MetaPage struct {
	Header PageHeader
	mu     sync.RWMutex

	// B+Tree metadata
	RootPage uint64 // page id of root
	PageSize uint32 // page size in bytes (e.g. 4096)
	Order    uint16 // B+Tree order
	Version  uint16 // format version
}

var _ Page = (*MetaPage)(nil)

func (m *MetaPage) RLock()               { m.mu.RLock() }
func (m *MetaPage) RUnlock()             { m.mu.RUnlock() }
func (m *MetaPage) Lock()                { m.mu.Lock() }
func (m *MetaPage) Unlock()              { m.mu.Unlock() }
func (m *MetaPage) GetHeader() *PageHeader { return &m.Header }

// WriteToBuffer function used for: Serializing a meta page into a buffer for persistent storage on disk.
//
// Format: [page header] [meta payload]
//  - PageHeader (via PageHeader.WriteToBuffer)
//  - Meta payload (RootPage, PageSize, Order, Version)
func (m *MetaPage) WriteToBuffer(buf *bytes.Buffer) error {
	// write header first
	if err := m.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// write meta payload
	if err := binary.Write(buf, binary.BigEndian, m.RootPage); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, m.PageSize); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, m.Order); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, m.Version); err != nil {
		return err
	}

	return nil
}

// ReadFromBuffer function used for: Deserializing a meta page from a buffer loaded from persistent storage on disk.
//
// Algorithm steps:
// 1. Read page header - Deserialize PageHeader structure from buffer
// 2. Read meta payload - Deserialize RootPage, PageSize, Order, and Version
//
// Format: [page header] [meta payload]
//  - PageHeader (via PageHeader.ReadFromBuffer)
//  - Meta payload (RootPage, PageSize, Order, Version)
func (m *MetaPage) ReadFromBuffer(buf *bytes.Reader) error {
	// Note: PageHeader is already read by caller (readPageFromFile).
	// read meta payload
	if err := binary.Read(buf, binary.BigEndian, &m.RootPage); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &m.PageSize); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &m.Order); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &m.Version); err != nil {
		return err
	}

	return nil
}
