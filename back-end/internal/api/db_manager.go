package api

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"bplustree/internal/btree"
	"bplustree/internal/storage"
)

// DatabaseInstance represents a single database instance
type DatabaseInstance struct {
	Name      string
	Filename  string
	Tree      *btree.BPlusTree
	Config    DatabaseConfig
	Schema    *storage.Schema // Schema for this database (nil if not set)
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
	databases    map[string]*DatabaseInstance
	databaseDir  string
	mu           sync.RWMutex
}

// NewDatabaseManager creates a new database manager
func NewDatabaseManager() *DatabaseManager {
	// Create database directory if it doesn't exist
	dbDir := "database"
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		panic(fmt.Sprintf("failed to create database directory: %v", err))
	}
	
	return &DatabaseManager{
		databases:   make(map[string]*DatabaseInstance),
		databaseDir: dbDir,
	}
}

// getDatabasePath returns the full path to a database file
func (dm *DatabaseManager) getDatabasePath(name string) string {
	return filepath.Join(dm.databaseDir, fmt.Sprintf("%s.db", name))
}

// CreateDatabase creates a new database instance
func (dm *DatabaseManager) CreateDatabase(name string, config DatabaseConfig, schema *storage.Schema) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, exists := dm.databases[name]; exists {
		return fmt.Errorf("database '%s' already exists", name)
	}

	filename := dm.getDatabasePath(name)
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

	// Set schema on tree if provided
	if schema != nil {
		tree.SetSchema(schema)
		// Persist schema to disk
		if err := dm.saveSchema(name, schema); err != nil {
			tree.Close()
			return fmt.Errorf("failed to save schema: %w", err)
		}
	}

	dm.databases[name] = &DatabaseInstance{
		Name:     name,
		Filename: filename,
		Tree:     tree,
		Config:   config,
		Schema:   schema,
	}

	return nil
}

// ConnectDatabase opens an existing database instance (loads from disk)
// If the database is already connected, it will close it first and then reconnect
func (dm *DatabaseManager) ConnectDatabase(name string, config DatabaseConfig) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	// If database is already connected, close it first before reconnecting
	if existingDb, exists := dm.databases[name]; exists {
		// Close the existing connection
		if err := existingDb.Close(); err != nil {
			return fmt.Errorf("failed to close existing database connection: %w", err)
		}
		// Remove from active databases
		delete(dm.databases, name)
	}

	filename := dm.getDatabasePath(name)
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

	// Load schema from disk if it exists
	schema, err := dm.loadSchema(name)
	if err != nil && !os.IsNotExist(err) {
		tree.Close()
		return fmt.Errorf("failed to load schema: %w", err)
	}
	if schema != nil {
		tree.SetSchema(schema)
	}

	dm.databases[name] = &DatabaseInstance{
		Name:     name,
		Filename: filename,
		Tree:     tree,
		Config:   config,
		Schema:   schema,
	}

	return nil
}

// CloseDatabase closes a database connection (keeps data on disk, does NOT delete files)
// This removes the database from active connections in memory but preserves all files on disk.
// The database can be reconnected later using ConnectDatabase.
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

	// Remove from active databases (files remain on disk)
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

// ListDatabases returns a list of all database names (from disk files, not just active connections)
func (dm *DatabaseManager) ListDatabases() []string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	// Scan database directory for all .db files
	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		// If directory doesn't exist or can't be read, return empty list
		return []string{}
	}

	// Use a map to track unique database names (in case of duplicates)
	namesMap := make(map[string]bool)
	
	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			// Check if it's a .db file
			if len(name) > 3 && name[len(name)-3:] == ".db" {
				// Extract database name (remove .db extension)
				dbName := name[:len(name)-3]
				namesMap[dbName] = true
			}
		}
	}

	// Convert map to slice and sort for consistent ordering
	names := make([]string, 0, len(namesMap))
	for name := range namesMap {
		names = append(names, name)
	}
	
	// Sort names alphabetically for consistent ordering
	sort.Strings(names)
	
	return names
}

// DropDatabase removes and closes a database instance (but does not delete files)
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

// DeleteDatabase deletes a database instance and its files from disk
func (dm *DatabaseManager) DeleteDatabase(name string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	db, exists := dm.databases[name]
	if exists {
		// Close the database if it's open
		if err := db.Close(); err != nil {
			return fmt.Errorf("failed to close database: %w", err)
		}
		delete(dm.databases, name)
	}

	// Delete database file and WAL file
	dbPath := dm.getDatabasePath(name)
	walPath := dbPath + ".wal"

	var firstErr error
	
	// Delete .db file
	if err := os.Remove(dbPath); err != nil && !os.IsNotExist(err) {
		firstErr = fmt.Errorf("failed to delete database file: %w", err)
	}

	// Delete .wal file
	if err := os.Remove(walPath); err != nil && !os.IsNotExist(err) {
		if firstErr == nil {
			firstErr = fmt.Errorf("failed to delete WAL file: %w", err)
		}
	}

	return firstErr
}

