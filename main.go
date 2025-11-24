package main

import "fmt"

type KeyType int
type ValueType string

// Maximum number of children in an internal node (m = 4)
// So leaf nodes can have up to ORDER-1 keys
const ORDER = 4 

type Node struct {
    isLeaf   bool
    keys     []KeyType
    values   []ValueType   // chỉ dùng cho leaf
    children []*Node       // chỉ dùng cho internal node
    next     *Node         // chỉ dùng cho leaf, linked list
}

type BPlusTree struct {
    root *Node
}

// -----------------------------
// Node creation helpers
// -----------------------------

// newLeafNode creates a new empty leaf node
func newLeafNode() *Node {
    return &Node{
        isLeaf:   true,
        keys:     make([]KeyType, 0, ORDER-1),
        values:   make([]ValueType, 0, ORDER-1),
        children: nil,
        next:     nil,
    }
}

// newInternalNode creates a new empty internal node
func newInternalNode() *Node {
    return &Node{
        isLeaf:   false,
        keys:     make([]KeyType, 0, ORDER-1),
        children: make([]*Node, 0, ORDER),
    }
}

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

// -----------------------------
// Insert into B+ Tree
// -----------------------------

func (tree *BPlusTree) Insert(key KeyType, value ValueType) {
	// if tree is empty, create root leaf
	if tree.root == nil {
		leaf := newLeafNode()
		leaf.keys = append(leaf.keys, key)
		leaf.values = append(leaf.values, value)
		tree.root = leaf
		return
	}

	// find leaf to insert
	leaf := tree.findLeaf(key)
	insertIntoLeaf(leaf, key, value)

	// if leaf not full, done
	if len(leaf.keys) < ORDER {
		return
	}

	// leaf is full -> split
	newLeaf, newKey := splitLeaf(leaf)

	// maintain stack to trace path to parent
	parentStack := []*Node{}
	current := tree.root
	for current != leaf {
		parentStack = append(parentStack, current)
		i := 0
		for i < len(current.keys) && key >= current.keys[i] {
			i++
		}
		current = current.children[i]
	}

	// new node to insert into parent
	var newNode *Node = newLeaf
	var pushKey KeyType = newKey

	// insert new key/node into ancestors
	for len(parentStack) > 0 {
		parent := parentStack[len(parentStack)-1]
		parentStack = parentStack[:len(parentStack)-1]

		insertIntoInternal(parent, pushKey, newNode)
		if len(parent.keys) < ORDER {
			return
		}

		// parent is full -> split
		newNode, pushKey = splitInternal(parent)
	}

	// if root was split, create new root
	newRoot := newInternalNode()
	newRoot.keys = append(newRoot.keys, pushKey)
	newRoot.children = append(newRoot.children, tree.root, newNode)
	tree.root = newRoot
}

func main(){
	fmt.Println("B+ Tree implementation")
}