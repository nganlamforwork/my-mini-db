package btree

import (
	"fmt"

	"bplustree/internal/common"
	"bplustree/internal/page"
	"bplustree/internal/storage"
	"bplustree/internal/transaction"
)

// Type aliases for convenience
type KeyType = storage.CompositeKey
type ValueType = storage.Record

// Type aliases for page types
type LeafPage = page.LeafPage
type InternalPage = page.InternalPage

type BPlusTree struct {
	meta      *page.MetaPage
	pager     *page.PageManager
	txManager *transaction.TransactionManager
	wal       *transaction.WALManager
	schema    *storage.Schema // Optional schema for schema-enforced operations
}

const MAX_KEYS = page.ORDER - 1
const MIN_KEYS = (page.ORDER - 1) / 2


// GetPager function used for: Returning the page manager instance (implements transaction.TreeInterface for transaction system).
//
// Algorithm steps:
// 1. Return the internal page manager pointer
//
// Return: *page.PageManager - the page manager instance
func (tree *BPlusTree) GetPager() *page.PageManager {
	return tree.pager
}

// SetSchema sets the schema for this tree
func (tree *BPlusTree) SetSchema(schema *storage.Schema) {
	tree.schema = schema
}

// GetSchema returns the current schema (may be nil)
func (tree *BPlusTree) GetSchema() *storage.Schema {
	return tree.schema
}

// NewBPlusTree function used for: Creating a new B+Tree instance with a custom database filename, automatically creating PageManager and initializing WAL/transaction support for crash recovery.
//
// Algorithm steps:
// 1. Create PageManager - Initialize PageManager with specified filename and truncate flag (default cache size)
// 2. Initialize WAL manager - Create WAL manager using the database filename
// 3. Initialize transaction manager - Create transaction manager with WAL manager
// 4. Create BPlusTree struct - Create tree with page manager, transaction manager, and WAL
// 5. Attempt WAL recovery - Restore committed state from previous session if WAL exists
// 6. Load meta page - Load meta page from disk if it exists
// 7. Return initialized tree - Return tree instance ready for use
//
// Note: The PageManager is managed internally by the BPlusTree. When tree.Close() is called, it will close both the WAL and the PageManager.
// Uses default cache size (100 pages). For custom cache size, use NewBPlusTreeWithCacheSize().
//
// Return: (*BPlusTree, error) - new B+Tree instance, error if PageManager creation or WAL initialization fails
func NewBPlusTree(filename string, truncate bool) (*BPlusTree, error) {
	// Create PageManager with specified filename (default cache size)
	pager := page.NewPageManagerWithFile(filename, truncate)
	
	// Initialize WAL manager using database filename
	wal, err := transaction.NewWALManager(filename)
	if err != nil {
		pager.Close() // Close pager on error to avoid resource leak
		return nil, fmt.Errorf("failed to create WAL: %w", err)
	}

	// Initialize transaction manager
	txManager := transaction.NewTransactionManager(wal)

	tree := &BPlusTree{
		pager:     pager,
		txManager: txManager,
		wal:       wal,
	}

	// Try to recover from WAL if needed
	if err := wal.Recover(pager); err != nil {
		// If recovery fails, continue anyway (might be first run)
		// In production, you'd want better error handling
	}

	// Load meta page
	meta, err := pager.ReadMeta()
	if err == nil {
		tree.meta = meta
	}

	return tree, nil
}

// NewBPlusTreeWithCacheSize function used for: Creating a new B+Tree instance with a custom database filename and configurable cache size, automatically creating PageManager and initializing WAL/transaction support for crash recovery.
//
// Algorithm steps:
// 1. Create PageManager - Initialize PageManager with specified filename, truncate flag, and custom cache size
// 2. Initialize WAL manager - Create WAL manager using the database filename
// 3. Initialize transaction manager - Create transaction manager with WAL manager
// 4. Create BPlusTree struct - Create tree with page manager, transaction manager, and WAL
// 5. Attempt WAL recovery - Restore committed state from previous session if WAL exists
// 6. Load meta page - Load meta page from disk if it exists
// 7. Return initialized tree - Return tree instance ready for use
//
// Note: The PageManager is managed internally by the BPlusTree. When tree.Close() is called, it will close both the WAL and the PageManager.
// This allows users to configure cache size based on available memory and workload requirements.
//
// Parameters:
//   - filename: Database filename (e.g., "mydb.db")
//   - truncate: true to create new database, false to open existing
//   - maxCacheSize: Maximum number of pages to cache in memory (e.g., 200 for ~800KB cache)
//
// Return: (*BPlusTree, error) - new B+Tree instance, error if PageManager creation or WAL initialization fails
func NewBPlusTreeWithCacheSize(filename string, truncate bool, maxCacheSize int) (*BPlusTree, error) {
	// Create PageManager with specified filename and custom cache size
	pager := page.NewPageManagerWithCacheSize(filename, truncate, maxCacheSize)
	
	// Initialize WAL manager using database filename
	wal, err := transaction.NewWALManager(filename)
	if err != nil {
		pager.Close() // Close pager on error to avoid resource leak
		return nil, fmt.Errorf("failed to create WAL: %w", err)
	}

	// Initialize transaction manager
	txManager := transaction.NewTransactionManager(wal)

	tree := &BPlusTree{
		pager:     pager,
		txManager: txManager,
		wal:       wal,
	}

	// Try to recover from WAL if needed
	if err := wal.Recover(pager); err != nil {
		// If recovery fails, continue anyway (might be first run)
		// In production, you'd want better error handling
	}

	// Load meta page
	meta, err := pager.ReadMeta()
	if err == nil {
		tree.meta = meta
	}

	return tree, nil
}

