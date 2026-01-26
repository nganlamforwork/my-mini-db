# Concurrent Access Architecture Decision Record (ADR)

**Status:** Approved  
**Date:** January 27, 2026  
**Decision:** Latch Crabbing (Lock Coupling) with Optimistic/Pessimistic Fallback

---

## Section 1: Concurrency Strategy Analysis

This section analyzes four viable approaches for adding concurrent access to our B+ Tree implementation. Each option is evaluated against our constraints: **correctness over performance**, **incremental implementation**, and **compatibility with existing WAL and disk format**.

### Option 1: Global Mutex (Coarse-Grained Locking)

**Description:** Wrap all B+ Tree operations (`Search`, `Insert`, `Delete`) with a single `sync.RWMutex` at the tree level.

**Pros:**

- **Trivial to implement:** ~10 lines of code changes
- **Zero risk of deadlocks:** Single lock point eliminates lock ordering issues
- **Immediate correctness:** Guarantees serializability
- **Perfect for baseline:** Ideal Phase 1 implementation to establish thread-safety baseline

**Cons:**

- **Severe performance bottleneck:** All operations serialize through one lock
- **No true concurrency:** Even read-only operations block each other
- **Does not scale:** Performance degrades linearly with contention

**Verdict:** **Rejected for final implementation.** Acceptable as Phase 1 baseline only.

---

### Option 2: Copy-on-Write (CoW) / Multi-Version Concurrency Control (MVCC)

**Description:** Each write operation creates a new version of modified pages. Readers access immutable snapshots, eliminating read-write conflicts.

**Pros:**

- **Excellent read concurrency:** Readers never block writers or other readers
- **Natural snapshot isolation:** Supports time-travel queries
- **No read latches needed:** Readers operate on immutable data

**Cons:**

- **Major architectural change:** Requires versioning metadata in every page
- **Disk format incompatibility:** Cannot reuse existing page layout
- **Complex garbage collection:** Must track and reclaim old page versions
- **WAL integration complexity:** Version management conflicts with current WAL design
- **Memory overhead:** Multiple versions of pages must coexist

**Verdict:** **Rejected.** Too invasive for incremental implementation. Would require rewriting core data structures and WAL integration.

---

### Option 3: B-Link Tree (Lehman & Yao Algorithm)

**Description:** Extends B+ Tree with "right links" (sibling pointers) and "high keys" (fence keys). Allows atomic splits without locking parent nodes. Readers traverse horizontally when encountering splits.

**Pros:**

- **Proven in production:** PostgreSQL uses this exact algorithm
- **Eliminates root bottleneck:** Readers can traverse around splits without parent locks
- **High concurrency:** Multiple readers and writers can operate simultaneously

**Cons:**

- **Disk format changes required:** Must add `RightPageID` and `HighKey` fields to every page header
- **Complex traversal logic:** Search must handle "move right" when `SearchKey > HighKey`
- **Deadlock risk:** Complex lock ordering across multiple levels can cause deadlocks if not carefully managed
- **Implementation complexity:** Requires rewriting core traversal and split logic
- **Testing burden:** Must verify correctness of horizontal traversal in all edge cases

**Verdict:** **Rejected.** Complexity and deadlock risk exceed our current learning objectives. Disk format changes would break backward compatibility.

---

### Option 4: Latch Crabbing (Lock Coupling) - **SELECTED**

**Description:** Fine-grained locking where latches are held on nodes during traversal. "Crabbing" means acquiring a latch on the child node before releasing the parent latch (like moving hand-over-hand on monkey bars). Supports both optimistic (assume no splits) and pessimistic (lock aggressively for splits) approaches.

**Pros:**

- **Incremental implementation:** Can start with global lock, then add fine-grained locks node-by-node
- **Reuses existing disk format:** No schema changes required
- **Perfect WAL integration:** Pessimistic approach aligns with WAL's write-ahead logging (acquire exclusive latch → log → modify → release)
- **Gradual complexity:** Can implement read path first, then write path
- **Industry-proven:** MySQL InnoDB uses this exact technique
- **Deadlock prevention:** Lock ordering (root → leaf) is straightforward to enforce

**Cons:**

- **Root bottleneck (mitigated):** All operations must pass through root, but optimistic reads can use shared latches
- **Split handling complexity:** Must detect "unsafe" nodes and restart with pessimistic locking
- **Lock overhead:** More lock acquisitions than global mutex (but enables true concurrency)

