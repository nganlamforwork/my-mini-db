# MiniDB Testing Documentation

**Date:** January 2026  
**Version:** 4.0  
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
# Run all tests
go test -v ./internal/btree/...

# Run specific test
go test -v ./internal/btree/... -run TestInsertWithSplit

# Run with coverage
go test -cover ./internal/btree/...

# Generate coverage report
go test -coverprofile=coverage.out ./internal/btree/...
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

- **Total Tests**: 18 comprehensive tests
- **Test Code**: 1,650+ lines
- **Coverage Areas**:
  - Insert operations (3 tests)
  - Search operations (1 test)
  - Range queries (3 tests)
  - Update operations (4 tests)
  - Delete operations (6 tests)
  - Persistence (1 test)

### Test Artifacts Generated

- **18 database files** (`.db`)
- **18 visual diagrams** (`.png`)
- **18 documentation files** (`description.txt`)
- **Total**: 54 artifacts per test run

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
- **API-Friendly**: Test execution can be exposed via API
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

- `tree_test.go` - Main test file (1,650+ lines)
- `visualize_tree.py` - Tree visualization script (500+ lines)
- `testdata/` - Test output directory
- `TESTING.md` - This document

---

**Last Updated:** January 2026  
**Test Suite Version:** 4.0  
**Status:** Comprehensive Coverage
