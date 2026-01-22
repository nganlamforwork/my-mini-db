# MiniDB API Documentation

The MiniDB API server provides a RESTful interface to interact with MiniDB instances. B+Tree operations can optionally return step-based execution traces for visualization when `enable_steps=true`.

**Architecture:** MiniDB follows a standard RDBMS hierarchy: **1 Database contains N Tables**, and **1 Table contains 1 B+ Tree**. Databases are logical containers, while tables hold the actual data and B+ Trees.

---

## Table of Contents

- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Data Types](#data-types)
- [Database Lifecycle APIs](#database-lifecycle-apis)
- [Table Lifecycle APIs](#table-lifecycle-apis)
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

**Note:** Database files are organized in a directory structure: `database/{dbName}/`. Each table within a database has its own files:
- `{tableName}.db` - B+ Tree data file
- `{tableName}.wal` - Write-Ahead Log file
- `{tableName}.schema.json` - Schema definition file

The `database/` folder is created automatically if it doesn't exist.

### Base URL

All API requests should be made to:

```
http://localhost:8080/api
```

---

## API Overview

**Architecture:** MiniDB follows a standard RDBMS hierarchy: **1 Database contains N Tables**, and **1 Table contains 1 B+ Tree**. 

- **Database**: A logical container that groups related tables. A database is created with just a name and contains no data until tables are created.
- **Table**: A named collection of records with a defined schema. Each table has its own B+ Tree, schema (columns and primary key), and configuration.

The MiniDB API is organized into three categories:

1. **Database Lifecycle APIs**: Create, list, get, connect, and drop databases
2. **Table Lifecycle APIs**: Create tables within databases (with schema and config)
3. **Data Operation APIs**: Insert, update, delete, search, and range queries on tables
4. **Introspection APIs**: Inspect tree structure, WAL, and cache statistics for tables

All data operations optionally return step-based execution traces for visualization when `enable_steps=true`.

**Schema Enforcement:** All tables require a schema definition (columns and primary key) when created. Schema validation is enforced on all operations (insert, update, delete, search, range query).

**Setup Flow:** The typical workflow is:
1. **Step 1**: Create a Database (name only)
2. **Step 2**: Create one or more Tables within that Database (schema + config)
3. **Step 3**: Perform data operations on the Tables

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

Create a new empty database (container). The database will have no tables until you create them.

**Endpoint:** `POST /api/databases`

**Request Body:**

```json
{
  "name": "mydb"
}
```

**Request Fields:**

- `name` (required): Database name

**Response:**

```json
{
  "success": true,
  "name": "mydb"
}
```

**Status Codes:**

- `201 Created`: Database created successfully
- `400 Bad Request`: Invalid request (e.g., database already exists, empty name)
- `500 Internal Server Error`: Creation failed

**Note:** This creates an empty database container. To store data, you must create tables within this database using the [Create Table](#create-table) endpoint.

**File Structure:** Database files are stored in `database/{dbName}/` directory. Each table will have its own `.db` and `.schema.json` files within this directory.

---

## Table Lifecycle APIs

### Create Table

Create a new table within an existing database. Each table has its own B+ Tree, schema, and configuration.

**Endpoint:** `POST /api/databases/{dbName}/tables`

**Request Body:**

```json
{
  "name": "users",
  "config": {
    "order": 4,
    "pageSize": 4096,
    "walEnabled": true,
    "cacheSize": 100
  },
  "schema": {
    "columns": [
      { "name": "id", "type": "INT" },
      { "name": "name", "type": "STRING" },
      { "name": "age", "type": "INT" }
    ],
    "primaryKey": ["id"]
  }
}
```

**Request Fields:**

- `name` (required): Table name
- `config` (optional): Table-specific B+Tree configuration
  - `order` (optional): B+Tree order (default: 4)
  - `pageSize` (optional): Page size in bytes (default: 4096)
  - `walEnabled` (optional): Enable WAL (default: true)
  - `cacheSize` (optional): Cache size in pages (default: 100)
- `schema` (required): Table schema definition
  - `columns` (required): Array of column definitions
    - `name` (required): Column name
    - `type` (required): Column type - must be one of: `"INT"`, `"STRING"`, `"FLOAT"`, `"BOOL"`
  - `primaryKey` (required): Array of column names that form the primary key
    - Order matters: The order of columns in this array determines the key ordering
    - Example: `["col2", "col1"]` means records are sorted by `col2` first, then `col1`
    - All primary key columns must exist in the `columns` array

**Response:**

```json
{
  "success": true,
  "database": "mydb",
  "name": "users",
  "schema": {
    "columns": [
      { "name": "id", "type": "INT" },
      { "name": "name", "type": "STRING" },
      { "name": "age", "type": "INT" }
    ],
    "primaryKey": ["id"]
  }
}
```

**Status Codes:**

- `201 Created`: Table created successfully
- `400 Bad Request`: Invalid request (e.g., invalid schema, table already exists)
- `404 Not Found`: Database not found
- `500 Internal Server Error`: Creation failed

**Note:** Schema is mandatory and persisted to disk as `database/{dbName}/{tableName}.schema.json`. The table's B+ Tree file is stored as `database/{dbName}/{tableName}.db`.

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

- Database files are stored in the `database/{dbName}/` folder relative to the backend directory
- The filename field shows the directory path for the database
- Individual table files are stored within this directory

**Status Codes:**

- `200 OK`: Success
- `404 Not Found`: Database not found

### Connect Database

Connect to an existing database instance (loads tables from disk). This will read all table files and load pages into memory. All disk I/O during loading is tracked.

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
- `404 Not Found`: Database directory not found
- `500 Internal Server Error`: Connection failed

**Note:**

- This endpoint opens an existing database and loads all tables from disk (does not create a new database)
- All tables within the database directory are automatically loaded
- Disk I/O during table loading is tracked and visible via the I/O statistics endpoint
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

- This permanently deletes the entire database directory (`database/{dbName}/`) including all tables and their files (`.db`, `.wal`, `.schema.json`)
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

### Cleanup All Databases

Wipe all database files (.db, .wal, .schema.json) from disk. Useful for cleaning up incompatible data structures.

**Endpoint:** `POST /api/databases?cleanup=true`

**Response:**

```json
{
  "success": true,
  "message": "All database files cleaned up (.db, .wal, .schema.json)"
}
```

**Status Codes:**

- `200 OK`: Cleanup successful
- `500 Internal Server Error`: Cleanup failed

**Note:**

- This deletes all `.db`, `.wal`, and `.schema.json` files from the database directory
- All active database connections are closed before cleanup
- Useful when upgrading to schema-enforced databases (Version 7.0)

**Status Codes:**

- `200 OK`: All databases deleted successfully
- `500 Internal Server Error`: Deletion failed

**Note:**

- This permanently deletes all database directories and their contents (all `.db`, `.wal`, and `.schema.json` files)
- All open databases are automatically closed
- This operation cannot be undone
- Use with caution!

---

## Data Operation APIs

All data operations optionally return step-based execution traces when `enable_steps=true`. See [Step-Based Execution Traces](#step-based-execution-traces) for details.

**Note:** All data operations now require both database name and table name in the path: `/api/databases/{dbName}/tables/{tableName}/{operation}`

### Insert

Insert a row into a table.

**Endpoint:** `POST /api/databases/{dbName}/tables/{tableName}/insert`

**Query Parameters:**

- `enable_steps` (boolean, optional): Default `false`. When `true`, the response includes a `steps` field with execution traces.

**Request Body:**

Provide row data as a JSON object:

```json
{
  "id": 1,
  "name": "Alice",
  "age": 25
}
```

The backend will:
1. Validate the row against the schema (check fields exist and types match)
2. Extract the composite key using the primary key columns in order
3. Convert the row to a Record

**Note:** All databases require a schema. The primary key is automatically extracted from the row data using the schema's primary key column order.

**Response (enable_steps=false, default):**

```json
{
  "success": true,
  "operation": "INSERT",
  "key": {
    "values": [
      {"type": "int", "value": 42}
    ]
  }
}
```

**Response (enable_steps=true):**

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
      "step_id": 1,
      "type": "TRAVERSE_START",
      "node_id": "N2",
      "depth": 0,
      "key": {"values": [{"type": "int", "value": 42}]},
      "metadata": {}
    },
    {
      "step_id": 2,
      "type": "NODE_VISIT",
      "node_id": "N2",
      "depth": 0,
      "key": {"values": [{"type": "int", "value": 42}]},
      "metadata": {"is_leaf": false, "key_count": 1}
    }
  ]
}
```

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid request or duplicate key
- `404 Not Found`: Database or table not found

### Update

Update a row in a table.

**Endpoint:** `POST /api/databases/{dbName}/tables/{tableName}/update`

**Query Parameters:**

- `enable_steps` (boolean, optional): Default `false`. When `true`, the response includes a `steps` field with execution traces.

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

**Response (enable_steps=false, default):**

```json
{
  "success": true,
  "operation": "UPDATE",
  "key": {...}
}
```

**Response (enable_steps=true):**

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

Delete a row from a table.

**Endpoint:** `POST /api/databases/{dbName}/tables/{tableName}/delete`

**Query Parameters:**

- `enable_steps` (boolean, optional): Default `false`. When `true`, the response includes a `steps` field with execution traces.

**Request Body:**

Provide the primary key components as a JSON object:

```json
{
  "id": 1
}
```

For composite primary keys, provide all key components:

```json
{
  "col2": "value2",
  "col1": 1
}
```

The backend will extract the composite key using the primary key column order defined in the schema.

**Response (enable_steps=false, default):**

```json
{
  "success": true,
  "operation": "DELETE",
  "key": {...}
}
```

**Response (enable_steps=true):**

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

Search for a row in a table by primary key.

**Endpoint:** `POST /api/databases/{dbName}/tables/{tableName}/search`

**Query Parameters:**

- `enable_steps` (boolean, optional): Default `false`. When `true`, the response includes a `steps` field with execution traces.

**Request Body:**

Provide the primary key components as a JSON object:

```json
{
  "id": 1
}
```

For composite primary keys, provide all key components:

```json
{
  "col2": "value2",
  "col1": 1
}
```

The backend will extract the composite key using the primary key column order defined in the schema.

**Response (enable_steps=false, default):**

```json
{
  "success": true,
  "operation": "SEARCH",
  "key": {...},
  "value": {
    "columns": [
      {"type": "string", "value": "Hello, World!"}
    ]
  }
}
```

**Response (enable_steps=true):**

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

Query all rows within a key range in a table.

**Endpoint:** `POST /api/databases/{dbName}/tables/{tableName}/range`

**Query Parameters:**

- `enable_steps` (boolean, optional): Default `false`. When `true`, the response includes a `steps` field with execution traces.

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

**Response (enable_steps=false, default):**

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
  ]
}
```

**Response (enable_steps=true):**

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
- `404 Not Found`: Database or table not found

---

## Introspection APIs

All introspection endpoints now require both database name and table name in the path: `/api/databases/{dbName}/tables/{tableName}/{operation}`

### Get Tree Structure

Get the full B+Tree structure for a table.

**Endpoint:** `GET /api/databases/{dbName}/tables/{tableName}/tree`

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

Get Write-Ahead Log information for a table.

**Endpoint:** `GET /api/databases/{dbName}/tables/{tableName}/wal`

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

Get buffer pool/cache statistics for a table.

**Endpoint:** `GET /api/databases/{dbName}/tables/{tableName}/cache`

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

Get a list of all page IDs currently in the cache for a table.

**Endpoint:** `GET /api/databases/{dbName}/tables/{tableName}/cache/pages`

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

Get statistics and details of all I/O read operations (disk reads when cache misses occur) for a table.

**Endpoint:** `GET /api/databases/{dbName}/tables/{tableName}/io`

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
curl http://localhost:8080/api/databases/mydb/tables/users/io
```

**Note:** The details array is limited to the last 1000 I/O reads to prevent unbounded memory growth. The `totalReads` counter is not limited and tracks all I/O operations since database creation.

---

## Step-Based Execution Traces

Data operations (insert, update, delete, search, range) optionally return a `steps` array containing execution traces when `enable_steps=true`. Each step represents a discrete operation during tree traversal and modification.

**Note:** When `enable_steps=false` (default), the `steps` field is not included in the response, providing zero-overhead operation execution.

### Step Object Schema

```json
{
  "step_id": 1,
  "type": "TRAVERSE_START",
  "node_id": "N2",
  "target_id": null,
  "key": {"values": [{"type": "int", "value": 42}]},
  "value": null,
  "depth": 0,
  "metadata": {}
}
```

**Fields:**

- `step_id` (number): Execution order of the step (monotonic, auto-incrementing)
- `type` (string): Step type (e.g., `TRAVERSE_START`, `NODE_VISIT`, `NODE_SPLIT`, `INSERT_ENTRY`)
- `node_id` (string): Node involved in this step (e.g., "N2", "N5")
- `target_id` (string | null): Target node for operations involving multiple nodes (e.g., parent node for promotions)
- `key` (any | null): Key being operated on in this step
- `value` (any | null): Value associated with the key (for insert/update operations)
- `depth` (number): Tree depth of the node (root = 0, increasing downward)
- `metadata` (object): Additional step-specific information (e.g., `split_index`, `is_leaf`, `key_count`, `sibling_type`)

### Step Types

Common step types include:

- **Navigation**: `TRAVERSE_START`, `NODE_VISIT`, `KEY_COMPARISON`, `CHILD_POINTER_SELECTED`
- **Insert**: `LEAF_FOUND`, `INSERT_ENTRY`, `OVERFLOW_DETECTED`, `NODE_SPLIT`, `PROMOTE_KEY`, `NEW_ROOT_CREATED`, `REBALANCE_COMPLETE`
- **Delete**: `ENTRY_REMOVED`, `UNDERFLOW_DETECTED`, `CHECK_SIBLING`, `BORROW_LEFT`, `BORROW_RIGHT`, `MERGE_NODES`, `SHRINK_TREE`
- **Search**: `SEARCH_FOUND`, `SEARCH_NOT_FOUND`
- **Lifecycle**: `OPERATION_COMPLETE`

### Example: Insert Operation (enable_steps=true)

```bash
curl -X POST "http://localhost:8080/api/databases/mydb/tables/users/insert?enable_steps=true" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 42,
    "name": "Hello"
  }'
```

**Response:**

```json
{
  "success": true,
  "operation": "INSERT",
  "key": {"values": [{"type": "int", "value": 42}]},
  "steps": [
    {
      "step_id": 1,
      "type": "TRAVERSE_START",
      "node_id": "N2",
      "depth": 0,
      "key": {"values": [{"type": "int", "value": 42}]},
      "metadata": {}
    },
    {
      "step_id": 2,
      "type": "NODE_VISIT",
      "node_id": "N2",
      "depth": 0,
      "key": {"values": [{"type": "int", "value": 42}]},
      "metadata": {"is_leaf": false, "key_count": 1}
    },
    {
      "step_id": 3,
      "type": "LEAF_FOUND",
      "node_id": "N4",
      "depth": 1,
      "key": {"values": [{"type": "int", "value": 42}]},
      "metadata": {}
    },
    {
      "step_id": 4,
      "type": "INSERT_ENTRY",
      "node_id": "N4",
      "depth": 1,
      "key": {"values": [{"type": "int", "value": 42}]},
      "value": {"columns": [{"type": "string", "value": "Hello"}]},
      "metadata": {}
    },
    {
      "step_id": 5,
      "type": "OPERATION_COMPLETE",
      "node_id": "N4",
      "depth": 1,
      "metadata": {"op": "insert"}
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
- `404 Not Found`: Database, table, or resource not found
- `500 Internal Server Error`: Server-side error

**Error Messages:**

- `"Database 'x' not found"`: The specified database does not exist
- `"Table 'y' not found in database 'x'"`: The specified table does not exist in the database

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
    "name": "example"
  }'
```

**2. Create a table:**

```bash
curl -X POST http://localhost:8080/api/databases/example/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "users",
    "config": {
      "cacheSize": 100
    },
    "schema": {
      "columns": [
        { "name": "id", "type": "INT" },
        { "name": "name", "type": "STRING" },
        { "name": "age", "type": "INT" }
      ],
      "primaryKey": ["id"]
    }
  }'
```

**3. Insert a row (without steps, default):**

```bash
curl -X POST http://localhost:8080/api/databases/example/tables/users/insert \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "name": "Alice",
    "age": 25
  }'
```

**3b. Insert a row (with steps):**

```bash
curl -X POST "http://localhost:8080/api/databases/example/tables/users/insert?enable_steps=true" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 2,
    "name": "Bob",
    "age": 30
  }'
