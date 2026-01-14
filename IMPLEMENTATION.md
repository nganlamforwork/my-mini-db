# MiniDB: B+Tree Database Implementation

**Date:** January 13, 2026  
**Author:** Lam Le Vu Ngan  
**Current Version:** 4.0 (Transaction Support)

> 📝 **See [CHANGELOG.md](CHANGELOG.md) for complete development history and version evolution**

## Overview

This document presents the architecture and implementation of a file-backed B+Tree database with full CRUD operations (insert, search, update, delete, range query) and persistent storage capabilities. The implementation demonstrates proper B+Tree rebalancing algorithms including node splitting, borrowing, and merging while maintaining all tree invariants.

**Key Highlights:**

- Complete B+Tree with disk persistence and in-memory caching
- Composite keys and structured row values - Support for multi-column primary keys and full database rows
- Proper delete implementation with borrow and merge operations
- Range query support leveraging leaf-level linked list
- Page-based storage architecture with 4KB pages
- Comprehensive test coverage with both binary and human-readable outputs

---

## Data Model

### Type System

MiniDB supports structured data with composite keys and multi-column rows, mimicking real database behavior.

#### **Column Types**

```go
TypeInt    = 0  // int64
TypeString = 1  // string
TypeFloat  = 2  // float64
TypeBool   = 3  // bool
```

#### **CompositeKey**

A composite key consists of one or more column values, enabling multi-column primary keys:

```go
type CompositeKey struct {
    Values []Column  // Ordered list of key columns
}
```

**Features:**

- Compare method for ordering: returns -1, 0, or 1
- Supports single-column keys (e.g., `K(10)`) or multi-column (e.g., `(10, "John")`)
- Lexicographic comparison: compares column-by-column left-to-right

**Serialization Format:**

```
[numValues:4][type:1][value][type:1][value]...
```

#### **Record**

A row represents a complete database record with multiple typed columns:

```go
type Record struct {
    Columns []Column  // Data columns
}
```

**Features:**

- Each column has a type (Int, String, Float, Bool) and value
- Variable-length serialization based on content
- Size() method for space calculation

**Serialization Format:**

```
[numColumns:4][type:1][value][type:1][value]...
```

#### **Type Aliases**

```go
type KeyType = CompositeKey
type ValueType = Record
```

---

## B+Tree Structure & Constants

### Core Constants

| Constant          | Value      | Description                                  |
| ----------------- | ---------- | -------------------------------------------- |
| `ORDER`           | 4          | Maximum number of children per internal node |
| `MAX_KEYS`        | 3          | Maximum keys per node (ORDER - 1)            |
| `DefaultPageSize` | 4096 bytes | Size of each page on disk                    |
| `PageHeaderSize`  | 56 bytes   | Fixed size of page header                    |

### Minimum Keys Calculation

- **Leaf Nodes:** `minKeys = ceil(ORDER/2) - 1 = 1` (for ORDER=4)
- **Internal Nodes:** `minKeys = ceil(ORDER/2) - 1 = 1` (for ORDER=4)
- **Root Special Case:** Root can have 0 keys (when empty) or 1+ keys

### Page Types

```
PageTypeMeta     = 0  // Metadata page (page 1)
PageTypeInternal = 1  // Internal B+Tree nodes
PageTypeLeaf     = 2  // Leaf B+Tree nodes
```

### Page Structure

#### **PageHeader (56 bytes)** - Common to all page types

**Purpose:** Every page begins with this header to store metadata about the page and its position in the tree. This enables the database to identify page types, track free space, and maintain tree structure relationships.

```
PageID        uint64   // Unique page identifier
PageType      uint8    // Meta/Internal/Leaf
KeyCount      uint16   // Number of keys in this page
FreeSpace     uint16   // Remaining free bytes
ParentPage    uint64   // Parent page ID (0 if root)
NextPage      uint64   // Right sibling (0 if none)
PrevPage      uint64   // Left sibling (0 if none)
LSN           uint64   // Log sequence number (for WAL)
```

#### **MetaPage Structure**

**Role:** The metadata page (page 1) serves as the database's entry point, storing global configuration and the root page pointer. This design follows standard database architecture where a dedicated metadata page bootstraps the entire tree structure.

