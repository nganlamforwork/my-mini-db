package transaction

import (
	"fmt"
	"sync"

	"bplustree/internal/page"
)

// TransactionState represents the state of a transaction
type TransactionState uint8

const (
	TxStateActive TransactionState = iota
	TxStateCommitted
	TxStateRolledBack
)

// TreeInterface defines the interface for tree operations needed by transactions
type TreeInterface interface {
	GetPager() *page.PageManager
}

// Transaction represents a database transaction
type Transaction struct {
	txID          uint64				// Transaction ID (unique identifier for the transaction)
	state         TransactionState		// Transaction state (Active, Committed, RolledBack)
	tree          TreeInterface			// Tree interface (for accessing the tree)
	modifiedPages map[uint64]interface{} // Track modified pages for rollback
	originalPages map[uint64]interface{} // Original page state for rollback
}

// TransactionManager manages transactions
type TransactionManager struct {
	mu         sync.Mutex       // Phase 3: Protect concurrent transaction operations
	wal        *WALManager		// WAL manager
	activeTx   *Transaction		// Currently active transaction
	nextTxID   uint64			// Next transaction ID to assign
	autoCommit bool 			// True if current transaction is auto-commit (single operation)
}

// Constructor to create a new transaction manager
func NewTransactionManager(wal *WALManager) *TransactionManager {
	return &TransactionManager{
		wal:      wal,
		activeTx: nil,
		nextTxID: 1,
	}
}

// Begin starts a new explicit transaction (for multi-operation queries)
func (tm *TransactionManager) Begin(tree TreeInterface) (*Transaction, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.activeTx != nil {
		return nil, fmt.Errorf("transaction already active (nested transactions not supported)")
	}

	tx := &Transaction{
		txID:          tm.nextTxID,
		state:         TxStateActive,
		tree:          tree,
		modifiedPages: make(map[uint64]interface{}),
		originalPages: make(map[uint64]interface{}),
	}

	tm.nextTxID++
	tm.activeTx = tx
	tm.autoCommit = false // Explicit transaction

	return tx, nil
}

// BeginAutoCommit starts an auto-commit transaction (for single operations)
// This ensures crash recovery even for simple operations
// Phase 3: For concurrent operations, each operation gets its own transaction
func (tm *TransactionManager) BeginAutoCommit(tree TreeInterface) (*Transaction, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Phase 3: Always create a new transaction for concurrent operations
	// (Previously reused activeTx, but that's not safe for concurrent access)
	tx := &Transaction{
		txID:          tm.nextTxID,
		state:         TxStateActive,
		tree:          tree,
		modifiedPages: make(map[uint64]interface{}),
		originalPages: make(map[uint64]interface{}),
	}

	tm.nextTxID++
	tm.activeTx = tx
	tm.autoCommit = true // Auto-commit transaction, apply for single operations

	return tx, nil
}

// IsAutoCommit returns true if the current transaction is auto-commit (single operation)
func (tm *TransactionManager) IsAutoCommit() bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	return tm.autoCommit
}

// Commit commits the current transaction (multi-operation)
func (tm *TransactionManager) Commit() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.activeTx == nil {
		return fmt.Errorf("no active transaction")
	}

	if tm.activeTx.state != TxStateActive {
		return fmt.Errorf("transaction is not active (state: %v)", tm.activeTx.state)
	}

	// Make a copy of modifiedPages to iterate safely (protect against concurrent modification)
	modifiedPagesCopy := make(map[uint64]interface{})
	for pageID, pageObj := range tm.activeTx.modifiedPages {
		modifiedPagesCopy[pageID] = pageObj
	}

	// Write all modified pages to WAL first (Write-Ahead Logging)
	for pageID, pageObj := range modifiedPagesCopy {
		// Determine entry type based on operation
		entryType := WALEntryUpdate
		if _, exists := tm.activeTx.originalPages[pageID]; !exists {
			entryType = WALEntryInsert // New page
		}

		lsn, err := tm.wal.LogPageWrite(pageID, pageObj, entryType)
		if err != nil {
			return fmt.Errorf("failed to write to WAL: %w", err)
		}

		// Update page LSN
		switch p := pageObj.(type) {
		case *page.MetaPage:
			p.Header.LSN = lsn
		case *page.InternalPage:
			p.Header.LSN = lsn
		case *page.LeafPage:
			p.Header.LSN = lsn
		}
	}

	// Flush all modified pages to main database file
	pager := tm.activeTx.tree.GetPager()
	for pageID, pageObj := range modifiedPagesCopy {
		// Use WriteMeta for meta page (page ID 1) to ensure proper handling
		if pageID == 1 {
			if metaPage, ok := pageObj.(*page.MetaPage); ok {
				// Ensure meta page is in cache before writing
				pager.Put(1, metaPage)
				if err := pager.WriteMeta(metaPage); err != nil {
					return fmt.Errorf("failed to write meta page: %w", err)
				}
				continue
			}
		}
		if err := pager.WritePageToFile(pageID, pageObj); err != nil {
			return fmt.Errorf("failed to write page %d: %w", pageID, err)
		}
	}

	// Mark transaction as committed
	tm.activeTx.state = TxStateCommitted
	tm.activeTx = nil
	tm.autoCommit = false

	return nil
}

