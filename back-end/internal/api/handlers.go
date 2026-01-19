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
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "insert":
		h.handleInsert(w, r, parts[1])
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "update":
		h.handleUpdate(w, r, parts[1])
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "delete":
		h.handleDelete(w, r, parts[1])
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "search":
		h.handleSearch(w, r, parts[1])
	case r.Method == "POST" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "range":
		h.handleRangeQuery(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "tree":
		h.handleGetTreeStructure(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "wal":
		h.handleGetWALInfo(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 4 && parts[0] == "databases" && parts[2] == "cache" && parts[3] == "pages":
		h.handleGetCachePages(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "cache":
		h.handleGetCacheStats(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "io":
		h.handleGetIOReads(w, r, parts[1])
	case r.Method == "GET" && len(parts) == 3 && parts[0] == "databases" && parts[2] == "config":
		h.handleGetTreeConfig(w, r, parts[1])
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

// handleCreateDatabase creates a new database
// Architecture: 1 Database = 1 Table = 1 B+ Tree
// Schema is mandatory - columns and primaryKey must be provided
func (h *APIHandler) handleCreateDatabase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string          `json:"name"`
		Config      DatabaseConfig  `json:"config,omitempty"`
		Columns     []struct {
			Name string `json:"name"`
			Type string `json:"type"` // "INT", "STRING", "FLOAT", "BOOL"
		} `json:"columns"`
		PrimaryKey  []string        `json:"primaryKey"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "Database name is required")
		return
	}

	// Schema is mandatory - validate columns and primaryKey
	if len(req.Columns) == 0 {
		writeError(w, http.StatusBadRequest, "At least one column is required")
		return
	}

	if len(req.PrimaryKey) == 0 {
		writeError(w, http.StatusBadRequest, "At least one primary key column is required")
		return
	}

	// Build schema from columns and primaryKey
	columnDefs := make([]storage.ColumnDefinition, len(req.Columns))
	for i, col := range req.Columns {
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
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid column type '%s'. Must be INT, STRING, FLOAT, or BOOL", col.Type))
			return
		}
		columnDefs[i] = storage.ColumnDefinition{
			Name: col.Name,
			Type: colType,
		}
	}

	schema, err := storage.NewSchema(columnDefs, req.PrimaryKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid schema: %v", err))
		return
	}

	// Verify all primary key columns exist in columns
	columnNames := make(map[string]bool)
	for _, col := range columnDefs {
		columnNames[col.Name] = true
	}
	for _, pkCol := range req.PrimaryKey {
		if !columnNames[pkCol] {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Primary key column '%s' does not exist in columns", pkCol))
			return
		}
	}

	if err := h.dbManager.CreateDatabase(req.Name, req.Config, schema); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := map[string]interface{}{
		"success": true,
		"name":    req.Name,
		"schema": map[string]interface{}{
			"columns": req.Columns,
			"primaryKey": req.PrimaryKey,
		},
	}

	writeJSONResponse(w, http.StatusCreated, response)
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
// Accepts row data as JSON object, extracts key using schema
func (h *APIHandler) handleInsert(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if database has schema
	if db.Schema == nil {
		writeError(w, http.StatusBadRequest, "Database does not have a schema. Please create database with schema first.")
		return
	}

	// Decode row data as map[string]interface{}
	var rowData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rowData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Validate row against schema
	if err := db.Schema.ValidateRow(rowData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Row validation failed: %v", err))
		return
	}

	// Extract key from row using schema
	key, err := db.Schema.ExtractKey(rowData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Convert row to Record
	value, err := db.Schema.RowToRecord(rowData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to convert row to record: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(db.Tree)
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
func (h *APIHandler) handleUpdate(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		Key   JSONCompositeKey `json:"key"`
		Value JSONRecord       `json:"value"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	db, err := h.dbManager.GetDatabase(dbName)
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

	adapter := NewTreeAdapter(db.Tree)
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
// Accepts composite key components as JSON object, constructs key using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleDelete(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if database has schema
	if db.Schema == nil {
		writeError(w, http.StatusBadRequest, "Database does not have a schema. Please create database with schema first.")
		return
	}

	// Decode key components as map[string]interface{}
	var keyData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&keyData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Extract key from key components using schema (key-only validation)
	key, err := db.Schema.ExtractKeyFromKeyData(keyData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(db.Tree)
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
// Accepts composite key components as JSON object, constructs key using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleSearch(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if database has schema
	if db.Schema == nil {
		writeError(w, http.StatusBadRequest, "Database does not have a schema. Please create database with schema first.")
		return
	}

	// Decode key components as map[string]interface{}
	var keyData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&keyData); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	// Extract key from key components using schema (key-only validation)
	key, err := db.Schema.ExtractKeyFromKeyData(keyData)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract key: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(db.Tree)
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
// Accepts key component maps (like Search/Delete), constructs keys using schema
// Only validates primary key fields, ignores non-key attributes
func (h *APIHandler) handleRangeQuery(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		StartKey map[string]interface{} `json:"startKey"`
		EndKey   map[string]interface{} `json:"endKey"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Check if database has schema
	if db.Schema == nil {
		writeError(w, http.StatusBadRequest, "Database does not have a schema. Please create database with schema first.")
		return
	}

	// Extract keys from key component maps using schema (key-only validation)
	startKey, err := db.Schema.ExtractKeyFromKeyData(req.StartKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract startKey: %v", err))
		return
	}

	endKey, err := db.Schema.ExtractKeyFromKeyData(req.EndKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to extract endKey: %v", err))
		return
	}

	// Parse enable_steps query parameter (default: false)
	enableSteps := r.URL.Query().Get("enable_steps") == "true"

	adapter := NewTreeAdapter(db.Tree)
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
// Architecture: 1 Database = 1 Table = 1 B+ Tree
// Route: GET /api/databases/:dbName/tree
func (h *APIHandler) handleGetTreeStructure(w http.ResponseWriter, r *http.Request, dbName string) {
	// Get the database instance (must be connected)
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("Database '%s' not found or not connected. Please connect the database first.", dbName))
		return
	}

	// Get tree structure from the single B+ Tree associated with this database
	tree, err := GetTreeStructure(db.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to get tree structure: %v", err))
		return
	}

	writeJSONResponse(w, http.StatusOK, tree)
}

// handleGetWALInfo returns WAL information
func (h *APIHandler) handleGetWALInfo(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	walInfo, err := GetWALInfo(db.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, walInfo)
}

// handleGetCacheStats returns cache statistics
func (h *APIHandler) handleGetCacheStats(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	cacheStats := GetCacheStatsInfo(db.Tree)
	writeJSONResponse(w, http.StatusOK, cacheStats)
}

// handleGetCachePages returns list of pages currently in cache
func (h *APIHandler) handleGetCachePages(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	cachePages := GetCachePagesInfo(db.Tree)
	writeJSONResponse(w, http.StatusOK, cachePages)
}

// handleGetIOReads returns I/O read statistics and details
func (h *APIHandler) handleGetIOReads(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	ioInfo := GetIOReadInfo(db.Tree)
	writeJSONResponse(w, http.StatusOK, ioInfo)
}

// handleGetTreeConfig returns runtime B+Tree configuration
func (h *APIHandler) handleGetTreeConfig(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	config, err := GetTreeConfigInfo(db.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusOK, config)
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