```
PageHeader    (56 bytes)
RootPage      uint64   // Page ID of tree root
PageSize      uint32   // Page size (4096)
Order         uint16   // B+Tree order (4)
Version       uint16   // Format version
```

#### **InternalPage Structure**

**Role:** Internal nodes implement the tree's routing layer. They contain separator keys and child pointers but no actual data values. This separation allows the tree to maintain high fanout while keeping navigation efficient.

```
PageHeader    (56 bytes)
Keys[]        CompositeKey  // Array of separator keys (KeyCount entries)
Children[]    uint64        // Array of child page IDs (KeyCount + 1 entries)
```

**Routing Invariant:** For internal node with keys K[0..n-1] and children C[0..n]:

- Subtree C[i] contains keys where: K[i-1] < key ≤ K[i]
- C[0] contains all keys ≤ K[0]
- C[n] contains all keys > K[n-1]

**Example:** An internal node with keys [(30), (60)] routes to 3 children:

- Child 0: keys ≤ (30)
- Child 1: keys (31) to (60)
- Child 2: keys > (60)

#### **LeafPage Structure**

**Role:** Leaf nodes store the actual key-value pairs. The implementation maintains a doubly-linked list across all leaves (via PrevPage/NextPage pointers), enabling efficient sequential scans without tree traversal—a critical optimization for range queries.

```
PageHeader    (56 bytes)
Keys[]        CompositeKey  // Array of keys (KeyCount entries)
Values[]      Record           // Array of row values (KeyCount entries)
```

**Leaf Properties:**

- Keys maintained in sorted order using Compare method
- Doubly-linked list structure enables O(k) range scans
- All leaves at same depth (balanced tree property)
- Each value is a complete Record with multiple columns

---

## Page Layout Calculation

```
Available Payload = PageSize - PageHeaderSize
                  = 4096 - 56 = 4040 bytes

Internal Node Capacity:
  - Keys: Variable (depends on key column types and values)
  - Children: (MAX_KEYS + 1) × 8 bytes = 32 bytes
  - Typical small keys fit easily in available space

Leaf Node Capacity:
  - Variable based on key and value sizes
  - Keys: Each CompositeKey has variable size based on column types
  - Values: Each Record has variable size based on column data
  - Page split occurs when payload exceeds available space (4040 bytes)
```

**Size Calculation Methods:**

- `CompositeKey.Size()`: Returns bytes needed for serialization
- `Record.Size()`: Returns bytes needed for serialization
- `computeLeafPayloadSize()`: Sums all key and value sizes in a leaf

### File Structure

```
Offset 0:     Page 1 (MetaPage)       - 4096 bytes
Offset 4096:  Page 2 (Internal/Leaf)  - 4096 bytes
Offset 8192:  Page 3 (Internal/Leaf)  - 4096 bytes
...
```

**Page ID to Offset Mapping:** `offset = (pageID - 1) × PageSize`

### B+Tree Invariants Maintained

1. **Order Property:** Internal nodes have ≤ ORDER children
2. **Balance Property:** All leaf nodes are at the same depth
3. **Occupancy:** Non-root nodes have ≥ ceil(ORDER/2) - 1 keys
4. **Leaf Linking:** All leaves connected in sorted order via NextPage
5. **Parent Pointers:** All non-root pages correctly reference parent
6. **Key Ordering:** Keys in each node are sorted using Compare method
7. **Separator Keys:** Internal node keys correctly partition child subtrees

---

## What Was Implemented

### Data Model Features

- **Composite Keys** - Multi-column primary keys with lexicographic ordering
- **Structured Records** - Full database rows with typed columns (Int, String, Float, Bool)
- **Variable-Length Serialization** - Efficient binary encoding for keys and values
- **Type-Safe Comparisons** - Compare method for proper key ordering

### 1. **Load from Disk Functionality**

**Purpose:** Enable the database to reload an existing tree structure from disk into memory when the application starts.

**Algorithm Steps:**

1. **Initialize file handle** - Open database file in read/write mode without truncating existing data
2. **Load metadata** - Read meta page (page 1) to obtain root page ID and tree configuration
3. **Traverse tree structure** - Starting from root, recursively visit each node in depth-first order
4. **Cache pages** - Load each page into memory hash map, keyed by page ID
5. **Validate structure** - Ensure all parent-child relationships are consistent during traversal

