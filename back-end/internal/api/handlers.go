package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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
func (h *APIHandler) handleCreateDatabase(w http.ResponseWriter, r *http.Request) {
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

	if err := h.dbManager.CreateDatabase(req.Name, req.Config); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONResponse(w, http.StatusCreated, map[string]interface{}{
		"success": true,
		"name":    req.Name,
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

// handleInsert handles insert operations
func (h *APIHandler) handleInsert(w http.ResponseWriter, r *http.Request, dbName string) {
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

	adapter := NewTreeAdapter(db.Tree)
	steps, err := adapter.Insert(key, value)

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

	adapter := NewTreeAdapter(db.Tree)
	steps, err := adapter.Update(key, value)

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
func (h *APIHandler) handleDelete(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		Key JSONCompositeKey `json:"key"`
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

	adapter := NewTreeAdapter(db.Tree)
	steps, err := adapter.Delete(key)

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
func (h *APIHandler) handleSearch(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		Key JSONCompositeKey `json:"key"`
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

	adapter := NewTreeAdapter(db.Tree)
	value, steps, err := adapter.Search(key)

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
func (h *APIHandler) handleRangeQuery(w http.ResponseWriter, r *http.Request, dbName string) {
	var req struct {
		StartKey JSONCompositeKey `json:"startKey"`
		EndKey   JSONCompositeKey `json:"endKey"`
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

	startKey, err := FromJSONCompositeKey(req.StartKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid startKey: %v", err))
		return
	}

	endKey, err := FromJSONCompositeKey(req.EndKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid endKey: %v", err))
		return
	}

	adapter := NewTreeAdapter(db.Tree)
	keys, values, steps, err := adapter.SearchRange(startKey, endKey)

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
func (h *APIHandler) handleGetTreeStructure(w http.ResponseWriter, r *http.Request, dbName string) {
	db, err := h.dbManager.GetDatabase(dbName)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	tree, err := GetTreeStructure(db.Tree)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
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