package main

import (
	"fmt"
)

// TransactionState represents the state of a transaction
type TransactionState uint8

const (
	TxStateActive TransactionState = iota
	TxStateCommitted
	TxStateRolledBack
)

// Transaction represents a database transaction
type Transaction struct {
	txID      uint64
	state     TransactionState
	tree      *BPlusTree
	modifiedPages map[uint64]interface{} // Track modified pages for rollback
	originalPages  map[uint64]interface{} // Original page state for rollback
}

// TransactionManager manages transactions
type TransactionManager struct {
	wal        *WALManager
	activeTx   *Transaction
	nextTxID   uint64
}

// NewTransactionManager creates a new transaction manager
func NewTransactionManager(wal *WALManager) *TransactionManager {
	return &TransactionManager{
		wal:      wal,
		activeTx: nil,
		nextTxID: 1,
	}
}

// Begin starts a new transaction
func (tm *TransactionManager) Begin(tree *BPlusTree) (*Transaction, error) {
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

	return tx, nil
}

// Commit commits the current transaction
func (tm *TransactionManager) Commit() error {
	if tm.activeTx == nil {
		return fmt.Errorf("no active transaction")
	}

	if tm.activeTx.state != TxStateActive {
		return fmt.Errorf("transaction is not active (state: %v)", tm.activeTx.state)
	}

	// Write all modified pages to WAL first (Write-Ahead Logging)
	for pageID, page := range tm.activeTx.modifiedPages {
		// Determine entry type based on operation
		entryType := WALEntryUpdate
		if _, exists := tm.activeTx.originalPages[pageID]; !exists {
			entryType = WALEntryInsert // New page
		}

		lsn, err := tm.wal.LogPageWrite(pageID, page, entryType)
		if err != nil {
			return fmt.Errorf("failed to write to WAL: %w", err)
		}

		// Update page LSN
		switch p := page.(type) {
		case *MetaPage:
			p.Header.LSN = lsn
		case *InternalPage:
			p.Header.LSN = lsn
		case *LeafPage:
			p.Header.LSN = lsn
		}
	}

	// Flush all modified pages to main database file
	for pageID, page := range tm.activeTx.modifiedPages {
		if err := tm.activeTx.tree.pager.writePageToFile(pageID, page); err != nil {
			return fmt.Errorf("failed to write page %d: %w", pageID, err)
		}
	}

	// Mark transaction as committed
	tm.activeTx.state = TxStateCommitted
	tm.activeTx = nil

	return nil
}

// Rollback rolls back the current transaction
func (tm *TransactionManager) Rollback() error {
	if tm.activeTx == nil {
		return fmt.Errorf("no active transaction")
	}

	if tm.activeTx.state != TxStateActive {
		return fmt.Errorf("transaction is not active (state: %v)", tm.activeTx.state)
	}

	// Restore original page states
	for pageID, originalPage := range tm.activeTx.originalPages {
		tm.activeTx.tree.pager.pages[pageID] = originalPage
	}

	// Remove newly created pages
	for pageID := range tm.activeTx.modifiedPages {
		if _, wasOriginal := tm.activeTx.originalPages[pageID]; !wasOriginal {
			// This was a new page, remove it
			delete(tm.activeTx.tree.pager.pages, pageID)
		}
	}

	// Mark transaction as rolled back
	tm.activeTx.state = TxStateRolledBack
	tm.activeTx = nil

	return nil
}

// GetActiveTransaction returns the currently active transaction, or nil
func (tm *TransactionManager) GetActiveTransaction() *Transaction {
	return tm.activeTx
}

// TrackPageModification tracks a page modification for the current transaction
func (tm *TransactionManager) TrackPageModification(pageID uint64, page interface{}) {
	if tm.activeTx == nil {
		return // No active transaction, no tracking needed
	}

	// Save original state if not already saved
	if _, exists := tm.activeTx.originalPages[pageID]; !exists {
		// Get original page from pager
		originalPage := tm.activeTx.tree.pager.Get(pageID)
		if originalPage != nil {
			// Deep copy would be ideal, but for simplicity we'll track the reference
			// In a production system, you'd want proper deep copying
			tm.activeTx.originalPages[pageID] = originalPage
		}
	}

	// Track modified page
	tm.activeTx.modifiedPages[pageID] = page
}

// Checkpoint creates a checkpoint in the WAL
func (tm *TransactionManager) Checkpoint() error {
	if tm.activeTx != nil {
		return fmt.Errorf("cannot checkpoint while transaction is active")
	}
	return tm.wal.Checkpoint()
}