```

**4. Search for a row:**

```bash
curl -X POST http://localhost:8080/api/databases/example/tables/users/search \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1
  }'
```

**5. Get tree structure:**

```bash
curl http://localhost:8080/api/databases/example/tables/users/tree
```

**6. Get cache statistics:**

```bash
curl http://localhost:8080/api/databases/example/tables/users/cache
```

**7. Get list of cached pages:**

```bash
curl http://localhost:8080/api/databases/example/tables/users/cache/pages
```

**8. Get I/O read statistics:**

```bash
curl http://localhost:8080/api/databases/example/tables/users/io
```

**9. Close the database:**

```bash
curl -X POST http://localhost:8080/api/databases/example/close
```

**10. Reconnect the database:**

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
curl http://localhost:8080/api/databases/example/tables/users/tree | jq
```

### JavaScript/Fetch Example

```javascript
// Step 1: Create database
const dbResponse = await fetch("http://localhost:8080/api/databases", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "mydb",
  }),
});

// Step 2: Create table
const tableResponse = await fetch("http://localhost:8080/api/databases/mydb/tables", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "users",
    config: { cacheSize: 100 },
    schema: {
      columns: [
        { name: "id", type: "INT" },
        { name: "name", type: "STRING" },
      ],
      primaryKey: ["id"],
    },
  }),
});

// Step 3: Insert data (with steps)
const insertResponse = await fetch(
  "http://localhost:8080/api/databases/mydb/tables/users/insert?enable_steps=true",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1,
      name: "Alice",
    }),
  }
);

const result = await insertResponse.json();
console.log("Steps:", result.steps); // Only present when enable_steps=true
```

