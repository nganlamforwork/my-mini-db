package api

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Server represents the API server
type Server struct {
	httpServer *http.Server
	dbManager  *DatabaseManager
	handler    *APIHandler
}

// NewServer creates a new API server
func NewServer(addr string) *Server {
	dbManager := NewDatabaseManager()
	handler := NewAPIHandler(dbManager)

	mux := http.NewServeMux()
	mux.Handle("/api/", http.StripPrefix("/api", handler))

	return &Server{
		httpServer: &http.Server{
			Addr:         addr,
			Handler:      mux,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		dbManager: dbManager,
		handler:   handler,
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	fmt.Printf("MiniDB API server starting on %s\n", s.httpServer.Addr)
	fmt.Printf("API endpoints available at: http://localhost%s/api/\n", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

// Stop gracefully stops the HTTP server
func (s *Server) Stop(ctx context.Context) error {
	// Close all databases
	if err := s.dbManager.CloseAll(); err != nil {
		fmt.Printf("Error closing databases: %v\n", err)
	}

	// Shutdown HTTP server
	return s.httpServer.Shutdown(ctx)
}

// GetDatabaseManager returns the database manager
func (s *Server) GetDatabaseManager() *DatabaseManager {
	return s.dbManager
}