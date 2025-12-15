package main

// -----------------------------
// Insert into internal node
// -----------------------------

// insertIntoInternal inserts `key` and the associated right-side child
// pointer into an internal node `page` at the correct position.
//
// Key concepts and flow:
//   - Internal nodes store separator keys and child pointers where the
//     child pointer at index i corresponds to keys <= keys[i] for the
//     left child and > keys[i] for the right child (routing semantics).
//   - When inserting a new separator, we insert the key and the pointer
//     to the right child produced by a split.
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
func splitInternal(page *InternalPage, newPage *InternalPage) KeyType {
	mid := len(page.keys) / 2 // middle index
	midKey := page.keys[mid]  // key to push up

	// move half of keys and children to new node
	newPage.keys = append(newPage.keys, page.keys[mid+1:]...)
	newPage.children = append(newPage.children, page.children[mid+1:]...)

	// truncate original node to keep left half
	page.keys = page.keys[:mid]
	page.children = page.children[:mid+1]

	// update metadata
	page.Header.KeyCount = uint16(len(page.keys))
	newPage.Header.KeyCount = uint16(len(newPage.keys))

	return midKey
}