// Begin function used for: Starting a new explicit transaction for multi-operation atomicity (all operations commit together or all rollback).
//
// Algorithm steps:
// 1. Call transaction manager to begin new explicit transaction
// 2. Return any error from transaction manager
//
// Return: error - nil on success, error if transaction cannot be started
func (tree *BPlusTree) Begin() error {
	_, err := tree.txManager.Begin(tree)
	return err
}

// Commit function used for: Committing the current transaction, persisting all page modifications to disk via WAL and clearing transaction state.
//
// Algorithm steps:
// 1. Call transaction manager to commit current transaction
// 2. If auto-commit transaction, commit and clear auto-commit flag
// 3. Write all modified pages to disk and sync WAL
//
// Return: error - nil on success, error if commit fails
func (tree *BPlusTree) Commit() error {
	return tree.txManager.Commit()
}

// Rollback function used for: Rolling back the current transaction, discarding all uncommitted modifications and restoring previous state.
//
// Algorithm steps:
// 1. Call transaction manager to rollback current transaction
// 2. Discard all tracked page modifications
// 3. Reload meta page from pager to ensure tree state is consistent
// 4. Clear transaction state without writing to disk
//
// Return: error - nil on success, error if rollback fails
func (tree *BPlusTree) Rollback() error {
	err := tree.txManager.Rollback()
	if err != nil {
		return err
	}
	
	// Reload meta page from pager to ensure tree state is consistent after rollback
	if tree.pager != nil {
		meta, err := tree.pager.ReadMeta()
		if err == nil {
			tree.meta = meta
		}
	}
	
	return nil
}

// ensureAutoCommitTransaction function used for: Ensuring a transaction exists for single operations to provide crash recovery guarantees.
//
// Algorithm steps:
// 1. Check if transaction manager exists, return false if not
// 2. Check if active transaction already exists
// 3. If no active transaction, create new auto-commit transaction
// 4. Return true if new transaction was created, false otherwise
//
// Return: bool - true if new auto-commit transaction was created, false if transaction already exists
func (tree *BPlusTree) ensureAutoCommitTransaction() bool {
	if tree.txManager == nil {
		return false
	}
	
	activeTx := tree.txManager.GetActiveTransaction()
	if activeTx == nil {
		// No active transaction, create auto-commit one
		_, _ = tree.txManager.BeginAutoCommit(tree)
		return true
	}
	return false
}

// commitAutoTransaction function used for: Committing an auto-commit transaction if one exists, ensuring single operations are crash-safe.
//
// Algorithm steps:
// 1. Check if transaction manager exists, return nil if not
// 2. Check if current transaction is auto-commit
// 3. If auto-commit, commit the transaction
// 4. Return nil if no auto-commit transaction exists
//
// Return: error - nil on success or if no auto-commit transaction, error if commit fails
func (tree *BPlusTree) commitAutoTransaction() error {
	if tree.txManager == nil {
		return nil
	}
	
	if tree.txManager.IsAutoCommit() {
		return tree.txManager.Commit()
	}
	return nil
}

// Checkpoint function used for: Creating a checkpoint in the WAL to mark a stable point for recovery and allow WAL truncation.
//
// Algorithm steps:
// 1. Call transaction manager to create WAL checkpoint
// 2. Write checkpoint entry to WAL marking all committed transactions
// 3. Allow WAL truncation up to checkpoint position
//
// Return: error - nil on success, error if checkpoint creation fails
func (tree *BPlusTree) Checkpoint() error {
	return tree.txManager.Checkpoint()
}

// Close function used for: Closing the WAL and page manager, ensuring all data is flushed to disk and resources are released.
//
// Algorithm steps:
// 1. Close WAL manager if it exists, flushing all pending writes
// 2. Close page manager if it exists, flushing page cache to disk
// 3. Return any error from closing operations
//
// Return: error - nil on success, error if closing fails
func (tree *BPlusTree) Close() error {
	if tree.wal != nil {
		if err := tree.wal.Close(); err != nil {
			return err
		}
	}
	if tree.pager != nil {
		return tree.pager.Close()
	}
	return nil
}

// findLeaf function used for: Traversing the B+Tree from root to locate the leaf page that should contain (or receive) the given key.
//
// Algorithm steps:
// 1. Load meta page if not already loaded
// 2. Start from root page ID stored in meta
// 3. Iteratively traverse internal nodes until leaf is reached
// 4. For each internal node, perform binary search to find last key <= search key
// 5. Follow corresponding child pointer to next level
// 6. Track path of internal page IDs from root to leaf (excluding leaf itself)
// 7. Return target leaf page, path of internal nodes, and any error
//
// Return: (*LeafPage, []uint64, error) - target leaf page, path of internal page IDs from root to leaf, error if page not found
func (tree *BPlusTree) findLeaf(key KeyType) (*LeafPage, []uint64, error) {
	path := make([]uint64, 0)
	depth := 0

	// ensure meta is loaded
	if tree.meta == nil {
		if m, err := tree.pager.ReadMeta(); err == nil {
			tree.meta = m
		}
	}

	currentID := uint64(0)
	if tree.meta != nil {
		currentID = tree.meta.RootPage
	}

	for {
		page := tree.pager.Get(currentID)
		if page == nil {
			return nil, nil, fmt.Errorf("page not found: %d", currentID)
		}

		switch p := page.(type) {
		case *LeafPage:
			return p, path, nil

		case *InternalPage:
			path = append(path, currentID)

			// binary search: last key <= key
			pos := common.BinarySearchLastLessOrEqual(p.Keys, key)

			// If pos == -1 then all keys in the internal node are > key,
			// so the correct child to follow is the left-most child (index 0).
			var childIndex int
			if pos == -1 {
				childIndex = 0
			} else {
				childIndex = pos + 1
			}

			currentID = p.Children[childIndex]
			depth++

		default:
			return nil, nil, fmt.Errorf("unknown page type for page ID: %d", currentID)
		}
	}
}

