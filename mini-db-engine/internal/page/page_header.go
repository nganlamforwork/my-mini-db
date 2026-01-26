package page

import (
	"bytes"
	"encoding/binary"
)

const PageHeaderSize = 68 // base size with B-Link (68 bytes)

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

	// B-Link support
	RightPageID uint64 // right sibling for B-Link (all node types)
	HighKey     []byte // high key value for B-Link

	// padding for 8-byte alignment
	_ uint32

	// concurrency / recovery (optional but future-proof)
	LSN uint64 // log sequence number (for WAL)
}

// WriteToBuffer function used for: Serializing a page header into a buffer for persistent storage on disk.
// Format: [PageID] [ParentPage] [PrevPage] [NextPage] [PageType] [KeyCount] [FreeSpace] [Padding] [LSN] [RightPageID] [HighKeySize] [HighKey]
func (h *PageHeader) WriteToBuffer(buf *bytes.Buffer) error {
	// 1. Core Fields (Always fixed size)
	binary.Write(buf, binary.BigEndian, h.PageID)
	binary.Write(buf, binary.BigEndian, h.ParentPage)
	binary.Write(buf, binary.BigEndian, h.PrevPage)
	binary.Write(buf, binary.BigEndian, h.NextPage)
	binary.Write(buf, binary.BigEndian, uint8(h.PageType))
	binary.Write(buf, binary.BigEndian, h.KeyCount)
	binary.Write(buf, binary.BigEndian, h.FreeSpace)
	
	// Explicit 11-byte padding to reach correct alignment
	buf.Write(make([]byte, 11))
	
	binary.Write(buf, binary.BigEndian, h.LSN)

	// 2. B-Link Fields
	binary.Write(buf, binary.BigEndian, h.RightPageID)
	highKeySize := uint32(len(h.HighKey))
	binary.Write(buf, binary.BigEndian, highKeySize)
	if highKeySize > 0 {
		buf.Write(h.HighKey)
	}

	return nil
}

// ReadFromBuffer function used for: Deserializing a page header from a buffer loaded from persistent storage on disk.
// Format: [PageID] [ParentPage] [PrevPage] [NextPage] [PageType] [KeyCount] [FreeSpace] [Padding] [LSN] [RightPageID] [HighKeySize] [HighKey]
func (h *PageHeader) ReadFromBuffer(buf *bytes.Reader) error {
	binary.Read(buf, binary.BigEndian, &h.PageID)
	binary.Read(buf, binary.BigEndian, &h.ParentPage)
	binary.Read(buf, binary.BigEndian, &h.PrevPage)
	binary.Read(buf, binary.BigEndian, &h.NextPage)
	
	var pType uint8
	binary.Read(buf, binary.BigEndian, &pType)
	h.PageType = PageType(pType)
	
	binary.Read(buf, binary.BigEndian, &h.KeyCount)
	binary.Read(buf, binary.BigEndian, &h.FreeSpace)
	
	// Skip 11-byte padding
	buf.Read(make([]byte, 11))
	
	binary.Read(buf, binary.BigEndian, &h.LSN)

	// B-Link fields
	binary.Read(buf, binary.BigEndian, &h.RightPageID)
	
	var highKeySize uint32
	binary.Read(buf, binary.BigEndian, &highKeySize)
	if highKeySize > 0 {
		h.HighKey = make([]byte, highKeySize)
		buf.Read(h.HighKey)
	} else {
		h.HighKey = nil
	}

	if h.PageID > 1000000 {
		// fmt.Printf("DEBUG: Suspicious PageID read: %d\n", h.PageID)
	}

	return nil
}
