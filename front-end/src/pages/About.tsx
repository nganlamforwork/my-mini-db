import { Github, Linkedin, Mail, Phone, MapPin } from 'lucide-react'

export function About() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl text-left">
      <h1 className="text-5xl font-bold mb-12">About MiniDB</h1>

      {/* About Me Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-6">About Me</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-medium mb-2">Lam Le Vu Ngan</h3>
            <p className="text-muted-foreground">Software Engineer</p>
          </div>
          
          <div className="flex flex-wrap gap-6 text-sm">
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
            
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Vietnam</span>
            </div>
          </div>
        </div>
      </section>

      {/* Project Overview Section */}
      <section>
        <h2 className="text-3xl font-semibold mb-6">Project Overview</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          MiniDB is a file-backed B+Tree database implementation in Go with full CRUD operations, 
          transaction support, and Write-Ahead Logging (WAL). This production-ready implementation 
          demonstrates core database engine concepts following industry-standard patterns used by 
          PostgreSQL, SQLite, and MySQL InnoDB.
        </p>
        
        <div>
          <h3 className="text-2xl font-medium mb-4">Key Features</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">B+Tree Implementation:</strong> Full CRUD operations (Insert, Search, Update, Delete) with O(log n) time complexity</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Transaction Support:</strong> Multi-operation atomicity with Begin/Commit/Rollback</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Write-Ahead Logging (WAL):</strong> All changes logged before database writes for durability</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Crash Recovery:</strong> Automatic recovery by replaying WAL entries</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">LRU Page Cache:</strong> Configurable in-memory cache with automatic eviction (default: 100 pages)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">REST API:</strong> Complete RESTful API for all operations with step-based execution traces</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Page-Based Storage:</strong> Fixed-size 4KB pages with efficient memory management</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Composite Keys:</strong> Multi-column primary keys with lexicographic ordering</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Structured Records:</strong> Typed database rows (Int, String, Float, Bool)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span><strong className="text-foreground">Range Queries:</strong> Efficient range scans using leaf-level linked list (O(log n + k))</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Future Features Section */}
      <section className="mt-16">
        <h2 className="text-3xl font-semibold mb-6">Future Features</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          The following features are planned for future development, organized by priority:
        </p>

        {/* High Priority */}
        <div className="mb-8">
          <h3 className="text-2xl font-medium mb-4 text-destructive">High Priority</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Concurrent Access:</strong> Add page-level locking or latching to support multiple readers and single writer. Consider B-link tree variant for better concurrency.
              </span>
            </li>
          </ul>
        </div>

        {/* Medium Priority */}
        <div className="mb-8">
          <h3 className="text-2xl font-medium mb-4 text-orange-500 dark:text-orange-400">Medium Priority</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Variable-Length Value Optimization:</strong> Optimize for large values by implementing overflow pages for values larger than page size and adding compression.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Index Statistics:</strong> Track tree height, page count, and key distribution. Implement Stats() method for diagnostics to help identify when rebalancing is needed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Bulk Loading:</strong> Optimize for inserting sorted data by building tree bottom-up instead of incremental inserts. Expected 3-5x faster for initial loads.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Update Optimization:</strong> Consider copy-on-write for large values and add versioning for concurrent updates.
              </span>
            </li>
          </ul>
        </div>

        {/* Low Priority */}
        <div>
          <h3 className="text-2xl font-medium mb-4 text-muted-foreground">Low Priority</h3>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Key Compression:</strong> Implement prefix compression for keys in internal nodes to reduce space and increase fanout.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Snapshot Isolation:</strong> Implement MVCC (Multi-Version Concurrency Control) so readers don't block writers.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>
                <strong className="text-foreground">Performance Benchmarks:</strong> Add benchmark tests for insert/search/delete/update/range throughput. Compare against other embedded DBs (BoltDB, BadgerDB) and profile memory usage and I/O patterns.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
