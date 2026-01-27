# MiniDB Development Changelog

This document tracks the evolution of the MiniDB B+Tree database implementation, documenting major development phases and feature additions.

## Table of Contents

- [MiniDB Development Changelog](#minidb-development-changelog)
  - [Table of Contents](#table-of-contents)
  - [Version 8.0 - Concurrent Access (Current)](#version-80---concurrent-access-phase-35)
  - [Version 7.0 - Schema Enforcement](#version-70---schema-enforcement)
    - [Major Features Added](#major-features-added)
    - [Implementation Details](#implementation-details)
      - [Schema Definition](#schema-definition)
      - [Row-to-Key Extraction Logic](#row-to-key-extraction-logic)
      - [Key Ordering](#key-ordering)
    - [Schema-Based Operations](#schema-based-operations)
      - [Create Database (Updated)](#create-database-updated)
      - [Insert (Updated)](#insert-updated)
      - [Search \& Delete (Updated)](#search--delete-updated)
      - [Cleanup All Databases (New)](#cleanup-all-databases-new)
    - [Breaking Changes](#breaking-changes)
    - [Migration Guide](#migration-guide)
    - [Files Added](#files-added)
    - [Files Modified](#files-modified)
    - [Key Improvements Over Version 6.0](#key-improvements-over-version-60)
  - [Version 5.0 - LRU Page Cache](#version-50---lru-page-cache)
    - [Major Features Added](#major-features-added-1)
    - [Implementation Details](#implementation-details-1)
    - [Real-World Context](#real-world-context)
    - [Benefits](#benefits)
    - [Cache Statistics](#cache-statistics)
    - [Testing](#testing)
    - [Files Added](#files-added-1)
    - [Files Modified](#files-modified-1)
    - [Key Improvements Over Version 4.0](#key-improvements-over-version-40)
  - [Version 4.0 - Complete Transaction Support \& Write-Ahead Logging](#version-40---complete-transaction-support--write-ahead-logging)
    - [Major Features Added](#major-features-added-2)
    - [Implementation Details](#implementation-details-2)
    - [Real-World Context](#real-world-context-1)
    - [Crash Safety Scenarios](#crash-safety-scenarios)
    - [Testing](#testing-1)
    - [Files Added](#files-added-2)
    - [Files Modified](#files-modified-2)
    - [Key Improvements Over Version 3.0](#key-improvements-over-version-30)
  - [Version 3.0 - Composite Keys \& Structured Records](#version-30---composite-keys--structured-records)
    - [Major Features Added](#major-features-added-3)
    - [Implementation Details](#implementation-details-3)
    - [Benefits](#benefits-1)
    - [Files Added](#files-added-3)
    - [Files Modified](#files-modified-3)
    - [Key Improvements Over Version 2.0](#key-improvements-over-version-20)
  - [Version 2.0 - Disk Persistence \& Load from Disk](#version-20---disk-persistence--load-from-disk)
    - [Major Features Added](#major-features-added-4)
    - [Implementation Details](#implementation-details-4)
    - [Benefits](#benefits-2)
    - [Files Modified](#files-modified-4)
    - [Key Improvements Over Version 1.0](#key-improvements-over-version-10)
  - [Version 1.0 - Core B+Tree Implementation](#version-10---core-btree-implementation)
    - [Major Features Implemented](#major-features-implemented)
    - [Implementation Details](#implementation-details-5)
    - [Files Created](#files-created)
  - [Development Timeline](#development-timeline)
  - [Future Roadmap](#future-roadmap)
    - [Version 6.0 - Performance Optimizations (Planned)](#version-60---performance-optimizations-planned)
    - [Version 9.0 - Advanced Concurrency (Planned)](#version-90---advanced-concurrency-planned)
    - [Version 10.0 - Advanced Features (Planned)](#version-100---advanced-features-planned)
  - [Statistics](#statistics)
    - [Code Growth](#code-growth)
    - [Test Coverage](#test-coverage)
    - [Features by Version](#features-by-version)
  - [Notes](#notes)

## Version 8.0 - Concurrent Access (Phase 3.5)

**Release Date:** January 27, 2026  
**Status:** Current Version - Stabilized

### Major Features Added

- **Thread-Safe Architecture**
  - **Concurrent Readers**: Multiple readers can search the tree simultaneously (Shared Locks)
  - **Serialized Writers**: Writers operate safely under a Global Lock (Phase 3 approach)
  - **Thread-Safe Transactions**: Complete overhaul of `TransactionManager` to support concurrent access

### Implementation Details

- **Concurrency Control**
  - Replaced ad-hoc locking with structured `sync.RWMutex` architecture
  - `Search` operations acquire `RLock` (Read Lock)
  - `Insert`/`Delete` operations acquire `Lock` (Write Lock)
  - Added race detection to CI/CD pipeline

- **Transaction Manager Hardening**
  - Fixed critical race conditions in internal map access (`modifiedPages`, `originalPages`)
  - Added fine-grained synchronization to:
    - `TrackPageModification`
    - `TrackPageAllocation`
    - `TrackPageDeletion`

- **Phase 4 Research Artifacts (In-Codebase)**
  - Implemented but disabled fine-grained pessimistic locking logic:
    - `findLeafPessimistic()`: Root-to-leaf exclusive locking
    - `handleSplitWithLocks()`: Specialized split handler for pre-locked paths
    - `rebalanceLeafWithLocks()`: Specialized merge handler for pre-locked paths

### Why Phase 3.5?
I successfully implemented the infrastructure for full Phase 4 concurrency (fine-grained splits) but identified exponential complexity risks. To guarantee data integrity (Correctness > Performance), I stabilized at Phase 3.5, which offers concurrent reads and guaranteed safety for writers.

### Testing

- Comprehensive concurrency test suite in `internal/btree/concurrent_test.go`:
  - `TestCrabbing_ReaderWriterIsolation`: Verifies reader-writer isolation with 20 concurrent readers, 1 writer, and 1 deleter
  - `TestOptimisticWrite_WALLogging`: Verifies WAL logging correctness under concurrent operations
  - `TestOptimisticWrite_ConcurrentOperations`: Tests concurrent writers and deleters operating on different key ranges
  - `TestOptimisticWrite_SafetyChecks`: Validates safety check logic for optimistic operations
- All tests run with Go race detector (`-race` flag) to ensure zero race conditions
- Thread-safety verified through stress testing with multiple goroutines

### Files Added

- `internal/btree/concurrent_test.go`: Comprehensive concurrency test suite

### Files Modified

- `internal/btree/tree.go`: Added `sync.RWMutex` for thread-safe operations
- `internal/transaction/transaction.go`: Added fine-grained locking for thread-safe transaction management

### Key Improvements Over Version 7.0

- **Concurrent Read Access**: Multiple readers can search simultaneously without blocking
- **Thread Safety**: All operations are now safe for concurrent use
- **Transaction Hardening**: Transaction manager is fully thread-safe with fine-grained synchronization
- **Race Condition Free**: All operations verified with Go race detector

---


## Version 7.0 - Schema Enforcement

**Release Date:** January 2026  
**Status:** Completed

### Major Features Added

- **Schema Definition System**: Tables now require explicit schema definitions with column types and primary keys
- **Row Validation**: Automatic validation of row data against schema (field existence and type checking)
- **Key Extraction**: Automatic extraction of composite keys from row data based on primary key column order
- **Schema Persistence**: Schemas are persisted to disk as `.schema.json` files
- **Data Cleanup**: Utility functions to wipe incompatible database files

### Implementation Details

#### Schema Definition

Schemas define:
- **Columns**: Array of column definitions (name, type)
- **Primary Key**: Ordered list of column names that form the composite primary key

Supported column types:
- `INT`: Integer (int64)
- `STRING`: String
- `FLOAT`: Float64
- `BOOL`: Boolean

#### Row-to-Key Extraction Logic

When a row is inserted:
1. Row is validated against schema (all columns must exist, types must match)
2. Primary key is extracted by pulling values from the row in the order defined by `primaryKeyColumns`
3. Example: If schema has columns [A, B, C] and PK is [C, A], input {A:1, B:2, C:3} generates Key [3, 1]

#### Key Ordering

The order of columns in `primaryKeyColumns` determines how records are sorted:
- Records are sorted by the first primary key column, then the second, etc.
- Example: PK [col2, col1] means records are sorted by col2 first, then col1

### Schema-Based Operations

Schema enforcement enables automatic validation and key extraction:

- **Row Validation**: All row data is validated against schema (field existence and type checking)
- **Automatic Key Extraction**: Composite keys are automatically extracted from row data based on primary key column order
- **Type Safety**: Schema enforcement ensures data integrity at the B+Tree level

### Breaking Changes

- **Old databases are incompatible**: Databases created before Version 7.0 use a different data structure
- **Schema required**: New databases must be created with a schema definition
- **Operation format changed**: Insert, Search, and Delete operations now work with schema-validated rows and keys

### Files Added

- `internal/storage/types.go`: Added `ColumnDefinition`, `Schema` structs and validation/extraction functions
- `internal/storage/schema_test.go`: Schema validation and key extraction tests
- `internal/btree/schema_test.go`: B+Tree integration tests with schema support

### Files Modified

- `internal/btree/tree.go`: Added schema field and getter/setter methods
- `docs/IMPLEMENTATION.md`: Added Row-to-Key extraction logic documentation
- `docs/CHANGELOG.md`: Added Version 7.0 entry

### Key Improvements Over Version 6.0

- **Type Safety**: Schema enforcement ensures data integrity
- **Simplified Operations**: Row-based operations are more intuitive than manual key/value construction
- **Flexible Primary Keys**: Support for composite primary keys with custom ordering
- **Automatic Key Extraction**: No need to manually construct composite keys

---

## Version 5.0 - LRU Page Cache

**Date:** January 2026  
**Status:** Completed

### Major Features Added

- **LRU Page Cache**

  - Least Recently Used (LRU) cache for page management
  - Configurable cache size at database creation (default: 100 pages, ~400KB)
  - Automatic eviction of least recently used pages
  - Thread-safe implementation with read-write mutex
  - Cache statistics (hits, misses, evictions, size)

- **Cache Size Configuration**
  - `NewBPlusTreeWithCacheSize(filename, truncate, maxCacheSize)` - Create database with custom cache size
  - `NewBPlusTree(filename, truncate)` - Uses default cache size (100 pages) for backward compatibility
  - Users can configure cache size based on available memory and workload requirements

### Implementation Details

- **New File**: `internal/page/cache.go` - LRU cache implementation

  - Doubly-linked list for LRU ordering
  - Hash map for O(1) page lookup
  - Thread-safe operations
  - Cache statistics tracking

- **Updated**: `internal/btree/tree.go`

  - Added `NewBPlusTreeWithCacheSize()` constructor for custom cache size configuration
  - Updated `NewBPlusTree()` to use default cache size (backward compatible)

- **Updated**: `internal/page/page_manager.go`

  - Replaced unbounded map with LRU cache
  - Enhanced `NewPageManagerWithCacheSize()` to properly initialize cache with custom size
  - Added `GetCacheStats()` method for performance monitoring
  - Added `GetMaxCacheSize()` method
  - Added `Put()` and `RemoveFromCache()` methods for cache management

- **Updated**: `internal/transaction/transaction.go` and `internal/transaction/wal.go`
  - Updated to use new cache methods (`Put()` instead of direct map access)

### Real-World Context

This implementation matches how production databases manage memory:

- **PostgreSQL**: Uses shared buffer pool (similar to LRU cache) with configurable size
- **MySQL InnoDB**: Uses buffer pool with LRU eviction (default 128MB)
- **Oracle**: Uses database buffer cache with LRU eviction

### Benefits

- **Predictable Memory Usage**: Cache size limit prevents unbounded memory growth
- **Improved Performance**: Frequently accessed pages stay in memory, reducing disk I/O
- **Production-Like Behavior**: Matches real database memory management
- **Performance Monitoring**: Cache statistics enable performance analysis
- **Scalability**: Can handle large databases without loading all pages into memory

### Cache Statistics

The cache provides detailed performance metrics:

```go
type CacheStats struct {
    Hits      uint64  // Number of cache hits
    Misses    uint64  // Number of cache misses
    Evictions uint64  // Number of pages evicted
    Size      int     // Current cache size
}
```

### Testing

- Added comprehensive cache tests in `internal/page/cache_test.go`

  - Basic LRU operations (Put, Get, Eviction)
  - Cache statistics validation
  - Update operations
  - Remove and Clear operations

- Added cache configuration tests in `internal/btree/cache_test.go`

  - `TestCustomCacheSize` - Verifies custom cache size configuration
  - `TestDefaultCacheSize` - Verifies default cache size (100 pages)
  - `TestCacheSizeEviction` - Verifies cache eviction with small cache size

- All existing B+Tree tests pass with new cache implementation
- Cache eviction verified under memory pressure

### Files Added

- `internal/page/cache.go` - LRU cache implementation
- `internal/page/cache_test.go` - Cache unit tests
- `internal/btree/cache_test.go` - Cache configuration and integration tests

### Files Modified

- `internal/btree/tree.go` - Added `NewBPlusTreeWithCacheSize()` constructor
- `internal/page/page_manager.go` - Enhanced cache initialization with custom size support
- `internal/transaction/transaction.go` - Updated to use cache methods
- `internal/transaction/wal.go` - Updated to use cache methods

### Key Improvements Over Version 4.0

- **Memory Management**: Bounded memory usage with LRU eviction
- **Configurable Cache Size**: Users can set cache size based on available memory and workload
- **Performance**: Reduced disk I/O for frequently accessed pages
- **Monitoring**: Cache statistics for performance analysis
- **Scalability**: Can handle databases larger than available RAM
- **Production-Like Configuration**: Matches real database systems where cache size is configurable

---

## Version 4.0 - Complete Transaction Support & Write-Ahead Logging

**Date:** January 2026  
**Status:** Completed - Production Ready

### Major Features Added

- **Dual Transaction Model**

  - **Auto-Commit Transactions**: Every single operation (Insert/Update/Delete) automatically creates and commits a transaction, ensuring crash recovery for all operations without user intervention
  - **Explicit Transactions**: `Begin()`, `Commit()`, `Rollback()` for multi-operation atomicity
  - Seamless integration between both transaction types

- **Complete Write-Ahead Logging (WAL)**

  - WAL file (`.wal` extension) for durability
  - Log Sequence Numbers (LSN) for ordering and recovery
  - Automatic crash recovery via WAL replay on database open
  - Checkpoint support for WAL truncation
  - Physical page-level logging (complete page snapshots)

- **Crash Safety Guarantee**

  - **No Partial Writes**: All database writes go through transaction commit process
  - **Write-Ahead Principle**: WAL written and synced before database file writes
  - **Guaranteed Consistency**: If crash occurs before commit, tree remains unchanged
  - **Automatic Recovery**: WAL replay restores committed state after crashes
  - **Zero Data Loss**: Every operation is crash-recoverable

- **ACID Properties**
  - **Atomicity**: All-or-nothing transaction execution (single and multi-operation)
  - **Consistency**: Database remains in valid state even after crashes
  - **Durability**: Committed changes survive crashes via WAL replay
  - **Isolation**: Single transaction at a time (concurrency pending)

### Implementation Details

- **Auto-Commit Implementation**

  - `ensureAutoCommitTransaction()` - Automatically creates transaction for single operations
  - `commitAutoTransaction()` - Auto-commits at operation end via defer
  - All operations (Insert/Update/Delete) are transactional by default

- **Explicit Transaction Implementation**

  - `Begin()` - Start explicit transaction for multi-operation queries
  - `Commit()` - Write to WAL first, then flush to database (atomic)
  - `Rollback()` - Restore original page states, discard changes

- **WAL Implementation**

  - Created `wal.go` - Complete WAL implementation
  - `LogPageWrite()` - Logs complete page snapshots to WAL
  - `Recover()` - Replays WAL entries on database open
  - `Checkpoint()` - Truncates WAL after ensuring durability

- **Transaction Management**

  - Created `transaction.go` - Complete transaction management
  - Page modification tracking with original state preservation
  - Page allocation and deletion tracking
  - Transaction state management (Active, Committed, RolledBack)

- **Crash Safety Implementation**

  - Removed all direct database writes during operations
  - All writes (including meta page) go through transaction commit
  - Proper meta page initialization before transaction tracking
  - WAL sync before database file writes ensures durability

- **Integration**
  - Updated `tree.go` - Integrated transaction tracking throughout all operations
  - Updated `page_manager.go` - WAL integration for page writes
  - Added `NewBPlusTree()` constructor with WAL initialization and recovery
  - All operations track page modifications for transaction support

### Real-World Context

This implementation follows industry-standard patterns used in production databases:

- **PostgreSQL**: Auto-commit for single statements, explicit transactions for multi-statement blocks, WAL (pg_xlog/pg_wal) for durability
- **SQLite**: Auto-commit mode by default, WAL mode for crash recovery, explicit transactions for atomicity
- **MySQL InnoDB**: Auto-commit mode by default, redo log (similar to WAL) for durability, explicit transactions for multi-statement operations
- **ARIES Algorithm**: Industry-standard recovery algorithm principles (Write-Ahead Logging, Log Sequence Numbers, Checkpointing)

### Crash Safety Scenarios

Version 4.0 guarantees crash safety in all scenarios:

1. **Crash Before Commit**: No WAL entries, no database writes → Tree unchanged on restart ✓
2. **Crash During Commit**: WAL written and synced, database write incomplete → Recovery restores committed state ✓
3. **Crash After Commit**: Both WAL and database updated and synced → State fully persisted ✓

### Testing

- Comprehensive test suite for transaction features:
  - `TestAutoCommitSingleInsert` - Verifies auto-commit for single operations
  - `TestAutoCommitCrashRecovery` - Verifies crash recovery for auto-commit operations
  - `TestExplicitTransactionMultipleOperations` - Verifies multi-operation atomicity
  - `TestExplicitTransactionRollback` - Verifies rollback functionality
  - `TestAutoCommitVsExplicitTransaction` - Verifies both transaction types work together

### Files Added

- `internal/transaction/wal.go` - Complete Write-Ahead Logging implementation
- `internal/transaction/transaction.go` - Complete transaction management

### Files Modified

- `internal/btree/tree.go` - Added auto-commit and explicit transaction support, removed direct writes
- `internal/page/page_manager.go` - WAL integration for page writes
- `docs/IMPLEMENTATION.md` - Comprehensive transaction documentation with crash safety details
- `docs/CHANGELOG.md` - This changelog entry

### Key Improvements Over Version 3.0

Version 4.0 adds complete transaction support and crash recovery, addressing critical durability and consistency requirements:

1. **Crash Recovery**: Every operation is now crash-recoverable via WAL, ensuring no data loss
2. **ACID Properties**: Full atomicity, consistency, durability guarantees for all operations
3. **Auto-Commit Transactions**: Single operations automatically transactional without user intervention
4. **Explicit Transactions**: Multi-operation atomicity with Begin/Commit/Rollback
5. **Write-Ahead Logging**: Industry-standard WAL implementation for durability
6. **Production Ready**: Matches real database behavior (PostgreSQL, SQLite, MySQL InnoDB)

---

## Version 3.0 - Composite Keys & Structured Records

**Date:** January 2026  
**Status:** Completed

### Major Features Added

- **Composite Keys**

  - Multi-column primary keys support
  - Lexicographic comparison (column-by-column)
  - Variable-length serialization
  - Type-safe comparisons

- **Structured Records**
  - Full database rows with multiple typed columns
  - Support for Int, String, Float, Bool types
  - Variable-length serialization based on content
  - Size calculation for space management

### Implementation Details

- Created `types.go` - CompositeKey and Record types
- Updated all tree operations to use `Compare()` method
- Updated serialization/deserialization for new types
- Modified `leaf_page.go` and `internal_page.go` for new types
- Updated `node.go` with type aliases

### Benefits

- More realistic database behavior (multi-column keys)
- Support for complex data structures
- Type-safe operations
- Efficient variable-length encoding

### Files Added

- `types.go` - CompositeKey and Record type definitions

### Files Modified

- `tree.go` - Updated to use CompositeKey and Record
- `leaf_page.go` - Updated serialization
- `internal_page.go` - Updated serialization
- `node.go` - Updated type aliases

### Key Improvements Over Version 2.0

Version 3.0 introduces a more realistic data model, moving from simple key-value pairs to structured database records:

1. **Multi-Column Keys**: Support for composite primary keys (e.g., (user_id, timestamp))
2. **Structured Data**: Full database rows with multiple typed columns instead of single values
3. **Type Safety**: Strong typing for keys and values (Int, String, Float, Bool)
4. **Realistic Database Model**: Closer to real database systems with structured records
5. **Flexible Serialization**: Variable-length encoding for efficient storage

---

## Version 2.0 - Disk Persistence & Load from Disk

**Date:** January 2026  
**Status:** Completed

### Major Features Added

- **Load from Disk**

  - Full tree reconstruction from persistent storage
  - Recursive page loading from root
  - Automatic tree structure restoration
  - Validation of parent-child relationships

- **Page Persistence Enhancement**
  - `FlushAll()` method to sync all pages to disk
  - Write-back caching strategy
  - Guaranteed persistence on clean shutdown
  - Page cache management

### Implementation Details

- Added `Load()` method to BPlusTree
- Added `loadPage()` recursive helper
- Implemented `FlushAll()` in PageManager
- Enhanced page write synchronization
- File-based persistence with 4KB pages

### Benefits

- Database survives application restarts
- Data durability across sessions
- Proper shutdown handling
- Foundation for crash recovery

### Files Modified

- `tree.go` - Added Load() and loadPage() methods
- `page_manager.go` - Added FlushAll() method

### Key Improvements Over Version 1.0

Version 2.0 adds persistence capabilities, making the database usable across application restarts:

1. **Data Persistence**: Database survives application restarts and system crashes
2. **Load from Disk**: Automatic tree reconstruction on startup
3. **FlushAll()**: Ensures all modifications are written to disk before shutdown
4. **Session Continuity**: Can resume work from previous session
5. **Foundation for Recovery**: Sets up infrastructure for future crash recovery features

---

## Version 1.0 - Core B+Tree Implementation

**Date:** January 2026  
**Status:** Completed

### Major Features Implemented

- **B+Tree Structure**

  - Internal nodes for routing
  - Leaf nodes for data storage
  - Order = 4 (max 3 keys per node)
  - Page size = 4KB
  - Balanced tree invariants

- **Core Operations**

  - **Insert**: O(log n) with automatic node splitting
  - **Search**: O(log n) point queries
  - **Delete**: Full deletion with rebalancing (borrow/merge)
  - **Update**: In-place updates when possible
  - **Range Query**: O(log n + k) using leaf chain

- **Tree Maintenance**
  - Node splitting (leaf and internal)
  - Borrowing from siblings (left & right)
  - Node merging (leaf and internal)
  - Root special cases handling
  - Parent pointer maintenance
  - Sibling link maintenance (doubly-linked leaf list)

### Implementation Details

- Page-based storage architecture
- In-memory page cache
- Binary serialization format
- Meta page for root tracking
- Page header with metadata

### Files Created

- `tree.go` - Core B+Tree implementation
- `node.go` - Node type definitions
- `page_header.go` - Page header structure
- `meta_page.go` - Metadata page
- `leaf_page.go` - Leaf page implementation
- `internal_page.go` - Internal page implementation
- `page_manager.go` - Page allocation and caching

---

## Development Timeline

```
Phase 1: Core B+Tree (v1.0)
  ├── Basic tree structure
  ├── Insert/Search/Delete operations
  ├── Node splitting and merging
  └── Tree rebalancing algorithms

Phase 2: Persistence (v2.0)
  ├── Disk-based storage
  ├── Load from disk functionality
  └── FlushAll() for durability

Phase 3: Type System (v3.0)
  ├── Composite keys
  ├── Structured records
  └── Type-safe operations

Phase 4: Complete Transactions (v4.0)
  ├── Auto-commit transactions (every operation crash-safe)
  ├── Explicit transactions (multi-operation atomicity)
  ├── Write-Ahead Logging (complete implementation)
  ├── Crash recovery (automatic WAL replay)
  └── Crash safety guarantee (no partial writes)

Phase 5: LRU Page Cache (v5.0)
  ├── Configurable cache size
  ├── LRU eviction algorithm
  └── Cache statistics and monitoring

Phase 6: Schema Enforcement (v7.0)
  ├── Schema definition system
  ├── Row validation
  ├── Automatic key extraction
  └── Schema persistence

Phase 7: Concurrent Access (v8.0) ← Current
  ├── Concurrent readers (shared locks)
  ├── Serialized writers (global lock)
  ├── Thread-safe transactions
  └── Phase 3.5 stabilized concurrency
```

---

## Future Roadmap

### Version 6.0 - Performance Optimizations (Planned)

- Bulk loading for sorted data
- Key compression
- Index statistics
- Query optimization

### Version 9.0 - Advanced Concurrency (Planned)

- Fine-grained pessimistic locking (Phase 4)
- Concurrent splits and merges
- Page-level locking for writers
- Improved write concurrency

### Version 10.0 - Advanced Features (Planned)

- MVCC (Multi-Version Concurrency Control)
- Snapshot isolation
- WAL segment rotation
- Free page list for defragmentation

---

## Statistics

### Code Growth

- **v1.0**: Core implementation
- **v2.0**: Disk persistence and load from disk
- **v3.0**: Composite keys and structured records
- **v4.0**: Complete transaction implementation with crash safety
- **v5.0**: LRU page cache for memory management
- **v7.0**: Schema enforcement and row-based operations
- **v8.0**: Concurrent access with thread-safe architecture

### Test Coverage

- **v1.0**: 18 comprehensive tests
- **v2.0**: Load from disk tests
- **v3.0**: Multi-column key/value tests
- **v4.0**: 5+ comprehensive transaction tests (auto-commit, explicit, crash recovery)
- **v5.0**: Cache configuration and LRU eviction tests
- **v7.0**: Schema validation and key extraction tests
- **v8.0**: Concurrency tests (reader-writer isolation, concurrent operations, transaction safety)

### Features by Version

- **v1.0**: 5 core operations
- **v2.0**: +1 persistence feature
- **v3.0**: +2 type system features
- **v4.0**: +3 transaction features (auto-commit, explicit transactions, crash safety)
- **v5.0**: +1 cache management feature (LRU cache with configurable size)
- **v7.0**: +1 schema enforcement feature (row validation, key extraction, schema persistence)
- **v8.0**: +1 concurrency feature (concurrent readers, serialized writers, thread-safe transactions)

---

## Notes

- Each version builds upon the previous version's foundation
- Backward compatibility maintained where possible
- Test suite expanded with each version
- Documentation updated for each major feature
- Real-world database patterns followed throughout

---

**Last Updated:** January 27, 2026  
**Current Version:** 8.0  
**Project Status:** Active Development
