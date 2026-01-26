# Concurrent Access in B+ Trees

This document outlines the concepts and theories behind adding concurrent access support to a B+ Tree. It includes a simplified guide for beginners followed by the technical details of the B-link tree variant.

---

## Part 1: The Beginner's Guide

If you are new to databases, **Concurrency Control** can sound scary. Let's break it down using detailed definitions and simple analogies.

### 1. The Core Problem: Shared Access
Imagine a B+ Tree is a **shared notebook** in a library used by hundreds of students (threads) at the same time.
*   **User A** wants to read Page 5 to find a phone number.
*   **User B** wants to write on Page 5 to add a new phone number.

If they do this at the exact same time without coordination:
*   **User A** might read a sentence that **User B** is only half-way through writing (e.g., seeing "555-12..." instead of "555-1234").
*   **Result:** The data read is "garbage" or incorrect.

**Solution: Concurrency Control**
A systematic way to manage simultaneous operations so that they don't conflict or corrupt the data. It ensures **consistency** (everyone sees correct data) and **integrity** (the notebook doesn't fall apart).

### 2. The Tools: Locks vs. Latches
In database engineering, we distinguish between two types of "protection".

#### 2.1. Locks (Logical Protection)
*   **Definition:** A mechanism to protect *database contents* (logical data like a "User Record" or "Bank Account") from other *transactions*.
*   **Scope:** Held for the entire duration of a transaction (e.g., "Transfer Money").
*   **Behavior:** Supports deadlock detection and rollback.
*   **Analogy:** Checking a book out of the library for a week. You own that title for the duration.