// Insert function used for: B+Tree insertion with automatic node splitting to maintain balance. The operation handles two cases: simple insertion (no split) and insertion with splits that propagate upward.
//
// Algorithm steps:
// 1. Handle empty tree - Create root leaf if tree is empty
// 2. Find target leaf - Navigate to leaf that should contain the key
// 3. Check duplicates - Return error if key already exists
// 4. Insert into leaf - Add key-value pair in sorted order
// 5. Check overflow - Verify if leaf exceeds capacity (key count or payload size)
// 6. Split if needed - Split leaf and propagate split upward through internal nodes
// 7. Create new root - If root splits, create new root internal node
//
// Return: error - nil on success, error if duplicate key or operation fails
func (tree *BPlusTree) Insert(key KeyType, value ValueType) error {
	// Auto-commit: Ensures crash recovery even for single operations
	wasAutoCommit := tree.ensureAutoCommitTransaction()
	defer func() {
		if wasAutoCommit {
			_ = tree.commitAutoTransaction()
		}
	}()

	// 1. Empty tree → create root leaf
	if tree.meta == nil {
		if m, err := tree.pager.ReadMeta(); err == nil {
			tree.meta = m
		} else {
		// fallback: create a new meta page in-memory
		tree.meta = &page.MetaPage{RootPage: 0, PageSize: uint32(page.DefaultPageSize), Order: uint16(page.ORDER), Version: 1}
		}
	}

	if tree.meta.RootPage == 0 {
		leaf := tree.pager.NewLeaf()
		leaf.Keys = append(leaf.Keys, key)
		leaf.Values = append(leaf.Values, value)
		leaf.Header.KeyCount = 1
		tree.meta.RootPage = leaf.Header.PageID
		
		// Ensure meta page is properly initialized for transaction tracking
		tree.meta.Header.PageID = 1
		tree.meta.Header.PageType = page.PageTypeMeta
		
		// Track page modifications for transaction (will be persisted on commit)
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
			tree.txManager.TrackPageModification(1, tree.meta, tree)
		}
		
		// Meta page will be written during transaction commit (via defer)
		return nil
	}

	// 2. Find target leaf + path to parent
	leaf, path, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Check for duplicate keys using binary search
	if common.BinarySearch(leaf.Keys, key) != -1 {
		return fmt.Errorf("duplicate key insertion: %v", key)
	}

	// Insert into the leaf in sorted order
	if err := page.InsertIntoLeaf(leaf, key, value); err != nil {
		return err
	}

	// Track page modification for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
	}

	// Check for overflow
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	keyOverflow := len(leaf.Keys) > MAX_KEYS
	sizeOverflow := page.ComputeLeafPayloadSize(leaf) > payloadCapacity
	isOverflow := keyOverflow || sizeOverflow

	// If the leaf does not overflow (by key count or payload), we're done
	if !isOverflow {
		return nil
	}

	// 3. Split leaf
	var pushKey KeyType
	newLeaf := tree.pager.NewLeaf()
	
	pushKey = page.SplitLeaf(leaf, newLeaf)

	// Track page modifications for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
		tree.txManager.TrackPageAllocation(newLeaf.Header.PageID, newLeaf, tree)
	}

	var childPageID uint64 = newLeaf.Header.PageID

	// 4. Propagate split up: insert the promoted key into parent
	//    internal nodes. If a parent overflows, split it and
	//    continue upward. `childPageID` always points to the
	//    right-side page produced by the most recent split.
	parentDepth := len(path) - 1
	for len(path) > 0 {
		parentID := path[len(path)-1]
		path = path[:len(path)-1]

		parent := tree.pager.Get(parentID).(*page.InternalPage)

		// Insert the separator key and pointer into parent
		page.InsertIntoInternal(parent, pushKey, childPageID)

		// Track parent modification
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(parentID, parent, tree)
		}

		// If parent didn't overflow, split propagation stops
		if len(parent.Keys) < page.ORDER {
			return nil
		}

		// split internal
		newInternal := tree.pager.NewInternal()
		pushKey = page.SplitInternal(parent, newInternal, tree.pager)
		
		// Track new internal page
		if tree.txManager != nil {
			tree.txManager.TrackPageAllocation(newInternal.Header.PageID, newInternal, tree)
		}
		
		childPageID = newInternal.Header.PageID
		parentDepth--
	}

	// 5. Root split → create new root
	newRoot := tree.pager.NewInternal()
	newRoot.Keys = append(newRoot.Keys, pushKey)
	newRoot.Children = append(
		newRoot.Children,
		tree.meta.RootPage,
		childPageID,
	)

	// Ensure correct type assertions for left and right children
		if left, ok := tree.pager.Get(tree.meta.RootPage).(*page.InternalPage); ok {
		left.Header.ParentPage = newRoot.Header.PageID
	} else if leftLeaf, ok := tree.pager.Get(tree.meta.RootPage).(*page.LeafPage); ok {
		leftLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	if right, ok := tree.pager.Get(childPageID).(*page.InternalPage); ok {
		right.Header.ParentPage = newRoot.Header.PageID
	} else if rightLeaf, ok := tree.pager.Get(childPageID).(*page.LeafPage); ok {
		rightLeaf.Header.ParentPage = newRoot.Header.PageID
	}

	newRoot.Header.KeyCount = 1
	
	// Update meta root
	tree.meta.RootPage = newRoot.Header.PageID
	
	// Ensure meta page is properly initialized for transaction tracking
	tree.meta.Header.PageID = 1
	tree.meta.Header.PageType = page.PageTypeMeta
	
	// Track new root and meta modifications (will be persisted on commit)
	if tree.txManager != nil {
		tree.txManager.TrackPageAllocation(newRoot.Header.PageID, newRoot, tree)
		tree.txManager.TrackPageModification(1, tree.meta, tree)
	}
	
	// Meta page will be written during transaction commit (via defer)
	return nil
}