**Pseudo Code:**

```
function Load():
    meta = readMetaPage()
    if meta.rootPage == 0:
        return  // empty tree

    loadPageRecursively(meta.rootPage)

function loadPageRecursively(pageID):
    page = pager.get(pageID)  // loads from disk if not cached

    if page is InternalPage:
        for each childID in page.children:
            loadPageRecursively(childID)
```

**Key Addition:** The `FlushAll()` method ensures all modified pages are written to disk before closing the file handle. This addresses the write-back caching pattern where pages are initially written only on creation but need synchronization before shutdown.

---

### 2. **Search Operation**

**Overview:** Standard B+Tree search with O(log n) complexity through binary search at internal nodes and linear scan at leaves.

**Algorithm Steps:**

1. **Start at root** - Begin traversal from the root page
2. **Navigate internal nodes** - Binary search keys to determine correct child pointer
3. **Follow path downward** - Descend through internal nodes until reaching a leaf
4. **Search leaf** - Linear search in the leaf's sorted key array
5. **Return result** - Return value if found, error otherwise

**Pseudo Code:**

```
function Search(key):
    if tree is empty:
        return error "empty tree"

    leaf, path = findLeaf(key)

    for i, k in leaf.keys:
        if k == key:
            return leaf.values[i]

    return error "key not found"
```

---

### 3. **Range Query Operation**

**Overview:** Efficient range scanning leveraging the leaf-level doubly-linked list. Unlike point queries that require tree traversal, range queries follow horizontal links between leaves after locating the start position, achieving O(log n + k) complexity where k is the result count.

**Algorithm Steps:**

1. **Validate range** - Ensure startKey ≤ endKey to avoid invalid queries
2. **Locate start position** - Use standard search to find leaf containing or after startKey
3. **Scan current leaf** - Collect all keys within range from the current leaf node
4. **Follow leaf chain** - Use NextPage pointer to traverse to subsequent leaves
5. **Early termination** - Stop scanning when keys exceed endKey
6. **Return results** - Aggregate all collected key-value pairs

**Pseudo Code:**

```
function SearchRange(startKey, endKey):
    if startKey > endKey:
        return error "invalid range"

    leaf = findLeaf(startKey)
    results = []

    while leaf != null:
        for key, value in leaf:
            if key >= startKey and key <= endKey:
                results.append((key, value))
            if key > endKey:
                return results

        if leaf.lastKey < endKey:
            leaf = leaf.nextPage
        else:
            break

    return results
```

**Optimization Benefits:**

- No tree re-traversal for sequential keys
- Cache-friendly sequential access pattern
- Minimal computational overhead after initial seek

---

### 4. **Update Operation**

**Overview:** Atomic value modification that optimizes for the common case where the new value fits in the existing page. The implementation avoids unnecessary tree rebalancing by performing in-place updates when possible, falling back to delete-insert only when required.

**Algorithm Steps:**

1. **Locate key** - Navigate to leaf containing the target key
2. **Verify existence** - Return error if key not found
3. **Calculate size delta** - Compare old and new value sizes
4. **Check page capacity** - Determine if new value fits in current page
5. **In-place update** - If fits, directly replace value and update free space
6. **Fallback to delete+insert** - If doesn't fit, remove old entry and re-insert
7. **Maintain consistency** - Ensure page metadata reflects actual payload

**Pseudo Code:**

```
function Update(key, newValue):
    leaf = findLeaf(key)

    index = findKeyIndex(leaf, key)
    if index == -1:
        return error "key not found"

    oldSize = sizeof(leaf.values[index])
    newSize = sizeof(newValue)
    sizeDelta = newSize - oldSize

    if leaf.usedSpace + sizeDelta <= pageCapacity:
        // In-place update
        leaf.values[index] = newValue
        updateFreeSpace(leaf)
        return success
    else:
        // Delete and re-insert
        Delete(key)
        Insert(key, newValue)
        return success
```

**Performance Characteristics:**

- **Best case:** O(log n) - in-place update without rebalancing
- **Worst case:** O(log n) - delete + insert with potential rebalancing
- Maintains page locality for similar-sized values

---

