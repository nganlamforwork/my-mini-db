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

// TableConfig is currently identical to DatabaseConfig for compatibility.
// You can later split them if table-level config diverges.
type TableConfig = DatabaseConfig

// Table represents a single table in a database.
// Each table owns one B+Tree, its schema and config.
type Table struct {
	Name     string
	Filename string            // path to .db file
	Tree     *btree.BPlusTree
	Config   TableConfig
	Schema   *storage.Schema

	mu sync.RWMutex
}

// Close closes the table's B+Tree.
func (t *Table) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.Tree != nil {
		return t.Tree.Close()
	}
	return nil
}

// Database represents a logical database containing multiple tables.
type Database struct {
	Name   string
	Dir    string               // directory for this DB: database/{dbName}
	Tables map[string]*Table    // tableName -> *Table

	mu sync.RWMutex
}

// Close closes all tables in this database.
func (db *Database) Close() error {
	db.mu.Lock()
	defer db.mu.Unlock()

	var firstErr error
	for _, tbl := range db.Tables {
		if err := tbl.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// DatabaseManager manages multiple logical databases.
type DatabaseManager struct {
	databases   map[string]*Database // dbName -> *Database
	databaseDir string               // root dir, e.g. "database"
	mu          sync.RWMutex
}

// NewDatabaseManager creates a new database manager
func NewDatabaseManager() *DatabaseManager {
	// Create database directory if it doesn't exist
	dbDir := "database"
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		panic(fmt.Sprintf("failed to create database directory: %v", err))
	}
	
	return &DatabaseManager{
		databases:   make(map[string]*Database),
		databaseDir: dbDir,
	}
}

// getDatabaseDir returns the directory for a single DB: database/{dbName}
func (dm *DatabaseManager) getDatabaseDir(dbName string) string {
	return filepath.Join(dm.databaseDir, dbName)
}

// getTablePath returns the full path to a table's .db file.
func (dm *DatabaseManager) getTablePath(dbName, tableName string) string {
	return filepath.Join(dm.getDatabaseDir(dbName), fmt.Sprintf("%s.db", tableName))
}

// getTableSchemaPath returns the full path to a table's schema JSON file.
func (dm *DatabaseManager) getTableSchemaPath(dbName, tableName string) string {
	return filepath.Join(dm.getDatabaseDir(dbName), fmt.Sprintf("%s.schema.json", tableName))
}

// CreateDatabase creates a new empty logical database (no tables yet).
func (dm *DatabaseManager) CreateDatabase(name string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if _, exists := dm.databases[name]; exists {
		return fmt.Errorf("database '%s' already exists", name)
	}

	dbDir := dm.getDatabaseDir(name)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory '%s': %w", dbDir, err)
	}

	dm.databases[name] = &Database{
		Name:   name,
		Dir:    dbDir,
		Tables: make(map[string]*Table),
	}

	return nil
}

// CreateTable creates a new table in an existing database.
// It also creates and initializes the underlying B+Tree file.
func (dm *DatabaseManager) CreateTable(
	dbName string,
	tableName string,
	config TableConfig,
	schema *storage.Schema,
) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	db, exists := dm.databases[dbName]
	if !exists {
		return fmt.Errorf("database '%s' not found", dbName)
	}

	db.mu.Lock()
	defer db.mu.Unlock()

	if _, exists := db.Tables[tableName]; exists {
		return fmt.Errorf("table '%s' already exists in database '%s'", tableName, dbName)
	}

	// Ensure DB directory exists
	if err := os.MkdirAll(db.Dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory '%s': %w", db.Dir, err)
	}

	filename := dm.getTablePath(dbName, tableName)
	truncate := true // new table -> new B+Tree file

	var tree *btree.BPlusTree
	var err error

	if config.CacheSize != nil {
		tree, err = btree.NewBPlusTreeWithCacheSize(filename, truncate, *config.CacheSize)
	} else {
		tree, err = btree.NewBPlusTree(filename, truncate)
	}
	if err != nil {
		return fmt.Errorf("failed to create table '%s' in database '%s': %w", tableName, dbName, err)
	}

	// Attach schema to tree and persist schema file
	if schema != nil {
		tree.SetSchema(schema)

		if err := dm.saveTableSchema(dbName, tableName, schema); err != nil {
			tree.Close()
			return fmt.Errorf("failed to save schema for table '%s' in database '%s': %w", tableName, dbName, err)
		}
	}

	db.Tables[tableName] = &Table{
		Name:     tableName,
		Filename: filename,
		Tree:     tree,
		Config:   config,
		Schema:   schema,
	}

	return nil
}

