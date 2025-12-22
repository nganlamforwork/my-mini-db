package main

import (
	"bytes"
	"encoding/binary"
)

// -----------------------------
// Insert into internal node
// -----------------------------

// insertIntoInternal inserts `key` and the associated right-side child
// pointer into an internal node `page` at the correct position.
//
// Routing semantics (precise): for an internal node with keys K[0..n-1]
// and children C[0..n], the subtree C[i] contains keys where
// K[i-1] < key <= K[i], with K[-1] = -inf and K[n] = +inf. To choose
// a child for `searchKey` we find the last key <= searchKey (pos) and
// follow child C[pos+1]; if no key <= searchKey, follow C[0]. This
// matches the binary search used in `findLeaf`.
func insertIntoInternal(page *InternalPage, key KeyType, childPageID uint64) {
	i := 0
	// find the position for the new key (first key >= new key)
	for i < len(page.keys) && key > page.keys[i] {
		i++
	}

	// insert key into keys slice and shift elements to the right
	page.keys = append(page.keys, 0)
	copy(page.keys[i+1:], page.keys[i:])
	page.keys[i] = key

	// insert the child pointer after the key (right-side child)
	page.children = append(page.children, 0)
	copy(page.children[i+2:], page.children[i+1:])
	page.children[i+1] = childPageID

	// update metadata
	page.Header.KeyCount = uint16(len(page.keys))
}

// splitInternal splits a full internal node and returns new node and the middle key
// splitInternal splits a full internal node `page` into two nodes:
// the original `page` becomes the left node and `newPage` becomes the
// right node. The middle key is returned to be promoted to the parent.
//
// Key points:
// - The middle key (mid) is removed from the node and propagated upward.
// - Keys to the right of mid and corresponding child pointers move to `newPage`.
// - Parent pointers for moved children should be updated by caller if tracked.
func splitInternal(page *InternalPage, newPage *InternalPage, pm *PageManager) KeyType {
	mid := len(page.keys) / 2 // middle index
	midKey := page.keys[mid]  // key to push up

	// move half of keys and children to new node
	newPage.keys = append(newPage.keys, page.keys[mid+1:]...)
	newPage.children = append(newPage.children, page.children[mid+1:]...)

	// truncate original node to keep left half
	page.keys = page.keys[:mid]
	page.children = page.children[:mid+1]

	// update metadata: ensure KeyCount reflects actual slice lengths
	page.Header.KeyCount = uint16(len(page.keys))
	newPage.Header.KeyCount = uint16(len(newPage.keys))

	// update parent pointer of children moved to newPage
	// for each child page id now owned by newPage, set its ParentPage
	for _, childID := range newPage.children {
		if pm == nil {
			continue
		}
		child := pm.Get(childID)
		if child == nil {
			continue
		}
		switch c := child.(type) {
		case *InternalPage:
			c.Header.ParentPage = newPage.Header.PageID
		case *LeafPage:
			c.Header.ParentPage = newPage.Header.PageID
		}
	}

	// recompute FreeSpace for internal pages (keys*8 + children*8 payload)
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	usedLeft := len(page.keys)*8 + len(page.children)*8
	if usedLeft > payloadCapacity {
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - usedLeft)
	}
	usedRight := len(newPage.keys)*8 + len(newPage.children)*8
	if usedRight > payloadCapacity {
		newPage.Header.FreeSpace = 0
	} else {
		newPage.Header.FreeSpace = uint16(payloadCapacity - usedRight)
	}

	return midKey
}

// WriteToBuffer serializes the internal page into buf. Format:
//  - header (PageHeader.WriteToBuffer)
//  - keys (KeyCount entries, each written as int64 big-endian)
//  - children (KeyCount+1 entries, each uint64 big-endian)
func (p *InternalPage) WriteToBuffer(buf *bytes.Buffer) error {
	if err := p.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// write keys as fixed-size int64
	for _, k := range p.keys {
		if err := binary.Write(buf, binary.BigEndian, int64(k)); err != nil {
			return err
		}
	}

	// write child page ids
	for _, c := range p.children {
		if err := binary.Write(buf, binary.BigEndian, c); err != nil {
			return err
		}
	}

	return nil
}

// ReadFromBuffer deserializes an internal page from buf. It expects the
// same layout used in WriteToBuffer.
func (p *InternalPage) ReadFromBuffer(buf *bytes.Reader) error {
	// PageHeader is already read by caller (readPageFromFile); payload follows.

	// prepare slices
	keyCount := int(p.Header.KeyCount)
	p.keys = make([]KeyType, 0, keyCount)
	for i := 0; i < keyCount; i++ {
		var k int64
		if err := binary.Read(buf, binary.BigEndian, &k); err != nil {
			return err
		}
		p.keys = append(p.keys, KeyType(k))
	}

	// children: keyCount+1 entries
	childCount := keyCount + 1
	p.children = make([]uint64, 0, childCount)
	for i := 0; i < childCount; i++ {
		var c uint64
		if err := binary.Read(buf, binary.BigEndian, &c); err != nil {
			return err
		}
		p.children = append(p.children, c)
	}

	return nil
}