// Load function used for: Enabling the database to reload an existing tree structure from disk into memory when the application starts.
//
// Algorithm steps:
// 1. Initialize file handle - Open database file in read/write mode without truncating existing data (handle already initialized in NewBPlusTree)
// 2. Load metadata - Read meta page (page 1) to obtain root page ID and tree configuration
// 3. Traverse tree structure - Starting from root, recursively visit each node in depth-first order (handle by loadPage function - recursively)
// 4. Cache pages - Load each page into memory hash map, keyed by page ID (automatic via PageManager.Get() which caches pages when loading from disk)
//
// Return: error - nil on success, error if meta page read fails or page loading fails
func (tree *BPlusTree) Load() error {
	// Load meta page first
	meta, err := tree.pager.ReadMeta()
	if err != nil {
		return fmt.Errorf("failed to read meta page: %w", err)
	}
	tree.meta = meta

	// If tree is empty, nothing to load
	if tree.meta.RootPage == 0 {
		return nil
	}

	// Recursively load all pages starting from root
	return tree.loadPage(tree.meta.RootPage)
}

// loadPage function used for: Recursively loading a page and all its descendant pages from disk into memory cache during tree initialization.
//
// Algorithm steps:
// 1. If pageID is 0, return immediately (no page to load)
// 2. Get page from page manager (loads from disk if not in cache, then caches it)
// 3. If page is an internal node, recursively load all child pages
// 4. Continue recursion until all leaf pages are reached
//
// Return: error - nil on success, error if page loading fails
func (tree *BPlusTree) loadPage(pageID uint64) error {
	if pageID == 0 {
		return nil
	}

	// Get will load the page from disk if not already in cache (and caches it), otherwise returns the page from cache
	page := tree.pager.Get(pageID)
	if page == nil {
		return fmt.Errorf("failed to load page %d", pageID)
	}

	// If it's an internal node, recursively load all children
	if internal, ok := page.(*InternalPage); ok {
		for _, childID := range internal.Children {
			if err := tree.loadPage(childID); err != nil {
				return err
			}
		}
	}

	return nil
}

