# MiniDB

A file-backed B+Tree database implementation in Go with full CRUD operations, transaction support, and Write-Ahead Logging (WAL).

## Table of Contents

- [MiniDB](#minidb)
  - [Table of Contents](#table-of-contents)
  - [Author](#author)
  - [Documentation](#documentation)
  - [Project Structure](#project-structure)
  - [Features](#features)
    - [Core Operations](#core-operations)
    - [Advanced Features](#advanced-features)
    - [Architecture Highlights](#architecture-highlights)
  - [Overview](#overview)
  - [Quick Start](#quick-start)
    - [Option 1: REST API Server](#option-1-rest-api-server)
    - [Option 2: Direct Go API Usage](#option-2-direct-go-api-usage)
    - [Option 3: REST API Examples](#option-3-rest-api-examples)
  - [Testing](#testing)
    - [Backend Tests](#backend-tests)
    - [Web Interface (Optional)](#web-interface-optional)
    - [API Testing](#api-testing)
  - [Real-World Context](#real-world-context)
  - [Performance Characteristics](#performance-characteristics)
  - [License](#license)
  - [Key Features](#key-features)

---

## Author

**Lam Le Vu Ngan**  
**Role:** Software Engineer

- **GitHub:** [nganlamforwork](https://github.com/nganlamforwork/)
- **LinkedIn:** [Ngan Lam Le Vu](https://www.linkedin.com/in/nganlamlevu/)

- **Email:** nganlamforwork@gmail.com
- **Phone:** (+84) 945 29 30 31

---

## Documentation

- **[API.md](back-end/docs/API.md)**: Complete REST API documentation with endpoints and examples
- **[IMPLEMENTATION.md](back-end/docs/IMPLEMENTATION.md)**: Complete implementation details, algorithms, and architecture
- **[TESTING.md](back-end/docs/TESTING.md)**: Comprehensive test suite documentation and test infrastructure
- **[CHANGELOG.md](back-end/docs/CHANGELOG.md)**: Development history and version evolution

For full technical details, see [IMPLEMENTATION.md](back-end/docs/IMPLEMENTATION.md).

---

## Project Structure

```
MiniDB/
├── back-end/                       # Go backend implementation
│   ├── cmd/
│   │   └── minidb/                 # Main application entry point
│   │       └── main.go
│   ├── internal/
│   │   ├── api/                    # REST API server
│   │   │   ├── handlers.go         # HTTP request handlers
│   │   │   ├── db_manager.go       # Database instance management
│   │   │   ├── server.go           # HTTP server setup
│   │   │   ├── adapter.go          # B+Tree operation adapter
│   │   │   ├── introspection.go    # Tree structure introspection
│   │   │   ├── models.go           # API data models
│   │   │   └── json_helpers.go     # JSON serialization helpers
│   │   ├── btree/                  # B+Tree implementation
│   │   │   ├── tree.go             # Core B+Tree operations
│   │   │   ├── tree_test.go        # B+Tree integration tests
│   │   │   ├── cache_test.go       # Cache configuration & LRU cache tests
│   │   │   ├── utils.go            # Utility functions
│   │   │   └── testdata/           # Test artifacts (DB files, PNG diagrams)
│   │   ├── page/                   # Page management
│   │   │   ├── page_header.go      # Page header structure
│   │   │   ├── meta_page.go        # Metadata page implementation
│   │   │   ├── leaf_page.go        # Leaf page operations
│   │   │   ├── internal_page.go    # Internal page operations
│   │   │   ├── node.go             # Common page types
│   │   │   ├── page_manager.go     # Page allocation & caching
│   │   │   ├── cache.go            # LRU cache implementation
│   │   │   └── clone.go            # Page cloning utilities
│   │   ├── common/                 # Shared utilities
│   │   │   └── search.go           # Binary search functions
│   │   ├── storage/                # Storage types
│   │   │   └── types.go            # CompositeKey & Record types
│   │   └── transaction/            # Transaction & WAL
│   │       ├── transaction.go      # Transaction management
│   │       └── wal.go              # Write-Ahead Logging
│   ├── docs/                       # Backend documentation
│   │   ├── API.md                  # REST API documentation
│   │   ├── IMPLEMENTATION.md       # Implementation details & algorithms
│   │   ├── TESTING.md              # Test suite documentation
│   │   └── CHANGELOG.md            # Development history
│   ├── scripts/                   # Utility scripts
│   │   └── visualize_tree.py      # Tree visualization tool
│   ├── database/                   # Database files storage (auto-created)
│   │   └── *.db, *.wal             # Database and WAL files
│   ├── go.mod                      # Go module definition
│   └── go.sum                      # Go module checksums
├── front-end/                      # React web interface (optional, for visualization)
│   └── ...                         # React + TypeScript + Vite application
└── README.md                       # This file
```

---

## Features

> **Note:** For complete feature documentation, see [IMPLEMENTATION.md](back-end/docs/IMPLEMENTATION.md)

### Core Operations

- **Insert**: O(log n) insertion with automatic node splitting
- **Search**: O(log n) point queries
- **Update**: In-place updates when possible, fallback to delete+insert
- **Delete**: Full rebalancing with borrow and merge operations
- **Range Query**: O(log n + k) range scans using leaf-level linked list

### Advanced Features

- **Transaction Support**: Multi-operation atomicity with Begin/Commit/Rollback
- **Write-Ahead Logging**: All changes logged before database writes
- **Crash Recovery**: Automatic recovery by replaying WAL entries
- **LRU Page Cache**: Configurable in-memory cache with automatic eviction (default: 100 pages, customizable at database creation)
- **Disk Persistence**: Load tree structure from disk on startup
- **Page Management**: 4KB page size with efficient memory management
- **Composite Keys**: Multi-column primary keys with lexicographic ordering
- **Structured Records**: Typed database rows (Int, String, Float, Bool)

### Architecture Highlights

- **Page-Based Storage**: Fixed-size 4KB pages with page headers
- **B+Tree Order**: 4 (max 3 keys per node, 4 children)
- **Page Types**: Meta, Internal, Leaf
- **LRU Cache**: Least Recently Used cache for frequently accessed pages
- **Leaf Linking**: Doubly-linked list for efficient range scans
- **WAL File**: Separate `.wal` file for transaction logging

---

## Overview

MiniDB is a production-ready B+Tree database implementation demonstrating core database engine concepts. The implementation follows industry-standard patterns used by PostgreSQL, SQLite, and MySQL InnoDB, and is based on the ARIES recovery algorithm principles.

The core backend provides:
- **B+Tree Engine**: Full B+Tree implementation with all CRUD operations
- **REST API**: RESTful endpoints for all database operations with step-based execution traces
- **Transaction Support**: Multi-operation atomicity with WAL-based crash recovery
- **Page Cache**: Configurable LRU cache for efficient memory management

**Note:** A React web interface (`front-end/`) is included for easy visualization and testing, but the backend can be used independently via the REST API or directly through Go code.

---

## Quick Start

### Option 1: REST API Server

Start the backend API server:

```bash
cd back-end
go run cmd/minidb/main.go -server -addr :8080
```

The API will be available at `http://localhost:8080/api`. See [API.md](back-end/docs/API.md) for complete API documentation.

**Optional:** To use the web interface for visualization, start the frontend:

```bash
cd front-end
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### Option 2: Direct Go API Usage

```go
package main

import (
    "fmt"

    "bplustree/internal/btree"
    "bplustree/internal/storage"
)

func main() {
    // Create B+Tree with custom database filename (default cache: 100 pages)
    // PageManager and WAL are created internally
    // Files are stored in database/ folder
    tree, err := btree.NewBPlusTree("database/mydb.db", true)  // true = truncate existing file
    if err != nil {
        panic(err)
    }
    defer tree.Close()

    // Or create with custom cache size (e.g., 200 pages for ~800KB cache)
    // tree, err := btree.NewBPlusTreeWithCacheSize("database/mydb.db", true, 200)

    // Single insert - automatically transactional and crash-recoverable
    key := storage.NewCompositeKey(storage.NewInt(10))
    value := storage.NewRecord(storage.NewString("Hello"), storage.NewInt(42))
    tree.Insert(key, value)  // Auto-commits internally

    // Or use explicit transaction for multiple operations
    tree.Begin()
    tree.Insert(key, value)
    tree.Update(key, storage.NewRecord(storage.NewString("Updated")))
    tree.Commit()  // All operations persist together

    // Search
    result, err := tree.Search(key)
    if err == nil {
        fmt.Println("Found:", result)
    }

    // Check cache statistics
    stats := tree.GetPager().GetCacheStats()
    fmt.Printf("Cache: hits=%d, misses=%d, evictions=%d, size=%d/%d\n",
        stats.Hits, stats.Misses, stats.Evictions,
        stats.Size, tree.GetPager().GetMaxCacheSize())
}
```

### Option 3: REST API Examples

**Create a database:**

```bash
curl -X POST http://localhost:8080/api/databases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mydb",
    "config": {
      "cacheSize": 100
    }
  }'
```

**Insert data:**

```bash
curl -X POST http://localhost:8080/api/databases/mydb/insert \
  -H "Content-Type: application/json" \
  -d '{
    "key": {"values": [{"type": "int", "value": 42}]},
    "value": {"columns": [{"type": "string", "value": "Hello"}]}
  }'
```

See [API.md](back-end/docs/API.md) for complete API documentation.

---

## Testing

### Backend Tests

Run the comprehensive backend test suite:

```bash
cd back-end
go test -v ./internal/btree/...
```

Tests generate:

- Binary database files (`.db`) in test directories
- Visual tree diagrams (`.png`)
- Test documentation (`description.txt`)

See [TESTING.md](back-end/docs/TESTING.md) for detailed test documentation.

### Web Interface (Optional)

The included React frontend (`front-end/`) provides an interactive web interface for:
- Database management (create, connect, delete)
- Visual B+Tree structure inspection
- Step-by-step operation visualization
- Performance monitoring (cache stats, I/O reads, WAL info)

This is optional - the backend can be used independently via the REST API or Go code.

### API Testing

Test the REST API endpoints:

```bash
# List databases
curl http://localhost:8080/api/databases

# Create database
curl -X POST http://localhost:8080/api/databases \
  -H "Content-Type: application/json" \
  -d '{"name": "testdb", "config": {"cacheSize": 100}}'

# Get tree structure
curl http://localhost:8080/api/databases/testdb/tree

# Get cache statistics
curl http://localhost:8080/api/databases/testdb/cache
```

See [API.md](back-end/docs/API.md) for complete API documentation and examples.

---

## Real-World Context

This implementation follows industry-standard patterns:

- **PostgreSQL**: WAL for durability (pg_xlog/pg_wal)
- **SQLite**: WAL mode for crash recovery
- **MySQL InnoDB**: Redo log for durability
- **ARIES Algorithm**: Industry-standard recovery algorithm principles

---

## Performance Characteristics

| Operation      | Time Complexity | Notes                       |
| -------------- | --------------- | --------------------------- |
| Insert         | O(log n)        | May trigger O(log n) splits |
| Search         | O(log n)        | Single path traversal       |
| Delete         | O(log n)        | May trigger O(log n) merges |
| Update         | O(log n)        | In-place when fits          |
| Range Query    | O(log n + k)    | k = result count            |
| Load from Disk | O(n)            | Must read all n pages       |

---

## License

This project is for educational and demonstration purposes.

---

## Key Features

- **B+Tree Implementation**: Full B+Tree with insert, search, update, delete, and range queries
- **Transaction Support**: Multi-operation atomicity with Begin/Commit/Rollback
- **Write-Ahead Logging**: All changes logged before database writes
- **Crash Recovery**: Automatic recovery by replaying WAL entries
- **LRU Page Cache**: Configurable in-memory cache with automatic eviction (default: 100 pages)
- **REST API**: Complete RESTful API for all operations with step-based execution traces
- **Page-Based Storage**: Fixed-size 4KB pages with efficient memory management
- **Composite Keys**: Multi-column primary keys with lexicographic ordering
- **Structured Records**: Typed database rows (Int, String, Float, Bool)

**Note:** A React web interface is included for visualization and testing, but the backend is fully functional standalone.

---

**Version:** 6.0 (Web Interface & Visualization)  
**Last Updated:** January 2026
