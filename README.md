# MiniDB - B+Tree Database with Composite Keys

A file-backed B+Tree database implementation in Go featuring **composite keys** and **structured row values**, supporting full CRUD operations with persistent storage.

## Features

### ✅ Composite Keys & Structured Records

- **Multi-column primary keys** - Support for composite keys like `(userID, timestamp)`
- **Typed columns** - Int64, String, Float64, Boolean
- **Variable-length serialization** - Efficient binary encoding
- **Type-safe comparisons** - Lexicographic ordering for composite keys

### ✅ Complete B+Tree Operations

- **Insert** - O(log n) with automatic node splitting
- **Search** - O(log n) point queries
- **Delete** - O(log n) with borrow/merge rebalancing
- **Update** - O(log n) smart in-place updates
- **Range Query** - O(log n + k) using leaf-level linked list

### ✅ Persistence & Reliability

- **Disk-backed storage** - 4KB page-based architecture
- **Load from disk** - Resume operations from saved state
- **Write-back caching** - In-memory pages with FlushAll()
- **Test coverage** - 18 comprehensive tests with 100% pass rate

## Quick Start

### Basic Usage (Single-Column)

```go
// Create database
pm := NewPageManagerWithFile("test.db", true)
defer pm.Close()

tree := &BPlusTree{
    pager: pm,
    meta:  pm.ReadMeta(),
}

// Insert data
tree.Insert(K(10), V("Hello"))
tree.Insert(K(20), V("World"))

// Search
value, err := tree.Search(K(10))
if err == nil {
    fmt.Println(VS(value)) // Output: Hello
}

// Range query
keys, values, err := tree.SearchRange(K(10), K(20))

// Update
tree.Update(K(10), V("Updated"))

// Delete
tree.Delete(K(10))
```

### Advanced Usage (Composite Keys)

```go
// Composite key: (userID, timestamp)
key := NewCompositeKey(
    NewInt(1001),       // userID
    NewInt(1704067200), // timestamp
)

// Structured row: (name, age, email, active)
row := NewRecord(
    NewString("John Doe"),
    NewInt(30),
    NewString("john@example.com"),
    NewBool(true),
)

// Insert
tree.Insert(key, row)

// Search
value, _ := tree.Search(key)
fmt.Println(value) // {John Doe, 30, john@example.com, true}
```

## Architecture

### Type System

```go
// Column types
TypeInt    = 0  // int64
TypeString = 1  // string
TypeFloat  = 2  // float64
TypeBool   = 3  // bool

// Composite key
type CompositeKey struct {
    Values []Column
}

// Record value
type Record struct {
    Columns []Column
}
```

### Page Structure

- **MetaPage** (Page 1): Root pointer, configuration
- **InternalPage**: Routing keys + child pointers
- **LeafPage**: Data keys + row values + sibling links

### Constants

- `ORDER = 4` - Maximum 4 children per internal node
- `MAX_KEYS = 3` - Maximum 3 keys per node
- `PageSize = 4096` bytes
- `PageHeader = 56` bytes

## Data Model Examples

### E-commerce Database

```go
// Product: (category, productID) -> (name, price, stock, active)
productKey := NewCompositeKey(
    NewString("electronics"),
    NewInt(12345),
)

productRecord := NewRecord(
    NewString("Laptop"),
    NewFloat(999.99),
    NewInt(50),
    NewBool(true),
)
```

### Time-Series Data

```go
// Sensor: (deviceID, timestamp) -> (temperature, humidity, battery)
sensorKey := NewCompositeKey(
    NewInt(sensor_001),
    NewInt(1704067200),
)

sensorData := NewRecord(
    NewFloat(23.5),  // temperature
    NewFloat(65.0),  // humidity
    NewFloat(87.5),  // battery %
)
```

## Helper Functions (for tests)

```go
K(val int64)         // Create single-column key
V(val string)        // Create single-column value
KI(key KeyType)      // Extract int from key
VS(val ValueType)    // Extract string from value
```

## Implementation Details

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for:

- Complete algorithm descriptions
- Page layouts and serialization formats
- B+Tree invariants
- Rebalancing strategies
- Performance characteristics

## Testing

```bash
# Run all tests
go test -v

# Run specific test
go test -v -run TestInsertWithSplit

# Check test output
cat testdata/TestInsertWithSplit.db.txt
```

All 18 tests pass covering:

- Insert (simple, split, complex)
- Load from disk
- Point queries
- Delete (simple, borrow, merge)
- Range queries (simple, edge cases, multi-page)
- Update (simple, non-existent, large value, multiple)

## Performance

| Operation   | Complexity | Notes                    |
| ----------- | ---------- | ------------------------ |
| Insert      | O(log n)   | May trigger splits       |
| Search      | O(log n)   | Single tree traversal    |
| Delete      | O(log n)   | May trigger borrow/merge |
| Update      | O(log n)   | In-place when possible   |
| Range Query | O(log n+k) | k = result count         |

## Project Structure

```
.
├── types.go           # CompositeKey and Record types
├── node.go            # Type aliases
├── tree.go            # B+Tree operations
├── leaf_page.go       # Leaf serialization
├── internal_page.go   # Internal node serialization
├── page_manager.go    # Disk I/O and caching
├── tree_test.go       # Test suite
├── example_types.go   # Usage examples
├── IMPLEMENTATION.md  # Technical documentation
└── testdata/          # Test outputs
```

## Next Steps

See IMPLEMENTATION.md "Next Steps" section for:

**High Priority:**

- Transaction support (Begin/Commit/Rollback)
- Concurrent access with locking

**Medium Priority:**

- Index statistics
- Bulk loading optimization
- Variable-length value optimization

**Low Priority:**

- Key compression
- Snapshot isolation
- Performance benchmarks

## License

Educational project - Free to use and modify.

## Author

Lam Le Vu Ngan  
Date: January 13, 2026