### 5. **Delete Operation with Rebalancing**

**Overview:** Full B+Tree deletion implementation maintaining tree balance through two strategies: redistribution (borrowing from siblings) and merging. The algorithm handles both leaf and internal node rebalancing with proper separator key management.

**Algorithm Steps:**

1. **Locate and remove** - Navigate to target leaf and remove the key/value pair
2. **Check underflow condition** - Verify node maintains minimum occupancy (≥ minKeys)
3. **Try redistribution (borrow)** - Attempt to borrow from adjacent sibling with surplus keys
4. **Perform merge** - If siblings also at minimum, merge nodes and remove separator from parent
5. **Update parent separators** - Adjust or remove separator keys based on operation type
6. **Propagate upward** - Recursively rebalance parent if it underflows after merge
7. **Handle root** - Reduce tree height when root has only one child remaining

**Pseudo Code:**

```
function Delete(key):
    leaf, path = findLeaf(key)

    // Remove key from leaf
    removeKeyFromLeaf(leaf, key)

    if leaf is root and leaf.keys.count == 0:
        meta.rootPage = 0
        return

    minKeys = ceil(ORDER/2) - 1
    if leaf.keys.count >= minKeys:
        return  // no underflow

    rebalanceAfterDelete(leaf, path)

function rebalanceAfterDelete(leaf, path):
    parent = getParent(leaf, path)

    // Try borrow from right sibling
    if rightSibling exists and rightSibling.keys.count > minKeys:
        moveFirstKeyFromRightToLeft(leaf, rightSibling)
        updateParentSeparator()
        return

    // Try borrow from left sibling
    if leftSibling exists and leftSibling.keys.count > minKeys:
        moveLastKeyFromLeftToRight(leftSibling, leaf)
        updateParentSeparator()
        return

    // Must merge
    if rightSibling exists:
        mergeWithRightSibling(leaf, rightSibling)
        removeChildFromParent(parent, rightSibling)
    else:
        mergeWithLeftSibling(leftSibling, leaf)
        removeChildFromParent(parent, leaf)

    // Propagate to parent
    rebalanceInternalAfterDelete(parent, path)

function rebalanceInternalAfterDelete(node, path):
    if node is root and node.keys.count == 0 and node.children.count == 1:
        // Make single child the new root
        meta.rootPage = node.children[0]
        return

    if node.keys.count >= minKeys:
        return

    // Similar borrow/merge logic for internal nodes
    // Includes pulling separators from parent during borrow
    // Includes pushing separators during merge
```

**Implementation Details:**

- **Borrow from Right:** Transfer first key from right sibling, update parent separator
- **Borrow from Left:** Transfer last key from left sibling, update parent separator
- **Merge:** Combine nodes, pull separator from parent, update sibling links
- **Internal Node Rebalancing:** Apply same borrow/merge logic with separator key handling
- **Root Reduction:** Decrease tree height when root has single child

---

### 6. **Page Persistence Enhancement**

**Challenge Addressed:** The initial implementation wrote pages only during allocation, not after subsequent modifications. This caused data loss when reopening the database.

**Solution:** Implemented `FlushAll()` to synchronize all in-memory pages to disk before closing. This write-back strategy balances performance (batch writes) with durability (guaranteed persistence on clean shutdown).

**Pseudo Code:**

```
function FlushAll():
    for each (pageID, page) in cachedPages:
        writePageToFile(pageID, page)
```

---

### 7. **Comprehensive Test Suite with Visualization**

**Test Infrastructure:**

The test suite includes a sophisticated test context system that automatically generates:

- **Binary database files** (`.db`) - Persistent storage for verification
- **Visual tree diagrams** (`.db.png`) - Graphical representation using Python matplotlib
- **Human-readable descriptions** (`description.txt`) - Test steps, operations, and expected results

**Visualization Features:**

- Automatic tree structure visualization using `visualize_tree.py`
- Visual representation of internal nodes, leaf nodes, and their relationships
- Fallback to text-based dumps if Python/matplotlib unavailable
- Each test generates a PNG image showing the B+Tree structure after operations

**Tests Implemented:**

