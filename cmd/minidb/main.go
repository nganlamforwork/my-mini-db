package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bplustree/internal/api"
)

func main() {
	var (
		serverMode = flag.Bool("server", false, "Run as API server")
		addr       = flag.String("addr", ":8080", "Server address (e.g., :8080)")
	)
	flag.Parse()

	if *serverMode {
		runServer(*addr)
	} else {
		runExample()
	}
}

func runServer(addr string) {
	server := api.NewServer(addr)

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.Start(); err != nil {
			fmt.Printf("Server error: %v\n", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	<-sigChan
	fmt.Println("\nShutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Stop(ctx); err != nil {
		fmt.Printf("Error shutting down: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Server stopped")
}

func runExample() {
	fmt.Println("B+ Tree implementation")
	fmt.Println("\nTo run as API server, use: go run . -server")
	fmt.Println("Example: go run . -server -addr :8080")
	fmt.Println("\nRunning example usage...")

	// Note: Import btree here to avoid circular dependency
	// This is just an example - the API server doesn't need this
	fmt.Println("\nExample: Creating a B+Tree directly")
	fmt.Println("For API usage, start the server with -server flag")
}
