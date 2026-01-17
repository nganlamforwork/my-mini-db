package api

import (
	"fmt"
	"sync"

	"bplustree/internal/btree"
)

// DatabaseInstance represents a single database instance
type DatabaseInstance struct {
	Name      string
	Filename  string
	Tree      *btree.BPlusTree
	Config    DatabaseConfig
	mu        sync.RWMutex
}

// Close closes the database instance
func (db *DatabaseInstance) Close() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	if db.Tree != nil {
		return db.Tree.Close()
	}
	return nil
}

// DatabaseManager manages multiple database instances
type DatabaseManager struct {
	databases map[string]*DatabaseInstance
	mu        sync.RWMutex
}

// NewDatabaseManager creates a new database manager
func NewDatabaseManager() *DatabaseManager {
	return &DatabaseManager{
		databases: make(map[string]*DatabaseInstance),
	}
}

// CreateDatabase creates a new database instance
func (dm *DatabaseManager) CreateDatabase(name string, config DatabaseConfig) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, exists := dm.databases[name]; exists {
		return fmt.Errorf("database '%s' already exists", name)
	}

	filename := fmt.Sprintf("%s.db", name)
	truncate := true // Always create new

	var tree *btree.BPlusTree
	var err error

	if config.CacheSize != nil {
		tree, err = btree.NewBPlusTreeWithCacheSize(filename, truncate, *config.CacheSize)
	} else {
		tree, err = btree.NewBPlusTree(filename, truncate)
	}

	if err != nil {
		return fmt.Errorf("failed to create database: %w", err)
	}

	dm.databases[name] = &DatabaseInstance{
		Name:     name,
		Filename: filename,
		Tree:     tree,
		Config:   config,
	}

	return nil
}

// ConnectDatabase opens an existing database instance (loads from disk)
func (dm *DatabaseManager) ConnectDatabase(name string, config DatabaseConfig) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, exists := dm.databases[name]; exists {
		return fmt.Errorf("database '%s' already connected", name)
	}

	filename := fmt.Sprintf("%s.db", name)
	truncate := false // Open existing, don't truncate

	var tree *btree.BPlusTree
	var err error

	if config.CacheSize != nil {
		tree, err = btree.NewBPlusTreeWithCacheSize(filename, truncate, *config.CacheSize)
	} else {
		tree, err = btree.NewBPlusTree(filename, truncate)
	}

	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	dm.databases[name] = &DatabaseInstance{
		Name:     name,
		Filename: filename,
		Tree:     tree,
		Config:   config,
	}

	return nil
}

// CloseDatabase closes a database connection without removing from manager
func (dm *DatabaseManager) CloseDatabase(name string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	db, exists := dm.databases[name]
	if !exists {
		return fmt.Errorf("database '%s' not found", name)
	}

	if err := db.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}

	// Remove from active databases
	delete(dm.databases, name)
	return nil
}

// GetDatabase retrieves a database instance by name
func (dm *DatabaseManager) GetDatabase(name string) (*DatabaseInstance, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	db, exists := dm.databases[name]
	if !exists {
		return nil, fmt.Errorf("database '%s' not found", name)
	}

	return db, nil
}

// ListDatabases returns a list of all database names
func (dm *DatabaseManager) ListDatabases() []string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	names := make([]string, 0, len(dm.databases))
	for name := range dm.databases {
		names = append(names, name)
	}

	return names
}

// DropDatabase removes and closes a database instance
func (dm *DatabaseManager) DropDatabase(name string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	db, exists := dm.databases[name]
	if !exists {
		return fmt.Errorf("database '%s' not found", name)
	}

	if err := db.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}

	delete(dm.databases, name)
	return nil
}

// GetDatabaseInfo returns information about a database
func (dm *DatabaseManager) GetDatabaseInfo(name string) (*DatabaseInfo, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	db, exists := dm.databases[name]
	if !exists {
		return nil, fmt.Errorf("database '%s' not found", name)
	}

	rootPage := uint64(0)
	height := 0
	if !db.Tree.IsEmpty() {
		meta, err := db.Tree.GetPager().ReadMeta()
		if err == nil && meta != nil {
			rootPage = meta.RootPage
			// Calculate height (simplified - would need to traverse tree)
			height = 1 // Placeholder
		}
	}

	order := 4 // Default ORDER
	if db.Config.Order != nil {
		order = *db.Config.Order
	}

	pageSize := 4096 // DefaultPageSize
	if db.Config.PageSize != nil {
		pageSize = *db.Config.PageSize
	}

	walEnabled := true
	if db.Config.WalEnabled != nil {
		walEnabled = *db.Config.WalEnabled
	}

	cacheSize := 100 // DefaultCacheSize
	if db.Config.CacheSize != nil {
		cacheSize = *db.Config.CacheSize
	}

	return &DatabaseInfo{
		Name:      name,
		Filename:  db.Filename,
		Order:     order,
		PageSize:  pageSize,
		WalEnabled: walEnabled,
		CacheSize: cacheSize,
		RootPage:  rootPage,
		Height:    height,
	}, nil
}

// CloseAll closes all database instances
func (dm *DatabaseManager) CloseAll() error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	var firstErr error
	for _, db := range dm.databases {
		if err := db.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}