| Test Category    | Test Name                       | Purpose                   | Scenario                                                 |
| ---------------- | ------------------------------- | ------------------------- | -------------------------------------------------------- |
| **Insert Tests** | `TestInsertWithoutSplit`        | Basic insertion           | Insert 3 keys without triggering page split              |
|                  | `TestInsertWithSplit`           | Leaf split                | Insert 5 keys triggering leaf split and root creation    |
|                  | `TestInsertManyComplex`         | Complex splits            | Insert many keys causing multiple splits and tree growth |
| **Persistence**  | `TestLoadFromDisk`              | Disk persistence          | Insert data, close DB, reopen, verify data intact        |
| **Search Tests** | `TestSearch`                    | Point queries             | Search for existing and non-existing keys                |
| **Range Query**  | `TestRangeQuerySimple`          | Basic range scan          | Query subset [30, 60] from larger dataset                |
|                  | `TestRangeQueryEdgeCases`       | Boundary conditions       | Empty range, single key, full range, out-of-bounds       |
|                  | `TestRangeQueryAcrossPages`     | Multi-page traversal      | Range spanning multiple leaf nodes via linked list       |
| **Update Tests** | `TestUpdateSimple`              | In-place update           | Modify value without triggering rebalancing              |
|                  | `TestUpdateNonExistentKey`      | Error handling            | Verify error when updating non-existent key              |
|                  | `TestUpdateWithLargeValue`      | Fallback to delete+insert | Update with value exceeding page capacity                |
|                  | `TestUpdateMultiple`            | Batch modifications       | Multiple updates maintaining tree consistency            |
| **Delete Tests** | `TestDeleteSimple`              | Basic delete              | Delete from leaf without triggering rebalancing          |
|                  | `TestDeleteWithBorrowFromRight` | Borrow from right         | Create underflow, borrow key from right sibling          |
|                  | `TestDeleteWithBorrowFromLeft`  | Borrow from left          | Create underflow, borrow key from left sibling           |
|                  | `TestDeleteWithMerge`           | Merge operation           | Delete keys requiring node merge with sibling            |
|                  | `TestDeleteComplex`             | Multiple deletes          | Delete 6 keys from 16-key tree in specific order         |
|                  | `TestDeleteAll`                 | Edge case                 | Delete all keys, verify tree becomes empty (root = 0)    |

**Test Context System:**

Each test uses a `TestContext` helper that:

- Creates isolated test directory under `testdata/<TestName>/`
- Tracks all operations with natural language descriptions
- Records expected results for documentation
- Automatically generates description files
- Invokes visualization script for PNG generation

**Test Output Structure:**

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

**Test Coverage:**

- **18 comprehensive tests** covering all major operations
- **1,650+ lines** of test code with helper functions
- **Automatic documentation** generation for each test
- **Visual verification** through tree structure diagrams

---

### 8. **Transaction Support with Write-Ahead Logging (WAL)**

**Overview:** Full ACID transaction support with Write-Ahead Logging for durability and crash recovery. This feature enables multi-operation atomicity, consistency, and durability guarantees—critical for production database systems.

**Real-World Context:**

Transaction support with WAL is a fundamental feature in production databases. This implementation follows the same principles used by:

- **PostgreSQL**: Uses WAL (called "pg_xlog" or "pg_wal") for durability. All changes are logged before being written to data pages, enabling point-in-time recovery and crash recovery.
- **SQLite**: Implements WAL mode where changes are written to a separate WAL file before being checkpointed to the main database file.
- **MySQL InnoDB**: Uses a redo log (similar to WAL) to ensure durability and enable crash recovery.
- **Foundation**: Based on the **ARIES (Algorithms for Recovery and Isolation Exploiting Semantics)** recovery algorithm principles, which is the industry standard for database recovery.

**Key Concepts:**

1. **Write-Ahead Logging (WAL)**: All modifications are logged to a separate WAL file before being written to the main database file. This ensures that if a crash occurs, all committed transactions can be recovered by replaying the WAL.
2. **Transaction Atomicity**: Operations within a transaction either all succeed (commit) or all fail (rollback), maintaining database consistency.
3. **Durability**: Once a transaction is committed, its changes are guaranteed to persist even if the system crashes immediately after.

**Algorithm Steps:**