// Search function used for: Standard B+Tree search with O(log n) complexity through binary search at both internal nodes and leaves.
//
// Algorithm steps:
// 1. Start at root - Begin traversal from the root page
// 2. Navigate internal nodes - Binary search keys to determine correct child pointer (use findLeaf function)
// 3. Follow path downward - Descend through internal nodes until reaching a leaf
// 4. Search leaf - Binary search in the leaf's sorted key array
// 5. Return result - Return value if found, error otherwise
//
// Return: (ValueType, error) - value associated with key on success, error if key not found or tree is empty
func (tree *BPlusTree) Search(key KeyType) (ValueType, error) {
	// Empty tree
	if tree.IsEmpty() {
		return storage.Record{}, fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find the leaf that should contain the key
	leaf, _, err := tree.findLeaf(key)
	if err != nil {
		return storage.Record{}, err
	}

	// Search for the key in the leaf using binary search (exact match)
	index := common.BinarySearch(leaf.Keys, key)
	if index != -1 {
		value := leaf.Values[index]
		return value, nil
	}

	return storage.Record{}, fmt.Errorf("key not found: %v", key)
}

// SearchRange function used for: Efficient range scanning leveraging the leaf-level doubly-linked list.
// Unlike point queries that require tree traversal, range queries follow horizontal links between leaves after locating the start position.
//
// Algorithm steps:
// 1. Validate range - Ensure startKey ≤ endKey
// 2. Locate start leaf - Find leaf containing or after startKey
// 3. Scan current leaf - Collect keys within range
// 4. Follow leaf chain - Use NextPage pointer to traverse horizontally
// 5. Early termination - Stop when keys exceed endKey
// 6. Return results - Aggregate collected key-value pairs
//
// Return: ([]KeyType, []ValueType, error) - slice of keys, slice of values, error if range is invalid
func (tree *BPlusTree) SearchRange(startKey, endKey KeyType) ([]KeyType, []ValueType, error) {
	// Validate range
	if startKey.Compare(endKey) > 0 {
		return nil, nil, fmt.Errorf("invalid range: startKey %v > endKey %v", startKey, endKey)
	}

	// Empty tree
	if tree.IsEmpty() {
		return []KeyType{}, []ValueType{}, nil
	}

	// Find the leaf containing or after startKey
	leaf, _, err := tree.findLeaf(startKey)
	if err != nil {
		return nil, nil, err
	}

	keys := make([]KeyType, 0)
	values := make([]ValueType, 0)

	// Traverse leaves using the linked list
	for leaf != nil {
		// Find starting position using binary search
		startIdx := common.BinarySearchFirstGreaterOrEqual(leaf.Keys, startKey)
		
		// Scan keys in current leaf from start position
		for i := startIdx; i < len(leaf.Keys); i++ {
			k := leaf.Keys[i]
			if k.Compare(startKey) >= 0 && k.Compare(endKey) <= 0 {
				keys = append(keys, k)
				values = append(values, leaf.Values[i])
			}
			// Early exit if we've passed endKey
			if k.Compare(endKey) > 0 {
				return keys, values, nil
			}
		}

		// If last key in this leaf is still < endKey, continue to next leaf
		if len(leaf.Keys) > 0 && leaf.Keys[len(leaf.Keys)-1].Compare(endKey) < 0 {
			if leaf.Header.NextPage == 0 {
				break
			}
			nextPage := tree.pager.Get(leaf.Header.NextPage)
			if nextPage == nil {
				break
			}
			leaf = nextPage.(*page.LeafPage)
		} else {
			break
		}
	}

	return keys, values, nil
}

// Update function used for: Atomic value modification that optimizes for the common case where the new value fits in the existing page.
// The implementation avoids unnecessary tree rebalancing by performing in-place updates when possible, falling back to delete-insert only when required.
//
// Algorithm steps:
// 1. Locate key - Find leaf containing target key
// 2. Verify existence - Return error if key not found
// 3. Calculate size change - Compare old and new value sizes
// 4. Check capacity - Determine if new value fits in current page
// 5. In-place update - If fits, replace value and update free space
// 6. Fallback - If doesn't fit, delete old entry and re-insert
//
// Return: error - nil on success, error if key not found or update operation fails
func (tree *BPlusTree) Update(key KeyType, newValue ValueType) error {
	// Auto-commit: Ensures crash recovery even for single operations
	wasAutoCommit := tree.ensureAutoCommitTransaction()
	defer func() {
		if wasAutoCommit {
			_ = tree.commitAutoTransaction()
		}
	}()

	// Empty tree
	if tree.IsEmpty() {
		return fmt.Errorf("key not found: %v (empty tree)", key)
	}

	// Find the leaf containing the key
	leaf, _, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Find the key in the leaf using binary search
	keyIndex := common.BinarySearch(leaf.Keys, key)
	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	oldValue := leaf.Values[keyIndex]
	
	// Calculate size change
	oldSize := oldValue.Size()
	newSize := newValue.Size()
	sizeDelta := newSize - oldSize

	// Check if new value fits in current page
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	currentUsed := page.ComputeLeafPayloadSize(leaf)
	
	// If the new value fits, do in-place update
	if currentUsed + sizeDelta <= payloadCapacity {
		leaf.Values[keyIndex] = newValue
		
		// Update free space
		used := page.ComputeLeafPayloadSize(leaf)
		if used > payloadCapacity {
			leaf.Header.FreeSpace = 0
		} else {
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
		}
		
		// Track page modification for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
		}
		
		return nil
	}

	// If new value doesn't fit, fall back to delete + insert
	// This may trigger rebalancing
	if err := tree.Delete(key); err != nil {
		return fmt.Errorf("update failed during delete: %w", err)
	}
	
	if err := tree.Insert(key, newValue); err != nil {
		return fmt.Errorf("update failed during insert: %w", err)
	}

	return nil
}

// Delete function used for: Full B+Tree deletion maintaining tree balance through redistribution (borrowing) and merging.
// The algorithm handles both leaf and internal node rebalancing with proper separator key management.
//
// Algorithm steps:
// 1. Locate and remove - Find leaf and remove key-value pair
// 2. Check underflow - Verify node maintains minimum occupancy
// 3. Try borrowing - Attempt to borrow from sibling with surplus keys
// 4. Merge if needed - If siblings at minimum, merge nodes and remove separator
// 5. Propagate upward - Recursively rebalance parent if it underflows
// 6. Handle root - Reduce tree height when root has single child
//
// Return: error - nil on success, error if key not found or deletion fails
func (tree *BPlusTree) Delete(key KeyType) error {
	// Auto-commit: Ensures crash recovery even for single operations
	wasAutoCommit := tree.ensureAutoCommitTransaction()
	defer func() {
		if wasAutoCommit {
			_ = tree.commitAutoTransaction()
		}
	}()

	// Empty tree
	if tree.IsEmpty() {
		return fmt.Errorf("cannot delete from empty tree")
	}

	// Find the target leaf and path
	leaf, path, err := tree.findLeaf(key)
	if err != nil {
		return err
	}

	// Find and remove the key from the leaf using binary search
	keyIndex := common.BinarySearch(leaf.Keys, key)
	if keyIndex == -1 {
		return fmt.Errorf("key not found: %v", key)
	}

	// Remove the key and value
	leaf.Keys = append(leaf.Keys[:keyIndex], leaf.Keys[keyIndex+1:]...)
	leaf.Values = append(leaf.Values[:keyIndex], leaf.Values[keyIndex+1:]...)
	leaf.Header.KeyCount = uint16(len(leaf.Keys))

	// Recompute free space
	payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
	used := page.ComputeLeafPayloadSize(leaf)
	leaf.Header.FreeSpace = uint16(payloadCapacity - used)

	// Track page modification for transaction
	if tree.txManager != nil {
		tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
	}

	// If this is the root and it's a leaf, we're done
	if len(path) == 0 {
		// If root is now empty, reset tree
		if len(leaf.Keys) == 0 {
			tree.meta.RootPage = 0
			
			// Ensure meta page is properly initialized for transaction tracking
			tree.meta.Header.PageID = 1
			tree.meta.Header.PageType = page.PageTypeMeta
			
			// Track meta modification (will be persisted on commit)
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(1, tree.meta, tree)
			}
			
			// Meta page will be written during transaction commit (via defer)
			return nil
		}
		return nil
	}

	// Check if leaf needs rebalancing
	if len(leaf.Keys) >= MIN_KEYS {
		return nil // No underflow, we're done
	}

	// Handle underflow: try to borrow or merge
	return tree.rebalanceLeafAfterDelete(leaf, path)
}

