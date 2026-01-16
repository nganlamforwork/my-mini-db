package main

import (
	"fmt"

	"bplustree/internal/btree"
)

func main() {
	fmt.Println("B+ Tree implementation")
	
	// Example usage: Create B+Tree with custom database filename
	// The PageManager is created internally and will be closed when tree.Close() is called
	tree, err := btree.NewBPlusTree("example.db", true)
	if err != nil {
		fmt.Printf("Error creating tree: %v\n", err)
		return
	}
	defer tree.Close()
	
	fmt.Println("B+Tree created successfully with custom database file: example.db")
	
	// Alternative: You can also create PageManager separately if you need more control
	// import "bplustree/internal/page"
	// pager := page.NewPageManagerWithFile("custom.db", false)
	// tree, err := btree.NewBPlusTree(pager)
	// defer tree.Close() // This will also close the pager
}
