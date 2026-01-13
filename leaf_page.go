package main

import (
	"bytes"
	"fmt"
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
// leaf page (sum of key sizes + value sizes).
func computeLeafPayloadSize(p *LeafPage) int {
	size := 0
	for _, k := range p.keys {
		size += k.Size()
	}
	for _, v := range p.values {
		size += v.Size()
	}
	return size
}

// insertIntoLeaf inserts a key/value pair into `page` keeping the keys sorted.
// Returns an error if the single value is larger than the page payload capacity.
func insertIntoLeaf(page *LeafPage, key KeyType, value ValueType) error {
	// check single-value size against page capacity
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	if value.Size() > payloadCapacity {
		return fmt.Errorf("value too large for single page: %d bytes", value.Size())
	}

	i := 0
	for i < len(page.keys) && page.keys[i].Compare(key) < 0 {
		i++
	}

	// grow slices by one and shift elements right to make room
	page.keys = append(page.keys, CompositeKey{})
	page.values = append(page.values, Row{})

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
//  - keys (KeyCount entries, each serialized via CompositeKey.WriteTo)
//  - values (KeyCount entries, each serialized via Row.WriteTo)
func (p *LeafPage) WriteToBuffer(buf *bytes.Buffer) error {
	if err := p.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// keys
	for _, k := range p.keys {
		if err := k.WriteTo(buf); err != nil {
			return err
		}
	}

	// values
	for _, v := range p.values {
		if err := v.WriteTo(buf); err != nil {
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
		k, err := ReadCompositeKeyFrom(buf)
		if err != nil {
			return err
		}
		p.keys = append(p.keys, k)
	}

	p.values = make([]ValueType, 0, keyCount)
	for i := 0; i < keyCount; i++ {
		v, err := ReadRowFrom(buf)
		if err != nil {
			return err
		}
		p.values = append(p.values, v)
	}

	return nil
}
