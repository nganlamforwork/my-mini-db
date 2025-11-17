package main

import "fmt"

// INTERNAL_MAX_KEY defines the maximum number of keys that an internal node can hold.
// This corresponds to the "order" of the B-Tree minus 1 in classical definitions.
const INTERNAL_MAX_KEY = 4

// Node is an empty interface to represent a generic tree node (internal or leaf).
// In a full implementation, leaf nodes would have a concrete type as well.
type Node interface{}

// BTreeInternalNode represents an internal node in a B-Tree.
// It contains:
// - nkey: number of valid keys currently stored
// - keys: array of keys
// - children: array of pointers to child nodes
type BTreeInternalNode struct {
	nkey     int
	keys     [INTERNAL_MAX_KEY]int
	children [INTERNAL_MAX_KEY]*Node
}

// NewINode returns a new internal node initialized with zero keys
// and nil children. This is a helper function to create empty nodes.
func NewINode() BTreeInternalNode {
	var new_keys [INTERNAL_MAX_KEY]int
	var new_children [INTERNAL_MAX_KEY]*Node
	return BTreeInternalNode{
		nkey:     0,
		keys:     new_keys,
		children: new_children,
	}
}

// FindLastLE finds the last position (index) in the node's keys array
// where the key is less than or equal to findKey.
// Returns -1 if all keys are greater than findKey.
// This is useful to decide which child pointer to follow when descending the tree.
func (node *BTreeInternalNode) FindLastLE(findKey int) int {
	pos := -1
	for i := 0; i < node.nkey; i++ {
		if node.keys[i] <= findKey {
			pos = i
		}
	}
	return pos
}

// InsertKV inserts a new key-child pair into the internal node.
// Steps:
// 1. Find the position to insert using FindLastLE
// 2. Shift all keys and children after that position one step to the right
// 3. Insert the new key and child at the proper position
// 4. Increase nkey
//
// Note: This function assumes that the node is not full; in a full B-Tree
// you would need to handle splitting before inserting.
func (node *BTreeInternalNode) InsertKV(insertKey int, insertChild Node) {
	pos := node.FindLastLE(insertKey)
	// Shift keys and children to the right to make space for the new key
	for i := node.nkey - 1; i > pos; i-- {
		node.keys[i+1] = node.keys[i]
		node.children[i+1] = node.children[i]
	}
	node.keys[pos+1] = insertKey
	node.children[pos+1] = &insertChild
	node.nkey += 1
}

// Split splits the internal node into two nodes.
// - It splits around the middle index (median).
// - The left half remains in the original node.
// - The right half is returned as a new node.
//
// Important notes:
// - In a complete B-Tree implementation, the median key would be promoted
//   to the parent, not included in either child node directly.
// - Here, the function simply returns the right node, leaving promotion
//   logic to be implemented at a higher level (e.g., in the B-Tree structure itself).
func (node *BTreeInternalNode) Split() BTreeInternalNode {
	var newKeys [INTERNAL_MAX_KEY]int
	var newChildren [INTERNAL_MAX_KEY]*Node
	pos := node.nkey / 2

	// Copy the second half of keys and children into new node
	for i := pos; i < node.nkey; i++ {
		newKeys[i-pos] = node.keys[i]       // Copy key
		newChildren[i-pos] = node.children[i] // Copy child pointer
		node.keys[i] = 0                     // Clear old key
		node.children[i] = nil               // Clear old child
	}

	newNode := BTreeInternalNode{
		nkey:     node.nkey - pos,
		keys:     newKeys,
		children: newChildren,
	}

	// Update original node key count
	node.nkey = pos
	return newNode
}

func main() {
	fmt.Println("Hello word") // Typo: should be "Hello world"
}
