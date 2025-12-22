package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
)

// -----------------------------
// Insert into leaf
// -----------------------------

// insertIntoLeaf inserts a key/value pair into `page` keeping
// the keys sorted. This is an in-memory, stable insertion used
// by higher-level tree operations; it does not persist data to
// disk — the pager layer is responsible for page lifecycle.
//
// Key points:
// - Find the insertion index by scanning until the first key >= new key.
// - Shift existing keys/values to make room and update key count.
// computeLeafPayloadSize returns the number of payload bytes used by the
// leaf page (sum of key sizes + value length prefixes + value bytes).
func computeLeafPayloadSize(p *LeafPage) int {
	size := 0
	for range p.keys {
		size += 8 // key as int64
	}
	for _, v := range p.values {
		size += 4               // uint32 length prefix
		size += len([]byte(v))  // bytes of value
	}
	return size
}

// insertIntoLeaf inserts a key/value pair into `page` keeping the keys sorted.
// Returns an error if the single value is larger than the page payload capacity.
func insertIntoLeaf(page *LeafPage, key KeyType, value ValueType) error {
	// check single-value size against page capacity
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	if len([]byte(value))+4 > payloadCapacity {
		return fmt.Errorf("value too large for single page: %d bytes", len([]byte(value)))
	}

	i := 0
	for i < len(page.keys) && page.keys[i] < key {
		i++
	}

	// grow slices by one and shift elements right to make room
	page.keys = append(page.keys, 0)
	page.values = append(page.values, "")

	copy(page.keys[i+1:], page.keys[i:])
	copy(page.values[i+1:], page.values[i:])

	page.keys[i] = key
	page.values[i] = value

	// update header metadata and recompute free space
	page.Header.KeyCount = uint16(len(page.keys))
	used := computeLeafPayloadSize(page)
	if used > payloadCapacity {
		// shouldn't normally happen because we checked single value size,
		// but signal caller that page is overfull so it can split.
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - used)
	}

	return nil
}

// splitLeaf splits `page` into two leaf pages: the existing `page`
// becomes the left sibling and `newLeaf` becomes the right sibling.
//
// Key concepts:
//   - Use a midpoint to divide keys/values for relatively even distribution.
//   - The first key of the new right-side leaf is the separator pushed
//     up into the parent internal node.
//   - Sibling links (`NextPage`/`PrevPage`) are updated to maintain
//     the leaf-level doubly-linked list used for range scans.
func splitLeaf(page *LeafPage, newLeaf *LeafPage) KeyType {
	mid := len(page.keys) / 2 // Calculate midpoint for even distribution

	// Move keys and values from midpoint to the new leaf
	newLeaf.keys = append(newLeaf.keys, page.keys[mid:]...)
	newLeaf.values = append(newLeaf.values, page.values[mid:]...)

	// Retain only the left half in the original leaf
	page.keys = page.keys[:mid]
	page.values = page.values[:mid]

	// Update sibling links to stitch the new leaf into the list
	newLeaf.Header.NextPage = page.Header.NextPage
	newLeaf.Header.PrevPage = page.Header.PageID
	page.Header.NextPage = newLeaf.Header.PageID

	// Update key counts
	page.Header.KeyCount = uint16(len(page.keys))
	newLeaf.Header.KeyCount = uint16(len(newLeaf.keys))

	// Recompute free space for both pages based on payload
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	usedLeft := computeLeafPayloadSize(page)
	if usedLeft > payloadCapacity {
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - usedLeft)
	}
	usedRight := computeLeafPayloadSize(newLeaf)
	if usedRight > payloadCapacity {
		newLeaf.Header.FreeSpace = 0
	} else {
		newLeaf.Header.FreeSpace = uint16(payloadCapacity - usedRight)
	}

	// The first key of the new right leaf is the separator for the parent
	return newLeaf.keys[0]
}

// WriteToBuffer serializes the leaf page into buf. Format:
//  - header (PageHeader.WriteToBuffer)
//  - keys (KeyCount entries as int64)
//  - values (for each value: uint32 length, followed by bytes)
func (p *LeafPage) WriteToBuffer(buf *bytes.Buffer) error {
	if err := p.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// keys
	for _, k := range p.keys {
		if err := binary.Write(buf, binary.BigEndian, int64(k)); err != nil {
			return err
		}
	}

	// values: write length then bytes
	for _, v := range p.values {
		b := []byte(v)
		if err := binary.Write(buf, binary.BigEndian, uint32(len(b))); err != nil {
			return err
		}
		if _, err := buf.Write(b); err != nil {
			return err
		}
	}

	return nil
}

// ReadFromBuffer deserializes a leaf page from buf.
func (p *LeafPage) ReadFromBuffer(buf *bytes.Reader) error {
	// PageHeader already read by caller (readPageFromFile); payload follows.

	keyCount := int(p.Header.KeyCount)
	p.keys = make([]KeyType, 0, keyCount)
	for i := 0; i < keyCount; i++ {
		var k int64
		if err := binary.Read(buf, binary.BigEndian, &k); err != nil {
			return err
		}
		p.keys = append(p.keys, KeyType(k))
	}

	p.values = make([]ValueType, 0, keyCount)
	for i := 0; i < keyCount; i++ {
		var l uint32
		if err := binary.Read(buf, binary.BigEndian, &l); err != nil {
			return err
		}
		b := make([]byte, l)
		if _, err := io.ReadFull(buf, b); err != nil {
			return err
		}
		p.values = append(p.values, ValueType(b))
	}

	return nil
}
