# MiniDB Architecture

This document provides a visual overview of the MiniDB architecture, illustrating the core components, data structures, concurrency model, and transaction flow.

## 1. High-Level System Architecture

MiniDB follows a layered architecture where the **B+Tree Engine** orchestrates operations between the high-level API and the low-level storage subsystems.

```mermaid
graph TD
    User["User / API Client"]
    
    subgraph "MiniDB Engine"
        API["Public API (KV Store)"]
        
        subgraph "Core Logic"
            BTree["B+Tree Manager"]
            TxMgr["Transaction Manager"]
        end
        
        subgraph "Storage & Caching"
            Pager["Pager (Buffer Pool)"]
            Cache["LRU Cache"]
            WAL["Write-Ahead Log (WAL)"]
        end
        
        subgraph "File System"
            DBFile[("DB File (.db)")]
            WALFile[("WAL File (.wal)")]
        end
    end

    User -->|Get/Set/Del| API
    API -->|Begin/Commit| TxMgr
    API -->|CRUD Ops| BTree
    
    BTree -->|Read/Write Pages| Pager
    BTree -->|Acquire Locks| TxMgr
    
    TxMgr -->|Log Tx| WAL
    TxMgr -->|Track Modified Pages| BTree
    
    Pager -->|Check Cache| Cache
    Pager -->|Read/Write| DBFile
    WAL -->|Append Logs| WALFile
```

---

## 2. B+Tree & Data Structure Layout

MiniDB uses a page-based B+Tree structure. Every node is a 4KB page.

```mermaid
classDiagram
    class Page {
        +PageID uint32
        +PageType uint8
        +Dirty bool
        +Data []byte
    }

    class PageHeader {
        +PageType (Meta/Internal/Leaf)
        +NumCells uint16
        +FreeOffset uint16
        +RightPageID uint32 (Sibling)
    }

    class InternalNode {
        +Keys []CompositeKey
        +Children []PageID
    }

    class LeafNode {
        +Cells []Record
        +NextLeaf PageID
    }

    class Record {
        +Key CompositeKey
        +Value RowData
        +SchemaVersion
    }

    Page *-- PageHeader
    Page <|-- InternalNode
    Page <|-- LeafNode
    LeafNode *-- Record
    
    note for Page "Size: 4096 Bytes"
    note for InternalNode "Routing Only"
    note for LeafNode "Stores Actual Data"
```

---

## 3. Concurrency Model (Phase 3.5)

The current concurrency model allows multiple concurrent readers but prioritizes correctness by serializing writers.

```mermaid
graph TD
    subgraph "Traffic"
        R1[Reader 1]
        R2[Reader 2]
        R3[Reader 3]
        W1[Writer 1]
        W2[Writer 2]
    end

    subgraph "Synchronization Layer"
        RLock["Global Read Lock (RLock)"]
        WLock["Global Write Lock (Lock)"]
    end

    subgraph "Execution"
        Engine["B+Tree Engine"]
    end

    R1 --> RLock
    R2 --> RLock
    R3 --> RLock
    
    W1 --> WLock
    W2 --> WLock
    
    RLock -.->|Concurrent Access| Engine
    WLock -->|Serialized Access| Engine
    
    note right of RLock: Non-Blocking for Readers
    note right of WLock: Blocking (1 Writer at a time)
```

**Locking Strategy:**
- **Readers**: Acquire `tree.mu.RLock()`.
- **Writers**: Acquire `tree.mu.Lock()`.
- **Transactions**: `TxManager` protects its internal state with fine-grained mutexes (`tm.mu`).

---

## 4. Transaction & WAL Lifecycle

Ensures ACID properties and crash safety.

```mermaid
sequenceDiagram
    participant App
    participant Engine
    participant TxMgr as TransactionMgr
    participant WAL
    participant Disk

    App->>Engine: Insert(Key, Value)
    Engine->>TxMgr: Begin Auto-Commit Tx
    TxMgr->>TxMgr: Create ActiveTx
    
    rect rgb(240, 248, 255)
        note right of Engine: Execution Phase
        Engine->>Engine: Modify Page (In-Memory)
        Engine->>TxMgr: TrackModified(PageID)
    end
    
    rect rgb(255, 240, 240)
        note right of Engine: Commit Phase (Durability)
        Engine->>TxMgr: Commit()
        TxMgr->>WAL: Write Log Entry (Insert)
        WAL->>Disk: fsync() (WAL File)
        TxMgr->>TxMgr: Mark Comitted
    end
    
    TxMgr-->>Engine: Success
    Engine-->>App: OK
    
    note over Engine, Disk: Checkpoint / Flush happens asynchronously later
```

---

## 5. Core Operations Flow

Common logic for standard B+Tree operations.

```mermaid
flowchart TD
    Start([Start Operation]) --> CheckOp{Operation Type?}
    
    CheckOp -->|Search| SearchFlow
    CheckOp -->|Insert| WriteFlow
    CheckOp -->|Delete| WriteFlow
    
    subgraph SearchFlow [Read Path]
        AcquireRLock[Acquire global RLock]
        FindLeaf[Traverse to Leaf]
        BinarySearch[Binary Search in Leaf]
        ReturnResult[Return Value / Not Found]
        ReleaseRLock[Release RLock]
        
        AcquireRLock --> FindLeaf --> BinarySearch --> ReturnResult --> ReleaseRLock
    end
    
    subgraph WriteFlow [Write Path]
        AcquireLock[Acquire global Lock]
        StartTx[Start Transaction]
        FindLeafWrite[Traverse to Leaf]
        ExecuteOp[Insert / Delete]
        
        CheckSplit{Need Split/Merge?}
        
        SplitNode[Split Node & Propagate Up]
        MergeNode[Merge/Borrow Node]
        
        LogWAL[Write to WAL]
        Commit[Commit Transaction]
        ReleaseLock[Release Lock]
        
        AcquireLock --> StartTx --> FindLeafWrite --> ExecuteOp
        ExecuteOp --> CheckSplit
        CheckSplit -->|Yes| SplitNode
        CheckSplit -->|Yes| MergeNode
        CheckSplit -->|No| LogWAL
        SplitNode --> LogWAL
        MergeNode --> LogWAL
        LogWAL --> Commit --> ReleaseLock
    end
```
