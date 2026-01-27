import { Github, Linkedin, Mail, Phone, ExternalLink } from 'lucide-react'

export function Documentation() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl text-left">
      <h1 className="text-4xl font-bold mb-8">MiniDB Documentation</h1>
      
      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-left">
        <p className="text-lg text-muted-foreground">
          A file-backed B+Tree database implementation in Go with full CRUD operations, transaction support, and Write-Ahead Logging (WAL).
        </p>

        {/* Author Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Author</h2>
          <div className="space-y-2">
            <p className="font-medium">Lam Le Vu Ngan</p>
            <p className="text-muted-foreground">Software Engineer</p>
            <div className="flex flex-wrap gap-4 text-sm mt-4">
              <a
                href="https://github.com/nganlamforwork"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>nganlamforwork</span>
              </a>
              <a
                href="https://www.linkedin.com/in/nganlamlevu/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="h-4 w-4" />
                <span>Ngan Lam Le Vu</span>
              </a>
              <a
                href="mailto:nganlamforwork@gmail.com"
                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>nganlamforwork@gmail.com</span>
              </a>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>(+84) 945 29 30 31</span>
              </div>
            </div>
          </div>
        </section>

        {/* Repository */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Repository</h2>
          <div className="mb-6">
            <a
              href="https://github.com/nganlamforwork/my-mini-db"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors font-medium"
            >
              <Github className="h-5 w-5" />
              <span>github.com/nganlamforwork/my-mini-db</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Documentation Links */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Documentation</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">IMPLEMENTATION.md:</strong> Complete implementation details, algorithms, and architecture
            </li>
            <li>
              <strong className="text-foreground">TESTING.md:</strong> Comprehensive test suite documentation and test infrastructure
            </li>
            <li>
              <strong className="text-foreground">CHANGELOG.md:</strong> Development history and version evolution
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            For full technical details, see IMPLEMENTATION.md.
          </p>
        </section>

        {/* Features Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Features</h2>
          
          <div className="mb-6">
            <h3 className="text-2xl font-medium mb-3">Core Operations</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Insert:</strong> O(log n) insertion with automatic node splitting</li>
              <li><strong className="text-foreground">Search:</strong> O(log n) point queries</li>
              <li><strong className="text-foreground">Update:</strong> In-place updates when possible, fallback to delete+insert</li>
              <li><strong className="text-foreground">Delete:</strong> Full rebalancing with borrow and merge operations</li>
              <li><strong className="text-foreground">Range Query:</strong> O(log n + k) range scans using leaf-level linked list</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-2xl font-medium mb-3">Advanced Features</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Concurrent Access:</strong> Thread-safe operations with concurrent readers and serialized writers (Phase 3.5)</li>
              <li><strong className="text-foreground">Transaction Support:</strong> Multi-operation atomicity with Begin/Commit/Rollback</li>
              <li><strong className="text-foreground">Write-Ahead Logging:</strong> All changes logged before database writes</li>
              <li><strong className="text-foreground">Crash Recovery:</strong> Automatic recovery by replaying WAL entries</li>
              <li><strong className="text-foreground">LRU Page Cache:</strong> Configurable in-memory cache with automatic eviction (default: 100 pages, customizable at database creation)</li>
              <li><strong className="text-foreground">Disk Persistence:</strong> Load tree structure from disk on startup</li>
              <li><strong className="text-foreground">Page Management:</strong> 4KB page size with efficient memory management</li>
              <li><strong className="text-foreground">Composite Keys:</strong> Multi-column primary keys with lexicographic ordering</li>
              <li><strong className="text-foreground">Structured Records:</strong> Typed database rows (Int, String, Float, Bool)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-2xl font-medium mb-3">Architecture Highlights</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Page-Based Storage:</strong> Fixed-size 4KB pages with page headers</li>
              <li><strong className="text-foreground">B+Tree Order:</strong> 4 (max 3 keys per node, 4 children)</li>
              <li><strong className="text-foreground">Page Types:</strong> Meta, Internal, Leaf</li>
              <li><strong className="text-foreground">LRU Cache:</strong> Least Recently Used cache for frequently accessed pages</li>
              <li><strong className="text-foreground">Leaf Linking:</strong> Doubly-linked list for efficient range scans</li>
              <li><strong className="text-foreground">WAL File:</strong> Separate `.wal` file for transaction logging</li>
            </ul>
          </div>
        </section>

        {/* Overview Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Overview</h2>
          <p className="text-muted-foreground mb-4 leading-relaxed">
            MiniDB is a production-ready B+Tree database implementation demonstrating core database engine concepts. 
            The implementation follows industry-standard patterns used by PostgreSQL, SQLite, and MySQL InnoDB, 
            and is based on the ARIES recovery algorithm principles.
          </p>
          <p className="text-muted-foreground mb-4">The database engine provides:</p>
          <ul className="space-y-2 text-muted-foreground mb-4">
            <li><strong className="text-foreground">B+Tree Engine:</strong> Full B+Tree implementation with all CRUD operations</li>
            <li><strong className="text-foreground">Concurrent Access:</strong> Thread-safe operations supporting multiple concurrent readers</li>
            <li><strong className="text-foreground">Transaction Support:</strong> Multi-operation atomicity with WAL-based crash recovery</li>
            <li><strong className="text-foreground">Page Cache:</strong> Configurable LRU cache for efficient memory management</li>
            <li><strong className="text-foreground">Direct Go API:</strong> Use the B+Tree directly in Go programs</li>
          </ul>
          <p className="text-sm text-muted-foreground italic">
            Note: The engine is designed to be used directly via Go code. Test the implementation using the comprehensive test suite.
          </p>
        </section>

        {/* Quick Start Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Quick Start</h2>
          <h3 className="text-2xl font-medium mb-3">Direct Go Usage</h3>
          <div className="bg-muted rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm"><code>{`package main

import (
    "fmt"

    "bplustree/internal/btree"
    "bplustree/internal/storage"
)

func main() {
    // Create B+Tree with custom database filename (default cache: 100 pages)
    // PageManager and WAL are created internally
    // Files are stored in database/ folder
    tree, err := btree.NewBPlusTree("database/mydb.db", true)  // true = truncate existing file
    if err != nil {
        panic(err)
    }
    defer tree.Close()

    // Or create with custom cache size (e.g., 200 pages for ~800KB cache)
    // tree, err := btree.NewBPlusTreeWithCacheSize("database/mydb.db", true, 200)

    // Single insert - automatically transactional and crash-recoverable
    key := storage.NewCompositeKey(storage.NewInt(10))
    value := storage.NewRecord(storage.NewString("Hello"), storage.NewInt(42))
    tree.Insert(key, value)  // Auto-commits internally

    // Or use explicit transaction for multiple operations
    tree.Begin()
    tree.Insert(key, value)
    tree.Update(key, storage.NewRecord(storage.NewString("Updated")))
    tree.Commit()  // All operations persist together

    // Search
    result, err := tree.Search(key)
    if err == nil {
        fmt.Println("Found:", result)
    }

    // Check cache statistics
    stats := tree.GetPager().GetCacheStats()
    fmt.Printf("Cache: hits=%d, misses=%d, evictions=%d, size=%d/%d\\n",
        stats.Hits, stats.Misses, stats.Evictions,
        stats.Size, tree.GetPager().GetMaxCacheSize())
}`}</code></pre>
          </div>
        </section>

        {/* Testing Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Testing</h2>
          <h3 className="text-2xl font-medium mb-3">Running Tests</h3>
          <p className="text-muted-foreground mb-4">Run the comprehensive test suite:</p>
          <div className="bg-muted rounded-lg p-4 overflow-x-auto mb-4">
            <pre className="text-sm"><code>{`cd mini-db-engine
go test -v ./internal/btree/...`}</code></pre>
          </div>
          <p className="text-muted-foreground mb-2">Tests generate:</p>
          <ul className="space-y-1 text-muted-foreground mb-4">
            <li>• Binary database files (`.db`) in test directories</li>
            <li>• Test documentation (`description.txt`)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            See TESTING.md for detailed test documentation.
          </p>
        </section>

        {/* Real-World Context Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Real-World Context</h2>
          <p className="text-muted-foreground mb-4">This implementation follows industry-standard patterns:</p>
          <ul className="space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">PostgreSQL:</strong> WAL for durability (pg_xlog/pg_wal)</li>
            <li><strong className="text-foreground">SQLite:</strong> WAL mode for crash recovery</li>
            <li><strong className="text-foreground">MySQL InnoDB:</strong> Redo log for durability</li>
            <li><strong className="text-foreground">ARIES Algorithm:</strong> Industry-standard recovery algorithm principles</li>
          </ul>
        </section>

        {/* Performance Characteristics Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Performance Characteristics</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 text-left font-semibold">Operation</th>
                  <th className="border border-border p-2 text-left font-semibold">Time Complexity</th>
                  <th className="border border-border p-2 text-left font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border p-2">Insert</td>
                  <td className="border border-border p-2">O(log n)</td>
                  <td className="border border-border p-2">May trigger O(log n) splits</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Search</td>
                  <td className="border border-border p-2">O(log n)</td>
                  <td className="border border-border p-2">Single path traversal</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Delete</td>
                  <td className="border border-border p-2">O(log n)</td>
                  <td className="border border-border p-2">May trigger O(log n) merges</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Update</td>
                  <td className="border border-border p-2">O(log n)</td>
                  <td className="border border-border p-2">In-place when fits</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Range Query</td>
                  <td className="border border-border p-2">O(log n + k)</td>
                  <td className="border border-border p-2">k = result count</td>
                </tr>
                <tr>
                  <td className="border border-border p-2">Load from Disk</td>
                  <td className="border border-border p-2">O(n)</td>
                  <td className="border border-border p-2">Must read all n pages</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Key Features Section */}
        <section>
          <h2 className="text-3xl font-semibold mb-4">Key Features</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">B+Tree Implementation:</strong> Full B+Tree with insert, search, update, delete, and range queries</li>
            <li><strong className="text-foreground">Concurrent Access:</strong> Thread-safe operations with concurrent readers and serialized writers</li>
            <li><strong className="text-foreground">Transaction Support:</strong> Multi-operation atomicity with Begin/Commit/Rollback</li>
            <li><strong className="text-foreground">Write-Ahead Logging:</strong> All changes logged before database writes</li>
            <li><strong className="text-foreground">Crash Recovery:</strong> Automatic recovery by replaying WAL entries</li>
            <li><strong className="text-foreground">LRU Page Cache:</strong> Configurable in-memory cache with automatic eviction (default: 100 pages)</li>
            <li><strong className="text-foreground">Page-Based Storage:</strong> Fixed-size 4KB pages with efficient memory management</li>
            <li><strong className="text-foreground">Composite Keys:</strong> Multi-column primary keys with lexicographic ordering</li>
            <li><strong className="text-foreground">Structured Records:</strong> Typed database rows (Int, String, Float, Bool)</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4 italic">
            Note: The database engine is fully functional and can be used directly in Go programs. Test using the comprehensive test suite.
          </p>
        </section>

        {/* Version Info */}
        <section className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Version:</strong> 8.0 (Concurrent Access - Phase 3.5)
          </p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Last Updated:</strong> January 27, 2026
          </p>
        </section>
      </div>
    </div>
  )
}
