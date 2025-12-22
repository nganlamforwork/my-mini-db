package main

import (
	"bytes"
	"encoding/binary"
)

// DefaultPageSize is the default page size used by in-memory pages
const DefaultPageSize = 4096

type MetaPage struct {
	Header PageHeader

	// B+Tree metadata
	RootPage uint64 // page id of root
	PageSize uint32 // e.g. 4096
	Order    uint16 // B+Tree order
	Version  uint16 // format version
}

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
