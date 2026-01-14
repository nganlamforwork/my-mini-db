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
  - [Testing](#testing)
  - [Real-World Context](#real-world-context)
  - [Performance Characteristics](#performance-characteristics)
  - [License](#license)

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

- **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)**: Complete implementation details, algorithms, and architecture
- **[docs/TESTING.md](docs/TESTING.md)**: Comprehensive test suite documentation and test infrastructure
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)**: Development history and version evolution

For full technical details, see [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

---

## Project Structure

```
MiniDB/
├── cmd/
│   └── minidb/         # Main application entry point
│       ├── main.go
│       └── example_types.go
├── internal/
│   ├── btree/          # B+Tree implementation
│   │   ├── tree.go
│   │   └── tree_test.go
│   ├── page/           # Page management
│   │   ├── page_header.go
│   │   ├── meta_page.go
│   │   ├── leaf_page.go
│   │   ├── internal_page.go
│   │   ├── node.go
│   │   └── page_manager.go
│   ├── storage/        # Storage types
│   │   └── types.go
│   └── transaction/    # Transaction & WAL
│       ├── transaction.go
│       └── wal.go
├── docs/               # Documentation
│   ├── IMPLEMENTATION.md
│   ├── TESTING.md
│   └── CHANGELOG.md
├── scripts/            # Utility scripts
│   └── visualize_tree.py
├── testdata/           # Test artifacts
│   └── [test directories]
├── go.mod
└── README.md           # This file
```

---

## Features

> **Note:** For complete feature documentation, see [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)

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
- **Disk Persistence**: Load tree structure from disk on startup
- **Page Management**: In-memory caching with 4KB page size
- **Composite Keys**: Multi-column primary keys with lexicographic ordering
- **Structured Records**: Typed database rows (Int, String, Float, Bool)

### Architecture Highlights

- **Page-Based Storage**: Fixed-size 4KB pages with page headers
- **B+Tree Order**: 4 (max 3 keys per node, 4 children)
- **Page Types**: Meta, Internal, Leaf
- **Leaf Linking**: Doubly-linked list for efficient range scans
- **WAL File**: Separate `.wal` file for transaction logging

---

## Overview

MiniDB is a production-ready B+Tree database implementation demonstrating core database engine concepts. The implementation follows industry-standard patterns used by PostgreSQL, SQLite, and MySQL InnoDB, and is based on the ARIES recovery algorithm principles.

---

## Quick Start

```go
package main

import (
    "fmt"

    "bplustree/internal/btree"
    "bplustree/internal/page"
    "bplustree/internal/storage"
)

func main() {
    // Create page manager
    pager := page.NewPageManagerWithFile("mydb.db", true)
    defer pager.Close()

    // Create B+Tree with transaction support
    tree, err := btree.NewBPlusTree(pager)
    if err != nil {
        panic(err)
    }
    defer tree.Close()

    // Start transaction
    tree.Begin()

    // Insert data
    key := storage.NewCompositeKey(storage.NewInt(10))
    value := storage.NewRecord(storage.NewString("Hello"), storage.NewInt(42))
    tree.Insert(key, value)

    // Commit transaction
    tree.Commit()

    // Search
    result, err := tree.Search(key)
    if err == nil {
        fmt.Println("Found:", result)
    }
}
```

---

## Testing

Run the comprehensive test suite:

```bash
go test -v ./internal/btree/...
```

Tests generate:

- Binary database files (`.db`)
- Visual tree diagrams (`.png`)
- Test documentation (`description.txt`)

See [docs/TESTING.md](docs/TESTING.md) for detailed test documentation.

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

**Version:** 4.0  
**Last Updated:** January 2026