// ConnectDatabase opens an existing database (loads tables from disk if they exist)
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

	dbDir := dm.getDatabaseDir(name)
	
	// Check if database directory exists
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		return fmt.Errorf("database '%s' does not exist on disk", name)
	}

	// Create database object
	db := &Database{
		Name:   name,
		Dir:    dbDir,
		Tables: make(map[string]*Table),
	}

	// Scan for existing table files and load them
	entries, err := os.ReadDir(dbDir)
	if err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				fileName := entry.Name()
				// Check if it's a .db file (table file)
				if len(fileName) > 3 && fileName[len(fileName)-3:] == ".db" {
					tableName := fileName[:len(fileName)-3]
					
					// Load table from disk
					tablePath := dm.getTablePath(name, tableName)
					truncate := false // Open existing
					
					var tree *btree.BPlusTree
					if config.CacheSize != nil {
						tree, err = btree.NewBPlusTreeWithCacheSize(tablePath, truncate, *config.CacheSize)
					} else {
						tree, err = btree.NewBPlusTree(tablePath, truncate)
					}
					
					if err != nil {
						// Skip tables that can't be loaded, but continue with others
						continue
					}
					
					// Load schema if it exists
					var schema *storage.Schema
					schema, err = dm.loadTableSchema(name, tableName)
					if err == nil && schema != nil {
						tree.SetSchema(schema)
					}
					
					// Create table object
					db.Tables[tableName] = &Table{
						Name:     tableName,
						Filename: tablePath,
						Tree:     tree,
						Config:   config,
						Schema:   schema,
					}
				}
			}
		}
	}

	dm.databases[name] = db
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

// GetDatabase retrieves a database by name.
func (dm *DatabaseManager) GetDatabase(name string) (*Database, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	db, exists := dm.databases[name]
	if !exists {
		return nil, fmt.Errorf("database '%s' not found", name)
	}
	return db, nil
}

// ListTables returns a list of all table names in a database.
func (dm *DatabaseManager) ListTables(dbName string) ([]string, error) {
	db, err := dm.GetDatabase(dbName)
	if err != nil {
		return nil, err
	}

	db.mu.RLock()
	defer db.mu.RUnlock()

	tableNames := make([]string, 0, len(db.Tables))
	for name := range db.Tables {
		tableNames = append(tableNames, name)
	}

	// Sort for consistent ordering
	sort.Strings(tableNames)
	return tableNames, nil
}

// GetTable retrieves a table from a database.
func (dm *DatabaseManager) GetTable(dbName, tableName string) (*Table, error) {
	db, err := dm.GetDatabase(dbName)
	if err != nil {
		return nil, err
	}

	db.mu.RLock()
	defer db.mu.RUnlock()

	table, exists := db.Tables[tableName]
	if !exists {
		return nil, fmt.Errorf("table '%s' not found in database '%s'", tableName, dbName)
	}

	return table, nil
}

// GetDefaultTable gets the first table in a database (for backward compatibility during migration).
// TODO: Remove this once all handlers are updated to require explicit table names.
func (dm *DatabaseManager) GetDefaultTable(dbName string) (*Table, error) {
	db, err := dm.GetDatabase(dbName)
	if err != nil {
		return nil, err
	}

	db.mu.RLock()
	defer db.mu.RUnlock()

	if len(db.Tables) == 0 {
		return nil, fmt.Errorf("database '%s' has no tables", dbName)
	}

	// Return the first table (order is not guaranteed, but this is temporary)
	for _, table := range db.Tables {
		return table, nil
	}

	return nil, fmt.Errorf("database '%s' has no tables", dbName)
}

