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
    - [Direct Go API Usage](#direct-go-api-usage)
  - [Testing](#testing)
    - [Running Tests](#running-tests)
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

- **[IMPLEMENTATION.md](mini-db-engine/docs/IMPLEMENTATION.md)**: Complete implementation details, algorithms, and architecture
- **[TESTING.md](mini-db-engine/docs/TESTING.md)**: Comprehensive test suite documentation and test infrastructure
- **[CHANGELOG.md](mini-db-engine/docs/CHANGELOG.md)**: Development history and version evolution

For full technical details, see [IMPLEMENTATION.md](mini-db-engine/docs/IMPLEMENTATION.md).

---

## Project Structure

```
MiniDB/
├── mini-db-engine/                 # Go database engine implementation
│   ├── cmd/
│   │   └── minidb/                 # Main application entry point
│   │       ├── main.go
│   │       └── example_types.go   # Usage examples
│   ├── internal/
│   │   ├── btree/                  # B+Tree implementation
│   │   │   ├── tree.go             # Core B+Tree operations
│   │   │   ├── tree_test.go        # B+Tree integration tests
│   │   │   ├── cache_test.go       # Cache configuration & LRU cache tests
│   │   │   ├── utils.go            # Utility functions
│   │   │   └── testdata/           # Test artifacts (DB files, description files)
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
│   ├── docs/                       # Documentation
│   │   ├── IMPLEMENTATION.md       # Implementation details & algorithms
│   │   ├── TESTING.md              # Test suite documentation
│   │   └── CHANGELOG.md            # Development history
│   ├── scripts/                   # Utility scripts (if any)
│   ├── database/                   # Database files storage (auto-created)
│   │   └── *.db, *.wal             # Database and WAL files
│   ├── go.mod                      # Go module definition
│   └── go.sum                      # Go module checksums
├── front-end/                      # React web interface (optional)
│   └── ...                         # React + TypeScript + Vite application
└── README.md                       # This file
```

---

## Features

> **Note:** For complete feature documentation, see [IMPLEMENTATION.md](mini-db-engine/docs/IMPLEMENTATION.md)

### Core Operations

- **Insert**: O(log n) insertion with automatic node splitting
- **Search**: O(log n) point queries
- **Update**: In-place updates when possible, fallback to delete+insert
- **Delete**: Full rebalancing with borrow and merge operations
- **Range Query**: O(log n + k) range scans using leaf-level linked list

### Advanced Features

- **Concurrent Access**: Thread-safe operations with concurrent readers and serialized writers (Phase 3.5)
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

The database engine provides:
- **B+Tree Engine**: Full B+Tree implementation with all CRUD operations
- **Concurrent Access**: Thread-safe operations supporting multiple concurrent readers
- **Transaction Support**: Multi-operation atomicity with WAL-based crash recovery
- **Page Cache**: Configurable LRU cache for efficient memory management
- **Direct Go API**: Use the B+Tree directly in Go programs

**Note:** The engine is designed to be used directly via Go code. Test the implementation using the comprehensive test suite.

---

## Quick Start

### Direct Go Usage

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


---

## Testing

### Running Tests

Run the comprehensive test suite:

```bash
cd mini-db-engine
go test -v ./internal/btree/...
```

Tests generate:

- Binary database files (`.db`) in test directories
- Test documentation (`description.txt`)

See [TESTING.md](mini-db-engine/docs/TESTING.md) for detailed test documentation.

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
- **Concurrent Access**: Thread-safe operations with concurrent readers and serialized writers
- **Transaction Support**: Multi-operation atomicity with Begin/Commit/Rollback
- **Write-Ahead Logging**: All changes logged before database writes
- **Crash Recovery**: Automatic recovery by replaying WAL entries
- **LRU Page Cache**: Configurable in-memory cache with automatic eviction (default: 100 pages)
- **Page-Based Storage**: Fixed-size 4KB pages with efficient memory management
- **Composite Keys**: Multi-column primary keys with lexicographic ordering
- **Structured Records**: Typed database rows (Int, String, Float, Bool)

**Note:** The database engine is fully functional and can be used directly in Go programs. Test using the comprehensive test suite.

---

**Version:** 8.0 (Concurrent Access - Phase 3.5)  
**Last Updated:** January 27, 2026
