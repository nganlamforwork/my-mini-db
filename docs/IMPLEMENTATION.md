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
    - [3. **Insert Operation**](#3-insert-operation)
      - [3.1. **Leaf Split**](#31-leaf-split)
      - [3.2. **Internal Node Split**](#32-internal-node-split)
    - [4. **Range Query Operation**](#4-range-query-operation)
    - [5. **Update Operation**](#5-update-operation)
    - [6. **Delete Operation with Rebalancing**](#6-delete-operation-with-rebalancing)
      - [6.1. **Borrow from Sibling**](#61-borrow-from-sibling)
      - [6.2. **Merge Nodes**](#62-merge-nodes)
    - [7. **Page Persistence Enhancement**](#7-page-persistence-enhancement)
    - [8. **Transaction Support with Write-Ahead Logging (WAL)**](#8-transaction-support-with-write-ahead-logging-wal)
      - [8.1. **Auto-Commit Transactions (Crash Recovery for Single Operations)**](#81-auto-commit-transactions-crash-recovery-for-single-operations)
      - [8.2. **Explicit Transactions (Multi-Operation Atomicity)**](#82-explicit-transactions-multi-operation-atomicity)
      - [8.3. **Write-Ahead Logging (WAL) Implementation**](#83-write-ahead-logging-wal-implementation)
      - [8.4. **Transaction States and Lifecycle**](#84-transaction-states-and-lifecycle)
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

| Constant          | Value      | Description                                      |
| ----------------- | ---------- | ------------------------------------------------ |
| `ORDER`           | 4          | Maximum number of children per internal node     |
| `MAX_KEYS`        | 3          | Maximum keys per node (ORDER - 1)                |
| `MIN_KEYS`        | 1          | Minimum keys per non-root node ((ORDER - 1) / 2) |
| `DefaultPageSize` | 4096 bytes | Size of each page on disk                        |
| `PageHeaderSize`  | 56 bytes   | Fixed size of page header                        |

### Minimum Keys Calculation

- **Leaf Nodes:** `MIN_KEYS = (ORDER - 1) / 2 = 1` (for ORDER=4)
- **Internal Nodes:** `MIN_KEYS = (ORDER - 1) / 2 = 1` (for ORDER=4)
- **Implementation:** Defined as constant `MIN_KEYS` in `tree.go` to avoid hardcoded calculations
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
3. **Occupancy:** Non-root nodes have ≥ MIN_KEYS keys (MIN_KEYS = (ORDER - 1) / 2)
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

**Overview:** Standard B+Tree search with O(log n) complexity through binary search at both internal nodes and leaves. The search traverses from root to leaf using binary search to determine the correct path, then performs binary search within the target leaf to find the exact key.

**Algorithm Steps:**

1. **Start at root** - Begin traversal from the root page
2. **Navigate internal nodes** - Binary search keys to determine correct child pointer
3. **Follow path downward** - Descend through internal nodes until reaching a leaf
4. **Search leaf** - Binary search in the leaf's sorted key array to find exact match
5. **Return result** - Return value if found, error otherwise

**Pseudo Code:**

```
function Search(key):
    if tree is empty:
        return error

    currentPage = rootPage

    while currentPage is not a leaf:
        // Binary search to find rightmost key <= search key
        pos = binarySearchLastLessOrEqual(currentPage.keys, key)

        if pos == -1:
            // All keys > search key, follow leftmost child
            currentPage = currentPage.children[0]
        else:
            // Follow child after found key
            currentPage = currentPage.children[pos + 1]

    // Binary search in leaf for exact match
    index = binarySearch(currentPage.keys, key)
    if index != -1:
        return currentPage.values[index]

    return error "key not found"
```

**Key Concepts:**

- **Binary Search**: At each internal node, find the rightmost key ≤ search key to determine which child subtree to follow.
- **Child Selection**: If key found at position `i`, follow `children[i+1]` (subtree with keys ≥ `keys[i]`).
- **Binary Search in Leaves**: Once at leaf, use binary search to find exact match, providing O(log n) instead of O(n) performance.

**Time Complexity:** O(log n) - One path traversal from root to leaf with binary search at each internal node level, plus binary search within the leaf.

---

### 3. **Insert Operation**

**Overview:** B+Tree insertion with automatic node splitting to maintain balance. The operation handles two cases: simple insertion (no split) and insertion with splits that propagate upward. All insertions maintain sorted order and tree balance properties.

**Algorithm Steps:**

1. **Handle empty tree** - Create root leaf if tree is empty
2. **Find target leaf** - Navigate to leaf that should contain the key
3. **Check duplicates** - Return error if key already exists
4. **Insert into leaf** - Add key-value pair in sorted order
5. **Check overflow** - Verify if leaf exceeds capacity (key count or payload size)
6. **Split if needed** - Split leaf and propagate split upward through internal nodes
7. **Create new root** - If root splits, create new root internal node

**Pseudo Code:**

```
function Insert(key, value):
    if tree is empty:
        // Create root leaf
        rootLeaf = createLeaf()
        rootLeaf.keys.append(key)
        rootLeaf.values.append(value)
        meta.rootPage = rootLeaf.pageID
        return

    // Find target leaf and path to root
    leaf, path = findLeaf(key)

    // Check for duplicate key using binary search
    if binarySearch(leaf.keys, key) != -1:
        return error "duplicate key"

    // Insert key-value in sorted order (uses binary search to find insert position)
    insertIntoLeaf(leaf, key, value)

    // Check if leaf overflows
    if leaf.keyCount <= MAX_KEYS and leaf.payloadSize <= pageCapacity:
        return  // No split needed

    // Split leaf: redistribute keys between old and new leaf
    newLeaf = createLeaf()
    promotedKey = splitLeaf(leaf, newLeaf)

    // Propagate split upward through internal nodes
    currentChildID = newLeaf.pageID

    while path is not empty:
        parentID = path.pop()
        parent = getPage(parentID)

        // Insert promoted key and child pointer into parent
        insertIntoInternal(parent, promotedKey, currentChildID)

        if parent.keyCount < ORDER:
            return  // Parent didn't overflow, stop propagation

        // Parent overflowed, split it too
        newInternal = createInternal()
        promotedKey = splitInternal(parent, newInternal)
        currentChildID = newInternal.pageID

    // Root split: create new root
    newRoot = createInternal()
    newRoot.keys.append(promotedKey)
    newRoot.children.append(oldRootID)
    newRoot.children.append(currentChildID)
    meta.rootPage = newRoot.pageID
```

**Key Concepts:**

- **Simple Insert**: When leaf has space, just insert key-value in sorted order (no split).
- **Leaf Split**: When leaf overflows, split into two leaves, promote middle key to parent.
- **Split Propagation**: If parent internal node overflows after receiving promoted key, split it too and continue upward.
- **Root Split**: If root splits, create new root with single key and two children, increasing tree height.

**Time Complexity:**

- **Best case:** O(log n) - Insert without split
- **Worst case:** O(log n) - Insert with splits propagating to root

---

#### 3.1. **Leaf Split**

**Overview:** When a leaf page overflows (exceeds key count or payload capacity), it must be split into two leaves. The split redistributes keys evenly and promotes the first key of the right leaf to the parent internal node.

**Algorithm Steps:**

1. **Calculate midpoint** - Divide keys at midpoint for even distribution
2. **Create new leaf** - Allocate new leaf page for right half
3. **Redistribute keys** - Move keys from midpoint onward to new leaf
4. **Update sibling links** - Maintain doubly-linked list between leaves
5. **Promote separator** - First key of new leaf becomes separator for parent
6. **Update metadata** - Recompute free space for both leaves

**Pseudo Code:**

```
function splitLeaf(leaf, newLeaf):
    // Calculate midpoint for even key distribution
    mid = leaf.keys.length / 2

    // Move right half to new leaf
    newLeaf.keys = leaf.keys[mid:]
    newLeaf.values = leaf.values[mid:]

    // Keep left half in original leaf
    leaf.keys = leaf.keys[:mid]
    leaf.values = leaf.values[:mid]

    // Update sibling links to maintain leaf chain
    newLeaf.nextPage = leaf.nextPage
    newLeaf.prevPage = leaf.pageID
    leaf.nextPage = newLeaf.pageID

    // Update next sibling's prev pointer if exists
    if newLeaf.nextPage exists:
        nextSibling.prevPage = newLeaf.pageID

    // Update key counts
    leaf.keyCount = leaf.keys.length
    newLeaf.keyCount = newLeaf.keys.length

    // Recompute free space for both pages
    updateFreeSpace(leaf)
    updateFreeSpace(newLeaf)

    // Return first key of new leaf as separator for parent
    return newLeaf.keys[0]
```

**Key Concepts:**

- **Even Distribution**: Midpoint split ensures roughly equal keys in both leaves.
- **Separator Key**: First key of right leaf is promoted to parent (not copied, moved up).
- **Sibling Links**: NextPage/PrevPage pointers maintain leaf chain for range queries.
- **Free Space**: Recalculated after split to reflect actual payload usage.

---

#### 3.2. **Internal Node Split**

**Overview:** When an internal node overflows after receiving a promoted key from a child split, it must also be split. The middle key is promoted to the parent, and keys/children are redistributed between left and right nodes.

**Algorithm Steps:**

1. **Calculate midpoint** - Find middle key to promote
2. **Create new internal node** - Allocate new internal page for right half
3. **Redistribute keys** - Move keys after midpoint to new node
4. **Redistribute children** - Move corresponding child pointers
5. **Update parent pointers** - Set parent of moved children to new node
6. **Promote middle key** - Middle key moves up to parent (not kept in either node)
7. **Update metadata** - Recompute free space for both nodes

**Pseudo Code:**

```
function splitInternal(node, newNode, pageManager):
    // Calculate midpoint
    mid = node.keys.length / 2
    midKey = node.keys[mid]  // Key to promote (not kept in either node)

    // Move right half to new node
    newNode.keys = node.keys[mid+1:]
    newNode.children = node.children[mid+1:]

    // Keep left half in original node (including child at mid+1)
    node.keys = node.keys[:mid]
    node.children = node.children[:mid+1]

    // Update parent pointers of children moved to new node
    for each childID in newNode.children:
        child = pageManager.get(childID)
        child.parentPage = newNode.pageID

    // Update key counts
    node.keyCount = node.keys.length
    newNode.keyCount = newNode.keys.length

    // Recompute free space
    updateFreeSpace(node)
    updateFreeSpace(newNode)

    // Return middle key to be promoted to parent
    return midKey
```

**Key Concepts:**

- **Middle Key Promotion**: The middle key is removed from the node and promoted to parent (not kept in either split node).
- **Child Pointer Redistribution**: Children after midpoint move with their keys to the new node.
- **Parent Pointer Updates**: All moved children must have their parent pointers updated to point to the new node.
- **Key-Child Alignment**: For internal nodes, there's always one more child than keys (children[i] for keys < keys[i], children[i+1] for keys >= keys[i]).

---

### 4. **Range Query Operation**

**Overview:** Efficient range scanning leveraging the leaf-level doubly-linked list. Unlike point queries that require tree traversal, range queries follow horizontal links between leaves after locating the start position, achieving O(log n + k) complexity where k is the result count.

**Algorithm Steps:**

1. **Validate range** - Ensure startKey ≤ endKey
2. **Locate start leaf** - Find leaf containing or after startKey
3. **Scan current leaf** - Collect keys within range
4. **Follow leaf chain** - Use NextPage pointer to traverse horizontally
5. **Early termination** - Stop when keys exceed endKey
6. **Return results** - Aggregate collected key-value pairs

**Pseudo Code:**

```
function SearchRange(startKey, endKey):
    if startKey > endKey:
        return error "invalid range"

    // Find starting leaf using standard search
    leaf = findLeaf(startKey)
    results = []

    // Scan leaves horizontally using linked list
    while leaf != null:
        // Find starting position using binary search
        startIdx = binarySearchFirstGreaterOrEqual(leaf.keys, startKey)

        // Collect keys in current leaf that fall within range
        for i = startIdx to leaf.keys.length:
            key = leaf.keys[i]
            if key >= startKey and key <= endKey:
                results.append((key, leaf.values[i]))

            // Early exit if we've passed endKey
            if key > endKey:
                return results

        // Continue to next leaf if last key still < endKey
        if leaf.lastKey < endKey and leaf.nextPage exists:
            leaf = getPage(leaf.nextPage)
        else:
            break

    return results
```

**Key Concepts:**

- **Horizontal Traversal**: After initial O(log n) search, scan leaves horizontally using NextPage pointers.
- **Early Termination**: Stop scanning when keys exceed endKey to avoid unnecessary work.
- **Efficient**: O(log n + k) where k is result count, much better than k separate searches.

**Time Complexity:** O(log n + k) - Initial search plus sequential leaf scanning.

---

### 5. **Update Operation**

**Overview:** Atomic value modification that optimizes for the common case where the new value fits in the existing page. The implementation avoids unnecessary tree rebalancing by performing in-place updates when possible, falling back to delete-insert only when required.

**Algorithm Steps:**

1. **Locate key** - Find leaf containing target key
2. **Verify existence** - Return error if key not found
3. **Calculate size change** - Compare old and new value sizes
4. **Check capacity** - Determine if new value fits in current page
5. **In-place update** - If fits, replace value and update free space
6. **Fallback** - If doesn't fit, delete old entry and re-insert

**Pseudo Code:**

```
function Update(key, newValue):
    // Find leaf containing the key
    leaf = findLeaf(key)

    // Find key index in leaf using binary search
    index = binarySearch(leaf.keys, key)
    if index == -1:
        return error "key not found"

    // Calculate if new value fits
    oldSize = leaf.values[index].size()
    newSize = newValue.size()
    sizeDelta = newSize - oldSize

    // Check if update fits in current page
    if leaf.usedSpace + sizeDelta <= pageCapacity:
        // In-place update: just replace value
        leaf.values[index] = newValue
        updateFreeSpace(leaf)
        return success
    else:
        // Value too large: delete and re-insert
        Delete(key)
        Insert(key, newValue)
        return success
```

**Key Concepts:**

- **In-Place Update**: When new value fits, directly replace without tree rebalancing (O(log n)).
- **Delete+Insert Fallback**: When value too large, use delete then insert which may trigger rebalancing.
- **Space Efficiency**: Avoids unnecessary splits when value size increases but still fits.

**Time Complexity:**

- **Best case:** O(log n) - in-place update
- **Worst case:** O(log n) - delete + insert with potential rebalancing

---

### 6. **Delete Operation with Rebalancing**

**Overview:** Full B+Tree deletion maintaining tree balance through redistribution (borrowing) and merging. The algorithm handles both leaf and internal node rebalancing with proper separator key management.

**Algorithm Steps:**

1. **Locate and remove** - Find leaf and remove key-value pair
2. **Check underflow** - Verify node maintains minimum occupancy
3. **Try borrowing** - Attempt to borrow from sibling with surplus keys
4. **Merge if needed** - If siblings at minimum, merge nodes and remove separator
5. **Propagate upward** - Recursively rebalance parent if it underflows
6. **Handle root** - Reduce tree height when root has single child

**Pseudo Code:**

```
function Delete(key):
    // Find leaf containing key and path to root
    leaf, path = findLeaf(key)

    // Find key index in leaf using binary search
    index = binarySearch(leaf.keys, key)
    if index == -1:
        return error "key not found"

    // Remove key-value from leaf
    removeKeyFromLeaf(leaf, key, index)

    // Handle empty root
    if leaf is root and leaf.keyCount == 0:
        meta.rootPage = 0
        return

    // Check if rebalancing needed
    if leaf.keyCount >= MIN_KEYS:
        return  // No underflow

    // Rebalance leaf
    rebalanceLeafAfterDelete(leaf, path)

function rebalanceLeafAfterDelete(leaf, path):
    parent = getParent(leaf, path)

    // Try borrow from right sibling first
    if rightSibling exists and rightSibling.keyCount > MIN_KEYS:
        // Move first key from right to left
        borrowFromRight(leaf, rightSibling)
        updateParentSeparator(parent, leaf)
        return

    // Try borrow from left sibling
    if leftSibling exists and leftSibling.keyCount > MIN_KEYS:
        // Move last key from left to right
        borrowFromLeft(leftSibling, leaf)
        updateParentSeparator(parent, leftSibling)
        return

    // Cannot borrow, must merge
    if rightSibling exists:
        mergeWithRight(leaf, rightSibling)
    else:
        mergeWithLeft(leftSibling, leaf)

    // Remove separator from parent and propagate
    removeSeparatorFromParent(parent, mergedNode)
    rebalanceInternalAfterDelete(parent, path)

function rebalanceInternalAfterDelete(node, path):
    // Root reduction: if root has single child, make it new root
    if node is root and node.keyCount == 0:
        meta.rootPage = node.children[0]
        return

    if node.keyCount >= MIN_KEYS:
        return  // No underflow

    // Similar borrow/merge logic for internal nodes
    // Borrow: pull separator from parent, push separator to parent
    // Merge: combine nodes, remove separator from parent
    // Propagate upward if parent underflows
```

**Key Concepts:**

- **Borrowing**: Redistribute keys from sibling to avoid merge (preferred strategy).
- **Merging**: Combine underflowed node with sibling when borrowing not possible.
- **Separator Management**: Update parent separator keys when borrowing or merging.
- **Propagation**: Rebalancing may propagate upward if parent underflows after merge.

**Time Complexity:** O(log n) - May trigger O(log n) merges/borrows propagating to root.

---

#### 6.1. **Borrow from Sibling**

**Overview:** When a node underflows after deletion, the preferred strategy is to borrow a key from a sibling that has surplus keys. This avoids merging and maintains better tree balance. Borrowing works differently for leaf and internal nodes due to separator key management.

**Algorithm Steps (Leaf Nodes):**

1. **Check siblings** - Try right sibling first, then left sibling
2. **Borrow key-value** - Move first key from right (or last key from left)
3. **Update parent separator** - Adjust separator key in parent to reflect new boundary
4. **Update free space** - Recompute free space for both nodes

**Pseudo Code (Leaf Borrow):**

```
function borrowFromRight(leaf, rightSibling, parent):
    // Move first key-value from right to left
    leaf.keys.append(rightSibling.keys[0])
    leaf.values.append(rightSibling.values[0])

    // Remove from right sibling
    rightSibling.keys = rightSibling.keys[1:]
    rightSibling.values = rightSibling.values[1:]

    // Update parent separator: new boundary is first key of right sibling
    parent.separatorKey = rightSibling.keys[0]

    // Update key counts and free space
    updateKeyCount(leaf)
    updateKeyCount(rightSibling)
    updateFreeSpace(leaf)
    updateFreeSpace(rightSibling)

function borrowFromLeft(leftSibling, leaf, parent):
    // Move last key-value from left to right
    lastIdx = leftSibling.keys.length - 1
    leaf.keys.insert(0, leftSibling.keys[lastIdx])
    leaf.values.insert(0, leftSibling.values[lastIdx])

    // Remove from left sibling
    leftSibling.keys = leftSibling.keys[:lastIdx]
    leftSibling.values = leftSibling.values[:lastIdx]

    // Update parent separator: new boundary is first key of current leaf
    parent.separatorKey = leaf.keys[0]

    // Update key counts and free space
    updateKeyCount(leaf)
    updateKeyCount(leftSibling)
    updateFreeSpace(leaf)
    updateFreeSpace(leftSibling)
```

**Algorithm Steps (Internal Nodes):**

1. **Pull separator from parent** - Get separator key between node and sibling
2. **Borrow key and child** - Move first key from right (or last key from left) along with child pointer
3. **Push new separator to parent** - Update parent with new separator key
4. **Update parent pointers** - Set parent of moved child to borrowing node

**Pseudo Code (Internal Borrow):**

```
function borrowFromRight(node, rightSibling, parent):
    // Pull separator from parent (key between node and rightSibling)
    separatorKey = parent.keys[childIndex]

    // Add separator and first child from right to current node
    node.keys.append(separatorKey)
    node.children.append(rightSibling.children[0])

    // Update parent pointer of moved child
    movedChild.parentPage = node.pageID

    // Push first key of right sibling to parent as new separator
    parent.keys[childIndex] = rightSibling.keys[0]

    // Remove borrowed key and child from right sibling
    rightSibling.keys = rightSibling.keys[1:]
    rightSibling.children = rightSibling.children[1:]

    // Update key counts
    updateKeyCount(node)
    updateKeyCount(rightSibling)

function borrowFromLeft(leftSibling, node, parent):
    // Pull separator from parent (key between leftSibling and node)
    separatorKey = parent.keys[childIndex - 1]

    // Add separator and last child from left to beginning of current node
    node.keys.insert(0, separatorKey)
    lastChildIdx = leftSibling.children.length - 1
    node.children.insert(0, leftSibling.children[lastChildIdx])

    // Update parent pointer of moved child
    movedChild.parentPage = node.pageID

    // Push last key of left sibling to parent as new separator
    lastKeyIdx = leftSibling.keys.length - 1
    parent.keys[childIndex - 1] = leftSibling.keys[lastKeyIdx]

    // Remove borrowed key and child from left sibling
    leftSibling.keys = leftSibling.keys[:lastKeyIdx]
    leftSibling.children = leftSibling.children[:lastChildIdx]

    // Update key counts
    updateKeyCount(node)
    updateKeyCount(leftSibling)
```

**Key Concepts:**

- **Preferred Strategy**: Borrowing avoids merge, keeping tree more balanced.
- **Separator Management**: Parent separator keys must be updated to reflect new boundaries.
- **Child Pointer Updates**: For internal nodes, moved children need parent pointer updates.
- **Direction Preference**: Try right sibling first, then left (arbitrary but consistent).

---

#### 6.2. **Merge Nodes**

**Overview:** When a node underflows and neither sibling has surplus keys to borrow, the nodes must be merged. Merging combines two nodes and removes the separator key from the parent, which may cause the parent to underflow and propagate upward.

**Algorithm Steps (Leaf Merge):**

1. **Choose merge direction** - Prefer merging with right sibling, fallback to left
2. **Combine keys and values** - Append all keys/values from one node to the other
3. **Update sibling links** - Maintain leaf chain by updating NextPage/PrevPage pointers
4. **Remove separator from parent** - Delete separator key and child pointer from parent
5. **Propagate to parent** - Check if parent underflows after separator removal

**Pseudo Code (Leaf Merge):**

```
function mergeWithRight(leaf, rightSibling, parent):
    // Combine right sibling into current leaf
    leaf.keys.append(rightSibling.keys)
    leaf.values.append(rightSibling.values)

    // Update sibling links
    leaf.nextPage = rightSibling.nextPage
    if rightSibling.nextPage exists:
        nextSibling.prevPage = leaf.pageID

    // Remove separator and right child from parent
    removeSeparatorFromParent(parent, rightSibling)

    // Update free space
    updateFreeSpace(leaf)

    // Check if parent underflows and propagate
    if parent.keyCount < MIN_KEYS:
        rebalanceInternalAfterDelete(parent, path)

function mergeWithLeft(leftSibling, leaf, parent):
    // Combine current leaf into left sibling
    leftSibling.keys.append(leaf.keys)
    leftSibling.values.append(leaf.values)

    // Update sibling links
    leftSibling.nextPage = leaf.nextPage
    if leaf.nextPage exists:
        nextSibling.prevPage = leftSibling.pageID

    // Remove separator and current child from parent
    removeSeparatorFromParent(parent, leaf)

    // Update free space
    updateFreeSpace(leftSibling)

    // Check if parent underflows and propagate
    if parent.keyCount < MIN_KEYS:
        rebalanceInternalAfterDelete(parent, path)
```

**Algorithm Steps (Internal Merge):**

1. **Pull separator from parent** - Get separator key between nodes to merge
2. **Combine nodes** - Merge keys and children, inserting separator appropriately
3. **Update parent pointers** - Set parent of all moved children to merged node
4. **Remove separator from parent** - Delete separator key and child pointer
5. **Propagate to parent** - Check if parent underflows after separator removal

**Pseudo Code (Internal Merge):**

```
function mergeWithRight(node, rightSibling, parent):
    // Pull separator from parent
    separatorKey = parent.keys[childIndex]

    // Combine: node keys + separator + rightSibling keys
    node.keys.append(separatorKey)
    node.keys.append(rightSibling.keys)

    // Combine children: node children + rightSibling children
    node.children.append(rightSibling.children)

    // Update parent pointers of moved children
    for each childID in rightSibling.children:
        child = getPage(childID)
        child.parentPage = node.pageID

    // Remove separator and right child from parent
    removeSeparatorFromParent(parent, rightSibling)

    // Update key count
    node.keyCount = node.keys.length

    // Check if parent underflows and propagate
    if parent.keyCount < MIN_KEYS:
        rebalanceInternalAfterDelete(parent, path)

function mergeWithLeft(leftSibling, node, parent):
    // Pull separator from parent
    separatorKey = parent.keys[childIndex - 1]

    // Combine: leftSibling keys + separator + node keys
    leftSibling.keys.append(separatorKey)
    leftSibling.keys.append(node.keys)

    // Combine children: leftSibling children + node children
    leftSibling.children.append(node.children)

    // Update parent pointers of moved children
    for each childID in node.children:
        child = getPage(childID)
        child.parentPage = leftSibling.pageID

    // Remove separator and current child from parent
    removeSeparatorFromParent(parent, node)

    // Update key count
    leftSibling.keyCount = leftSibling.keys.length

    // Check if parent underflows and propagate
    if parent.keyCount < MIN_KEYS:
        rebalanceInternalAfterDelete(parent, path)
```

**Key Concepts:**

- **Separator Integration**: In internal node merge, separator key from parent is inserted between merged keys.
- **Child Pointer Updates**: All children moved during merge need parent pointer updates.
- **Propagation**: Merging removes a separator from parent, which may cause parent to underflow.
- **Direction Preference**: Prefer merging with right sibling, fallback to left (consistent with borrow preference).

---

### 7. **Page Persistence Enhancement**

**Challenge Addressed:** The initial implementation wrote pages only during allocation, not after subsequent modifications. This caused data loss when reopening the database.

**Solution:** Implemented `FlushAll()` to synchronize all in-memory pages to disk before closing. This write-back strategy balances performance (batch writes) with durability (guaranteed persistence on clean shutdown).

**Pseudo Code:**

```
function FlushAll():
    for each (pageID, page) in cachedPages:
        writePageToFile(pageID, page)
```

---

### 8. **Transaction Support with Write-Ahead Logging (WAL)**

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

#### 8.1. **Auto-Commit Transactions (Crash Recovery for Single Operations)**

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
// Create B+Tree with custom database filename
// The PageManager is created internally and will be closed when tree.Close() is called
tree, _ := NewBPlusTree("mydatabase.db", true)  // true = truncate existing file
defer tree.Close()

// Single insert - automatically transactional and crash-recoverable
tree.Insert(key1, value1)  // Auto-commits internally

// Single update - automatically transactional
tree.Update(key2, newValue2)  // Auto-commits internally

// Single delete - automatically transactional
tree.Delete(key3)  // Auto-commits internally

// All operations are immediately durable and crash-recoverable
```

**Note:** Users can choose any database filename. The `NewBPlusTree(filename, truncate)` function creates the PageManager internally with the specified filename. Set `truncate=true` to create a new database, or `truncate=false` to open an existing database.

**Crash Recovery:**

If the database crashes after any single operation, the WAL contains all necessary information to recover that operation:

```go
// Phase 1: Insert data (crashes before checkpoint)
tree, _ := NewBPlusTree("mydatabase.db", true)
tree.Insert(K(1), V("value1"))
tree.Insert(K(2), V("value2"))
tree.Close()
// ... crash occurs ...

// Phase 2: Recovery (reopen database)
tree2, _ := NewBPlusTree("mydatabase.db", false)  // false = open existing file
defer tree2.Close()
val, _ := tree2.Search(K(1))     // Data recovered successfully from WAL
```

---

#### 8.2. **Explicit Transactions (Multi-Operation Atomicity)**

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
// Create B+Tree with custom database filename
tree, _ := NewBPlusTree("mydatabase.db", true)
defer tree.Close()

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

#### 8.3. **Write-Ahead Logging (WAL) Implementation**

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

#### 8.4. **Transaction States and Lifecycle**

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