### Python Example

```python
import requests

# Step 1: Create database
db_response = requests.post('http://localhost:8080/api/databases', json={
    'name': 'mydb'
})

# Step 2: Create table
table_response = requests.post('http://localhost:8080/api/databases/mydb/tables', json={
    'name': 'users',
    'config': {'cacheSize': 100},
    'schema': {
        'columns': [
            {'name': 'id', 'type': 'INT'},
            {'name': 'name', 'type': 'STRING'}
        ],
        'primaryKey': ['id']
    }
})

# Step 3: Insert data (with steps)
insert_response = requests.post(
    'http://localhost:8080/api/databases/mydb/tables/users/insert?enable_steps=true',
    json={
        'id': 1,
        'name': 'Alice'
    }
)

result = insert_response.json()
print('Steps:', result.get('steps', []))  # Only present when enable_steps=true
```

---

## Notes

1. **Step Collection**: Step traces are optional and only included when `enable_steps=true`. When `enable_steps=false` (default), operations execute with zero overhead from step collection.

2. **Determinism**: Step traces are deterministic for identical inputs. The same operation on the same tree state produces the same steps in the same order.

3. **Step Ordering**: Steps are returned in execution order with monotonic `step_id` values. The order reflects the actual control flow of the operation.

4. **Core Independence**: The API layer is an adapter. The core B+Tree implementation works independently without the API.

5. **Concurrency**: The API server handles concurrent requests. Each database instance manages its own locking.

6. **Error Recovery**: If an operation fails, the `success` field is `false` and an `error` message is provided. When `enable_steps=true`, the `steps` array may be incomplete for failed operations.

---

## Future Enhancements

- **Event Streaming**: SSE/WebSocket support for real-time step streaming
- **Transaction APIs**: Explicit transaction begin/commit/rollback endpoints
- **Enhanced WAL Introspection**: Full WAL entry reading and parsing
- **Query Planning**: Expose query planning information in steps
- **Performance Metrics**: Additional performance counters and timing information