// rebalanceLeafAfterDelete function used for: Handling leaf node underflow by attempting to borrow keys from siblings (preferred strategy)
// or merging with siblings when borrowing is not possible.
//
// Algorithm steps:
// 1. Get parent internal node from path
// 2. Find index of current leaf in parent's children array
// 3. Try borrow from right sibling first - If exists and has surplus keys, move first key from right to left
// 4. Update parent separator - Adjust separator key in parent to reflect new boundary
// 5. Try borrow from left sibling - If right borrow fails and left exists with surplus, move last key from left to right
// 6. Update parent separator - Adjust separator key in parent to reflect new boundary
// 7. Merge if cannot borrow - If both siblings at minimum, merge with right sibling (preferred) or left sibling
// 8. Update sibling links - Maintain doubly-linked list between leaves
// 9. Remove separator from parent - Delete separator key and child pointer
// 10. Propagate upward - Recursively rebalance parent if it underflows after merge
//
// Return: error - nil on success, error if parent-child relationship is broken
func (tree *BPlusTree) rebalanceLeafAfterDelete(leaf *page.LeafPage, path []uint64) error {
	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*InternalPage)

	// Find the index of this leaf in parent's children
	childIndex := -1
	for i, childID := range parent.Children {
		if childID == leaf.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("invalid parent-child relationship")
	}

	// Try to borrow from right sibling first
	if childIndex < len(parent.Children)-1 {
		// Get right sibling
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.LeafPage)

		if len(rightSibling.Keys) > MIN_KEYS {
			// Borrow from right sibling
			leaf.Keys = append(leaf.Keys, rightSibling.Keys[0])
			leaf.Values = append(leaf.Values, rightSibling.Values[0])
			leaf.Header.KeyCount = uint16(len(leaf.Keys))

			rightSibling.Keys = rightSibling.Keys[1:]
			rightSibling.Values = rightSibling.Values[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.Keys))

			// Update separator key in parent
			parent.Keys[childIndex] = rightSibling.Keys[0]

			// Recompute free space for this leaf and right sibling
			payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
			used := page.ComputeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedRight := page.ComputeLeafPayloadSize(rightSibling)
			rightSibling.Header.FreeSpace = uint16(payloadCapacity - usedRight)

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
				tree.txManager.TrackPageModification(rightSibling.Header.PageID, rightSibling, tree)
				tree.txManager.TrackPageModification(parentID, parent, tree)
			}

			return nil
		}
	}

	// Try to borrow from left sibling (same logic as right sibling)
	if childIndex > 0 {
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.LeafPage)

		if len(leftSibling.Keys) > MIN_KEYS {
			// Borrow from left sibling
			lastIdx := len(leftSibling.Keys) - 1
			
			// Insert at beginning of current leaf
			leaf.Keys = append([]KeyType{leftSibling.Keys[lastIdx]}, leaf.Keys...)
			leaf.Values = append([]ValueType{leftSibling.Values[lastIdx]}, leaf.Values...)
			leaf.Header.KeyCount = uint16(len(leaf.Keys))

			leftSibling.Keys = leftSibling.Keys[:lastIdx]
			leftSibling.Values = leftSibling.Values[:lastIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

			// Update separator key in parent
			parent.Keys[childIndex-1] = leaf.Keys[0]

			// Recompute free space
			payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
			used := page.ComputeLeafPayloadSize(leaf)
			leaf.Header.FreeSpace = uint16(payloadCapacity - used)
			usedLeft := page.ComputeLeafPayloadSize(leftSibling)
			leftSibling.Header.FreeSpace = uint16(payloadCapacity - usedLeft)

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
				tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling, tree)
				tree.txManager.TrackPageModification(parentID, parent, tree)
			}

			return nil
		}
	}

	// Cannot borrow, must merge
	// Merge with right sibling if possible, otherwise with left
	if childIndex < len(parent.Children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.LeafPage)

		// Merge right into current
		leaf.Keys = append(leaf.Keys, rightSibling.Keys...)
		leaf.Values = append(leaf.Values, rightSibling.Values...)
		leaf.Header.KeyCount = uint16(len(leaf.Keys))
		leaf.Header.NextPage = rightSibling.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leaf.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leaf.Header.NextPage).(*page.LeafPage)
			nextPage.Header.PrevPage = leaf.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
		used := page.ComputeLeafPayloadSize(leaf)
		leaf.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and right child from parent
		parent.Keys = append(parent.Keys[:childIndex], parent.Keys[childIndex+1:]...)
		parent.Children = append(parent.Children[:childIndex+1], parent.Children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leaf.Header.PageID, leaf, tree)
			if leaf.Header.NextPage != 0 {
				nextPage := tree.pager.Get(leaf.Header.NextPage)
				if nextPage != nil {
					tree.txManager.TrackPageModification(leaf.Header.NextPage, nextPage, tree)
				}
			}
			tree.txManager.TrackPageModification(parentID, parent, tree)
		}

	} else {
		// Merge with left sibling
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.LeafPage)

		// Merge current into left
		leftSibling.Keys = append(leftSibling.Keys, leaf.Keys...)
		leftSibling.Values = append(leftSibling.Values, leaf.Values...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))
		leftSibling.Header.NextPage = leaf.Header.NextPage

		// Update next sibling's prev pointer if it exists
		if leftSibling.Header.NextPage != 0 {
			nextPage := tree.pager.Get(leftSibling.Header.NextPage).(*page.LeafPage)
			nextPage.Header.PrevPage = leftSibling.Header.PageID
		}

		// Recompute free space
		payloadCapacity := int(page.DefaultPageSize - page.PageHeaderSize)
		used := page.ComputeLeafPayloadSize(leftSibling)
		leftSibling.Header.FreeSpace = uint16(payloadCapacity - used)

		// Remove separator key and current child from parent
		parent.Keys = append(parent.Keys[:childIndex-1], parent.Keys[childIndex:]...)
		parent.Children = append(parent.Children[:childIndex], parent.Children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling, tree)
			if leftSibling.Header.NextPage != 0 {
				nextPage := tree.pager.Get(leftSibling.Header.NextPage)
				if nextPage != nil {
					tree.txManager.TrackPageModification(leftSibling.Header.NextPage, nextPage, tree)
				}
			}
			tree.txManager.TrackPageModification(parentID, parent, tree)
		}
	}

	// Propagate underflow to parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}

