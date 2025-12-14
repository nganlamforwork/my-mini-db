package main

type BPlusTree struct {
    root *Node
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