#### 2.2. Latches (Physical Protection)
*   **Definition:** A lightweight synchronization primitive used to protect *internal memory structures* (like a specific byte array functioning as a Page) from concurrent threads.
*   **Scope:** Held only for the split-second duration of an operation (e.g., "Read this specific RAM address").
*   **Behavior:** No deadlock detection (the programmer must ensure it doesn't happen). Extremely fast (uses CPU atomic instructions).
*   **Types:**
    *   **Read Latch (Shared):** Multiple people can read at the same time. "I am reading, please don't change anything."
    *   **Write Latch (Exclusive):** Only one person can hold this. "I am changing this, nobody else look!"

**We are implementing LATCHeS.** We want to protect the physical pages so the tree pointers don't point to nowhere.

### 3. Real-World Examples
Before we commit to this path, it's good to know we aren't reinventing the wheel. Major databases use these exact techniques:

*   **PostgreSQL:** Uses the **B-Link Tree** (the exact technique we are proposing!).
    *   It implements the *Lehman & Yao* algorithm (using High Keys + Right Links) to allow massive concurrency.
    *   It adds extra features like "Vacuum" for cleaning up deleted pages.

*   **MySQL (InnoDB):** Uses **Latch Crabbing** (optimistic & pessimistic approaches) on standard B+ Trees.
    *   It tries to be "Optimistic" (assume no splits) using cheap shared latches.
    *   If a split is needed, it restarts the operation with "Pessimistic" latching (exclusive latches) to safely split nodes.

**Decision:** We are choosing the **B-Link Tree (PostgreSQL style)** because:
1.  It is simpler to implement than InnoDB's complex optimistic/pessimistic restarting logic.
2.  It inherently prevents the "Root Bottleneck" issue better than standard latch crabbing.

### 4. The "Crabbing" Technique (Standard Approach)
How do we move through the tree safely without B-link pointers?

*   **Term: Lock Coupling (Crabbing)**
    *   *Definition:* A protocol where a thread must acquire a latch on the *child* node before releasing the latch on the *parent* node.
*   **Analogy:** **Monkey Bars**.
    *   To move safely on monkey bars, you grab the **next** bar before you let go of the **current** bar. You are never floating in mid-air.
*   **Process:**
    1.  Lock Parent.
    2.  Lock Child.
    3.  Check if Parent is "Safe" (won't split). If yes, Unlock Parent.
    4.  Repeat.
*   **Weakness:** Everyone has to use the first Monkey Bar (the Root). It becomes a massive bottleneck where everyone waits.

### 5. The B-link Tree (Our Approach)
The B-link tree is a variant of B-Tree designed by Lehman and Yao (1981) to solve the bottleneck problem.

**The Scenario:**
Imagine Page 10 is full: `[Apple, Banana, ... Grape]`.
You want to insert "Mango". The page is full, so you have to split it.

**Standard B+ Tree Way:**
1.  Lock the Parent (Table of Contents).
2.  Split Page 10 into Page 10 and Page 11.
3.  Update Parent to say "Page 11 starts with Mango".
4.  *Problem:* Locking the Parent stops *everyone else* from using that part of the tree.

**The B-link Way ("The Sticky Note" - Atomic Split):**
1.  **Phase 1 (Local Split):** Don't touch the Parent yet.
2.  Split Page 10. Move half the items to new Page 11.
3.  **Phase 2 (The Link):** On Page 10, add a pointer (Right Link) that says **"-> Continued on Page 11"**.
4.  Now, unlock Page 10 immediately.
5.  **Result:** Other readers can see Page 10. If they look for "Mango" (which is now on Page 11), they see "Grape" is the last word on Page 10, but they see the Right Link **"-> Page 11"**, so they hop over.
6.  **Phase 3 (Propagate):** Later, we update the Parent.

**Why is this better?**
You avoided locking the Parent during the critical split moment. The "Right Pointers" act as a safety net for readers who arrive "too early" (before the parent was updated).

---

## Part 2: Technical Concepts & Theory

Now that you understand the "Why", here is the detailed technical "How".

### 1. Detailed Definitions

#### 1.1. Read-Write Mutex (RWMutex)
*   **Definition:** A synchronization primitive that allows simultaneous access for readers (Shared) but exclusive access for a writer.
*   **Go Implementation:** `sync.RWMutex`.
    *   `RLock()`: Locks for reading.
    *   `Lock()`: Locks for writing (blocks all readers and other writers).

#### 1.2. Right Link (`P_next`)
*   **Definition:** A pointer (Page ID) stored in the header of every page (Internal and Leaf).
*   **Function:** It points to the immediate **right sibling** of the current node at the same level.
*   **Role:** It transforms the tree levels into singly-linked lists. This allows horizontal traversal when a key is not found in the expected range.

#### 1.3. High Key (`HK`)
*   **Definition:** Also known as the "Fence Key". It represents the **strict upper bound** of keys that this specific node instance is responsible for.
*   **Role:** It acts as a traffic sign.
    *   *Rule:* If `SearchKey > HighKey`, the key you are looking for is **NOT** in this node's children. It has moved to the sibling. You **MUST** follow the Right Link.
    *   *Example:* Node A has keys `[10, 20]`. Current High Key is `20`. If you search for `25`, you see `25 > 20`, so you traverse Right instead of Down.

### 2. Operation Algorithms

#### 2.1. Search (The "Move Right" Logic)
This is the heart of B-link concurrency. It handles the case where a reader lands on a node that was *just* split by a writer.

**Algorithm:**
1.  **Acquire Read Latch** on current node `N`.
2.  **Check Condition:** Is `TargetKey > N.HighKey`?
3.  **Branch:**
    *   **YES (Miss):** The node has split! The key is on the neighbor.
        *   Release Read Latch on `N`.
        *   New Current Node = `N.RightLink`.
        *   **Loop:** Go back to Step 1 with the new node.
    *   **NO (Hit):** The key covers the range we want.
        *   Perform standard binary search on `N`.
        *   Result found (or proceed to child).

```text
       [ 5 | 10 ] --(Right Link)--> [ 15 | 20 ]
          ^
     User wants '17'.
     1. Lands on Node [5|10].
     2. Checks HighKey (10).
     3. 17 > 10? YES.
     4. Use Right Link.
     5. Lands on Node [15|20]. Valid range. Found!
```

#### 2.2. Atomic Split
How to split without locking the parent immediately (Lehman & Yao Protocol):

**Algorithm:**
1.  **Acquire Write Latch** on Node `A`. (Node `A` is full).
2.  **Allocate** new Node `B` (in memory, private to thread).
3.  **Siphon Data:** Move upper half of `A`'s keys/values to `B`.
4.  **Connect Sibling:**
    *   `B.RightLink` = `A.RightLink` (Preserve the old chain).
    *   `B.HighKey` = `A.HighKey` (Inherit the old boundary).
    *   `A.HighKey` = `Last Key in A` (Shrink A's responsibility).
5.  **Link (The Atomic Step):**
    *   `A.RightLink` = `B.PageID`.
    *   *Consistency:* At this exact moment, `A -> B` exists. The Structure is valid.
6.  **Release Write Latch** on `A`.
    *   *Note:* The Parent still thinks `A` holds everything. That's okay! Readers will hit `A`, see `Key > HighKey`, and follow the link to `B`.
7.  **Propagate:** (Separately) Insert a pointer to `B` into the Parent node.

### 3. Implementation Roadmap for MiniDB

This roadmap is designed to prevent regressions and ensure correctness at every step.

#### Phase 1: Infrastructure & Latching (The Foundation)
*   **Goal:** Enable thread-safety for individual pages.
*   **Step 1.1:** Add `sync.RWMutex` to the `Page` struct (or a wrapper struct in PageManager).
*   **Step 1.2:** Update `PageManager.Get()` to return an interface that supports locking.
*   **Test 1:** Create a unit test spawning 100 threads reading/writing to the *same* page in memory. Verify no race conditions (use `go test -race`).

#### Phase 2: Schema Evolution (Data Structure)
*   **Goal:** Add B-Link fields to the on-disk format.
*   **Step 2.1:** Modify `PageHeader` struct to add `RightPageID` (uint64) and `HighKey` (variable length bytes).
*   **Step 2.2:** Update `Serialize()` and `Deserialize()` methods to handle these new fields.
*   **Verification:** Run existing tests. They should pass (backward compatibility or fresh DB).
*   **Key Point:** Ensure `HighKey` handles "Infinity" (empty or special flag) for the right-most node.

#### Phase 3: The "Move Right" Logic (Read Path)
*   **Goal:** Make readers smart enough to follow the link.
*   **Step 3.1:** Modify `findLeaf` traversal.
    *   *Add Logic:* After latching a node, compare `SearchKey` vs `node.HighKey`.
    *   *Loop:* If `SearchKey > HighKey`, release latch, grab `RightPageID`, and repeat.
*   **Step 3.2:** Modify `BinarySearch` inside the node to respect the fence key range.
*   **Test 3:** Manually construct a split scenario (Node A -> Node B) in a test, search for a key in B starting from A, and verify it hops correctly.

#### Phase 4: Atomic Split (Write Path)
*   **Goal:** Implement the Lehman & Yao split protocol.
*   **Step 4.1:** Rewrite the `Insert` split logic.
    *   Stop locking the parent first.
    *   Lock leaf, split, link (A->B), unlock leaf.
*   **Step 4.2:** Implement "Parent Fix-up". After releasing the leaf lock, acquire parent lock and insert the pointer to B.
*   **Test 4:** Concurrent Insert Benchmark.
    *   Run multiple writers inserting sequential and random keys.
    *   Verify the tree structure integrity (all links valid, count matches).

#### Phase 5: Verification & Stress Testing
*   **Goal:** Prove it works under fire.
*   **Step 5.1:** Run standard `go test -race ./...`.
*   **Step 5.2:** Create a "Torture Test":
    *   Start 10 reader threads (looping random searches).
    *   Start 2 writer threads (looping random inserts).
    *   Run for 60 seconds.
    *   Assert: 0 crashes, 0 "Key Not Found" errors for known existing keys.

---

## References (Verified)

1.  **Original Paper (The Source of Truth):**
    *   Lehman, P. L., & Yao, S. B. (1981). *Efficient Locking for Concurrent Operations on B-Trees*.
    *   [Link to PDF (CMU)](https://15721.courses.cs.cmu.edu/spring2017/papers/06-indexing-concurrency/p650-lehman.pdf)
    *   *Reading Advice:* Read "Section 3: The B-link Tree" for the specific diagrams.

2.  **CMU Database Course (Excellent Explanations):**
    *   Carnegie Mellon University - 15-445/645.
    *   [Slides on Index Concurrency](https://15445.courses.cs.cmu.edu/fall2021/notes/09-indexconcurrency.pdf)
    *   *Advice:* Look for slides titled "Crabbing" and "B-link Trees".

3.  **Modern B-Tree Techniques (Start here for advanced):**
    *   Goetz Graefe Survey. / [Link](https://w6113.github.io/files/papers/btreesurvey-graefe.pdf)

4.  **PostgreSQL Implementation**
    *   PostgreSQL uses the Lehman & Yao algorithm (B-Link Tree).
    *   [Source Code Documentation (nbtree)](https://github.com/postgres/postgres/tree/master/src/backend/access/nbtree) - "This directory contains an implementation of the Lehman and Yao high-concurrency B-tree management algorithm."
