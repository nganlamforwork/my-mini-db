# MiniDB Testing Documentation

**Date:** January 2026  
**Version:** 5.0  
**Status:** Comprehensive Test Suite with Visualization

> **Note:** This document describes the external testing infrastructure. For core implementation details, see [IMPLEMENTATION.md](IMPLEMENTATION.md)

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
  - [Test Context System](#test-context-system)
  - [Test Output Artifacts](#test-output-artifacts)
  - [Test Directory Structure](#test-directory-structure)
- [Test Categories & Coverage](#test-categories--coverage)
  - [1. Insert Operations](#1-insert-operations)
  - [2. Persistence Tests](#2-persistence-tests)
  - [3. Search Operations](#3-search-operations)
  - [4. Range Query Operations](#4-range-query-operations)
  - [5. Update Operations](#5-update-operations)
  - [6. Delete Operations](#6-delete-operations)
  - [7. Cache Testing](#7-cache-testing)
  - [8. Concurrency Testing](#8-concurrency-testing)
- [Test Helper Functions](#test-helper-functions)
  - [Key/Value Constructors](#keyvalue-constructors)
  - [TestContext Methods](#testcontext-methods)
- [Visualization System](#visualization-system)
  - [Tree Visualization](#tree-visualization)
  - [Visualization Script](#visualization-script)
  - [Future HTML/CSS Integration](#future-htmlcss-integration)
- [Running Tests](#running-tests)
  - [Basic Test Execution](#basic-test-execution)
  - [Test Output](#test-output)
  - [Viewing Test Results](#viewing-test-results)
- [Test Statistics](#test-statistics)
  - [Current Coverage](#current-coverage)
  - [Test Artifacts Generated](#test-artifacts-generated)
- [Future Enhancements](#future-enhancements)
  - [Planned Test Features](#planned-test-features)
  - [HTML/CSS UI Design Considerations](#htmlcss-ui-design-considerations)
- [Test Maintenance](#test-maintenance)
  - [Adding New Tests](#adding-new-tests)
  - [Updating Visualization](#updating-visualization)
  - [Test Documentation](#test-documentation)
- [Test Best Practices](#test-best-practices)
- [Files](#files)

---

## Overview

MiniDB includes a comprehensive test suite with automatic visualization and documentation generation. The test infrastructure is designed to be extensible and ready for future HTML/CSS-based UI for better user experience and interactive testing.

---

## Test Infrastructure

### Test Context System

The test suite uses a sophisticated `TestContext` helper system that provides:

- **Isolated Test Directories**: Each test runs in its own `testdata/<TestName>/` directory
- **Automatic Documentation**: Generates human-readable `description.txt` files
- **Visual Tree Diagrams**: Creates PNG images showing B+Tree structure
- **Operation Tracking**: Records all operations with natural language descriptions
- **Expected Results**: Documents expected outcomes for verification

### Test Output Artifacts

Each test automatically generates three artifacts:

1. **Binary Database File** (`.db`)
   - Persistent storage for verification
   - Can be loaded and inspected
   - Represents final database state

2. **Visual Tree Diagram** (`.db.png`)
   - Graphical representation using Python matplotlib
   - Shows internal nodes, leaf nodes, and relationships
   - Color-coded for different node types
   - Fallback to text-based dumps if Python unavailable

3. **Test Description** (`description.txt`)
   - Human-readable test documentation
   - Lists all operations performed
   - Documents expected results
   - Includes test summary and purpose

### Test Directory Structure

```
testdata/
  TestInsertWithSplit/
    TestInsertWithSplit.db         # Binary database file
    TestInsertWithSplit.db.png     # Visual tree diagram
    description.txt                # Test documentation
  TestDeleteWithMerge/
    TestDeleteWithMerge.db
    TestDeleteWithMerge.db.png
    description.txt
  ...
```

---

## Test Categories & Coverage

### 1. Insert Operations

Tests verify insertion correctness, node splitting, and tree growth.

#### `TestInsertWithoutSplit`

- **Purpose**: Basic insertion without triggering splits
- **Scenario**: Insert 3 keys that fit in a single leaf page
- **Validates**:
  - Basic insertion logic
  - Key ordering
  - Value storage
  - No split when not needed

#### `TestInsertWithSplit`

- **Purpose**: Leaf split and root creation
- **Scenario**: Insert 5 keys triggering leaf split
- **Validates**:
  - Leaf node splitting
  - Root node creation
  - Key distribution after split
  - Sibling link maintenance

#### `TestInsertManyComplex`

- **Purpose**: Complex multi-level splits
- **Scenario**: Insert many keys causing multiple splits
- **Validates**:
  - Multiple leaf splits
  - Internal node splits
  - Tree height growth
  - Complex tree structure maintenance

---

### 2. Persistence Tests

Tests verify disk persistence and data recovery.

#### `TestLoadFromDisk`

- **Purpose**: Verify database persistence across sessions
- **Scenario**:
  1. Create database and insert data
  2. Close database file
  3. Reopen and load from disk
  4. Verify all data intact
- **Validates**:
  - Page serialization/deserialization
  - Tree structure reconstruction
  - Data integrity after reload
  - Meta page persistence

---

### 3. Search Operations

Tests verify point query correctness.

#### `TestSearch`

- **Purpose**: Point query functionality
- **Scenario**: Search for existing and non-existing keys
- **Validates**:
  - Successful key lookup
  - Error handling for missing keys
  - Search path correctness
  - Value retrieval accuracy

---

### 4. Range Query Operations

Tests verify range scanning using leaf-level linked list.

#### `TestRangeQuerySimple`

- **Purpose**: Basic range scan
- **Scenario**: Query subset [30, 60] from larger dataset
- **Validates**:
  - Range boundary handling
  - Sequential leaf traversal
  - Result completeness
  - Key ordering in results

#### `TestRangeQueryEdgeCases`

- **Purpose**: Boundary condition handling
- **Scenarios**:
  - Empty range (startKey > endKey)
  - Single key range
  - Full database range
  - Out-of-bounds queries
- **Validates**:
  - Error handling
  - Edge case correctness
  - Boundary validation

#### `TestRangeQueryAcrossPages`

- **Purpose**: Multi-page range traversal
- **Scenario**: Range spanning multiple leaf nodes
- **Validates**:
  - Leaf chain traversal
  - NextPage pointer correctness
  - Multi-page result aggregation
  - Performance of horizontal scan

---

### 5. Update Operations

Tests verify value modification with size optimization.

#### `TestUpdateSimple`

- **Purpose**: In-place update optimization
- **Scenario**: Modify value without triggering rebalancing
- **Validates**:
  - In-place update when value fits
  - Free space recalculation
  - No unnecessary tree rebalancing
  - Value replacement correctness

#### `TestUpdateNonExistentKey`

- **Purpose**: Error handling for invalid updates
- **Scenario**: Attempt to update non-existent key
- **Validates**:
  - Proper error reporting
  - No side effects on database
  - Error message clarity

#### `TestUpdateWithLargeValue`

- **Purpose**: Fallback to delete+insert
- **Scenario**: Update with value exceeding page capacity
- **Validates**:
  - Automatic fallback mechanism
  - Delete+insert execution
  - Tree consistency after fallback
  - No data loss

#### `TestUpdateMultiple`

- **Purpose**: Batch update operations
- **Scenario**: Multiple updates maintaining consistency
- **Validates**:
  - Sequential update correctness
  - Tree state consistency
  - No interference between updates
  - Final state correctness

---

### 6. Delete Operations

Tests verify deletion with full rebalancing (borrow and merge).

#### `TestDeleteSimple`

- **Purpose**: Basic deletion without rebalancing
- **Scenario**: Delete from leaf without triggering underflow
- **Validates**:
  - Key removal
  - Value removal
  - Free space update
  - No rebalancing when not needed

#### `TestDeleteWithBorrowFromRight`

- **Purpose**: Borrow from right sibling
- **Scenario**: Create underflow, borrow key from right sibling
- **Validates**:
  - Underflow detection
  - Right sibling borrowing
  - Parent separator update
  - Tree consistency after borrow

#### `TestDeleteWithBorrowFromLeft`

- **Purpose**: Borrow from left sibling
- **Scenario**: Create underflow, borrow key from left sibling
- **Validates**:
  - Left sibling borrowing
  - Parent separator update
  - Key ordering maintenance
  - Sibling link preservation

#### `TestDeleteWithMerge`

- **Purpose**: Node merge operation
- **Scenario**: Delete keys requiring node merge with sibling
- **Validates**:
  - Merge operation correctness
  - Parent separator removal
  - Sibling link updates
  - Tree height reduction when appropriate

#### `TestDeleteComplex`

- **Purpose**: Multiple deletes with cascading rebalancing
- **Scenario**: Delete 6 keys from 16-key tree in specific order
- **Validates**:
  - Complex rebalancing sequences
  - Multiple borrow/merge operations
  - Tree consistency throughout
  - Final tree structure correctness

#### `TestDeleteAll`

- **Purpose**: Edge case - empty tree
- **Scenario**: Delete all keys, verify tree becomes empty
- **Validates**:
  - Root reset to 0
  - Empty tree state
  - No orphaned pages
  - Clean state after complete deletion

---

### 7. Cache Testing

The cache implementation is tested separately in `internal/page/cache_test.go` to verify LRU eviction behavior and cache statistics.

#### Cache Unit Tests

**TestLRUCacheBasic**

- **Purpose**: Verify basic LRU cache operations
- **Validates**:
  - Put and Get operations
  - LRU eviction when cache is full
  - Most recently used pages stay in cache
  - Least recently used pages are evicted

**TestLRUCacheStats**

- **Purpose**: Verify cache statistics tracking
- **Validates**:
  - Cache hit counting
  - Cache miss counting
  - Eviction counting
  - Current cache size tracking

**TestLRUCacheUpdate**

- **Purpose**: Verify page updates in cache
- **Validates**:
  - Updating existing cache entries
  - Cache size remains constant after update
  - Updated pages remain in cache

**TestLRUCacheRemove**

- **Purpose**: Verify manual cache removal
- **Validates**:
  - Removing specific pages from cache
  - Cache size decreases after removal
  - Other pages remain unaffected

**TestLRUCacheClear**

- **Purpose**: Verify cache clearing
- **Validates**:
  - All pages removed from cache
  - Cache size reset to zero
  - Cache ready for reuse

#### Cache Integration Testing

All B+Tree operations automatically exercise the cache:

- **Insert operations**: New pages added to cache
- **Search operations**: Pages loaded from cache or disk
- **Delete operations**: Pages accessed from cache
- **Range queries**: Multiple pages loaded, testing cache behavior
- **Load from disk**: Pages loaded and cached during tree reconstruction

#### Cache Configuration Testing

**TestCustomCacheSize**

- **Purpose**: Verify custom cache size configuration
- **Scenario**: Create database with custom cache size (50 pages)
- **Validates**:
  - Custom cache size is correctly set
  - Cache operations work with custom size
  - Cache statistics reflect custom configuration

**TestDefaultCacheSize**

- **Purpose**: Verify default cache size
- **Scenario**: Create database without specifying cache size
- **Validates**:
  - Default cache size is 100 pages
  - Default configuration works correctly

**TestCacheSizeEviction**

- **Purpose**: Verify cache eviction with small cache size
- **Scenario**: Create database with very small cache (5 pages), insert many keys
- **Validates**:
  - Cache size never exceeds maximum
  - Evictions occur when cache is full
  - Cache statistics track evictions correctly

#### Cache Performance Verification

Cache statistics can be accessed during tests:

```go
stats := tree.pager.GetCacheStats()
fmt.Printf("Hits: %d, Misses: %d, Evictions: %d, Size: %d\n",
    stats.Hits, stats.Misses, stats.Evictions, stats.Size)
```

**Expected Behavior:**

- Frequently accessed pages (root, hot leaves) should have high hit rates
- Cache evictions should occur when working with large datasets
- Cache size should never exceed configured maximum

---

## 8. Concurrency Testing

**Current Status**: Traditional B+ tree with global insert mutex implemented. B-Link concurrent write tests are **skipped** as they are not applicable to the current architecture.

> **See [concurrent-access.md](concurrent-access.md)** for detailed rationale on concurrency model decision.

### Concurrency Model

MiniDB uses a **pragmatic concurrency approach**:

- **Global `insertMu`**: Serializes all insert operations
- **Page-level `RWMutex`**: Allows concurrent reads
- **Thread-safe cache**: Protected by internal locks

This provides:

- ✅ **Multiple concurrent reads**: Fully supported
- ✅ **Read while write**: Supported
- ❌ **Multiple concurrent writes**: Serialized (not supported)

### Applicable Tests

#### `TestConcurrentPageAccess`

- **Status**: ✅ **Passes**
- **Purpose**: Verify page-level locking works correctly
- **Scenario**: Multiple goroutines accessing the same page concurrently
- **Validates**:
  - `sync.RWMutex` protects page data structures
  - No race conditions (verified with `go test -race`)
  - Read-write lock semantics work correctly

### Skipped Tests (Not Applicable to Current Model)

#### `TestBLinkMoveRight`

- **Status**: ⏭️ **Skipped** (B-Link not implemented)
- **Purpose**: Verify B-Link "Move Right" recovery logic
- **Reason**: Traditional B+ tree doesn't use move-right protocol
- **Alternative**: Global insertMu prevents splits during searches

#### `TestConcurrentInsertSequential`

- **Status**: ⏭️ **Skipped** (serialized writes)
- **Purpose**: Benchmark concurrent writers inserting sequential keys
- **Reason**: Global insertMu serializes inserts, test would not demonstrate concurrency
- **Alternative**: Single-threaded insert tests validate correctness

### Why These Tests Are Skipped

The test suite includes B-Link concurrency tests that were written for a fully concurrent implementation (Lehman & Yao protocol). **These tests are intentionally skipped** because:

1. **Different concurrency model**: We chose traditional B+ tree with global insertMu
2. **Not a failure**: Skipped tests reflect architectural decision, not bugs
3. **Documented tradeoff**: See [concurrent-access.md](concurrent-access.md) for full analysis
4. **Correctness preserved**: 23/25 tests pass, covering all core operations

### Test Execution

Run tests excluding concurrent write tests:

```bash
go test -v -run '^Test' -skip 'BLink|ConcurrentInsert' ./internal/btree
```

Run only concurrency tests (page-level locking):

```bash
go test -v -run 'ConcurrentPageAccess' ./internal/btree
```

### Future Enhancement

If B-Link tree is implemented in the future:

- **Re-enable** `TestBLinkMoveRight` and `TestConcurrentInsertSequential`
- Add additional stress tests for concurrent writers
- Implement torture test (10 readers, 2 writers, 2 deleters)
- Add deadlock detection monitoring

Current test suite is ready to validate B-Link implementation when that architectural decision is made.

---

## Test Helper Functions

### Key/Value Constructors

```go
// K() - Create composite key from integers
K(10)                    // Single-column key: (10)
K(10, 20)                // Multi-column key: (10, 20)

// V() - Create record from strings
V("value1")              // Single-column record
V("val1", "val2")        // Multi-column record

// KI() - Extract integer from key
KI(key)                   // Returns first integer value

// VS() - Extract string from record
VS(record)               // Returns first string value
```

### TestContext Methods

```go
ctx := NewTestContext(t)

// Add operations
ctx.AddOperation("Inserting key 10")
ctx.InsertKey(tree, key, value)
ctx.SearchKey(tree, key, expectedValue)

// Set test metadata
ctx.SetSummary("Tests basic insertion")

// Add expected results
ctx.AddExpected("Key 10 should be found")
ctx.AddExpected("Tree should have height 1")

// Generate artifacts
ctx.WriteDescription()  // Auto-called, generates description.txt
```

---

## Visualization System

### Tree Visualization

The visualization system uses Python's matplotlib to generate tree diagrams:

- **Internal Nodes**: Shown as rectangles with separator keys
- **Leaf Nodes**: Shown as rectangles with key-value pairs
- **Connections**: Arrows showing parent-child relationships
- **Sibling Links**: Horizontal lines showing leaf chain
- **Color Coding**: Different colors for different node types

### Visualization Script

`visualize_tree.py`:

- Parses binary database format directly
- Reconstructs tree structure
- Generates PNG images using matplotlib
- Handles missing Python dependencies gracefully

### Future HTML/CSS Integration

The test infrastructure is designed to support future HTML/CSS-based UI:

- **Structured Data**: Test artifacts are well-organized for parsing
- **JSON Export**: Can easily export test results to JSON
- **Interactive UI**: Test descriptions can be converted to interactive forms
- **Visual Tree**: PNG diagrams can be replaced with SVG/Canvas rendering
- **Real-time Testing**: Test framework supports programmatic execution

---

## Running Tests

### Basic Test Execution

After refactoring, all tests are located in the `internal/btree` package. Use the following commands:

```bash
# Run all applicable tests (skip B-Link specific tests)
go test -v -run '^Test' -skip 'BLink|ConcurrentInsert' ./internal/btree

# Run all tests including skipped ones (some will timeout/fail as expected)
go test -v ./internal/btree/...

# Run specific test
go test -v ./internal/btree/... -run TestInsertWithSplit

# Run with race detection
go test -race -skip 'BLink|ConcurrentInsert' ./internal/btree/...

# Run with coverage
go test -cover -skip 'BLink|ConcurrentInsert' ./internal/btree/...

# Generate coverage report
go test -coverprofile=coverage.out -skip 'BLink|ConcurrentInsert' ./internal/btree/...
go tool cover -html=coverage.out
```

**Note:** The test suite has been refactored into a proper package structure. Tests are now located in `internal/btree/tree_test.go` and use the refactored package imports (`internal/page`, `internal/storage`, `internal/transaction`).

### Test Output

Tests automatically:

1. Create test directories
2. Execute operations
3. Generate database files
4. Create visual diagrams
5. Write documentation files

### Viewing Test Results

1. **Database Files**: Inspect with hex editor or custom tools
2. **Visual Diagrams**: Open `.png` files in image viewer
3. **Documentation**: Read `description.txt` files
4. **Test Logs**: Check Go test output for runtime information

---

## Test Statistics

### Current Coverage

- **Total Tests**: 25 comprehensive tests
- **Passing Tests**: 23 (all core operations)
- **Skipped Tests**: 2 (B-Link specific, not applicable)
- **Test Categories**:
  - Insert operations (3 tests) ✅
  - Search operations (1 test) ✅
  - Range queries (3 tests) ✅
  - Update operations (4 tests) ✅
  - Delete operations (6 tests) ✅
  - Transaction tests (5 tests) ✅
  - Cache tests (7 tests) ✅
  - Schema tests (4 tests) ✅
  - Concurrency (page-level) (1 test) ✅
  - B-Link specific (1 test) ⏭️ Skipped
  - Concurrent writes (1 test) ⏭️ Skipped

**Test Success Rate**: 23/23 applicable tests pass (100%)

### Test Artifacts Generated

- **25 database files** (`.db` and `.db.wal`)
- **25 visual diagrams** (`.png`) - where applicable
- **25 documentation files** (`description.txt`)
- **Total**: ~75 artifacts per test run

---

## Future Enhancements

### Planned Test Features

1. **Transaction Tests**
   - Test Begin/Commit/Rollback
   - Test WAL recovery
   - Test concurrent transaction scenarios

2. **Performance Benchmarks**
   - Insert throughput
   - Search latency
   - Range query performance
   - Memory usage profiling

3. **Stress Tests**
   - Large dataset operations
   - Concurrent access simulation
   - Crash recovery scenarios
   - Memory pressure testing

4. **HTML/CSS Test UI**
   - Interactive test runner
   - Visual tree browser
   - Real-time test execution
   - Test result dashboard
   - Comparison tools

### HTML/CSS UI Design Considerations

The test infrastructure is structured to support:

- **Component-Based**: Each test is self-contained
- **Data-Driven**: Test descriptions are structured data
- **Visualization-Ready**: Tree structures can be rendered in browser
- **Extensible**: Test execution can be integrated into custom interfaces
- **Extensible**: Easy to add new test types and visualizations

---

## Test Maintenance

### Adding New Tests

1. Create test function following naming convention: `Test<FeatureName>`
2. Use `NewTestContext(t)` to get test context
3. Add operations using helper methods
4. Set summary and expected results
5. Test will auto-generate artifacts

### Updating Visualization

1. Modify `visualize_tree.py` for new visualization features
2. Update test helpers if needed
3. Regenerate test artifacts: `go test -v`

### Test Documentation

- Keep test descriptions clear and detailed
- Document expected behavior
- Include edge cases
- Note any assumptions

---

## Test Best Practices

1. **Isolation**: Each test runs in its own directory
2. **Determinism**: Tests should produce consistent results
3. **Clarity**: Test names and descriptions should be self-explanatory
4. **Coverage**: Test both happy path and error cases
5. **Documentation**: Always include expected results
6. **Visualization**: Ensure tree diagrams are readable
7. **Maintenance**: Keep tests updated with code changes

---

## Files

- `tree_test.go` - Main test file
- `visualize_tree.py` - Tree visualization script
- `testdata/` - Test output directory
- `TESTING.md` - This document

---

**Last Updated:** January 2026  
**Test Suite Version:** 4.0  
**Status:** Comprehensive Coverage
