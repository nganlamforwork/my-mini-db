package api

import (
	"fmt"

	"bplustree/internal/btree"
	"bplustree/internal/page"
)

// GetTreeStructure builds the full tree structure for visualization
func GetTreeStructure(tree *btree.BPlusTree) (*TreeStructure, error) {
	if tree.IsEmpty() {
		return &TreeStructure{
			RootPage: 0,
			Height:   0,
			Nodes:    make(map[uint64]TreeNode),
		}, nil
	}

	pager := tree.GetPager()
	meta, err := pager.ReadMeta()
	if err != nil {
		return nil, fmt.Errorf("failed to read meta page: %w", err)
	}

	if meta == nil || meta.RootPage == 0 {
		return &TreeStructure{
			RootPage: 0,
			Height:   0,
			Nodes:    make(map[uint64]TreeNode),
		}, nil
	}

	nodes := make(map[uint64]TreeNode)
	height := 0

	// Recursively build tree structure
	var buildNode func(pageID uint64, level int) error
	buildNode = func(pageID uint64, level int) error {
		if level > height {
			height = level
		}

		pg := pager.Get(pageID)
		if pg == nil {
			return fmt.Errorf("page not found: %d", pageID)
		}

		switch p := pg.(type) {
		case *page.InternalPage:
			keys := make([]JSONCompositeKey, len(p.Keys))
			for i, k := range p.Keys {
				keys[i] = ToJSONCompositeKey(k)
			}
			children := make([]uint64, len(p.Children))
			copy(children, p.Children)

			nodes[pageID] = TreeNode{
				PageID:   pageID,
				Type:     "internal",
				Keys:     keys,
				Children: children,
			}

			// Recursively build children
			for _, childID := range p.Children {
				if err := buildNode(childID, level+1); err != nil {
					return err
				}
			}

		case *page.LeafPage:
			keys := make([]JSONCompositeKey, len(p.Keys))
			for i, k := range p.Keys {
				keys[i] = ToJSONCompositeKey(k)
			}
			values := make([]JSONRecord, len(p.Values))
			for i, v := range p.Values {
				values[i] = ToJSONRecord(v)
			}

			var nextPage *uint64
			if p.Header.NextPage != 0 {
				np := p.Header.NextPage
				nextPage = &np
			}

			var prevPage *uint64
			if p.Header.PrevPage != 0 {
				pp := p.Header.PrevPage
				prevPage = &pp
			}

			nodes[pageID] = TreeNode{
				PageID:   pageID,
				Type:     "leaf",
				Keys:     keys,
				Values:   values,
				NextPage: nextPage,
				PrevPage: prevPage,
			}
		}

		return nil
	}

	if err := buildNode(meta.RootPage, 1); err != nil {
		return nil, err
	}

	return &TreeStructure{
		RootPage: meta.RootPage,
		Height:   height,
		Nodes:    nodes,
	}, nil
}

// GetWALInfo builds WAL information for introspection
// Note: This is a simplified version - full implementation would need access to WAL file
func GetWALInfo(tree *btree.BPlusTree) (*WALInfo, error) {
	// Note: Full WAL introspection would require access to WALManager
	// For now, return minimal info
	// In a full implementation, we'd need to read WAL entries from the file
	return &WALInfo{
		NextLSN: 0,
		Entries: []WALEntryInfo{},
	}, nil
}

// GetCacheStatsInfo retrieves cache statistics
func GetCacheStatsInfo(tree *btree.BPlusTree) *CacheStatsInfo {
	pager := tree.GetPager()
	stats := pager.GetCacheStats()
	maxSize := pager.GetMaxCacheSize()

	return &CacheStatsInfo{
		Size:      stats.Size,
		MaxSize:   maxSize,
		Hits:      stats.Hits,
		Misses:    stats.Misses,
		Evictions: stats.Evictions,
	}
}

// CachePagesInfo represents information about cached pages
type CachePagesInfo struct {
	PageIDs []uint64 `json:"pageIds"`
	Count   int      `json:"count"`
}

// GetCachePagesInfo retrieves list of all pages currently in cache
func GetCachePagesInfo(tree *btree.BPlusTree) *CachePagesInfo {
	pager := tree.GetPager()
	pageIDs := pager.GetCachedPageIDs()

	return &CachePagesInfo{
		PageIDs: pageIDs,
		Count:   len(pageIDs),
	}
}

// IOReadInfo represents I/O read statistics and details
type IOReadInfo struct {
	TotalReads uint64                 `json:"totalReads"`
	Details    []page.IOReadEntry     `json:"details,omitempty"`
}

// TreeConfigInfo represents runtime B+Tree configuration
type TreeConfigInfo struct {
	Order      int    `json:"order"`
	PageSize   int    `json:"pageSize"`
	CacheSize  int    `json:"cacheSize"`
	WalEnabled bool   `json:"walEnabled"`
	RootPageID uint64 `json:"rootPageId"`
	Height     int    `json:"height"`
}

// GetIOReadInfo retrieves I/O read statistics and details
func GetIOReadInfo(tree *btree.BPlusTree) *IOReadInfo {
	pager := tree.GetPager()
	totalReads := pager.GetIOReads()
	details := pager.GetIOReadDetails()

	return &IOReadInfo{
		TotalReads: totalReads,
		Details:    details,
	}
}

// GetTreeConfigInfo retrieves runtime B+Tree configuration
func GetTreeConfigInfo(tree *btree.BPlusTree) (*TreeConfigInfo, error) {
	pager := tree.GetPager()
	
	// Get order from page package constant
	order := int(page.ORDER)
	
	// Get page size from meta page
	meta, err := pager.ReadMeta()
	if err != nil {
		return nil, fmt.Errorf("failed to read meta page: %w", err)
	}
	
	pageSize := int(meta.PageSize)
	if pageSize == 0 {
		pageSize = 4096 // DefaultPageSize fallback
	}
	
	// Get cache size from pager
	cacheSize := pager.GetMaxCacheSize()
	
	// Check if WAL is enabled (WAL manager exists)
	// In current implementation, WAL is always enabled when tree is created
	walEnabled := true
	
	// Get root page ID
	rootPageID := uint64(0)
	if meta != nil {
		rootPageID = meta.RootPage
	}
	
	// Calculate height by traversing tree
	height := 0
	if !tree.IsEmpty() && rootPageID != 0 {
		// Use similar logic to GetTreeStructure to calculate height
		var calculateHeight func(pageID uint64, level int) error
		maxLevel := 0
		calculateHeight = func(pageID uint64, level int) error {
			if level > maxLevel {
				maxLevel = level
			}
			
			pg := pager.Get(pageID)
			if pg == nil {
				return fmt.Errorf("page not found: %d", pageID)
			}
			
			switch p := pg.(type) {
			case *page.InternalPage:
				// Recursively calculate height for children
				for _, childID := range p.Children {
					if err := calculateHeight(childID, level+1); err != nil {
						return err
					}
				}
			case *page.LeafPage:
				// Leaf node - this is the deepest level
			}
			return nil
		}
		
		if err := calculateHeight(rootPageID, 1); err == nil {
			height = maxLevel
		}
	}
	
	return &TreeConfigInfo{
		Order:      order,
		PageSize:   pageSize,
		CacheSize:  cacheSize,
		WalEnabled: walEnabled,
		RootPageID: rootPageID,
		Height:     height,
	}, nil
}