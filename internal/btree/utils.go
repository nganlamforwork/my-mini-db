package btree

// IsEmpty checks if the B+Tree is empty (has no root page).
// A tree is considered empty if meta is nil or RootPage is 0.
//
// Return: bool - true if tree is empty, false otherwise
func (tree *BPlusTree) IsEmpty() bool {
	return tree.meta == nil || tree.meta.RootPage == 0
}
