# MiniDB: B+Tree Database Implementation

**Date:** January 13, 2026  
**Author:** Lam Le Vu Ngan
**Current Version:** 4.0 (Transaction Support)

> **See [CHANGELOG.md](CHANGELOG.md) for complete development history and version evolution**

## Table of Contents

- [MiniDB: B+Tree Database Implementation](#minidb-btree-database-implementation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Data Model](#data-model)
    - [Type System](#type-system)
      - [**Column Types**](#column-types)
      - [**CompositeKey**](#compositekey)
      - [**Record**](#record)
      - [**Type Aliases**](#type-aliases)
  - [B+Tree Structure \& Constants](#btree-structure--constants)
    - [Core Constants](#core-constants)
    - [Minimum Keys Calculation](#minimum-keys-calculation)
    - [Page Types](#page-types)
    - [Page Structure](#page-structure)
      - [**PageHeader (56 bytes)** - Common to all page types](#pageheader-56-bytes---common-to-all-page-types)
      - [**MetaPage Structure**](#metapage-structure)
      - [**InternalPage Structure**](#internalpage-structure)
      - [**LeafPage Structure**](#leafpage-structure)
  - [Page Layout Calculation](#page-layout-calculation)
    - [File Structure](#file-structure)
    - [B+Tree Invariants Maintained](#btree-invariants-maintained)
  - [What Was Implemented](#what-was-implemented)
    - [Data Model Features](#data-model-features)
    - [1. **Load from Disk Functionality**](#1-load-from-disk-functionality)
    - [2. **Search Operation**](#2-search-operation)
    - [3. **Range Query Operation**](#3-range-query-operation)
    - [4. **Update Operation**](#4-update-operation)
    - [5. **Delete Operation with Rebalancing**](#5-delete-operation-with-rebalancing)
    - [6. **Page Persistence Enhancement**](#6-page-persistence-enhancement)
    - [7. **Transaction Support with Write-Ahead Logging (WAL)**](#7-transaction-support-with-write-ahead-logging-wal)
      - [7.1. **Auto-Commit Transactions (Crash Recovery for Single Operations)**](#71-auto-commit-transactions-crash-recovery-for-single-operations)
      - [7.2. **Explicit Transactions (Multi-Operation Atomicity)**](#72-explicit-transactions-multi-operation-atomicity)
      - [7.3. **Write-Ahead Logging (WAL) Implementation**](#73-write-ahead-logging-wal-implementation)
      - [7.4. **Transaction States and Lifecycle**](#74-transaction-states-and-lifecycle)
  - [Checklist: Completed Features](#checklist-completed-features)
    - [Core Operations](#core-operations)
    - [Transaction \& Durability](#transaction--durability)
    - [Tree Maintenance](#tree-maintenance)
    - [Testing](#testing)
  - [Next Steps: Priority Ordered](#next-steps-priority-ordered)
    - [High Priority](#high-priority)
    - [Medium Priority](#medium-priority)
    - [Low Priority](#low-priority)
  - [Technical Debt / Considerations](#technical-debt--considerations)
  - [Performance Characteristics](#performance-characteristics)
  - [Files Modified/Created](#files-modifiedcreated)

---

## Overview

This document presents the architecture and implementation of a file-backed B+Tree database with full CRUD operations (insert, search, update, delete, range query) and persistent storage capabilities. The implementation demonstrates proper B+Tree rebalancing algorithms including node splitting, borrowing, and merging while maintaining all tree invariants.

**Key Highlights:**

- Complete B+Tree with disk persistence and in-memory caching
- Composite keys and structured row values - Support for multi-column primary keys and full database rows
- Proper delete implementation with borrow and merge operations
- Range query support leveraging leaf-level linked list
- Page-based storage architecture with 4KB pages
- Transaction support with Write-Ahead Logging (WAL) for ACID guarantees
- Comprehensive test coverage (see [TESTING.md](TESTING.md) for details)

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

### 7. **Transaction Support with Write-Ahead Logging (WAL)**

**Overview:** Full ACID transaction support with Write-Ahead Logging for durability and crash recovery. MiniDB implements two types of transactions: **auto-commit transactions** (for single operations) and **explicit transactions** (for multi-operation queries). This dual approach ensures that every operation is crash-recoverable while also supporting atomic multi-operation transactions—critical for production database systems.

**Real-World Context:**

Transaction support with WAL is a fundamental feature in production databases. This implementation follows the same principles used by:

- **PostgreSQL**: Uses WAL (called "pg_xlog" or "pg_wal") for durability. All changes are logged before being written to data pages, enabling point-in-time recovery and crash recovery. PostgreSQL uses auto-commit by default for single statements, with explicit transactions for multi-statement blocks.
- **SQLite**: Implements WAL mode where changes are written to a separate WAL file before being checkpointed to the main database file. SQLite uses auto-commit for individual statements and explicit transactions (BEGIN/COMMIT) for multi-statement operations.
- **MySQL InnoDB**: Uses a redo log (similar to WAL) to ensure durability and enable crash recovery. InnoDB uses auto-commit mode by default, with explicit transactions for multi-statement operations.
- **Foundation**: Based on the **ARIES (Algorithms for Recovery and Isolation Exploiting Semantics)** recovery algorithm principles, which is the industry standard for database recovery.

**Key Concepts:**

1. **Write-Ahead Logging (WAL)**: All modifications are logged to a separate WAL file before being written to the main database file. This ensures that if a crash occurs, all committed transactions can be recovered by replaying the WAL.
2. **Transaction Atomicity**: Operations within a transaction either all succeed (commit) or all fail (rollback), maintaining database consistency.
3. **Durability**: Once a transaction is committed, its changes are guaranteed to persist even if the system crashes immediately after.
4. **Auto-Commit Transactions**: Every single operation (Insert, Update, Delete) automatically creates and commits a transaction, ensuring crash recovery even for simple operations.
5. **Explicit Transactions**: Multi-operation queries can be grouped into explicit transactions for atomicity across multiple operations.

---

#### 7.1. **Auto-Commit Transactions (Crash Recovery for Single Operations)**

**Purpose:** Ensure that every operation, even simple single-operation queries, is crash-recoverable. This matches the behavior of real production databases where every operation is transactional.

**How It Works:**

When a user calls `Insert()`, `Update()`, or `Delete()` without an explicit `Begin()`, the system automatically:

1. Creates an auto-commit transaction
2. Tracks all page modifications during the operation
3. Commits the transaction automatically at the end
4. Writes all changes to WAL for crash recovery

**Real-World Comparison:**

- **PostgreSQL**: Every SQL statement is automatically wrapped in a transaction. If you execute `INSERT INTO users VALUES (1, 'John')`, PostgreSQL automatically begins a transaction, executes the insert, and commits it—all transparently.
- **SQLite**: In default mode, each statement is automatically committed. The statement `INSERT INTO users VALUES (1, 'John')` is automatically transactional.
- **MySQL InnoDB**: With `autocommit=1` (the default), each statement is automatically committed as a separate transaction.

**Implementation Details:**

```go
func (tree *BPlusTree) Insert(key KeyType, value ValueType) error {
    // Automatically ensure transaction exists for crash recovery
    wasAutoCommit := tree.ensureAutoCommitTransaction()
    defer func() {
        if wasAutoCommit {
            _ = tree.commitAutoTransaction()  // Auto-commit at end
        }
    }()

    // ... perform insert operation ...
    // All page modifications are tracked and logged to WAL
}
```

**Algorithm Flow:**

1. **Operation Start**: Check if explicit transaction exists
   - If no transaction: Create auto-commit transaction
   - If transaction exists: Use existing transaction
2. **Track Modifications**: All page changes are tracked during operation
   - Pages are modified **in memory only** (not written to disk)
   - Original page states are saved for potential rollback
3. **Operation End**: If auto-commit transaction was created:
   - **Step 1**: Write all modified pages to WAL first (with `Sync()` for durability)
   - **Step 2**: Update page LSNs (Log Sequence Numbers)
   - **Step 3**: Flush pages to main database file (with `Sync()` for durability)
   - **Step 4**: Mark transaction as committed

**Critical Safety Property:** All database writes happen **only during commit**, never during the operation itself. This ensures that if a crash occurs before commit, no changes are written to disk, and the tree remains unchanged.

**Benefits:**

- **Crash Recovery**: Every operation is recoverable, even simple inserts/updates/deletes
- **No User Overhead**: Users don't need to explicitly manage transactions for single operations
- **Consistency**: Matches real database behavior where every operation is transactional
- **Durability**: All operations survive crashes via WAL replay

**Usage Example:**

```go
tree, _ := NewBPlusTree(pager)

// Single insert - automatically transactional and crash-recoverable
tree.Insert(key1, value1)  // Auto-commits internally

// Single update - automatically transactional
tree.Update(key2, newValue2)  // Auto-commits internally

// Single delete - automatically transactional
tree.Delete(key3)  // Auto-commits internally

// All operations are immediately durable and crash-recoverable
```

**Crash Recovery:**

If the database crashes after any single operation, the WAL contains all necessary information to recover that operation:

```go
// Phase 1: Insert data (crashes before checkpoint)
tree.Insert(K(1), V("value1"))
tree.Insert(K(2), V("value2"))
// ... crash occurs ...

// Phase 2: Recovery (reopen database)
tree2, _ := NewBPlusTree(pager)  // Automatically recovers from WAL
val, _ := tree2.Search(K(1))     // Data recovered successfully
```

---

#### 7.2. **Explicit Transactions (Multi-Operation Atomicity)**

**Purpose:** Group multiple operations into a single atomic transaction. All operations either succeed together or fail together, maintaining database consistency.

**How It Works:**

Users explicitly begin a transaction, perform multiple operations, and then commit or rollback:

1. **Begin**: Start tracking all page modifications
2. **Operations**: Perform multiple Insert/Update/Delete operations
3. **Commit**: Write all changes to WAL and flush to database (all succeed)
4. **Rollback**: Restore original page states (all fail)

**Real-World Comparison:**

- **PostgreSQL**: `BEGIN; INSERT ...; UPDATE ...; DELETE ...; COMMIT;` - All operations are atomic
- **SQLite**: `BEGIN TRANSACTION; INSERT ...; UPDATE ...; COMMIT;` - All operations succeed or fail together
- **MySQL InnoDB**: `START TRANSACTION; INSERT ...; UPDATE ...; COMMIT;` - Multi-statement atomicity

**Implementation Details:**

```go
func (tree *BPlusTree) Begin() error {
    // Start explicit transaction (not auto-commit)
    _, err := tree.txManager.Begin(tree)
    return err
}

func (tree *BPlusTree) Commit() error {
    // Write all tracked pages to WAL, then flush to database
    return tree.txManager.Commit()
}

func (tree *BPlusTree) Rollback() error {
    // Restore original page states, discard all changes
    return tree.txManager.Rollback()
}
```

**Algorithm Flow:**

**Begin:**

```
function Begin():
    if activeTx != null:
        error("transaction already active")

    tx = new Transaction()
    tx.modifiedPages = {}
    tx.originalPages = {}
    tx.autoCommit = false  // Explicit transaction
    activeTx = tx
```

**Commit:**

```
function Commit():
    // Write-Ahead: Log all changes to WAL first
    for each (pageID, page) in modifiedPages:
        lsn = wal.LogPageWrite(pageID, page)
        page.Header.LSN = lsn

    // Then write to main database
    for each (pageID, page) in modifiedPages:
        writePageToFile(pageID, page)

    activeTx = null
    autoCommit = false
```

**Rollback:**

```
function Rollback():
    // Restore original pages
    for each (pageID, originalPage) in originalPages:
        pages[pageID] = originalPage

    // Remove new pages
    for each pageID in modifiedPages:
        if pageID not in originalPages:
            delete pages[pageID]

    activeTx = null
    autoCommit = false
```

**Benefits:**

- **Atomicity**: Multiple operations succeed or fail together
- **Consistency**: Database remains in valid state even if some operations fail
- **Error Handling**: Can rollback entire transaction if any operation fails
- **Multi-Operation Queries**: Support complex operations that require multiple steps

**Usage Example:**

```go
tree, _ := NewBPlusTree(pager)

// Begin explicit transaction
tree.Begin()

// Perform multiple operations atomically
tree.Insert(key1, value1)
tree.Update(key2, newValue2)
tree.Delete(key3)
tree.Insert(key4, value4)

// Either commit or rollback
if allOperationsSuccessful {
    tree.Commit()  // All 4 operations persist together
} else {
    tree.Rollback()  // All 4 operations are discarded
}
```

**Interaction with Auto-Commit:**

When operations are called within an explicit transaction, they use the existing transaction instead of creating auto-commit ones:

```go
tree.Begin()              // Explicit transaction started
tree.Insert(key1, value1) // Uses explicit transaction (not auto-commit)
tree.Update(key2, value2) // Uses explicit transaction (not auto-commit)
tree.Commit()             // Commits both operations atomically
```

---

#### 7.3. **Write-Ahead Logging (WAL) Implementation**

**WAL File Format:**

Each WAL entry contains:

- **LSN (Log Sequence Number)**: 8 bytes - Monotonically increasing sequence number
- **Entry Type**: 1 byte - Insert, Update, Delete, or Checkpoint
- **Page ID**: 8 bytes - Identifier of the modified page
- **Data Length**: 4 bytes - Size of page data
- **Page Data**: Variable (padded to page size) - Complete serialized page

**What Gets Logged:**

The WAL stores **complete page snapshots** (physical logging), not individual operations. For example, a single `Insert()` operation that causes a split will log:

- Modified leaf page (left half after split)
- New leaf page (right half after split)
- Modified parent internal page (with new separator key)
- Possibly new internal pages (if parent also split)
- Meta page (if root changed)

This approach matches how real databases log changes at the page level for efficient recovery.

**Recovery Process:**

```go
function Recover():
    // On database open, replay WAL entries
    for each entry in WAL:
        if entry.Type == Checkpoint:
            break  // Checkpoint marks end of recoverable entries

        // Restore page from WAL entry
        page = deserialize(entry.PageData)
        pages[entry.PageID] = page

        // Write to main database file
        writePageToFile(entry.PageID, page)
```

**Checkpointing:**

Periodically, create a checkpoint to truncate the WAL:

```go
tree.Checkpoint()  // Writes checkpoint entry, truncates WAL
```

This ensures the WAL doesn't grow indefinitely. In production systems, checkpoints are typically created:

- After a certain number of transactions
- After a certain time period
- When WAL reaches a certain size

---

#### 7.4. **Transaction States and Lifecycle**

**Transaction States:**

1. **Active**: Transaction is in progress, modifications are being tracked
2. **Committed**: Transaction completed successfully, changes persisted
3. **RolledBack**: Transaction was aborted, changes discarded

**Transaction Lifecycle:**

```
[No Transaction]
    |
    | Insert/Update/Delete (no Begin)
    |
    v
[Auto-Commit Transaction Created]
    |
    | Track page modifications
    |
    v
[Auto-Commit Transaction Committed]
    |
    | Write to WAL → Flush to DB
    |
    v
[No Transaction]

OR

[No Transaction]
    |
    | Begin()
    |
    v
[Explicit Transaction Active]
    |
    | Insert/Update/Delete operations
    |
    v
[Commit() OR Rollback()]
    |
    | Commit: Write to WAL → Flush to DB
    | Rollback: Restore original pages
    |
    v
[No Transaction]
```

---

**Crash Safety Guarantee:**

MiniDB guarantees that **every single operation is crash-safe**. This means:

1. **During Operation (Before Commit)**: If a crash occurs while modifying pages/nodes in memory, the main database file remains unchanged. On restart, the tree is in the same state as before the operation started.

2. **During Commit (After WAL Write)**: If a crash occurs after WAL entries are written but before database file writes complete, the WAL contains all necessary information. On restart, recovery automatically replays WAL entries to restore the committed state.

3. **After Commit**: Once commit completes, both WAL and database file are updated and synced. The operation is fully durable.

**Implementation Details:**

- **Write-Ahead Logging**: All page modifications are written to WAL **first** (with `Sync()`), then to the database file. This ensures that if a crash occurs, committed changes can be recovered.

- **No Direct Writes**: All database writes (including meta page updates) go through the transaction commit process. No pages are written directly to disk during operations—they are only tracked in memory until commit.

- **Atomic Commit**: The commit process is atomic: either all pages are written to WAL and database, or none are (if commit fails, transaction is rolled back).

**Example Crash Scenarios:**

```go
// Scenario 1: Crash before commit
tree.Insert(key, value)  // Modifies pages in memory, tracks changes
// ... crash occurs before defer commit runs ...
// Result: No WAL entries, no DB writes → Tree unchanged on restart ✓

// Scenario 2: Crash during commit (after WAL, before DB)
tree.Insert(key, value)  // Commit starts
// WAL written and synced ✓
// ... crash occurs before DB write ...
// Result: WAL has entries → Recovery restores committed state ✓

// Scenario 3: Crash after commit
tree.Insert(key, value)  // Commit completes
// WAL written ✓, DB written ✓, both synced ✓
// ... crash occurs ...
// Result: Both WAL and DB updated → State fully persisted ✓
```

**Benefits:**

- **Crash Recovery**: Every operation is recoverable via WAL, matching real database behavior
- **Atomicity**: Multi-operation transactions either fully succeed or fully fail
- **Durability**: Committed changes survive crashes via WAL replay
- **Consistency**: Database remains in valid state even after rollback
- **Real-World Alignment**: Matches how PostgreSQL, SQLite, and MySQL handle transactions
- **Guaranteed Safety**: No partial writes—either the entire operation persists or nothing changes

**Limitations:**

- Single transaction at a time (no nested transactions)
- No concurrent transaction support (requires locking for multi-threaded use)
- WAL file grows until checkpoint (in production, would use WAL rotation)
- Rollback uses reference-based page tracking (deep copying would be ideal for complex scenarios)

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

### Testing

> **For comprehensive testing documentation, see [TESTING.md](TESTING.md)**

- **18 Comprehensive Tests** - All operations tested with edge cases
- **Visual Tree Diagrams** - PNG images showing B+Tree structure
- **Automatic Documentation** - Generated description files for each test
- **Binary Storage Validation** - Proper serialization/deserialization
- **Test Infrastructure** - Ready for future HTML/CSS-based UI

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
- `docs/TESTING.md` - Complete testing documentation
- Helper functions: K(), V(), KI(), VS() for test readability
- TestContext system for automatic documentation generation

**Visualization:**

- `visualize_tree.py` - Python script for tree visualization (500+ lines)
- Uses matplotlib to generate PNG diagrams of B+Tree structure
- Parses binary database format directly
- Designed for future HTML/CSS conversion

**Total Code:** ~2,700+ lines (implementation + tests + visualization)

> **See [TESTING.md](TESTING.md) for detailed test documentation, test categories, and future HTML/CSS UI plans**