1. **Begin Transaction**: Start tracking all page modifications
2. **Track Changes**: During transaction, all modified pages are tracked with their original state
3. **Commit**:
   - Write all modified pages to WAL first (Write-Ahead Logging)
   - Update page LSNs (Log Sequence Numbers)
   - Flush modified pages to main database file
   - Clear transaction state
4. **Rollback**:
   - Restore original page states from tracked copies
   - Remove newly created pages
   - Clear transaction state
5. **Recovery**: On database open, replay WAL entries to restore committed changes

**Pseudo Code:**

```
function Begin():
    tx = new Transaction()
    tx.modifiedPages = {}
    tx.originalPages = {}
    activeTx = tx

function Commit():
    // Write-Ahead: Log all changes to WAL first
    for each (pageID, page) in modifiedPages:
        lsn = wal.LogPageWrite(pageID, page)
        page.Header.LSN = lsn

    // Then write to main database
    for each (pageID, page) in modifiedPages:
        writePageToFile(pageID, page)

    activeTx = null

function Rollback():
    // Restore original pages
    for each (pageID, originalPage) in originalPages:
        pages[pageID] = originalPage

    // Remove new pages
    for each pageID in modifiedPages:
        if pageID not in originalPages:
            delete pages[pageID]

    activeTx = null

function Recover():
    // Replay WAL entries
    for each entry in WAL:
        restorePage(entry.PageID, entry.PageData)
        writePageToFile(entry.PageID, page)
```

**Implementation Details:**

- **WAL File Format**: Each entry contains LSN, entry type, page ID, and serialized page data
- **LSN (Log Sequence Number)**: Monotonically increasing sequence number for ordering log entries
- **Checkpointing**: Periodically truncate WAL after ensuring all changes are flushed to main database
- **Page Tracking**: Original page states are saved for rollback capability
- **Transaction States**: Active, Committed, RolledBack

**Usage Example:**

```go
tree, _ := NewBPlusTree(pager)

// Start transaction
tree.Begin()

// Perform multiple operations
tree.Insert(key1, value1)
tree.Update(key2, newValue2)
tree.Delete(key3)

// Either commit or rollback
if success {
    tree.Commit()  // All changes persist
} else {
    tree.Rollback()  // All changes discarded
}

// Create checkpoint to truncate WAL
tree.Checkpoint()
```

**Benefits:**

- **Atomicity**: Multi-operation transactions either fully succeed or fully fail
- **Durability**: Committed changes survive crashes via WAL replay
- **Consistency**: Database remains in valid state even after rollback
- **Recovery**: Automatic recovery from crashes by replaying WAL

**Limitations:**

- Single transaction at a time (no nested transactions)
- No concurrent transaction support (requires locking for multi-threaded use)
- WAL file grows until checkpoint (in production, would use WAL rotation)

---

## Checklist: Completed Features

### Core Operations

- **Insert** - O(log n) insertion with automatic node splitting
- **Search** - O(log n) point query with error handling
- **Delete** - Full B+Tree deletion with rebalancing (borrow/merge)
- **Range Query** - O(log n + k) range scan using leaf chain
- **Update** - Atomic value modification with smart in-place optimization

### Transaction & Durability

- **Transaction Support** - Begin/Commit/Rollback for multi-operation atomicity
- **Write-Ahead Logging (WAL)** - All changes logged before database writes
- **Crash Recovery** - Automatic recovery by replaying WAL entries
- **LSN Tracking** - Log Sequence Numbers for ordering and recovery
- **Checkpointing** - WAL truncation after ensuring durability

### Tree Maintenance

- **Load from Disk** - Full tree reconstruction from persistent storage
- **Node Splitting** - Leaf and internal node split propagation
- **Borrow from Siblings** - Redistribution to avoid merges (left & right)
- **Merge Nodes** - Combine underflowed nodes (leaf & internal)
- **Root Special Cases** - Handle empty root and height reduction
- **Page Persistence** - FlushAll() ensures all changes written to disk
- **Parent Pointer Updates** - Maintain correct parent-child relationships
- **Sibling Link Maintenance** - Update prev/next pointers during operations

### Test Coverage

- **18 Comprehensive Tests** - All operations tested with edge cases
- **Visual Tree Diagrams** - PNG images showing B+Tree structure
- **Automatic Documentation** - Generated description files for each test
- **Binary Storage Validation** - Proper serialization/deserialization

