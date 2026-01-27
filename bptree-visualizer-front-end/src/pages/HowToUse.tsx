import { Code, AlertTriangle, Layers, Eye, BookOpen, Play, Database } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function HowToUse() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl text-left">
      <h1 className="text-5xl font-bold mb-12">How to Use MiniDB</h1>

      {/* Important Note */}
      <Alert variant="destructive" className="mb-8 border-orange-500/50 bg-orange-500/10">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <AlertTitle className="text-orange-500 font-bold mb-2">Visualization & Simulation Only</AlertTitle>
        <AlertDescription className="text-foreground/90 leading-relaxed">
          <p className="mb-4">
            This frontend application is designed exclusively for <strong>visualizing the B+ Tree algorithms</strong>.
          </p>
          <p className="mb-2">
            <strong>Key Points:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong>Independent Logic:</strong> The logic used here mirrors the core engine but runs completely independently on the client-side. It does <strong>not</strong> interact with the actual backend engine.
            </li>
            <li>
              <strong>Source of Truth:</strong> The actual production logic and core implementation reside in the <strong>mini-db-engine</strong> folder. Please refer to that folder for the definitive implementation.
            </li>
            <li>
              <strong>Purpose:</strong> This tool is for educational and debugging purposes to see how keys are inserted, split, deleted, and merged visually.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Using the Visualizer */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Eye className="h-6 w-6" />
          Using the B+ Tree Visualizer
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          This playground allows you to experiment with B+ Tree operations in a sandbox environment. All data is reset when you reload or clear the browser cache.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Play className="h-5 w-5" />
              Step-by-Step Traces
            </h3>
            <p className="text-muted-foreground">
              Watch every step of an operation. See how the engine scans keys, finds leaf nodes, and handles overflows or underflows step-by-step.
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Split & Merge Visualization
            </h3>
            <p className="text-muted-foreground">
              Visualizes complex B+ Tree rebalancing operations like Node Splitting (during Insert) and Node Merging/Borrowing (during Delete).
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Database className="h-5 w-5" />
              No Setup Required
            </h3>
            <p className="text-muted-foreground">
              Since this is a simulation, you do not need to start any backend servers. Just open this page and start interacting with the tree.
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Interactive Learning
            </h3>
            <p className="text-muted-foreground">
              Perfect for understanding B+ Tree algorithms, testing edge cases, and seeing how the tree structure evolves with each operation.
            </p>
          </div>
        </div>
      </section>

      {/* Using the Actual Engine */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Code className="h-6 w-6" />
          Using the MiniDB Engine (Go API)
        </h2>
        <p className="text-muted-foreground mb-6">
          The actual MiniDB engine is a production-ready B+Tree database implementation in Go. Here's how to use it:
        </p>

        <div className="bg-muted/50 rounded-lg p-6 border mb-6">
          <h3 className="text-xl font-semibold mb-4">Quick Start Example</h3>
          <div className="bg-background border rounded-md p-4 font-mono text-sm overflow-x-auto">
            <pre><code>{`package main

import (
    "fmt"
    "bplustree/internal/btree"
    "bplustree/internal/storage"
)

func main() {
    // Create B+Tree with custom database filename
    // Default cache: 100 pages (~400KB)
    tree, err := btree.NewBPlusTree("database/mydb.db", true)
    if err != nil {
        panic(err)
    }
    defer tree.Close()

    // Or create with custom cache size
    // tree, err := btree.NewBPlusTreeWithCacheSize(
    //     "database/mydb.db", true, 200)

    // Single insert - automatically transactional
    key := storage.NewCompositeKey(storage.NewInt(10))
    value := storage.NewRecord(
        storage.NewString("Hello"), 
        storage.NewInt(42))
    tree.Insert(key, value)  // Auto-commits internally

    // Explicit transaction for multiple operations
    tree.Begin()
    tree.Insert(key, value)
    tree.Update(key, storage.NewRecord(
        storage.NewString("Updated")))
    tree.Commit()  // All operations persist together

    // Search
    result, err := tree.Search(key)
    if err == nil {
        fmt.Println("Found:", result)
    }

    // Check cache statistics
    stats := tree.GetPager().GetCacheStats()
    fmt.Printf("Cache: hits=%d, misses=%d\\n",
        stats.Hits, stats.Misses)
}`}</code></pre>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-6 border">
          <h3 className="text-xl font-semibold mb-4">Running Tests</h3>
          <p className="text-muted-foreground mb-4">
            Run the comprehensive test suite:
          </p>
          <div className="bg-background border rounded-md p-4 font-mono text-sm">
            <code>cd mini-db-engine && go test -v ./internal/btree/...</code>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Tests generate binary database files (`.db`) and test documentation (`description.txt`) in test directories.
          </p>
        </div>
      </section>

      {/* Logic Location */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Where is the Core Engine?
        </h2>
        <div className="bg-muted/50 rounded-lg p-6 border">
          <p className="mb-4 text-muted-foreground">
            If you are looking for the actual Database Engine implementation, please check the backend source code:
          </p>
          <div className="bg-background border rounded-md p-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Layers className="h-4 w-4" />
              <strong>Core Engine Source</strong>
            </div>
            <code>/mini-db-engine/</code>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            The frontend uses a focused visualization logic that mirrors the core algorithms found in the <code>mini-db-engine</code> directory.
          </p>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-3xl font-semibold mb-6">Tips for Using the Visualizer</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong>Use "Init":</strong> Quickly populate the tree with random data to test rebalancing operations.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong>Playback Speed:</strong> Adjust the speed slider to slow down complex operations like recursive deletions and splits.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong>Order:</strong> The visualizer simulates a B+ Tree of <strong>Order 4</strong> (max 3 keys per node) to ensure frequent splitting/merging for demonstration purposes.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong>Operations:</strong> Try Insert, Search, Update, Delete, and Range Query operations to see how the tree structure changes.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
