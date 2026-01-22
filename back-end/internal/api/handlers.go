package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"bplustree/internal/storage"
)

// APIHandler handles all API requests
type APIHandler struct {
	dbManager *DatabaseManager
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(dbManager *DatabaseManager) *APIHandler {
	return &APIHandler{
		dbManager: dbManager,
	}
}

// ServeHTTP implements http.Handler interface
func (h *APIHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	// Route requests
	switch {
	case r.Method == "GET" && len(parts) == 1 && parts[0] == "databases":
		h.handleListDatabases(w, r)
	case r.Method == "POST" && len(parts) == 1 && parts[0] == "databases":
		h.handleCreateDatabase(w, r)
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "tables":
		dbName := parts[1]
		h.handleListTables(w, r, dbName)
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "tables":
		dbName := parts[1]
		h.handleCreateTable(w, r, dbName)
	case r.Method == "POST" && len(parts) == 2 && parts[0] == "databases" && parts[1] == "connect":
		h.handleConnectDatabase(w, r)
	case r.Method == "GET" && len(parts) == 2 && parts[0] == "databases":
		h.handleGetDatabase(w, r, parts[1])
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "close":
		h.handleCloseDatabase(w, r, parts[1])
	case r.Method == "DELETE" && len(parts) == 2 && parts[0] == "databases":
		h.handleDeleteDatabase(w, r, parts[1])
	case r.Method == "DELETE" && len(parts) == 1 && parts[0] == "databases":
		h.handleDeleteAllDatabases(w, r)
	case r.Method == "POST" && len(parts) == 1 && parts[0] == "databases" && r.URL.Query().Get("cleanup") == "true":
		h.handleCleanupAllDatabases(w, r)
	// Table operations: /api/databases/:dbName/tables/:tableName/:operation
	case r.Method == "POST" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "insert":
		h.handleInsert(w, r, parts[1], parts[3])
	case r.Method == "POST" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "update":
		h.handleUpdate(w, r, parts[1], parts[3])
	case r.Method == "POST" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "delete":
		h.handleDelete(w, r, parts[1], parts[3])
	case r.Method == "POST" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "search":
		h.handleSearch(w, r, parts[1], parts[3])
	case r.Method == "POST" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "range":
		h.handleRangeQuery(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "tree":
		h.handleGetTreeStructure(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "wal":
		h.handleGetWALInfo(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 6 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "cache" && parts[5] == "pages":
		h.handleGetCachePages(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "cache":
		h.handleGetCacheStats(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "io":
		h.handleGetIOReads(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "config":
		h.handleGetTreeConfig(w, r, parts[1], parts[3])
	case r.Method == "GET" && len(parts) == 5 && parts[0] == "databases" && parts[2] == "tables" && parts[4] == "schema":
		h.handleGetTableSchema(w, r, parts[1], parts[3])
	default:
		writeError(w, http.StatusNotFound, "Not found")
	}
}

// handleListDatabases lists all databases
func (h *APIHandler) handleListDatabases(w http.ResponseWriter, r *http.Request) {
	names := h.dbManager.ListDatabases()
	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"databases": names,
	})
}

// handleCreateDatabase creates a new logical database (no tables yet).
// Route: POST /api/databases
// Payload: { "name": "my_db" }
func (h *APIHandler) handleCreateDatabase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "Database name is required")
		return
	}

	if err := h.dbManager.CreateDatabase(req.Name); err != nil {
		// Distinguish "already exists" vs other errors if needed
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"name":    req.Name,
	})
}

// handleListTables lists all tables in a database.
// Route: GET /api/databases/:dbName/tables
func (h *APIHandler) handleListTables(w http.ResponseWriter, r *http.Request, dbName string) {
	tables, err := h.dbManager.ListTables(dbName)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"tables": tables,
	})
}

