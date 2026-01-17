# MiniDB API Documentation

The MiniDB API server provides a RESTful interface to interact with MiniDB instances and visualize B+Tree operations through step-based execution traces.

---

## Table of Contents

- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Data Types](#data-types)
- [Database Lifecycle APIs](#database-lifecycle-apis)
- [Data Operation APIs](#data-operation-apis)
- [Introspection APIs](#introspection-apis)
- [Step-Based Execution Traces](#step-based-execution-traces)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Getting Started

### Starting the API Server

Run the MiniDB API server:

```bash
go run cmd/minidb/main.go -server -addr :8080
```

Options:

- `-server`: Enable server mode
- `-addr`: Server address (default: `:8080`)

The server will start and listen on the specified address. All API endpoints are prefixed with `/api`.

**Note:** Database files (`.db` and `.wal`) are automatically stored in the `database/` folder relative to the backend directory. The folder is created automatically if it doesn't exist.

### Base URL

All API requests should be made to:

```
http://localhost:8080/api
```

---

## API Overview

The MiniDB API is organized into three categories:

1. **Database Lifecycle APIs**: Create, list, get, and drop databases
2. **Data Operation APIs**: Insert, update, delete, search, and range queries
3. **Introspection APIs**: Inspect tree structure, WAL, and cache statistics

All data operations return step-based execution traces for visualization.

---

## Data Types

### CompositeKey

A composite key is an ordered tuple of typed values.

**JSON Format:**

```json
{
  "values": [
    { "type": "int", "value": 42 },
    { "type": "string", "value": "hello" }
  ]
}
```

**Supported Types:**

- `"int"`: Integer (int64)
- `"string"`: String
- `"float"`: Float64
- `"bool"`: Boolean

**Example:**

```json
{
  "values": [{ "type": "int", "value": 10 }]
}
```

### Record

A record represents a database row with multiple columns.

**JSON Format:**

```json
{
  "columns": [
    { "type": "string", "value": "Alice" },
    { "type": "int", "value": 25 },
    { "type": "bool", "value": true }
  ]
}
```

**Example:**

```json
{
  "columns": [
    { "type": "string", "value": "Hello" },
    { "type": "int", "value": 42 }
  ]
}
```

---

## Database Lifecycle APIs

### Create Database

Create a new database instance.

**Endpoint:** `POST /api/databases`

**Request Body:**

```json
{
  "name": "mydb",
  "config": {
    "order": 4,
    "pageSize": 4096,
    "walEnabled": true,
    "cacheSize": 100
  }
}
```

**Configuration Options:**

- `order` (optional): B+Tree order (default: 4)
- `pageSize` (optional): Page size in bytes (default: 4096)
- `walEnabled` (optional): Enable WAL (default: true)
- `cacheSize` (optional): Cache size in pages (default: 100)

**Response:**

```json
{
  "success": true,
  "name": "mydb"
}
```

**Status Codes:**

- `201 Created`: Database created successfully
- `400 Bad Request`: Invalid request
- `500 Internal Server Error`: Creation failed

### List Databases

List all database instances.

**Endpoint:** `GET /api/databases`

**Response:**

```json
{
  "databases": ["mydb", "testdb", "exampledb"]
}
```

**Status Codes:**

- `200 OK`: Success

### Get Database Info

Get information about a specific database.

**Endpoint:** `GET /api/databases/{name}`

**Response:**

```json
{
  "name": "mydb",
  "filename": "database/mydb.db",
  "order": 4,
  "pageSize": 4096,
  "walEnabled": true,
  "cacheSize": 100,
  "rootPage": 2,
  "height": 2
}
```

**Note:**

- Database files are stored in the `database/` folder relative to the backend directory
- The filename field shows the relative path to the database file

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

### Connect Database

Connect to an existing database instance (loads from disk). This will read the database file and load pages into memory. All disk I/O during loading is tracked.

**Endpoint:** `POST /api/databases/connect`

**Request Body:**

```json
{
  "name": "mydb",
  "config": {
    "cacheSize": 100
  }
}
```

**Response:**

```json
{
  "success": true,
  "name": "mydb",
  "message": "Database connected and loaded from disk"
}
```

**Status Codes:**

- `200 OK`: Database connected successfully
- `400 Bad Request`: Invalid request
- `404 Not Found`: Database file not found
- `500 Internal Server Error`: Connection failed

**Note:**

- This endpoint opens an existing database file (does not create a new one)
- Disk I/O during database loading (meta page and other pages) is tracked and visible via the I/O statistics endpoint
- The database remains connected until you explicitly close or drop it
- Use this endpoint to resume work with a previously created database

### Close Database

Close a database connection (keeps data on disk, can be reconnected later).

**Endpoint:** `POST /api/databases/{name}/close`

**Response:**

```json
{
  "success": true,
  "message": "Database closed (data remains on disk)"
}
```

**Status Codes:**

- `200 OK`: Database closed successfully
- `404 Not Found`: Database not found
- `500 Internal Server Error`: Close failed

**Note:**

- This closes the database connection but does NOT delete the database file
- The database can be reconnected later using the Connect Database endpoint
- Use this to free up memory while keeping the database file intact

### Drop Database

Remove and close a database instance (deletes from active connections but does NOT delete the file).

**Endpoint:** `POST /api/databases/{name}/close`

**Response:**

```json
{
  "success": true,
  "message": "Database closed (data remains on disk)"
}
```

**Status Codes:**

- `200 OK`: Database dropped successfully
- `404 Not Found`: Database not found

**Note:**

- This removes the database from active connections
- The database file remains on disk and can be reconnected later
- This is the same as the Close Database endpoint

### Delete Database

Permanently delete a database instance and its files from disk.

**Endpoint:** `DELETE /api/databases/{name}`

**Response:**

```json
{
  "success": true,
  "message": "Database 'mydb' and its files deleted"
}
```

**Status Codes:**

- `200 OK`: Database deleted successfully
- `500 Internal Server Error`: Deletion failed

**Note:**

- This permanently deletes the database `.db` and `.wal` files from the `database/` folder
- The database is automatically closed if it's currently open
- This operation cannot be undone

### Delete All Databases

Permanently delete all database instances and their files from disk.

**Endpoint:** `DELETE /api/databases`

**Response:**

```json
{
  "success": true,
  "message": "All databases and their files deleted"
}
```

**Status Codes:**

- `200 OK`: All databases deleted successfully
- `500 Internal Server Error`: Deletion failed

**Note:**

- This permanently deletes all `.db` and `.wal` files from the `database/` folder
- All open databases are automatically closed
- This operation cannot be undone
- Use with caution!

---

## Data Operation APIs

All data operations return step-based execution traces. See [Step-Based Execution Traces](#step-based-execution-traces) for details.

### Insert

Insert a key-value pair into the database.

**Endpoint:** `POST /api/databases/{name}/insert`

**Request Body:**

```json
{
  "key": {
    "values": [{ "type": "int", "value": 42 }]
  },
  "value": {
    "columns": [{ "type": "string", "value": "Hello, World!" }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "operation": "INSERT",
  "key": {
    "values": [
      {"type": "int", "value": 42}
    ]
  },
  "steps": [
    {
      "type": "TRAVERSE_NODE",
      "nodeId": "page-2",
      "keys": [...],
      "highlightKey": {"values": [{"type": "int", "value": 42}]}
    },
    {
      "type": "INSERT_KEY",
      "nodeId": "page-5",
      "key": {"values": [{"type": "int", "value": 42}]}
    }
  ]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request or duplicate key
- `404 Not Found`: Database not found

### Update

Update the value associated with a key.

**Endpoint:** `POST /api/databases/{name}/update`

**Request Body:**

```json
{
  "key": {
    "values": [{ "type": "int", "value": 42 }]
  },
  "value": {
    "columns": [{ "type": "string", "value": "Updated Value" }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "operation": "UPDATE",
  "key": {...},
  "steps": [...]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request
- `404 Not Found`: Database or key not found

### Delete

Delete a key-value pair from the database.

**Endpoint:** `POST /api/databases/{name}/delete`

**Request Body:**

```json
{
  "key": {
    "values": [{ "type": "int", "value": 42 }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "operation": "DELETE",
  "key": {...},
  "steps": [...]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request
- `404 Not Found`: Database or key not found

### Search

Search for a key and return its associated value.

**Endpoint:** `POST /api/databases/{name}/search`

**Request Body:**

```json
{
  "key": {
    "values": [{ "type": "int", "value": 42 }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "operation": "SEARCH",
  "key": {...},
  "value": {
    "columns": [
      {"type": "string", "value": "Hello, World!"}
    ]
  },
  "steps": [...]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request
- `404 Not Found`: Database or key not found

### Range Query

Query all key-value pairs within a range.

**Endpoint:** `POST /api/databases/{name}/range`

**Request Body:**

```json
{
  "startKey": {
    "values": [{ "type": "int", "value": 10 }]
  },
  "endKey": {
    "values": [{ "type": "int", "value": 50 }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "operation": "RANGE_QUERY",
  "keys": [
    {"values": [{"type": "int", "value": 10}]},
    {"values": [{"type": "int", "value": 20}]},
    ...
  ],
  "values": [
    {"columns": [...]},
    {"columns": [...]},
    ...
  ],
  "steps": [...]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request (e.g., startKey > endKey)
- `404 Not Found`: Database not found

---

## Introspection APIs

### Get Tree Structure

Get the full B+Tree structure for visualization.

**Endpoint:** `GET /api/databases/{name}/tree`

**Response:**

```json
{
  "rootPage": 2,
  "height": 3,
  "nodes": {
    "2": {
      "pageId": 2,
      "type": "internal",
      "keys": [
        {"values": [{"type": "int", "value": 30}]}
      ],
      "children": [3, 4]
    },
    "3": {
      "pageId": 3,
      "type": "leaf",
      "keys": [
        {"values": [{"type": "int", "value": 10}]},
        {"values": [{"type": "int", "value": 20}]}
      ],
      "values": [
        {"columns": [...]},
        {"columns": [...]}
      ],
      "nextPage": 4,
      "prevPage": 0
    },
    "4": {
      "pageId": 4,
      "type": "leaf",
      "keys": [...],
      "values": [...],
      "nextPage": 0,
      "prevPage": 3
    }
  }
}
```

**Node Types:**

- `"internal"`: Internal node (contains keys and child pointers)
- `"leaf"`: Leaf node (contains keys and values)

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

### Get WAL Info

Get Write-Ahead Log information.

**Endpoint:** `GET /api/databases/{name}/wal`

**Response:**

```json
{
  "nextLSN": 1024,
  "entries": [],
  "checkpoint": null
}
```

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

**Note:** WAL introspection is simplified in the current implementation. Full WAL entry reading requires direct file access.

### Get Cache Statistics

Get buffer pool/cache statistics.

**Endpoint:** `GET /api/databases/{name}/cache`

**Response:**

```json
{
  "size": 45,
  "maxSize": 100,
  "hits": 1234,
  "misses": 56,
  "evictions": 12
}
```

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

**Statistics:**

- `size`: Current number of pages in cache
- `maxSize`: Maximum cache size
- `hits`: Number of cache hits
- `misses`: Number of cache misses
- `evictions`: Number of pages evicted

### Get Cached Pages

Get a list of all page IDs currently in the cache.

**Endpoint:** `GET /api/databases/{name}/cache/pages`

**Response:**

```json
{
  "pageIds": [1, 2, 3, 5, 8, 13],
  "count": 6
}
```

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

**Fields:**

- `pageIds`: Array of page IDs currently cached in memory (ordered as stored in cache)
- `count`: Number of pages currently in cache

**Example Use Case:**
This endpoint is useful for debugging and visualization to see which pages are currently loaded in memory. It can help understand cache behavior and identify which pages are being accessed frequently.

**Example Request:**

```bash
curl http://localhost:8080/api/databases/mydb/cache/pages
```

### Get I/O Read Statistics

Get statistics and details of all I/O read operations (disk reads when cache misses occur).

**Endpoint:** `GET /api/databases/{name}/io`

**Response:**

```json
{
  "totalReads": 42,
  "details": [
    {
      "pageId": 3,
      "pageType": "leaf",
      "timestamp": "2024-01-17T20:30:45.123Z"
    },
    {
      "pageId": 2,
      "pageType": "internal",
      "timestamp": "2024-01-17T20:30:45.234Z"
    }
  ]
}
```

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

**Fields:**

- `totalReads`: Total number of I/O reads (cache misses) since database creation
- `details`: Array of I/O read entries (up to last 1000 entries), each containing:
  - `pageId`: Page ID that was read from disk
  - `pageType`: Type of page ("meta", "internal", or "leaf")
  - `timestamp`: When the read occurred (ISO 8601 format)

**Example Use Case:**
This endpoint is essential for understanding the performance benefits of the B+Tree cache. Compare `totalReads` with cache hits to see how effectively the cache is reducing disk I/O. A well-tuned cache should have many more cache hits than I/O reads.

**Performance Insight:**

- **Cache Hit**: Page loaded from memory (no I/O) - fast ⚡
- **Cache Miss (I/O Read)**: Page loaded from disk (I/O operation) - slower 🐌
- **Ratio**: `cache_hits / (cache_hits + io_reads)` indicates cache effectiveness

**Example Request:**

```bash
curl http://localhost:8080/api/databases/mydb/io
```

**Note:** The details array is limited to the last 1000 I/O reads to prevent unbounded memory growth. The `totalReads` counter is not limited and tracks all I/O operations since database creation.

---

## Step-Based Execution Traces

All data operations return a `steps` array containing execution traces. Each step represents a discrete operation during tree traversal and modification.

### Step Types

| Step Type           | Description                                 |
| ------------------- | ------------------------------------------- |
| `TRAVERSE_NODE`     | Traversing through an internal or leaf node |
| `INSERT_KEY`        | Inserting a key into a node                 |
| `UPDATE_KEY`        | Updating a key-value pair                   |
| `DELETE_KEY`        | Deleting a key from a node                  |
| `SPLIT_NODE`        | Splitting a node due to overflow            |
| `MERGE_NODE`        | Merging nodes due to underflow              |
| `BORROW_FROM_LEFT`  | Borrowing a key from left sibling           |
| `BORROW_FROM_RIGHT` | Borrowing a key from right sibling          |
| `WAL_APPEND`        | Appending to Write-Ahead Log                |
| `BUFFER_FLUSH`      | Flushing a page to disk                     |
| `SEARCH_FOUND`      | Key found during search                     |
| `SEARCH_NOT_FOUND`  | Key not found during search                 |

### Step Structure

```json
{
  "type": "TRAVERSE_NODE",
  "nodeId": "page-3",
  "keys": [
    { "values": [{ "type": "int", "value": 10 }] },
    { "values": [{ "type": "int", "value": 20 }] }
  ],
  "children": [5, 6, 7],
  "highlightKey": { "values": [{ "type": "int", "value": 15 }] }
}
```

**Common Fields:**

- `type`: Step type (required)
- `nodeId`: Page identifier (e.g., "page-3")
- `keys`: Array of keys in the node (for internal/leaf nodes)
- `children`: Array of child page IDs (for internal nodes)
- `highlightKey`: Key being searched/operated on (for visualization)

**Step-Specific Fields:**

- `originalNode`, `newNode`, `separatorKey`: For split/merge operations
- `lsn`: Log sequence number for WAL operations
- `pageId`: Page identifier for buffer operations
- `key`, `value`: For insert/update/delete operations

### Example: Insert Operation Steps

```json
{
  "success": true,
  "operation": "INSERT",
  "key": {...},
  "steps": [
    {
      "type": "TRAVERSE_NODE",
      "nodeId": "page-2",
      "keys": [{"values": [{"type": "int", "value": 30}]}],
      "children": [3, 4],
      "highlightKey": {"values": [{"type": "int", "value": 42}]}
    },
    {
      "type": "TRAVERSE_NODE",
      "nodeId": "page-4",
      "keys": [
        {"values": [{"type": "int", "value": 35}]},
        {"values": [{"type": "int", "value": 40}]}
      ],
      "highlightKey": {"values": [{"type": "int", "value": 42}]}
    },
    {
      "type": "INSERT_KEY",
      "nodeId": "page-4",
      "key": {"values": [{"type": "int", "value": 42}]}
    }
  ]
}
```

---

## Error Handling

All API endpoints return JSON responses. Errors follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common Error Status Codes:**

- `400 Bad Request`: Invalid request format or parameters
- `404 Not Found`: Database or resource not found
- `500 Internal Server Error`: Server-side error

**Example Error Response:**

```json
{
  "success": false,
  "error": "duplicate key insertion: (42)"
}
```

---

## Examples

### Complete Workflow Example

**1. Create a database:**

```bash
curl -X POST http://localhost:8080/api/databases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example",
    "config": {
      "cacheSize": 100
    }
  }'
```

**2. Insert a key-value pair:**

```bash
curl -X POST http://localhost:8080/api/databases/example/insert \
  -H "Content-Type: application/json" \
  -d '{
    "key": {
      "values": [
        {"type": "int", "value": 10}
      ]
    },
    "value": {
      "columns": [
        {"type": "string", "value": "Ten"}
      ]
    }
  }'
```

**3. Search for the key:**

```bash
curl -X POST http://localhost:8080/api/databases/example/search \
  -H "Content-Type: application/json" \
  -d '{
    "key": {
      "values": [
        {"type": "int", "value": 10}
      ]
    }
  }'
```

**4. Get tree structure:**

```bash
curl http://localhost:8080/api/databases/example/tree
```

**5. Get cache statistics:**

```bash
curl http://localhost:8080/api/databases/example/cache
```

**6. Get list of cached pages:**

```bash
curl http://localhost:8080/api/databases/example/cache/pages
```

**7. Get I/O read statistics:**

```bash
curl http://localhost:8080/api/databases/example/io
```

**8. Close the database:**

```bash
curl -X POST http://localhost:8080/api/databases/example/close
```

**9. Reconnect the database:**

```bash
curl -X POST http://localhost:8080/api/databases/connect \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example",
    "config": {
      "cacheSize": 100
    }
  }'
```

### Using cURL with Pretty JSON

To format JSON output, pipe through `jq`:

```bash
curl http://localhost:8080/api/databases/example/tree | jq
```

### JavaScript/Fetch Example

```javascript
// Create database
const response = await fetch("http://localhost:8080/api/databases", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "mydb",
    config: { cacheSize: 100 },
  }),
});

// Insert data
const insertResponse = await fetch(
  "http://localhost:8080/api/databases/mydb/insert",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: {
        values: [{ type: "int", value: 42 }],
      },
      value: {
        columns: [{ type: "string", value: "Hello" }],
      },
    }),
  }
);

const result = await insertResponse.json();
console.log("Steps:", result.steps);
```

### Python Example

```python
import requests

# Create database
response = requests.post('http://localhost:8080/api/databases', json={
    'name': 'mydb',
    'config': {'cacheSize': 100}
})

# Insert data
response = requests.post('http://localhost:8080/api/databases/mydb/insert', json={
    'key': {
        'values': [{'type': 'int', 'value': 42}]
    },
    'value': {
        'columns': [{'type': 'string', 'value': 'Hello'}]
    }
})

result = response.json()
print('Steps:', result['steps'])
```

---

## Notes

1. **Determinism**: Step traces are deterministic for identical inputs. The same operation on the same tree state produces the same steps.

2. **Visualization**: Steps are designed for visualization. The `highlightKey` field indicates which key is being operated on during traversal.

3. **Core Independence**: The API layer is an adapter. The core B+Tree implementation works independently without the API.

4. **Concurrency**: The API server handles concurrent requests. Each database instance manages its own locking.

5. **Error Recovery**: If an operation fails, the `success` field is `false` and an `error` message is provided. The `steps` array may be incomplete for failed operations.

---

## Future Enhancements

- **Event Streaming**: SSE/WebSocket support for real-time step streaming
- **Transaction APIs**: Explicit transaction begin/commit/rollback endpoints
- **Enhanced WAL Introspection**: Full WAL entry reading and parsing
- **Query Planning**: Expose query planning information in steps
- **Performance Metrics**: Additional performance counters and timing information
