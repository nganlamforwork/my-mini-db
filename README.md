# MiniDB — B+Tree (in-memory) Documentation

Date: 2025-12-21
Version: 0.1

## Overview

This repository contains a compact, educational B+Tree implementation focused on in-memory logic with optional page serialization APIs. The implementation emphasizes correctness of insertions, node splits, parent/child relationships, and basic per-page space accounting. Durability (WAL and on-disk pager) is intentionally out-of-scope for this version; serialization routines write to in-memory buffers for testing and future persistence extensions.

Key goals for this version:

- Clear, testable in-memory B+Tree operations (insert, split, traversal).
- Stable serialization APIs for pages (`WriteToBuffer` / `ReadFromBuffer`).
- Page header metadata including `KeyCount`, `FreeSpace`, `ParentPage`, and sibling links for leaves.

## Important files

- `page_header.go` — `PageHeader` type and header serialization.
- `meta_page.go` — `MetaPage` and global metadata serialization.
- `node.go` — type definitions for `InternalPage`, `LeafPage`, and constructors.
- `internal_page.go` — internal node helpers, split logic, and serialization.
- `leaf_page.go` — leaf helpers, split logic, payload accounting, and serialization.
- `page_manager.go` — in-memory `PageManager` allocator used by tests.
- `tree.go` — `BPlusTree` high-level operations (find, insert, root management).
- `tree_test.go` — comprehensive tests for insert and invariant checks.

## Key constants and types

- `ORDER` — B+Tree order (max children per internal node). Current repo: `ORDER = 4`.
- `KeyType` — integer type used for keys. Serialization uses 8-byte int (int64) representation.
- `ValueType` — alias for string values. Values are serialized as length-prefixed byte arrays.
- `DefaultPageSize` — 4096 bytes. Used for computing `FreeSpace` on pages.
- `PageHeaderSize` — fixed header size (56 bytes) used to compute available payload per page.

## Page layout & serialization

All pages begin with a `PageHeader` written in a stable, big-endian order. Consumers MUST decode fields in the same order. The header fields include page id, parent id, sibling links, page type, `KeyCount`, `FreeSpace`, and `LSN`.

Payload formats:

- `MetaPage`: header + `RootPage (uint64)` + `PageSize (uint32)` + `Order (uint16)` + `Version (uint16)`.
- `InternalPage`: header + keys (each int64) + children (each uint64). The number of keys equals `Header.KeyCount`; number of children equals `Header.KeyCount + 1`.
- `LeafPage`: header + keys (each int64) + values (for each value: `uint32` length followed by raw bytes). The number of keys equals `Header.KeyCount`.

APIs implemented for serialization:

- `WriteToBuffer(buf *bytes.Buffer)` and `ReadFromBuffer(buf *bytes.Reader)` for `PageHeader`, `MetaPage`, `InternalPage`, and `LeafPage`.

## In-memory structures & invariants

InternalPage:

- `Header PageHeader`
- `keys []KeyType`
- `children []uint64` (child page IDs)
- Invariant: `len(children) == len(keys) + 1`.

LeafPage:

- `Header PageHeader`
- `keys []KeyType`
- `values []ValueType`
- Invariant: `len(keys) == len(values) == Header.KeyCount`.

Header invariants:

- `Header.KeyCount` must always match the actual number of keys.
- `Header.FreeSpace` is kept as `DefaultPageSize - PageHeaderSize - usedPayloadBytes` (uint16). For internal pages used bytes are estimated as `8*len(keys) + 8*len(children)`; for leaves the exact payload is `8*len(keys) + sum(4 + len(value))`.

## Insert algorithm (detailed flow)

1. If the tree is empty (`rootPageID == 0`), allocate a new leaf via `PageManager.NewLeaf()`, insert the key/value, set `Header.KeyCount`, and set `tree.rootPageID`.
2. Locate the target leaf using `findLeaf(key)`:
   - Traverse from root.
   - In each `InternalPage`, perform a binary search to find the last key `<= searchKey`. Follow `children[pos+1]` (or `children[0]` if all keys are greater).
   - Record the path of internal page IDs for later upward propagation.
