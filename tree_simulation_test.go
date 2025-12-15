package main

import (
	"fmt"
	"io"
	"os"
	"testing"
)

// TestInsertSimulation inserts keys step-by-step and writes a textual
// snapshot of the tree after each insertion to `tree_simulation.txt`.
// The snapshots are intended to help debugging by showing page IDs,
// node types, keys and children at each tree level.
func TestInsertSimulation(t *testing.T) {
	tree := &BPlusTree{pager: NewPageManager()}

	// sample sequence with many splits
	keys := []KeyType{10, 5, 15, 3, 7, 12, 17, 2, 4, 6, 8, 9, 11, 13, 14, 1, 16, 18, 19, 20}

	// create/overwrite the simulation output file
	f, err := os.Create("tree_simulation.txt")
	if err != nil {
		t.Fatalf("failed to create simulation file: %v", err)
	}
	defer f.Close()

	fmt.Fprintf(f, "B+Tree simulation steps (total %d inserts)\n\n", len(keys))

	for i, k := range keys {
		if err := tree.Insert(k, ValueType(fmt.Sprintf("v%d", k))); err != nil {
			t.Fatalf("insert %v error: %v", k, err)
		}

		fmt.Fprintf(f, "Step %02d: Insert %v\n", i+1, k)
		dumpTreeToWriter(tree, f)
		fmt.Fprintln(f, "----------------------------------------")
	}

	// Final verification: simple sanity check that root exists
	if tree.rootPageID == 0 {
		t.Fatalf("tree root is empty after inserts")
	}
}

// dumpTreeToWriter writes a level-order snapshot of the B+Tree into w.
// It prints each level on its own block with node page IDs and keys.
func dumpTreeToWriter(tree *BPlusTree, w io.Writer) {
	if tree.rootPageID == 0 {
		fmt.Fprintln(w, "(empty tree)")
		return
	}

	// BFS with level separation
	queue := []uint64{tree.rootPageID}
	level := 0
	for len(queue) > 0 {
		levelSize := len(queue)
		fmt.Fprintf(w, "Level %d:\n", level)
		for i := 0; i < levelSize; i++ {
			id := queue[0]
			queue = queue[1:]

			p := tree.pager.Get(id)
			if p == nil {
				fmt.Fprintf(w, "  Page %d: <nil>\n", id)
				continue
			}

			switch n := p.(type) {
			case *InternalPage:
				fmt.Fprintf(w, "  Internal[%d] keys=%v children=%v\n", n.Header.PageID, n.keys, n.children)
				// enqueue children for next level
				for _, c := range n.children {
					queue = append(queue, c)
				}
			case *LeafPage:
				fmt.Fprintf(w, "  Leaf[%d] keys=%v vals=%v next=%d prev=%d\n", n.Header.PageID, n.keys, n.values, n.Header.NextPage, n.Header.PrevPage)
			default:
				fmt.Fprintf(w, "  Page %d: unknown type\n", id)
			}
		}
		level++
		fmt.Fprintln(w)
	}
}