// handleCreateTable creates a new table in an existing database.
// Route: POST /api/databases/:dbName/tables
// Payload:
// {
//   "name": "users",
//   "config": { ... },     // optional table-level config
//   "schema": {
//     "columns": [ { "name": "id", "type": "INT" }, ... ],
//     "primaryKey": ["id"]
//   }
// }
func (h *APIHandler) handleCreateTable(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		Name   string         `json:"name"`
		Config DatabaseConfig `json:"config,omitempty"`
		Schema struct {
			Columns []struct {
				Name string `json:"name"`
				Type string `json:"type"` // "INT", "STRING", "FLOAT", "BOOL"
			} `json:"columns"`
			PrimaryKey []string `json:"primaryKey"`
		} `json:"schema"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if strings.TrimSpace(dbName) == "" {
		writeError(w, http.StatusBadRequest, "Database name is required in path")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "Table name is required")
		return
	}

	// Check that DB exists (distinct "Database not found" error)
	if _, err := h.dbManager.GetDatabase(dbName); err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("Database '%s' not found", dbName))
		return
	}

	// Validate schema: at least one column and PK
	if len(req.Schema.Columns) == 0 {
		writeError(w, http.StatusBadRequest, "At least one column is required in schema")
		return
	}
	if len(req.Schema.PrimaryKey) == 0 {
		writeError(w, http.StatusBadRequest, "At least one primary key column is required")
		return
	}

	// Build storage.Schema from request
	columnDefs := make([]storage.ColumnDefinition, len(req.Schema.Columns))
	for i, col := range req.Schema.Columns {
		var colType storage.ColumnType
		switch col.Type {
		case "INT":
			colType = storage.TypeInt
		case "STRING":
			colType = storage.TypeString
		case "FLOAT":
			colType = storage.TypeFloat
		case "BOOL":
			colType = storage.TypeBool
		default:
			writeError(
				w,
				http.StatusBadRequest,
				fmt.Sprintf("Invalid column type '%s'. Must be INT, STRING, FLOAT, or BOOL", col.Type),
			)
			return
		}
		columnDefs[i] = storage.ColumnDefinition{
			Name: col.Name,
			Type: colType,
		}
	}

	schema, err := storage.NewSchema(columnDefs, req.Schema.PrimaryKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid schema: %v", err))
		return
	}

	// Verify that all PK columns exist in the column list
	columnNames := make(map[string]bool)
	for _, col := range columnDefs {
		columnNames[col.Name] = true
	}
	for _, pkCol := range req.Schema.PrimaryKey {
		if !columnNames[pkCol] {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Primary key column '%s' does not exist in columns", pkCol))
			return
		}
	}

	// Delegate to DatabaseManager.CreateTable
	if err := h.dbManager.CreateTable(dbName, req.Name, req.Config, schema); err != nil {
		// Distinct table vs database errors:
		if strings.Contains(err.Error(), "database '") && strings.Contains(err.Error(), "' not found") {
			writeError(w, http.StatusNotFound, err.Error()) // Database not found
			return
		}
		if strings.Contains(err.Error(), "already exists in database") {
			writeError(w, http.StatusBadRequest, err.Error()) // Table already exists
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"database": dbName,
		"name":     req.Name,
		"schema": map[string]interface{}{
			"columns":    req.Schema.Columns,
			"primaryKey": req.Schema.PrimaryKey,
		},
	})
}

// handleConnectDatabase connects to an existing database (loads from disk)
func (h *APIHandler) handleConnectDatabase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string          `json:"name"`
		Config DatabaseConfig  `json:"config,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Database name is required")
		return
	}

	if err := h.dbManager.ConnectDatabase(req.Name, req.Config); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"name":    req.Name,
		"message": "Database connected and loaded from disk",
	})
}

// handleCloseDatabase closes a database connection (keeps data on disk)
func (h *APIHandler) handleCloseDatabase(w http.ResponseWriter, r *http.Request, dbName string) {
	if err := h.dbManager.CloseDatabase(dbName); err != nil {
		if err.Error() == fmt.Sprintf("database '%s' not found", dbName) {
			writeError(w, http.StatusNotFound, err.Error())
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Database closed (data remains on disk)",
	})
}

// handleGetDatabase gets database information
func (h *APIHandler) handleGetDatabase(w http.ResponseWriter, r *http.Request, name string) {
	info, err := h.dbManager.GetDatabaseInfo(name)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, info)
}

// handleDropDatabase drops a database (removes from active connections but keeps files)
func (h *APIHandler) handleDropDatabase(w http.ResponseWriter, r *http.Request, name string) {
	if err := h.dbManager.DropDatabase(name); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

// handleDeleteDatabase deletes a database and its files from disk
func (h *APIHandler) handleDeleteDatabase(w http.ResponseWriter, r *http.Request, name string) {
	if err := h.dbManager.DeleteDatabase(name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Database '%s' and its files deleted", name),
	})
}

