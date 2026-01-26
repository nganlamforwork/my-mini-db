package btree

import (
	"bytes"
)

// IsEmpty checks if the B+Tree is empty (has no root page).
// A tree is considered empty if meta is nil or RootPage is 0.
//
// Return: bool - true if tree is empty, false otherwise
func (tree *BPlusTree) IsEmpty() bool {
	return tree.meta == nil || tree.meta.RootPage == 0
}

// serializeKeyToBytes serializes a CompositeKey to bytes for HighKey storage.
// This is used to store HighKey in page headers.
//
// Return: []byte - serialized key bytes, empty slice on error
func serializeKeyToBytes(key KeyType) []byte {
	var buf bytes.Buffer
	if err := key.WriteTo(&buf); err != nil {
		return []byte{}
	}
	return buf.Bytes()
}