**Verdict:** **APPROVED.** Best balance of correctness, incremental implementation, and compatibility with existing architecture.

**Key Insight:** Latch Crabbing's pessimistic approach pairs perfectly with WAL:

1. Acquire exclusive latch on leaf
2. Write to WAL (durability guarantee)
3. Modify page in memory
4. Release latch
5. Flush WAL asynchronously

This sequence ensures atomicity and durability without requiring disk format changes.

---

## Section 2: The Decision

### Selected Strategy: **Latch Crabbing with Optimistic/Pessimistic Fallback**

### Rationale

1. **Incremental Implementation Path:** We can implement concurrency in phases without breaking existing functionality:
   - Phase 1: Global lock (baseline)
   - Phase 2: Fine-grained read path (crabbing for `Search`)
   - Phase 3: Optimistic write operations (local locking for safe nodes in `Insert` and `Delete`)
   - Phase 4: Pessimistic fallback (handle splits and merges correctly)

2. **Zero Disk Format Changes:** Our existing B+ Tree page structure remains unchanged. This means:
   - No migration scripts needed
   - Existing databases continue to work
   - WAL format unchanged
   - Cache eviction logic unchanged

3. **WAL Compatibility:** The pessimistic locking strategy aligns perfectly with WAL's requirements:
   - Exclusive latch → WAL write → Page modification → Latch release
   - This sequence guarantees that WAL entries are logged before page modifications become visible

4. **Correctness First:** Lock coupling provides strong correctness guarantees:
   - Lock ordering (root → leaf) prevents deadlocks
   - Exclusive latches during splits prevent corruption
   - Shared latches for reads enable read concurrency

5. **Learning-Focused:** This approach teaches fundamental concurrency patterns (lock coupling, optimistic vs pessimistic) without the complexity of B-Link's horizontal traversal or CoW's version management.

### Implementation Philosophy

**Correctness > Performance** (for this learning phase)

- Every phase must pass 100% of regression tests
- Concurrency tests start small (5 goroutines) and scale gradually
- Stress tests are "medium" scale (50 goroutines), not Google-scale
- Integrity checks (tree traversal, key count validation) are mandatory after every concurrency test

---

## Section 3: Phased Roadmap with Verification Strategy

This roadmap is **strictly test-driven**. Each phase defines:

1. **Implementation Goal:** What code changes are made
2. **Mandatory Verification Steps:** How we prove correctness before moving to the next phase

**CRITICAL RULE:** Do not proceed to the next phase until all verification steps pass with 100% success rate.

---

### Phase 1: Thread-Safety Baseline (Global Lock)

**Status:** Foundation Phase  
**Complexity:** Low  
**Risk:** Minimal (wraps existing code)

#### Implementation Goal

Wrap all existing B+ Tree methods (`Search`, `Insert`, `Delete`, `Update`) with a global `sync.RWMutex` at the `BPlusTree` struct level.

**Code Changes:**

- Add `mu sync.RWMutex` field to `BPlusTree` struct
- Acquire `RLock()` at the start of `Search()`, release at the end
- Acquire `Lock()` at the start of `Insert()`, `Delete()`, `Update()`, release at the end
- **Do not modify any internal B+ Tree logic** (node traversal, splits, etc.)

**Expected Outcome:** All operations are now serialized. Performance will be poor, but correctness is guaranteed.

#### Mandatory Verification Steps

**1. Regression Test Suite (100% Pass Rate Required)**

```bash
# Run all existing single-threaded tests
go test ./internal/btree/... -v

# Expected: All tests pass. Zero failures.
# If any test fails, DO NOT PROCEED. Fix the regression first.
```

**Test Coverage Must Include:**

- Basic insert/search/delete operations
- Tree structure validation (height, node counts)
- WAL recovery (crash simulation)
- Cache eviction behavior
- Edge cases (empty tree, single node, full tree)

**2. Concurrency Level 1: Basic Thread Safety**

Create a new test file: `internal/btree/concurrent_test.go`

**Test Case: "GlobalLock_BasicConcurrency"**

```go
// Spawn 5 goroutines performing mixed operations
// - 2 readers (Search)
// - 2 writers (Insert)
// - 1 deleter (Delete)
// Run for 1000 operations total
// Verify: No race conditions detected
```

