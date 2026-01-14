package main

import (
	"fmt"

	"bplustree/internal/btree"
	"bplustree/internal/page"
)

func main() {
	fmt.Println("B+ Tree implementation")
	
	// Example usage
	pager := page.NewPageManagerWithFile("example.db", true)
	defer pager.Close()
	
	tree, err := btree.NewBPlusTree(pager)
	if err != nil {
		fmt.Printf("Error creating tree: %v\n", err)
		return
	}
	defer tree.Close()
	
	fmt.Println("B+Tree created successfully")
}
