package page

import (
	"bytes"
	"encoding/binary"

	"bplustree/internal/storage"
)

// -----------------------------
// Insert into internal node
// -----------------------------

// InsertIntoInternal inserts `key` and the associated right-side child
// pointer into an internal node `page` at the correct position.
//
// Routing semantics (precise): for an internal node with keys K[0..n-1]
// and children C[0..n], the subtree C[i] contains keys where
// K[i-1] < key <= K[i], with K[-1] = -inf and K[n] = +inf. To choose
// a child for `searchKey` we find the last key <= searchKey (pos) and
// follow child C[pos+1]; if no key <= searchKey, follow C[0]. This
// matches the binary search used in `findLeaf`.
func InsertIntoInternal(page *InternalPage, key KeyType, childPageID uint64) {
	i := 0
	// find the position for the new key (first key >= new key)
	for i < len(page.Keys) && key.Compare(page.Keys[i]) > 0 {
		i++
	}

	// insert key into keys slice and shift elements to the right
	page.Keys = append(page.Keys, storage.CompositeKey{})
	copy(page.Keys[i+1:], page.Keys[i:])
	page.Keys[i] = key

	// insert the child pointer after the key (right-side child)
	page.Children = append(page.Children, 0)
	copy(page.Children[i+2:], page.Children[i+1:])
	page.Children[i+1] = childPageID

	// update metadata
	page.Header.KeyCount = uint16(len(page.Keys))
}

// SplitInternal splits a full internal node and returns new node and the middle key
// SplitInternal splits a full internal node `page` into two nodes:
// the original `page` becomes the left node and `newPage` becomes the
// right node. The middle key is returned to be promoted to the parent.
//
// Key points:
// - The middle key (mid) is removed from the node and propagated upward.
// - Keys to the right of mid and corresponding child pointers move to `newPage`.
// - Parent pointers for moved children should be updated by caller if tracked.
func SplitInternal(page *InternalPage, newPage *InternalPage, pm *PageManager) KeyType {
	mid := len(page.Keys) / 2 // middle index
	midKey := page.Keys[mid]  // key to push up

	// move half of keys and children to new node
	newPage.Keys = append(newPage.Keys, page.Keys[mid+1:]...)
	newPage.Children = append(newPage.Children, page.Children[mid+1:]...)

	// truncate original node to keep left half
	page.Keys = page.Keys[:mid]
	page.Children = page.Children[:mid+1]

	// update metadata: ensure KeyCount reflects actual slice lengths
	page.Header.KeyCount = uint16(len(page.Keys))
	newPage.Header.KeyCount = uint16(len(newPage.Keys))

	// update parent pointer of children moved to newPage
	// for each child page id now owned by newPage, set its ParentPage
	for _, childID := range newPage.Children {
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

	// recompute FreeSpace for internal pages (sum of key sizes + children*8 payload)
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	usedLeft := len(page.Children) * 8
	for _, k := range page.Keys {
		usedLeft += k.Size()
	}
	if usedLeft > payloadCapacity {
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - usedLeft)
	}
	usedRight := len(newPage.Children) * 8
	for _, k := range newPage.Keys {
		usedRight += k.Size()
	}
	if usedRight > payloadCapacity {
		newPage.Header.FreeSpace = 0
	} else {
		newPage.Header.FreeSpace = uint16(payloadCapacity - usedRight)
	}

	return midKey
}

// WriteToBuffer serializes the internal page into buf. Format:
//  - header (PageHeader.WriteToBuffer)
//  - keys (KeyCount entries, each serialized via CompositeKey.WriteTo)
//  - children (KeyCount+1 entries, each uint64 big-endian)
func (p *InternalPage) WriteToBuffer(buf *bytes.Buffer) error {
	if err := p.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// write keys
	for _, k := range p.Keys {
		if err := k.WriteTo(buf); err != nil {
			return err
		}
	}

	// write child page ids
	for _, c := range p.Children {
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
	p.Keys = make([]KeyType, 0, keyCount)
	for i := 0; i < keyCount; i++ {
		k, err := storage.ReadCompositeKeyFrom(buf)
		if err != nil {
			return err
		}
		p.Keys = append(p.Keys, k)
	}

	// children: keyCount+1 entries
	childCount := keyCount + 1
	p.Children = make([]uint64, 0, childCount)
	for i := 0; i < childCount; i++ {
		var c uint64
		if err := binary.Read(buf, binary.BigEndian, &c); err != nil {
			return err
		}
		p.Children = append(p.Children, c)
	}

	return nil
}
