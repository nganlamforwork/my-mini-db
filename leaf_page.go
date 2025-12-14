package main

// -----------------------------
// Finding the correct leaf
// -----------------------------

// findLeaf traverses the tree to find the correct leaf where 'key' should be inserted.
// Uses binary search to find the last key <= input key (B+Tree routing rule).
func (tree *BPlusTree) findLeaf(key KeyType) *Node {
    current := tree.root
    if current == nil {
        return nil
    }

    for !current.isLeaf {
        keys := current.keys
        left, right := 0, len(keys)-1
        pos := -1 // last index where keys[pos] <= key

        // binary search for last key <= key
        for left <= right {
            mid := (left + right) / 2
            if keys[mid] <= key {
                pos = mid
                left = mid + 1
            } else {
                right = mid - 1
            }
        }

        // child index = pos + 1
        // if pos = -1 → go to children[0]
        childIndex := pos + 1
        current = current.children[childIndex]
    }

    return current
}

// -----------------------------
// Insert into leaf
// -----------------------------

// insertIntoLeaf inserts key/value pair into a leaf node in sorted order
func insertIntoLeaf(leaf *Node, key KeyType, value ValueType) {
	i := 0
	// find correct position for key
	for i < len(leaf.keys) && leaf.keys[i] < key {
		i++
	}

	// append empty slots to shift elements
	leaf.keys = append(leaf.keys, 0)
	leaf.values = append(leaf.values, "")
	copy(leaf.keys[i+1:], leaf.keys[i:])
	copy(leaf.values[i+1:], leaf.values[i:])

	// insert the new key/value
	leaf.keys[i] = key
	leaf.values[i] = value
}

// splitLeaf splits a full leaf node into two and returns the new leaf and its first key
func splitLeaf(leaf *Node) (*Node, KeyType) {
	mid := (ORDER + 1) / 2 // find split point
	newLeaf := newLeafNode()

	// move half of keys/values to the new leaf
	newLeaf.keys = append(newLeaf.keys, leaf.keys[mid:]...)
	newLeaf.values = append(newLeaf.values, leaf.values[mid:]...)

	// truncate original leaf
	leaf.keys = leaf.keys[:mid]
	leaf.values = leaf.values[:mid]

	// update linked list pointers
	newLeaf.next = leaf.next
	leaf.next = newLeaf

	// return new leaf and the first key of new leaf (to push up)
	return newLeaf, newLeaf.keys[0]
}