// DeleteAllDatabases deletes all database instances and their files from disk
func (dm *DatabaseManager) DeleteAllDatabases() error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	// Close all databases
	var firstErr error
	for name, db := range dm.databases {
		if err := db.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("failed to close database '%s': %w", name, err)
		}
	}
	dm.databases = make(map[string]*DatabaseInstance)

	// Delete all .db and .wal files in the database directory
	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		if firstErr == nil {
			firstErr = fmt.Errorf("failed to read database directory: %w", err)
		}
		return firstErr
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			filePath := filepath.Join(dm.databaseDir, entry.Name())
			if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
				if firstErr == nil {
					firstErr = fmt.Errorf("failed to delete file '%s': %w", entry.Name(), err)
				}
			}
		}
	}

	return firstErr
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

	// Include schema if available
	var schemaInfo *SchemaInfo
	if db.Schema != nil {
		columns := make([]ColumnInfo, len(db.Schema.Columns))
		for i, col := range db.Schema.Columns {
			columns[i] = ColumnInfo{
				Name: col.Name,
				Type: col.Type.String(),
			}
		}
		schemaInfo = &SchemaInfo{
			Columns:          columns,
			PrimaryKeyColumns: db.Schema.PrimaryKeyColumns,
		}
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
		Schema:    schemaInfo,
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

// getSchemaPath returns the full path to a schema file
func (dm *DatabaseManager) getSchemaPath(name string) string {
	return filepath.Join(dm.databaseDir, fmt.Sprintf("%s.schema.json", name))
}

// saveSchema saves the schema to disk as JSON
func (dm *DatabaseManager) saveSchema(name string, schema *storage.Schema) error {
	schemaPath := dm.getSchemaPath(name)
	
	// Convert schema to JSON-serializable format
	schemaJSON := map[string]interface{}{
		"columns": make([]map[string]interface{}, len(schema.Columns)),
		"primaryKeyColumns": schema.PrimaryKeyColumns,
	}
	
	for i, col := range schema.Columns {
		schemaJSON["columns"].([]map[string]interface{})[i] = map[string]interface{}{
			"name": col.Name,
			"type": col.Type.String(),
		}
	}
	
	data, err := json.MarshalIndent(schemaJSON, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal schema: %w", err)
	}
	
	if err := os.WriteFile(schemaPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write schema file: %w", err)
	}
	
	return nil
}

// loadSchema loads the schema from disk
func (dm *DatabaseManager) loadSchema(name string) (*storage.Schema, error) {
	schemaPath := dm.getSchemaPath(name)
	
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, err
	}
	
	var schemaJSON struct {
		Columns          []struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"columns"`
		PrimaryKeyColumns []string `json:"primaryKeyColumns"`
	}
	
	if err := json.Unmarshal(data, &schemaJSON); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema: %w", err)
	}
	
	// Convert JSON schema to storage.Schema
	columns := make([]storage.ColumnDefinition, len(schemaJSON.Columns))
	for i, colJSON := range schemaJSON.Columns {
		var colType storage.ColumnType
		switch colJSON.Type {
		case "INT":
			colType = storage.TypeInt
		case "STRING":
			colType = storage.TypeString
		case "FLOAT":
			colType = storage.TypeFloat
		case "BOOL":
			colType = storage.TypeBool
		default:
			return nil, fmt.Errorf("unknown column type: %s", colJSON.Type)
		}
		columns[i] = storage.ColumnDefinition{
			Name: colJSON.Name,
			Type: colType,
		}
	}
	
	schema, err := storage.NewSchema(columns, schemaJSON.PrimaryKeyColumns)
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}
	
	return schema, nil
}

// CleanupAllDatabases deletes all database files (.db, .wal, .schema.json) from disk
// This is useful for wiping incompatible data structures
func (dm *DatabaseManager) CleanupAllDatabases() error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	// Close all databases
	var firstErr error
	for name, db := range dm.databases {
		if err := db.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("failed to close database '%s': %w", name, err)
		}
	}
	dm.databases = make(map[string]*DatabaseInstance)

	// Delete all database-related files
	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		if firstErr == nil {
			firstErr = fmt.Errorf("failed to read database directory: %w", err)
		}
		return firstErr
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			name := entry.Name()
			// Delete .db, .wal, and .schema.json files
			if (len(name) > 3 && name[len(name)-3:] == ".db") ||
			   (len(name) > 4 && name[len(name)-4:] == ".wal") ||
			   (len(name) > 13 && name[len(name)-13:] == ".schema.json") {
				filePath := filepath.Join(dm.databaseDir, name)
				if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
					if firstErr == nil {
						firstErr = fmt.Errorf("failed to delete file '%s': %w", name, err)
					}
				}
			}
		}
	}

	return firstErr
}