// handleDeleteAllDatabases deletes all databases and their files from disk
func (h *APIHandler) handleDeleteAllDatabases(w http.ResponseWriter, r *http.Request) {
	if err := h.dbManager.DeleteAllDatabases(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "All databases and their files deleted",
	})
}

// handleCleanupAllDatabases wipes all database files (.db, .wal, .schema.json) from disk
// This is useful for cleaning up incompatible data structures
func (h *APIHandler) handleCleanupAllDatabases(w http.ResponseWriter, r *http.Request) {
	if err := h.dbManager.CleanupAllDatabases(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "All database files cleaned up (.db, .wal, .schema.json)",
	})
}

// handleInsert handles insert operations
// Route: POST /api/databases/:dbName/tables/:tableName/insert
// Accepts row data as JSON object, extracts key using schema
func (h *APIHandler) handleInsert(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if table has schema
	if table.Schema == nil {
		writeError(w, http.StatusBadRequest, "Table does not have a schema. Please create table with schema first.")
		return
	}

	// Decode row data as map[string]interface{}
	var rowData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rowData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Validate row against schema
	if err := table.Schema.ValidateRow(rowData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Row validation failed: %v", err))
		return
	}

	// Extract key from row using schema
	key, err := table.Schema.ExtractKey(rowData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Convert row to Record
	value, err := table.Schema.RowToRecord(rowData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to convert row to record: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(table.Tree)
	steps, err := adapter.Insert(key, value, enableSteps)

	resp := OperationResponse{
		Success:   err == nil,
		Operation: "INSERT",
		Key:       &key,
		Steps:     steps,
	}

	if err != nil {
		resp.Error = err.Error()
	}

	writeJSONResponse(w, http.StatusOK, ToJSONOperationResponse(resp))
}

// handleUpdate handles update operations
// Route: POST /api/databases/:dbName/tables/:tableName/update
func (h *APIHandler) handleUpdate(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	var req struct {
		Key   JSONCompositeKey `json:"key"`
		Value JSONRecord       `json:"value"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	key, err := FromJSONCompositeKey(req.Key)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid key: %v", err))
		return
	}

	value, err := FromJSONRecord(req.Value)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid value: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(table.Tree)
	steps, err := adapter.Update(key, value, enableSteps)

	resp := OperationResponse{
		Success:   err == nil,
		Operation: "UPDATE",
		Key:       &key,
		Steps:     steps,
	}

	if err != nil {
		resp.Error = err.Error()
	}

	writeJSONResponse(w, http.StatusOK, ToJSONOperationResponse(resp))
}

// handleDelete handles delete operations
// Route: POST /api/databases/:dbName/tables/:tableName/delete
// Accepts composite key components as JSON object, constructs key using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleDelete(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if table has schema
	if table.Schema == nil {
		writeError(w, http.StatusBadRequest, "Table does not have a schema. Please create table with schema first.")
		return
	}

	// Decode key components as map[string]interface{}
	var keyData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&keyData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Extract key from key components using schema (key-only validation)
	key, err := table.Schema.ExtractKeyFromKeyData(keyData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(table.Tree)
	steps, err := adapter.Delete(key, enableSteps)

	resp := OperationResponse{
		Success:   err == nil,
		Operation: "DELETE",
		Key:       &key,
		Steps:     steps,
	}

	if err != nil {
		resp.Error = err.Error()
	}

	writeJSONResponse(w, http.StatusOK, ToJSONOperationResponse(resp))
}

// handleSearch handles search operations
// Route: POST /api/databases/:dbName/tables/:tableName/search
// Accepts composite key components as JSON object, constructs key using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleSearch(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if table has schema
	if table.Schema == nil {
		writeError(w, http.StatusBadRequest, "Table does not have a schema. Please create table with schema first.")
		return
	}

	// Decode key components as map[string]interface{}
	var keyData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&keyData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Extract key from key components using schema (key-only validation)
	key, err := table.Schema.ExtractKeyFromKeyData(keyData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(table.Tree)
	value, steps, err := adapter.Search(key, enableSteps)

	resp := OperationResponse{
		Success:   err == nil,
		Operation: "SEARCH",
		Key:       &key,
		Steps:     steps,
	}

	if err == nil {
		resp.Value = &value
	} else {
		resp.Error = err.Error()
	}

	writeJSONResponse(w, http.StatusOK, ToJSONOperationResponse(resp))
}

// handleRangeQuery handles range query operations
// Route: POST /api/databases/:dbName/tables/:tableName/range
// Accepts key component maps (like Search/Delete), constructs keys using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleRangeQuery(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	var req struct {
		StartKey map[string]interface{} `json:"startKey"`
		EndKey   map[string]interface{} `json:"endKey"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if table has schema
	if table.Schema == nil {
		writeError(w, http.StatusBadRequest, "Table does not have a schema. Please create table with schema first.")
		return
	}

	// Extract keys from key component maps using schema (key-only validation)
	startKey, err := table.Schema.ExtractKeyFromKeyData(req.StartKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract startKey: %v", err))
		return
	}

	endKey, err := table.Schema.ExtractKeyFromKeyData(req.EndKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract endKey: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(table.Tree)
	keys, values, steps, err := adapter.SearchRange(startKey, endKey, enableSteps)

	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	jsonKeys := make([]JSONCompositeKey, len(keys))
	for i, k := range keys {
		jsonKeys[i] = ToJSONCompositeKey(k)
	}

	jsonValues := make([]JSONRecord, len(values))
	for i, v := range values {
		jsonValues[i] = ToJSONRecord(v)
	}

	writeJSONResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"operation": "RANGE_QUERY",
		"keys":     jsonKeys,
		"values":   jsonValues,
		"steps":    ToJSONSteps(steps),
	})
}

// handleGetTreeStructure returns tree structure for visualization
// Route: GET /api/databases/:dbName/tables/:tableName/tree
func (h *APIHandler) handleGetTreeStructure(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Get tree structure from the B+ Tree associated with this table
	tree, err := GetTreeStructure(table.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get tree structure: %v", err))
		return
	}

	writeJSONResponse(w, http.StatusOK, tree)
}

// handleGetWALInfo returns WAL information
// Route: GET /api/databases/:dbName/tables/:tableName/wal
func (h *APIHandler) handleGetWALInfo(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	walInfo, err := GetWALInfo(table.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, walInfo)
}

// handleGetCacheStats returns cache statistics
// Route: GET /api/databases/:dbName/tables/:tableName/cache
func (h *APIHandler) handleGetCacheStats(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	cacheStats := GetCacheStatsInfo(table.Tree)
	writeJSONResponse(w, http.StatusOK, cacheStats)
}

// handleGetCachePages returns list of pages currently in cache
// Route: GET /api/databases/:dbName/tables/:tableName/cache/pages
func (h *APIHandler) handleGetCachePages(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	cachePages := GetCachePagesInfo(table.Tree)
	writeJSONResponse(w, http.StatusOK, cachePages)
}

// handleGetIOReads returns I/O read statistics and details
// Route: GET /api/databases/:dbName/tables/:tableName/io
func (h *APIHandler) handleGetIOReads(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	ioInfo := GetIOReadInfo(table.Tree)
	writeJSONResponse(w, http.StatusOK, ioInfo)
}

// handleGetTreeConfig returns runtime B+Tree configuration
// Route: GET /api/databases/:dbName/tables/:tableName/config
func (h *APIHandler) handleGetTreeConfig(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	config, err := GetTreeConfigInfo(table.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, config)
}

// handleGetTableSchema returns the schema for a table
// Route: GET /api/databases/:dbName/tables/:tableName/schema
func (h *APIHandler) handleGetTableSchema(w http.ResponseWriter, r *http.Request, dbName, tableName string) {
	table, err := h.dbManager.GetTable(dbName, tableName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	if table.Schema == nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("Table '%s' in database '%s' does not have a schema", tableName, dbName))
		return
	}

	// Convert to API format
	columns := make([]ColumnInfo, len(table.Schema.Columns))
	for i, col := range table.Schema.Columns {
		columns[i] = ColumnInfo{
			Name: col.Name,
			Type: col.Type.String(),
		}
	}

	schemaInfo := SchemaInfo{
		Columns:          columns,
		PrimaryKeyColumns: table.Schema.PrimaryKeyColumns,
	}

	writeJSONResponse(w, http.StatusOK, schemaInfo)
}

// writeJSONResponse writes a JSON response with appropriate headers
func writeJSONResponse(w http.ResponseWriter, statusCode int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	return json.NewEncoder(w).Encode(data)
}

// writeError writes an error response
func writeError(w http.ResponseWriter, statusCode int, message string) {
	writeJSONResponse(w, statusCode, map[string]interface{}{
		"success": false,
		"error":   message,
	})
}