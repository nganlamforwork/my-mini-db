package page

import (
	"bytes"
	"encoding/binary"
)

const PageHeaderSize = 56 // bytes (56 bytes)

type PageType uint8
type PageHeader struct {
	PageID   uint64   // unique page identifier
	PageType PageType // meta / internal / leaf

	// common B+Tree metadata
	KeyCount  uint16 // number of keys currently stored
	FreeSpace uint16 // remaining free space (bytes)

	// tree structure
	ParentPage uint64 // parent page id (0 if root)
	NextPage   uint64 // right sibling (leaf) or 0
	PrevPage   uint64 // left sibling (leaf) or 0

	// padding for 8-byte alignment
	_ uint32

	// concurrency / recovery (optional but future-proof)
	LSN uint64 // log sequence number (for WAL)
}

// WriteToBuffer function used for: Serializing a page header into a buffer for persistent storage on disk.
//
// Format: [page header] [page type] [key count] [free space] [padding] [LSN]
func (h *PageHeader) WriteToBuffer(buf *bytes.Buffer) error {
	// Serialize header fields in a stable, explicitly-defined order
	// (big-endian). The serialization order is independent of the Go
	// struct field layout; consumers/readers must use the same order
	// when decoding. The chosen order here is:
	//   PageID, ParentPage, PrevPage, NextPage, PageType, KeyCount,
	//   FreeSpace, padding (uint32), LSN
	if err := binary.Write(buf, binary.BigEndian, h.PageID); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, h.ParentPage); err != nil {
		return err
	}

	// linkage (prev/next) so scanners can follow sibling chains
	if err := binary.Write(buf, binary.BigEndian, h.PrevPage); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, h.NextPage); err != nil {
		return err
	}

	// type and counts
	if err := binary.Write(buf, binary.BigEndian, h.PageType); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, h.KeyCount); err != nil {
		return err
	}
	if err := binary.Write(buf, binary.BigEndian, h.FreeSpace); err != nil {
		return err
	}

	// padding for alignment to keep header size stable across platforms
	var padding uint32 = 0
	if err := binary.Write(buf, binary.BigEndian, padding); err != nil {
		return err
	}

	// LSN last so header changes affecting recovery can be appended
	if err := binary.Write(buf, binary.BigEndian, h.LSN); err != nil {
		return err
	}

	return nil
}

// ReadFromBuffer function used for: Deserializing a page header from a buffer loaded from persistent storage on disk.
//
// Format: [page header] [page type] [key count] [free space] [padding] [LSN]
func (h *PageHeader) ReadFromBuffer(buf *bytes.Reader) error {
	// Deserialize fields in the same order they were written.
	if err := binary.Read(buf, binary.BigEndian, &h.PageID); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &h.ParentPage); err != nil {
		return err
	}

	if err := binary.Read(buf, binary.BigEndian, &h.PrevPage); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &h.NextPage); err != nil {
		return err
	}

	if err := binary.Read(buf, binary.BigEndian, &h.PageType); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &h.KeyCount); err != nil {
		return err
	}
	if err := binary.Read(buf, binary.BigEndian, &h.FreeSpace); err != nil {
		return err
	}

	// skip padding (alignment)
	var padding uint32
	if err := binary.Read(buf, binary.BigEndian, &padding); err != nil {
		return err
	}

	// read LSN last (consistent with WriteToBuffer)
	if err := binary.Read(buf, binary.BigEndian, &h.LSN); err != nil {
		return err
	}

	return nil
}