**Execution:**

```bash
go test ./internal/btree/... -race -run TestGlobalLock_BasicConcurrency
```

**Success Criteria:**

- Zero race conditions reported by `-race` flag
- All operations complete without panics
- Final tree state is valid (can traverse and count keys)

**3. Data Integrity Check**

After the concurrency test, perform a full tree traversal:

- Count total keys in tree
- Verify count matches expected count (sum of all inserts minus deletes)
- Verify no duplicate keys exist
- Verify tree structure is valid (parent-child relationships correct)

**Phase 1 Exit Criteria:**

- 100% regression test pass rate
- Zero race conditions in concurrency test
- Data integrity verified

**Only then proceed to Phase 2.**

---

### Phase 2: Fine-Grained Read Path (Crabbing)

**Status:** Read Concurrency  
**Complexity:** Medium  
**Risk:** Moderate (modifies core traversal logic)

#### Implementation Goal

Move `sync.RWMutex` from tree-level to node-level. Implement "hand-over-hand" locking for `Search()` operations. Keep `Insert()` and `Delete()` globally locked (they will be optimized in Phase 3 and Phase 4).

**Code Changes:**

- Add `mu sync.RWMutex` field to `Node` struct (or page wrapper)
- Modify `findLeaf()` to acquire `RLock()` on each node during traversal
- **Lock Coupling Protocol:**
  1. Acquire `RLock()` on current node `N`
  2. Identify child node `C` to traverse to
  3. Acquire `RLock()` on child `C`
  4. Release `RLock()` on parent `N`
  5. Repeat until leaf is reached
- Keep `Insert()` and `Delete()` using global tree-level lock (temporary)

**Expected Outcome:** Multiple readers can traverse the tree concurrently. Writers still serialize through global lock.

#### Mandatory Verification Steps

**1. Regression Test: Search Logic Correctness**

```bash
go test ./internal/btree/... -run TestSearch
```

**Success Criteria:**

- All search operations return correct results
- Search for non-existent keys returns "not found" (not garbage data)
- Search handles edge cases (empty tree, single key, duplicate key scenarios)

**2. Concurrency Level 2: Reader-Writer Isolation**

**Test Case: "Crabbing_ReaderWriterIsolation"**

```go
// Spawn:
// - 20 "Reader" goroutines (continuously calling Search() on known keys)
// - 1 "Writer" goroutine (inserting new keys in a different range)
// - 1 "Deleter" goroutine (deleting keys in a third range)
// Run for 10 seconds
// Verify: Readers never see garbage data or panic
```

**Execution:**

```bash
go test ./internal/btree/... -race -run TestCrabbing_ReaderWriterIsolation -timeout 15s
```

**Success Criteria:**

- Zero race conditions
- Zero panics or nil pointer dereferences
- All reader goroutines complete successfully
- Readers only see committed data (keys that existed before writer started, or keys fully inserted by writer)

**3. Lock Ordering Verification**

Add instrumentation to verify lock acquisition order:

- Log lock acquisitions (in test mode only)
- Verify that locks are always acquired in root → leaf order
- Verify that parent locks are released before grandparent locks (true crabbing)

**4. WAL Integration Check**

Verify that WAL logging still works correctly:

- Insert and Delete operations (still using global lock) must log to WAL
- WAL recovery must restore tree state correctly
- No WAL entries are lost or corrupted

**Phase 2 Exit Criteria:**

- 100% regression test pass rate
- Reader-writer isolation verified (no garbage reads)
- Lock ordering verified (root → leaf, proper release)
- WAL integration intact

**Only then proceed to Phase 3.**

---

### Phase 3: Optimistic Write Operations (Local Locking)

**Status:** Write Path Optimization  
**Complexity:** High  
**Risk:** High (modifies critical write path)

#### Implementation Goal

Allow `Insert()` and `Delete()` to use fine-grained locking via crabbing. Implement "optimistic" approach: if a leaf node is "safe" (for Insert: has space, won't split; for Delete: has enough keys, won't merge), lock only that leaf. If the leaf is "unsafe" (will split or merge), fall back to global lock (pessimistic path will be implemented in Phase 4).

**Code Changes:**