// ListDatabases returns a list of all database names (from disk directories, not just active connections)
func (dm *DatabaseManager) ListDatabases() []string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		return []string{}
	}

	names := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			names = append(names, entry.Name())
		}
	}
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

// DeleteDatabase deletes a database instance and all its tables/files from disk
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

	// Delete entire database directory (includes all table files)
	dbDir := dm.getDatabaseDir(name)
	var firstErr error
	if err := os.RemoveAll(dbDir); err != nil && !os.IsNotExist(err) {
		firstErr = fmt.Errorf("failed to delete database directory: %w", err)
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
	dm.databases = make(map[string]*Database)

	// Delete all database directories
	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		if firstErr == nil {
			firstErr = fmt.Errorf("failed to read database directory: %w", err)
		}
		return firstErr
	}

	for _, entry := range entries {
		if entry.IsDir() {
			dirPath := filepath.Join(dm.databaseDir, entry.Name())
			if err := os.RemoveAll(dirPath); err != nil && !os.IsNotExist(err) {
				if firstErr == nil {
					firstErr = fmt.Errorf("failed to delete database directory '%s': %w", entry.Name(), err)
				}
			}
		}
	}

	return firstErr
}

// GetDatabaseInfo returns information about a database
// Note: This is a simplified version that returns basic info.
// For detailed table info, you may want a separate GetTableInfo method.
func (dm *DatabaseManager) GetDatabaseInfo(name string) (*DatabaseInfo, error) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	db, exists := dm.databases[name]
	if !exists {
		return nil, fmt.Errorf("database '%s' not found", name)
	}

	// Return basic database info (no single tree/schema anymore)
	return &DatabaseInfo{
		Name:      name,
		Filename:  db.Dir, // Directory path instead of single file
		Order:     4,      // Default - table-specific configs vary
		PageSize:  4096,   // Default
		WalEnabled: true,  // Default
		CacheSize: 100,    // Default
		RootPage:  0,      // No single root page
		Height:    0,      // No single height
		Schema:    nil,    // No single schema
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

// saveTableSchema saves a table's schema to disk as JSON.
func (dm *DatabaseManager) saveTableSchema(dbName, tableName string, schema *storage.Schema) error {
	schemaPath := dm.getTableSchemaPath(dbName, tableName)

	schemaJSON := map[string]interface{}{
		"columns":           make([]map[string]interface{}, len(schema.Columns)),
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

// loadTableSchema loads a table's schema from disk.
func (dm *DatabaseManager) loadTableSchema(dbName, tableName string) (*storage.Schema, error) {
	schemaPath := dm.getTableSchemaPath(dbName, tableName)

	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, err
	}

	var schemaJSON struct {
		Columns []struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"columns"`
		PrimaryKeyColumns []string `json:"primaryKeyColumns"`
	}

	if err := json.Unmarshal(data, &schemaJSON); err != nil {
		return nil, fmt.Errorf("failed to unmarshal schema: %w", err)
	}

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
	dm.databases = make(map[string]*Database)

	// Delete all database directories (which contain table files)
	entries, err := os.ReadDir(dm.databaseDir)
	if err != nil {
		if firstErr == nil {
			firstErr = fmt.Errorf("failed to read database directory: %w", err)
		}
		return firstErr
	}

	for _, entry := range entries {
		if entry.IsDir() {
			dirPath := filepath.Join(dm.databaseDir, entry.Name())
			if err := os.RemoveAll(dirPath); err != nil && !os.IsNotExist(err) {
				if firstErr == nil {
					firstErr = fmt.Errorf("failed to delete database directory '%s': %w", entry.Name(), err)
				}
			}
		}
	}

	return firstErr
}