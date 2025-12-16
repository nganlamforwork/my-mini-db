package main

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
func insertIntoLeaf(page *LeafPage, key KeyType, value ValueType) {
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

	// maintain header metadata
	page.Header.KeyCount = uint16(len(page.keys))
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

	// The first key of the new right leaf is the separator for the parent
	return newLeaf.keys[0]
}
