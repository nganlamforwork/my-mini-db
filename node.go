package main

type KeyType int
type ValueType string

// Maximum number of children in an internal node (m = 4)
// So leaf nodes can have up to ORDER-1 keys
const ORDER = 4 

type Node struct {
    isLeaf   bool
    keys     []KeyType
    values   []ValueType   // only for leaf
    children []*Node       // only for internal node
    next     *Node         // only for leaf, linked list
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