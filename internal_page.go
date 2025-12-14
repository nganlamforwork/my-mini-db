package main

// -----------------------------
// Insert into internal node
// -----------------------------

// insertIntoInternal inserts a key and child pointer into an internal node
func insertIntoInternal(node *Node, key KeyType, child *Node) {
	i := 0
	// find the position for the new key
	for i < len(node.keys) && key > node.keys[i] {
		i++
	}

	// insert key
	node.keys = append(node.keys, 0)
	copy(node.keys[i+1:], node.keys[i:])
	node.keys[i] = key

	// insert corresponding child pointer
	node.children = append(node.children, nil)
	copy(node.children[i+2:], node.children[i+1:])
	node.children[i+1] = child
}

// splitInternal splits a full internal node and returns new node and the middle key
func splitInternal(node *Node) (*Node, KeyType) {
	mid := len(node.keys) / 2      // middle index
	midKey := node.keys[mid]       // key to push up

	newNode := newInternalNode()
	// move half of keys and children to new node
	newNode.keys = append(newNode.keys, node.keys[mid+1:]...)
	newNode.children = append(newNode.children, node.children[mid+1:]...)

	// truncate original node
	node.keys = node.keys[:mid]
	node.children = node.children[:mid+1]

	return newNode, midKey
}