---

## Next Steps: Priority Ordered

### High Priority

1. **Concurrent Access**
   - Add page-level locking or latching
   - Support multiple readers, single writer
   - Consider B-link tree variant for better concurrency

### Medium Priority

3. **Variable-Length Value Optimization**

   - Currently stores values as strings; optimize for large values
   - Implement overflow pages for values > page size
   - Add compression for large values

4. **Index Statistics**

   - Track tree height, page count, key distribution
   - Implement `Stats()` method for diagnostics
   - Help identify when rebalancing is needed

5. **Bulk Loading**

   - Optimize for inserting sorted data
   - Build tree bottom-up instead of incremental inserts
   - 3-5x faster for initial loads

6. **Update Optimization**
   - Consider copy-on-write for large values
   - Add versioning for concurrent updates

### Low Priority

7. **Key Compression**

   - Implement prefix compression for keys in internal nodes
   - Reduces space, increases fanout

8. **Snapshot Isolation**

   - MVCC (Multi-Version Concurrency Control)
   - Readers don't block writers

9. **Performance Benchmarks**
   - Add benchmark tests for insert/search/delete/update/range throughput
   - Compare against other embedded DBs (BoltDB, BadgerDB)
   - Profile memory usage and I/O patterns

---

## Technical Debt / Considerations

- **Error Handling:** Some panics could be graceful errors
- **Memory Usage:** All pages loaded into memory; consider LRU cache eviction
- **File Format Version:** Add version handling for schema migration
- **Defragmentation:** Deleted pages not reused; implement free page list
- **WAL Rotation:** Currently truncates WAL on checkpoint; production systems use WAL segment rotation

---

## Performance Characteristics

| Operation      | Time Complexity | Notes                                                     |
| -------------- | --------------- | --------------------------------------------------------- |
| Insert         | O(log n)        | May trigger O(log n) splits                               |
| Search         | O(log n)        | Single path traversal                                     |
| Delete         | O(log n)        | May trigger O(log n) merges/borrows                       |
| Update         | O(log n)        | In-place when fits; O(log n) delete+insert when oversized |
| Range Query    | O(log n + k)    | k = result count, horizontal leaf traversal               |
| Load from Disk | O(n)            | Must read all n pages                                     |

**Current Limitations:**

- ORDER = 4 (max 3 keys per node, 4 children)
- Page size = 4KB
- No buffer pool (all pages in memory)
- Single-threaded access only (transaction support added, but no concurrent transactions)
- Variable-length keys/values based on data content
- WAL enabled for durability and crash recovery

---

## Files Modified/Created

**Core Implementation:**

- `types.go` - **NEW** CompositeKey and Record types with serialization (400+ lines)
- `node.go` - Updated type aliases to use CompositeKey and Record
- `tree.go` - Updated all operations to use Compare method, added transaction support (900+ lines total)
- `leaf_page.go` - Updated serialization for CompositeKey/Record
- `internal_page.go` - Updated serialization for CompositeKey
- `page_manager.go` - Added FlushAll() for persistence
- `wal.go` - **NEW** Write-Ahead Logging implementation (300+ lines)
- `transaction.go` - **NEW** Transaction management with begin/commit/rollback (200+ lines)

**Tests:**

- `tree_test.go` - 18 comprehensive tests with visualization (1,650+ lines)
- Helper functions: K(), V(), KI(), VS() for test readability
- TestContext system for automatic documentation generation

**Visualization:**

- `visualize_tree.py` - Python script for tree visualization (500+ lines)
- Uses matplotlib to generate PNG diagrams of B+Tree structure
- Parses binary database format directly

**Test Output:**

- `testdata/<TestName>/*.db` - Binary database files
- `testdata/<TestName>/*.db.png` - Visual tree structure diagrams
- `testdata/<TestName>/description.txt` - Test documentation

**Total Code:** ~2,700+ lines (implementation + tests + visualization)

**Test Statistics:**

- 18 total tests with full visualization
- 100% pass rate
- Coverage: Insert, Search, Delete, Update, Range Query, Load, Edge Cases, Multi-column data
- Automatic generation of test documentation and tree diagrams
- Each test produces 3 artifacts: .db file, .png diagram, description.txt
