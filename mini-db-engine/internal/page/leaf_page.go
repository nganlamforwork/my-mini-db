package page

import (
	"bytes"
	"fmt"

	"bplustree/internal/common"
	"bplustree/internal/storage"
)

// ComputeLeafPayloadSize function used for: Calculating the total payload size (sum of all key sizes and value sizes) in a leaf page.
//
// Algorithm steps:
// 1. Sum key sizes - Iterate through all keys and sum their serialized sizes
// 2. Sum value sizes - Iterate through all values and sum their serialized sizes
// 3. Return total - Return the sum of key sizes and value sizes
//
// Return: int - total number of payload bytes used by the leaf page
func ComputeLeafPayloadSize(p *LeafPage) int {
	size := 0
	for _, k := range p.Keys {
		size += k.Size()
	}
	for _, v := range p.Values {
		size += v.Size()
	}
	return size
}

// InsertIntoLeaf function used for: Inserting a key-value pair into a leaf page while maintaining sorted order and updating free space.
//
// Algorithm steps:
// 1. Check value size - Verify that the single value does not exceed page payload capacity
// 2. Find insert position - Use binary search to locate insertion index to maintain sorted order
// 3. Shift elements - Grow slices and shift existing keys/values to the right to make room
// 4. Insert key-value - Insert new key-value pair at the calculated position
// 5. Update metadata - Update KeyCount to reflect new key-value pair
// 6. Recompute free space - Calculate used payload and update FreeSpace header field
//
// Return: error - nil on success, error if value exceeds page capacity or insertion fails
func InsertIntoLeaf(page *LeafPage, key KeyType, value ValueType) error {
	// check single-value size against page capacity
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	if value.Size() > payloadCapacity {
		return fmt.Errorf("value too large for single page: %d bytes", value.Size())
	}

	// Find insert position using binary search
	i := common.BinarySearchInsertPosition(page.Keys, key)

	// grow slices by one and shift elements right to make room
	page.Keys = append(page.Keys, storage.CompositeKey{})
	page.Values = append(page.Values, storage.Record{})

	copy(page.Keys[i+1:], page.Keys[i:])
	copy(page.Values[i+1:], page.Values[i:])

	page.Keys[i] = key
	page.Values[i] = value

	// update header metadata and recompute free space
	page.Header.KeyCount = uint16(len(page.Keys))
	used := ComputeLeafPayloadSize(page)
	if used > payloadCapacity {
		// shouldn't normally happen because we checked single value size,
		// but signal caller that page is overfull so it can split.
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - used)
	}

	return nil
}

// SplitLeaf function used for: Splitting a full leaf page into two leaf pages when it overflows,
// redistributing keys and values, and promoting the first key of the right leaf to the parent internal node.
// Implements B-Link tree protocol (Lehman & Yao) for atomic splits.
//
// Algorithm steps:
// 1. Calculate midpoint - Divide keys at midpoint for even distribution (mid = len(keys) / 2)
// 2. Redistribute keys - Move keys from midpoint onward to new leaf (right half)
// 3. Redistribute values - Move values from midpoint onward to new leaf (right half)
// 4. Truncate original page - Keep left half (keys and values up to midpoint) in original leaf
// 5. Update sibling links - Maintain doubly-linked list between leaves (update NextPage/PrevPage pointers)
// 6. Update B-Link pointers (Lehman & Yao protocol):
//    - B.RightPageID = A.RightPageID (preserve old chain)
//    - B.HighKey = A.HighKey (inherit old boundary)
//    - A.HighKey = last key in A (shrink A's responsibility)
//    - A.RightPageID = B.PageID (link A->B)
// 7. Update next sibling pointer - Update next sibling's PrevPage pointer if it exists
// 8. Update metadata - Update KeyCount for both leaves to reflect actual slice lengths
// 9. Recompute free space - Calculate free space for both leaves based on payload capacity
//
// Return: KeyType - the first key of the new right leaf (separator key to be promoted to parent)
func SplitLeaf(page *LeafPage, newLeaf *LeafPage) KeyType {
	mid := len(page.Keys) / 2 // Calculate midpoint for even distribution

	// Move keys and values from midpoint to the new leaf
	newLeaf.Keys = append(newLeaf.Keys, page.Keys[mid:]...)
	newLeaf.Values = append(newLeaf.Values, page.Values[mid:]...)

	// Retain only the left half in the original leaf
	page.Keys = page.Keys[:mid]
	page.Values = page.Values[:mid]

	// Update sibling links to stitch the new leaf into the list
	newLeaf.Header.NextPage = page.Header.NextPage
	newLeaf.Header.PrevPage = page.Header.PageID
	page.Header.NextPage = newLeaf.Header.PageID

	// B-Link protocol (Lehman & Yao): Set up RightPageID and HighKey
	// Preserve old chain: B.RightPageID = A.RightPageID
	newLeaf.Header.RightPageID = page.Header.RightPageID
	// Inherit old boundary: B.HighKey = A.HighKey
	newLeaf.Header.HighKey = page.Header.HighKey

	// Shrink A's responsibility: A.HighKey = last key in A
	if len(page.Keys) > 0 {
		lastKey := page.Keys[len(page.Keys)-1]
		var buf bytes.Buffer
		if err := lastKey.WriteTo(&buf); err == nil {
			page.Header.HighKey = buf.Bytes()
		}
	} else {
		// If A is empty (shouldn't happen), set empty HighKey
		page.Header.HighKey = []byte{}
	}

	// Link A->B: A.RightPageID = B.PageID
	page.Header.RightPageID = newLeaf.Header.PageID

	// Update key counts
	page.Header.KeyCount = uint16(len(page.Keys))
	newLeaf.Header.KeyCount = uint16(len(newLeaf.Keys))

	// Recompute free space for both pages based on payload
	payloadCapacity := int(DefaultPageSize - PageHeaderSize)
	usedLeft := ComputeLeafPayloadSize(page)
	if usedLeft > payloadCapacity {
		page.Header.FreeSpace = 0
	} else {
		page.Header.FreeSpace = uint16(payloadCapacity - usedLeft)
	}
	usedRight := ComputeLeafPayloadSize(newLeaf)
	if usedRight > payloadCapacity {
		newLeaf.Header.FreeSpace = 0
	} else {
		newLeaf.Header.FreeSpace = uint16(payloadCapacity - usedRight)
	}

	// The first key of the new right leaf is the separator for the parent
	return newLeaf.Keys[0]
}