// rebalanceInternalAfterDelete function used for: Handling internal node underflow by borrowing from siblings (preferred strategy)
// or merging, and reducing tree height when root has single child.
//
// Algorithm steps:
// 1. Root reduction - If root has no keys and one child, make that child the new root
// 2. Check underflow - If node has enough keys, return (no rebalancing needed)
// 3. Get parent internal node from path
// 4. Find index of current node in parent's children array
// 5. Try borrow from right sibling - Pull separator from parent, add separator and first child from right to current node
// 6. Push new separator to parent - Update parent with first key of right sibling as new separator
// 7. Update parent pointers - Set parent of moved child to borrowing node
// 8. Try borrow from left sibling - If right borrow fails, pull separator from parent, add separator and last child from left to current node
// 9. Push new separator to parent - Update parent with last key of left sibling as new separator
// 10. Update parent pointers - Set parent of moved child to borrowing node
// 11. Merge if cannot borrow - If both siblings at minimum, merge with right sibling (preferred) or left sibling
// 12. Pull separator from parent - Integrate separator key into merged node
// 13. Update parent pointers - Set parent of all moved children to merged node
// 14. Remove separator from parent - Delete separator key and child pointer
// 15. Propagate upward - Recursively rebalance parent's parent if parent underflows after merge
//
// Return: error - nil on success, error if parent-child relationship is broken
func (tree *BPlusTree) rebalanceInternalAfterDelete(node *page.InternalPage, path []uint64) error {
	// If this is the root
	if len(path) == 0 {
		// If root has no keys and one child, make that child the new root
		if len(node.Keys) == 0 && len(node.Children) == 1 {
			tree.meta.RootPage = node.Children[0]
			
			// Update parent pointer of new root
			newRoot := tree.pager.Get(tree.meta.RootPage)
			switch r := newRoot.(type) {
			case *page.InternalPage:
				r.Header.ParentPage = 0
				if tree.txManager != nil {
					tree.txManager.TrackPageModification(r.Header.PageID, r, tree)
				}
			case *page.LeafPage:
				r.Header.ParentPage = 0
				if tree.txManager != nil {
					tree.txManager.TrackPageModification(r.Header.PageID, r, tree)
				}
			}
			
			// Ensure meta page is properly initialized for transaction tracking
			tree.meta.Header.PageID = 1
			tree.meta.Header.PageType = page.PageTypeMeta
			
			// Track meta modification (will be persisted on commit)
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(1, tree.meta, tree)
			}
			
			// Meta page will be written during transaction commit (via defer)
			return nil
		}
		return nil
	}

	// Check if node has enough keys
	if len(node.Keys) >= MIN_KEYS {
		return nil
	}

	// Get parent
	parentID := path[len(path)-1]
	parent := tree.pager.Get(parentID).(*page.InternalPage)

	// Find the index of this node in parent's children
	childIndex := -1
	for i, childID := range parent.Children {
		if childID == node.Header.PageID {
			childIndex = i
			break
		}
	}

	if childIndex == -1 {
		return fmt.Errorf("parent-child relationship broken in internal node")
	}

	// Try to borrow from right sibling
	if childIndex < len(parent.Children)-1 {
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.InternalPage)

		if len(rightSibling.Keys) > MIN_KEYS {
			// Pull separator from parent
			separatorKey := parent.Keys[childIndex]

			// Borrow from right sibling
			node.Keys = append(node.Keys, separatorKey)
			node.Children = append(node.Children, rightSibling.Children[0])
			node.Header.KeyCount = uint16(len(node.Keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(rightSibling.Children[0])
			switch c := movedChild.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push first key of right sibling to parent
			parent.Keys[childIndex] = rightSibling.Keys[0]

			// Remove first key and child from right sibling
			rightSibling.Keys = rightSibling.Keys[1:]
			rightSibling.Children = rightSibling.Children[1:]
			rightSibling.Header.KeyCount = uint16(len(rightSibling.Keys))

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(node.Header.PageID, node, tree)
				tree.txManager.TrackPageModification(rightSibling.Header.PageID, rightSibling, tree)
				tree.txManager.TrackPageModification(parentID, parent, tree)
				if movedChild != nil {
					switch c := movedChild.(type) {
					case *page.InternalPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c, tree)
					case *page.LeafPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c, tree)
				}
			}
		}

		return nil
		}
	}

	// Try to borrow from left sibling
	if childIndex > 0 {
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.InternalPage)

		if len(leftSibling.Keys) > MIN_KEYS {
			// Pull separator from parent
			separatorKey := parent.Keys[childIndex-1]
			
			// Insert at beginning of current node
			node.Keys = append([]KeyType{separatorKey}, node.Keys...)
			lastChildIdx := len(leftSibling.Children) - 1
			node.Children = append([]uint64{leftSibling.Children[lastChildIdx]}, node.Children...)
			node.Header.KeyCount = uint16(len(node.Keys))

			// Update parent pointer of moved child
			movedChild := tree.pager.Get(leftSibling.Children[lastChildIdx])
			switch c := movedChild.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}

			// Push last key of left sibling to parent
			lastKeyIdx := len(leftSibling.Keys) - 1
			parent.Keys[childIndex-1] = leftSibling.Keys[lastKeyIdx]

			// Remove last key and child from left sibling
			leftSibling.Keys = leftSibling.Keys[:lastKeyIdx]
			leftSibling.Children = leftSibling.Children[:lastChildIdx]
			leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

			// Track page modifications for transaction
			if tree.txManager != nil {
				tree.txManager.TrackPageModification(node.Header.PageID, node, tree)
				tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling, tree)
				tree.txManager.TrackPageModification(parentID, parent, tree)
				if movedChild != nil {
					switch c := movedChild.(type) {
					case *page.InternalPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c, tree)
					case *page.LeafPage:
						tree.txManager.TrackPageModification(c.Header.PageID, c, tree)
				}
			}
		}

		return nil
		}
	}

	// Cannot borrow, must merge
	if childIndex < len(parent.Children)-1 {
		// Merge with right sibling
		rightSiblingID := parent.Children[childIndex+1]
		rightSibling := tree.pager.Get(rightSiblingID).(*page.InternalPage)

		// Pull separator from parent
		separatorKey := parent.Keys[childIndex]
		node.Keys = append(node.Keys, separatorKey)
		node.Keys = append(node.Keys, rightSibling.Keys...)
		node.Children = append(node.Children, rightSibling.Children...)
		node.Header.KeyCount = uint16(len(node.Keys))

		// Update parent pointers of all moved children
		for _, childID := range rightSibling.Children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = node.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = node.Header.PageID
			}
		}

		// Remove separator key and right child from parent
		parent.Keys = append(parent.Keys[:childIndex], parent.Keys[childIndex+1:]...)
		parent.Children = append(parent.Children[:childIndex+1], parent.Children[childIndex+2:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(node.Header.PageID, node, tree)
			tree.txManager.TrackPageModification(parentID, parent, tree)
			for _, childID := range rightSibling.Children {
				child := tree.pager.Get(childID)
				if child != nil {
					tree.txManager.TrackPageModification(childID, child, tree)
				}
			}
		}

	} else {
		// Merge with left sibling
		leftSiblingID := parent.Children[childIndex-1]
		leftSibling := tree.pager.Get(leftSiblingID).(*page.InternalPage)

		// Pull separator from parent
		separatorKey := parent.Keys[childIndex-1]
		leftSibling.Keys = append(leftSibling.Keys, separatorKey)
		leftSibling.Keys = append(leftSibling.Keys, node.Keys...)
		leftSibling.Children = append(leftSibling.Children, node.Children...)
		leftSibling.Header.KeyCount = uint16(len(leftSibling.Keys))

		// Update parent pointers of all moved children
		for _, childID := range node.Children {
			child := tree.pager.Get(childID)
			switch c := child.(type) {
			case *page.InternalPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			case *page.LeafPage:
				c.Header.ParentPage = leftSibling.Header.PageID
			}
		}

		// Remove separator key and current child from parent
		parent.Keys = append(parent.Keys[:childIndex-1], parent.Keys[childIndex:]...)
		parent.Children = append(parent.Children[:childIndex], parent.Children[childIndex+1:]...)
		parent.Header.KeyCount = uint16(len(parent.Keys))

		// Track page modifications for transaction
		if tree.txManager != nil {
			tree.txManager.TrackPageModification(leftSibling.Header.PageID, leftSibling, tree)
			tree.txManager.TrackPageModification(parentID, parent, tree)
			// Track all moved children
			for _, childID := range node.Children {
				child := tree.pager.Get(childID)
				if child != nil {
					tree.txManager.TrackPageModification(childID, child, tree)
				}
			}
		}
	}

	// Propagate underflow to parent's parent if necessary
	return tree.rebalanceInternalAfterDelete(parent, path[:len(path)-1])
}
