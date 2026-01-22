package page

import (
	"bplustree/internal/storage"
	"bytes"
	"encoding/binary"
)

// InsertIntoInternal function used for: Inserting a separator key and its associated right-side child pointer
// into an internal node at the correct sorted position.
//
// Algorithm steps:
// 1. Find insertion position - Locate first key >= new key to maintain sorted order
// 2. Insert key - Shift existing keys to the right and insert new key at correct position
// 3. Insert child pointer - Insert child page ID after the key (right-side child)
// 4. Update metadata - Update KeyCount to reflect new key and child
//
// Routing semantics: For an internal node with keys K[0..n-1] and children C[0..n],
// the subtree C[i] contains keys where K[i-1] < key <= K[i], with K[-1] = -inf and K[n] = +inf.
// The child pointer is inserted at position i+1, corresponding to the right subtree of key K[i].
//
// Return: void - modifies page in place
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

// SplitInternal function used for: Splitting a full internal node into two nodes when it overflows,
// redistributing keys and children, and promoting the middle key to the parent.
//
// Algorithm steps:
// 1. Calculate midpoint - Find middle key index to promote (mid = len(keys) / 2)
// 2. Promote middle key - Middle key is removed from node and returned to parent (not kept in either split node)
// 3. Redistribute keys - Move keys after midpoint to new node (right half)
// 4. Redistribute children - Move corresponding child pointers after midpoint to new node
// 5. Truncate original node - Keep left half (keys and children up to midpoint) in original page
// 6. Update parent pointers - Set parent of all moved children to new node's page ID
// 7. Update metadata - Update KeyCount for both nodes to reflect actual slice lengths
// 8. Recompute free space - Calculate free space for both nodes based on payload capacity
//
// Return: KeyType - the middle key to be promoted to the parent internal node
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

// WriteToBuffer function used for: Serializing an internal page into a buffer for persistent storage on disk.
//
// Algorithm steps:
// 1. Write page header - Serialize PageHeader structure to buffer
// 2. Write keys - Serialize all keys (KeyCount entries) using CompositeKey.WriteTo
// 3. Write children - Serialize all child page IDs (KeyCount+1 entries) as uint64 big-endian
//
// Format: [page header] [keys] [children]
//  - PageHeader (via PageHeader.WriteToBuffer)
//  - Keys[] (KeyCount entries, each serialized via CompositeKey.WriteTo)
//  - Children[] (KeyCount+1 entries, each uint64 big-endian)
//
// Return: error - nil on success, error if serialization fails
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

// ReadFromBuffer function used for: Deserializing an internal page from a buffer loaded from persistent storage on disk.
//
// Algorithm steps:
// 1. Prepare key slice - Allocate slice with capacity equal to KeyCount from header
// 2. Read keys - Deserialize all keys (KeyCount entries) using ReadCompositeKeyFrom
// 3. Prepare children slice - Allocate slice with capacity KeyCount+1 (one more child than keys)
// 4. Read children - Deserialize all child page IDs (KeyCount+1 entries) as uint64 big-endian
//
// Format: [page header] [keys] [children]
//  - PageHeader (via PageHeader.ReadFromBuffer)
//  - Keys[] (KeyCount entries, each deserialized via ReadCompositeKeyFrom)
//  - Children[] (KeyCount+1 entries, each uint64 big-endian)
//
// Return: error - nil on success, error if deserialization fails
func (p *InternalPage) ReadFromBuffer(buf *bytes.Reader) error {
	// PageHeader is already read by caller (readPageFromFile); payload follows.

	// prepare slices
	keyCount := int(p.Header.KeyCount)
	p.Keys = make([]KeyType, 0, keyCount)
	for range keyCount {
		k, err := storage.ReadCompositeKeyFrom(buf)
		if err != nil {
			return err
		}
		p.Keys = append(p.Keys, k)
	}

	// children: keyCount+1 entries
	childCount := keyCount + 1
	p.Children = make([]uint64, 0, childCount)
	for range childCount {
		var c uint64
		if err := binary.Read(buf, binary.BigEndian, &c); err != nil {
			return err
		}
		p.Children = append(p.Children, c)
	}

	return nil
}