3. Check for duplicate keys in the leaf (reject duplicates).
4. Call `insertIntoLeaf(page, key, value)`:
   - Insert the key/value in sorted order (slice insert).
   - Update `Header.KeyCount`.
   - Recompute `Header.FreeSpace` using `computeLeafPayloadSize`.
   - If the single `value` size exceeds page payload capacity, return an error (this version does not store out-of-line values).
5. Determine overflow:
   - If `len(keys) > MAX_KEYS` (ORDER - 1) OR payload usage > payload capacity, split the leaf using `splitLeaf(left, newRight)`.
6. `splitLeaf(left, right)`:
   - Compute midpoint; move right-half keys and values into `newRight`.
   - Update sibling links (`NextPage`/`PrevPage`).
   - Set `Header.KeyCount` and recompute `Header.FreeSpace` for both pages.
   - Return the separator key (first key of the right page) to be inserted into parent.
7. Propagate split upward using the recorded path:
   - For each parent ID from the bottom of the path, call `insertIntoInternal(parent, separatorKey, newChildPageID)`.
   - If the parent overflows (>= ORDER keys), call `splitInternal(parent, newParentRight, pm)`.
8. `splitInternal(page, newPage, pm)`:
   - Choose mid index and promote `midKey`.
   - Move keys and corresponding children (mid+1 onward) to `newPage`.
   - Truncate left page to left half.
   - Update `Header.KeyCount` on both pages.
   - For each moved `childID`, use `pm.Get(childID)` and set child's `Header.ParentPage` = `newPage.Header.PageID`.
   - Recompute `Header.FreeSpace` for both internal pages.
   - Return `midKey` as the next separator to push upward.
9. If the root splits, create a new internal `newRoot` with two children (left & right) and set their `Header.ParentPage` fields. Update `tree.rootPageID`.

## Free-space tracking and large values

- This version computes per-page `FreeSpace` conservatively and enforces that single values cannot exceed page payload capacity. If large-value support is required, consider:
  - Storing large values out-of-line in a value log and storing references in leaves.
  - Implementing compression or fragmentation.

## Tests

- `tree_test.go` contains tests that verify:
  - Insertions without split keep the tree as a single leaf root.
  - Inserts that exceed capacity split leaves and propagate correctly to internal nodes.
  - Parent pointers (`Header.ParentPage`) are maintained for children.
  - `Header.KeyCount` and `Header.FreeSpace` are consistent with actual payload.
  - Multi-insert scenarios yield sorted leaf scans and maintain invariants.

## Reimplementation checklist (step-by-step)

1. Implement `PageHeader` with stable serialization.
2. Implement `MetaPage` and serialize metadata.
3. Define `InternalPage` and `LeafPage` with constructors that initialize `FreeSpace`.
4. Implement `PageManager` (in-memory map) with `NewLeaf`, `NewInternal`, and `Get`.
5. Implement `insertIntoLeaf` and `insertIntoInternal` helpers.
6. Implement `splitLeaf` and `splitInternal` — ensure moved children's `ParentPage` are updated.
7. Implement `findLeaf` and `BPlusTree.Insert` using the flow above.
8. Add unit tests for structural invariants and serialization round-trip.

## Next steps / improvements

- Add a small WAL and persistence layer in `PageManager` to persist pages and restore state.
- Add support for out-of-line value storage (value log) to handle arbitrarily large values.
- Improve packing/compaction and precise byte offsets to get exact `FreeSpace` accounting and reduce fragmentation.
- Add concurrency controls (locks) for multi-threaded access.
- Add checksums/version tags to serialized pages for corruption detection.

---

This README documents the current repository state and provides enough detail for someone to reimplement the same flow and invariants. If you prefer a Jupyter notebook version with the same content split into explanatory cells, tell me and I will create it.