- Remove global lock from `Insert()` and `Delete()` methods
- Implement crabbing for write traversal (similar to search, but use `Lock()` for exclusive access)
- **Safety Check for Insert:** Before releasing parent lock, check if child is "safe":
  - Leaf node: `len(keys) < MAX_KEYS` → Safe (won't split)
  - Internal node: Not applicable (splits propagate, so always unsafe for now)
- **Safety Check for Delete:** Before releasing parent lock, check if child is "safe":
  - Leaf node: `len(keys) > MIN_KEYS` → Safe (won't merge/redistribute)
  - Internal node: Not applicable (merges propagate, so always unsafe for now)
- **Optimistic Path (Insert):** If leaf is safe:
  1. Acquire exclusive `Lock()` on leaf
  2. Release all parent locks
  3. Perform insert
  4. Write to WAL
  5. Release leaf lock
- **Optimistic Path (Delete):** If leaf is safe:
  1. Acquire exclusive `Lock()` on leaf
  2. Release all parent locks
  3. Perform delete
  4. Write to WAL
  5. Release leaf lock
- **Pessimistic Path (Temporary):** If leaf is unsafe (for either operation):
  1. Release all locks
  2. Acquire global tree lock
  3. Retry operation (will handle split/merge under global lock)
  4. Release global lock

**Expected Outcome:** Inserts into non-full leaves and deletes from non-minimal leaves can proceed concurrently. Operations that cause splits or merges serialize through global lock (temporary).

#### Mandatory Verification Steps

**1. Regression Test: Write Operations Correctness**

```bash
go test ./internal/btree/... -run "TestInsert|TestDelete"
```

**Success Criteria:**

- All insert operations succeed
- All delete operations succeed
- Tree structure remains valid (no cycles, correct parent-child links)
- Keys are inserted in correct sorted order
- Duplicate key handling works correctly
- Deleted keys are actually removed (cannot be found via Search)
- Delete of non-existent keys handles gracefully

**2. WAL Logging Verification**

**Test Case: "OptimisticWrite_WALLogging"**

```go
// Perform 100 optimistic inserts (into safe leaves)
// Perform 50 optimistic deletes (from safe leaves)
// Verify: Every insert/delete operation logged to WAL before unlock
// Verify: WAL entries are in correct order
// Verify: WAL recovery restores correct tree state (100 inserted, 50 deleted = 50 remaining)
```

**Success Criteria:**

- WAL contains entry for every insert and delete
- WAL entries are written before page modifications (WAL-first protocol)
- WAL recovery restores exact tree state (correct key count)

**3. Concurrency Level 3: Concurrent Writers and Deleters (Different Ranges)**

**Test Case: "OptimisticWrite_ConcurrentOperations"**

```go
// Spawn 10 writer goroutines
// Each writer inserts keys in a distinct range (e.g., Writer 1: 0-99, Writer 2: 100-199, ...)
// Each writer performs 50 inserts
// Spawn 5 deleter goroutines
// Each deleter deletes keys from a distinct range (e.g., Deleter 1: 0-49, Deleter 2: 50-99, ...)
// Each deleter performs 25 deletes
// Verify: No deadlocks, all operations succeed
```

**Execution:**

```bash
go test ./internal/btree/... -race -run TestOptimisticWrite_ConcurrentOperations -timeout 30s
```

**Success Criteria:**

- Zero deadlocks (test completes within timeout)
- Zero race conditions
- All 500 keys (10 writers × 50 inserts) are initially inserted
- All 125 keys (5 deleters × 25 deletes) are successfully deleted
- Final tree contains exactly 375 keys (500 - 125)
- Tree structure is valid (traversal succeeds, no cycles)

**4. Safety Check Validation**

Add test to verify safety checks work for both operations:

**Insert Safety Checks:**
- Insert into a leaf that is at `MAX_KEYS - 1` (should use optimistic path)
- Insert into a leaf that is at `MAX_KEYS` (should fall back to global lock)
- Verify correct path is taken in each case

**Delete Safety Checks:**
- Delete from a leaf that is at `MIN_KEYS + 1` (should use optimistic path)
- Delete from a leaf that is at `MIN_KEYS` (should fall back to global lock)
- Verify correct path is taken in each case

**Phase 3 Exit Criteria:**

- 100% regression test pass rate
- WAL logging verified (all inserts and deletes logged before unlock)
- Concurrent writers and deleters succeed (no deadlocks, all operations complete)
- Safety checks validated for both Insert and Delete

**Only then proceed to Phase 4.**

---

### Phase 4: Full Concurrency (Pessimistic Fallback)

**Status:** Complete Implementation  
**Complexity:** Very High  
**Risk:** Very High (handles splits under fine-grained locking)

#### Implementation Goal

Handle "unsafe" nodes (splits for Insert, merges/redistributions for Delete) by implementing pessimistic locking with restart logic. When a split or merge is detected, restart the operation with aggressive exclusive locks held from root to leaf.

**Code Changes:**

- Remove global lock fallback from `Insert()` and `Delete()`
- **Pessimistic Split Protocol (Insert):**
  1. During crabbing, if a node is "unsafe" (will split), mark it
  2. Release all current locks
  3. **Restart with Pessimistic Mode:**
     - Acquire exclusive `Lock()` on root
     - Traverse to leaf, acquiring exclusive `Lock()` on each node (no early release)
     - Keep all locks held until split is complete
  4. Perform split:
     - Lock leaf (already held)
     - Allocate new sibling node
     - Redistribute keys
     - Update parent (lock already held)
     - If parent splits, propagate upward (all ancestor locks already held)
  5. Write to WAL (all modifications)
  6. Release all locks in reverse order (leaf → root)
- **Pessimistic Merge/Redistribution Protocol (Delete):**
  1. During crabbing, if a node is "unsafe" (will merge/redistribute), mark it
  2. Release all current locks
  3. **Restart with Pessimistic Mode:**
     - Acquire exclusive `Lock()` on root
     - Traverse to leaf, acquiring exclusive `Lock()` on each node (no early release)
     - Keep all locks held until merge/redistribution is complete
  4. Perform merge/redistribution:
     - Lock leaf (already held)
     - Check sibling nodes (may need to lock siblings)
     - If merge needed: merge with sibling, update parent
     - If redistribution needed: redistribute keys with sibling, update parent
     - If parent underflows, propagate upward (all ancestor locks already held)
  5. Write to WAL (all modifications)
  6. Release all locks in reverse order (leaf → root)

**Expected Outcome:** Full concurrency for reads, inserts, and deletes, including operations that cause splits, merges, or redistributions.

#### Mandatory Verification Steps

**1. Regression Test: Full Operation Suite**

```bash
go test ./internal/btree/... -v
```

**Success Criteria:**

- 100% pass rate on all existing tests
- Insert, Search, Delete all work correctly
- Tree structure validation passes
- WAL recovery works

**2. Stress Test (Medium Scale): Mixed Workload**

**Test Case: "PessimisticFallback_StressTest"**

```go
// Spawn 50 concurrent goroutines:
// - 20 "Reader" goroutines (40% of workload)
// - 20 "Writer" goroutines (40% of workload, Insert operations)
// - 10 "Deleter" goroutines (20% of workload, Delete operations)
// All goroutines operate on overlapping key ranges (to force contention, splits, and merges)
// Run for 30 seconds
// Verify: System remains stable, no deadlocks, no data corruption
```

**Execution:**

```bash
go test ./internal/btree/... -race -run TestPessimisticFallback_StressTest -timeout 60s
```

**Success Criteria:**

- Zero race conditions
- Zero deadlocks (test completes within timeout)
- Zero panics or crashes
- All operations complete successfully

**3. Integrity Check: Tree Consistency**

After stress test, perform comprehensive integrity validation:

```go
// 1. Full tree traversal
// 2. Count all keys in tree
// 3. Verify: count matches expected count (sum of inserts minus deletes)
// 4. Verify: No duplicate keys
// 5. Verify: All keys are in sorted order (in-order traversal)
// 6. Verify: Tree height is within expected bounds
// 7. Verify: All parent-child relationships are correct
// 8. Verify: All leaf nodes are properly linked (if leaf linking exists)
```

**Success Criteria:**

- Key count matches expected count exactly
- No duplicate keys found
- Tree structure is valid (no cycles, correct links)
- All search operations on inserted keys return correct results

**4. Split and Merge Propagation Verification**

Create targeted tests for split and merge scenarios:

**Split Test:**
```go
// 1. Fill a leaf to MAX_KEYS
// 2. Spawn 5 concurrent writers, all trying to insert into that same leaf
// 3. Verify: Splits occur correctly (one or multiple if tree grows)
// 4. Verify: All keys are present after splits
// 5. Verify: Tree structure is valid (parent pointers correct)
```

**Merge Test:**
```go
// 1. Create tree with multiple leaves at MIN_KEYS
// 2. Spawn 5 concurrent deleters, all trying to delete from those leaves
// 3. Verify: Merges/redistributions occur correctly
// 4. Verify: All remaining keys are present after merges
// 5. Verify: Tree structure is valid (parent pointers correct, no orphaned nodes)
```

**Success Criteria:**

- Splits occur correctly (no lost keys)
- Merges/redistributions occur correctly (no lost keys, no orphaned nodes)
- Parent nodes are updated correctly for both splits and merges
- Multiple concurrent splits don't corrupt tree structure
- Multiple concurrent merges don't corrupt tree structure

**5. WAL Recovery Under Concurrency**

**Test Case: "PessimisticFallback_WALRecovery"**

```go
// 1. Run concurrent operations (mixed read/write/delete)
// 2. Simulate crash (close tree without flushing)
// 3. Reopen tree (triggers WAL recovery)
// 4. Verify: All committed operations are present
// 5. Verify: All committed deletes are reflected (keys are absent)
// 6. Verify: No uncommitted operations are visible
```

**Success Criteria:**

- WAL recovery restores correct tree state
- All committed inserts are present
- All committed deletes are reflected (deleted keys are absent)
- Tree structure is valid after recovery
- Key count matches expected count (inserts minus deletes)

**Phase 4 Exit Criteria:**

- 100% regression test pass rate
- Stress test passes (50 goroutines: 20 readers, 20 writers, 10 deleters)
- Tree integrity verified (key count, structure, no duplicates)
- Split propagation verified
- Merge/redistribution propagation verified
- WAL recovery works under concurrency (inserts and deletes)

**Implementation Complete.** System is now fully concurrent with correctness guarantees for Search, Insert, and Delete operations.

---

## Implementation Notes

### Lock Ordering Rule (Critical)

**Always acquire locks in root → leaf order. Always release in leaf → root order.**

This prevents deadlocks. If two threads both need to lock nodes A and B, and both acquire A before B, no deadlock can occur.

### WAL Integration (Critical)

**WAL writes must occur while holding exclusive latches:**

1. Acquire exclusive latch on leaf
2. Write to WAL (durability)
3. Modify page in memory
4. Release latch
5. Flush WAL asynchronously (optional optimization)

This ensures that if a crash occurs, WAL contains the modification before the page is visible to other threads.

### Performance Expectations

- **Phase 1:** Poor performance (all operations serialized)
- **Phase 2:** Good read performance, poor write performance (inserts and deletes serialized)
- **Phase 3:** Good performance for inserts/deletes into safe leaves, poor for splits/merges
- **Phase 4:** Good performance for all operations (reads, inserts, deletes), with some contention on root and nodes undergoing splits/merges

**Remember:** Correctness > Performance. Optimize only after correctness is proven.

### Delete Operation Considerations

Delete operations are more complex than inserts because they can trigger:
1. **Simple Delete:** Remove key from leaf (if leaf remains above MIN_KEYS)
2. **Redistribution:** Borrow keys from sibling (if sibling has extra keys)
3. **Merge:** Combine leaf with sibling (if both are at MIN_KEYS)

The pessimistic protocol must handle all three cases while maintaining lock ordering and WAL consistency.

---

## References

1. **MySQL InnoDB Source Code:** Implementation of latch crabbing in production database
   - [InnoDB B+ Tree Implementation](https://github.com/mysql/mysql-server/tree/8.0/storage/innobase/btr)

2. **CMU Database Course (15-445/645):** Excellent explanation of latch crabbing
   - [Index Concurrency Slides](https://15445.courses.cs.cmu.edu/fall2021/notes/09-indexconcurrency.pdf)
   - Focus on "Crabbing" and "Optimistic vs Pessimistic" sections

3. **Go sync Package Documentation:** Understanding RWMutex behavior
   - [sync.RWMutex](https://pkg.go.dev/sync#RWMutex)

4. **Database Internals (Alex Petrov):** Chapter on B-Tree concurrency
   - Comprehensive coverage of lock coupling and optimistic concurrency

---

## Document History

- **2026-01-27:** Initial ADR created. Decision: Latch Crabbing with Optimistic/Pessimistic Fallback. Phased implementation roadmap defined.