// Rollback rolls back the current transaction
func (tm *TransactionManager) Rollback() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	if tm.activeTx == nil {
		return fmt.Errorf("no active transaction")
	}

	if tm.activeTx.state != TxStateActive {
		return fmt.Errorf("transaction is not active (state: %v)", tm.activeTx.state)
	}

	// Restore original page states
	pager := tm.activeTx.tree.GetPager()
	for pageID, originalPage := range tm.activeTx.originalPages {
		// Deep copy the original page to avoid reference issues
		restoredPage := page.ClonePage(originalPage)
		if restoredPage != nil {
			pager.Put(pageID, restoredPage)
		}
	}

	// Remove newly created pages
	for pageID := range tm.activeTx.modifiedPages {
		if _, wasOriginal := tm.activeTx.originalPages[pageID]; !wasOriginal {
			// This was a new page, remove it from cache
			pager.RemoveFromCache(pageID)
		}
	}

	// Mark transaction as rolled back
	tm.activeTx.state = TxStateRolledBack
	tm.activeTx = nil
	tm.autoCommit = false

	return nil
}

// GetActiveTransaction returns the currently active transaction, or nil
func (tm *TransactionManager) GetActiveTransaction() *Transaction {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	return tm.activeTx
}

// TrackPageModification tracks a page modification for the current transaction
// If no transaction exists, it will be created automatically (auto-commit)
func (tm *TransactionManager) TrackPageModification(pageID uint64, pageObj interface{}, tree TreeInterface) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Auto-create transaction if none exists (for crash recovery)
	if tm.activeTx == nil {
		// Create new transaction directly (avoid recursive lock from BeginAutoCommit)
		tx := &Transaction{
			txID:          tm.nextTxID,
			state:         TxStateActive,
			tree:          tree,
			modifiedPages: make(map[uint64]interface{}),
			originalPages: make(map[uint64]interface{}),
		}
		tm.nextTxID++
		tm.activeTx = tx
		tm.autoCommit = true
	}

	// Save original state if not already saved
	if _, exists := tm.activeTx.originalPages[pageID]; !exists {
		// Get original page from pager
		pager := tm.activeTx.tree.GetPager()
		// Read directly from disk to get the true original state
		// This bypasses the cache which might already contain modifications
		originalPage, err := pager.ReadPageFromDisk(pageID)
		if err != nil || originalPage == nil {
			// If not on disk, get from cache (for newly created pages)
			originalPage = pager.Get(pageID)
		}
		
		if originalPage != nil {
			// Deep copy the page to ensure modifications don't affect the original
			clonedPage := page.ClonePage(originalPage)
			if clonedPage != nil {
				tm.activeTx.originalPages[pageID] = clonedPage
			}
		}
	}

	// Track modified page
	tm.activeTx.modifiedPages[pageID] = pageObj
}

// TrackPageAllocation tracks a newly allocated page
func (tm *TransactionManager) TrackPageAllocation(pageID uint64, pageObj interface{}, tree TreeInterface) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Auto-create transaction if none exists
	if tm.activeTx == nil {
		tx := &Transaction{
			txID:          tm.nextTxID,
			state:         TxStateActive,
			tree:          tree,
			modifiedPages: make(map[uint64]interface{}),
			originalPages: make(map[uint64]interface{}),
		}
		tm.nextTxID++
		tm.activeTx = tx
		tm.autoCommit = true
	}
	
	// New pages don't have original state
	tm.activeTx.modifiedPages[pageID] = pageObj
}


// TrackPageDeletion tracks a page deletion
func (tm *TransactionManager) TrackPageDeletion(pageID uint64, tree TreeInterface) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Auto-create transaction if none exists
	if tm.activeTx == nil {
		tx := &Transaction{
			txID:          tm.nextTxID,
			state:         TxStateActive,
			tree:          tree,
			modifiedPages: make(map[uint64]interface{}),
			originalPages: make(map[uint64]interface{}),
		}
		tm.nextTxID++
		tm.activeTx = tx
		tm.autoCommit = true
	}
	
	// Save original state if not already saved
	if _, exists := tm.activeTx.originalPages[pageID]; !exists {
		pager := tm.activeTx.tree.GetPager()
		originalPage := pager.Get(pageID)
		if originalPage != nil {
			// Deep copy the page to ensure modifications don't affect the original
			clonedPage := page.ClonePage(originalPage)
			if clonedPage != nil {
				tm.activeTx.originalPages[pageID] = clonedPage
			}
		}
	}
	
	// Mark as deleted (remove from modified pages, keep in original for rollback)
	delete(tm.activeTx.modifiedPages, pageID)
}

// Checkpoint creates a checkpoint in the WAL
func (tm *TransactionManager) Checkpoint() error {
	if tm.activeTx != nil {
		return fmt.Errorf("cannot checkpoint while transaction is active")
	}
	return tm.wal.Checkpoint()
}