// WriteToBuffer function used for: Serializing a leaf page into a buffer for persistent storage on disk.
//
// Algorithm steps:
// 1. Write page header - Serialize PageHeader structure to buffer
// 2. Write keys - Serialize all keys (KeyCount entries) using CompositeKey.WriteTo
// 3. Write values - Serialize all values (KeyCount entries) using Record.WriteTo
//
// Format: [page header] [keys] [values]
//  - PageHeader (via PageHeader.WriteToBuffer)
//  - Keys[] (KeyCount entries, each serialized via CompositeKey.WriteTo)
//  - Values[] (KeyCount entries, each serialized via Record.WriteTo)
//
// Return: error - nil on success, error if serialization fails
func (p *LeafPage) WriteToBuffer(buf *bytes.Buffer) error {
	if err := p.Header.WriteToBuffer(buf); err != nil {
		return err
	}

	// keys
	for _, k := range p.Keys {
		if err := k.WriteTo(buf); err != nil {
			return err
		}
	}

	// values
	for _, v := range p.Values {
		if err := v.WriteTo(buf); err != nil {
			return err
		}
	}

	return nil
}

// ReadFromBuffer function used for: Deserializing a leaf page from a buffer loaded from persistent storage on disk.
//
// Algorithm steps:
// 1. Prepare key slice - Allocate slice with capacity equal to KeyCount from header
// 2. Read keys - Deserialize all keys (KeyCount entries) using ReadCompositeKeyFrom
// 3. Prepare value slice - Allocate slice with capacity equal to KeyCount from header
// 4. Read values - Deserialize all values (KeyCount entries) using ReadRecordFrom
//
// Assumes: PageHeader has already been read by the caller (readPageFromFile).
//  - Keys[] (KeyCount entries, each deserialized via ReadCompositeKeyFrom)
//  - Values[] (KeyCount entries, each deserialized via ReadRecordFrom)
//
// Format: [page header] [keys] [values]
//
// Return: error - nil on success, error if deserialization fails
func (p *LeafPage) ReadFromBuffer(buf *bytes.Reader) error {
	// PageHeader is already read by caller (readPageFromFile); payload follows.

	keyCount := int(p.Header.KeyCount)
	p.Keys = make([]KeyType, 0, keyCount)
	for range keyCount {
		k, err := storage.ReadCompositeKeyFrom(buf)
		if err != nil {
			return err
		}
		p.Keys = append(p.Keys, k)
	}

	p.Values = make([]ValueType, 0, keyCount)
	for range keyCount {
		v, err := storage.ReadRecordFrom(buf)
		if err != nil {
			return err
		}
		p.Values = append(p.Values, v)
	}

	return nil
}
