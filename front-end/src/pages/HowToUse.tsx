import { Terminal, Globe, Database, Plus, Search, Trash2, FileCode, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function HowToUse() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl text-left">
      <h1 className="text-5xl font-bold mb-12">How to Use MiniDB</h1>

      {/* Important Note */}
      <Alert variant="destructive" className="mb-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important Note About This Frontend</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            <strong>This web interface is designed for easy checking and visualization only.</strong> The main logic and implementation are in the codebase itself.
          </p>
          <p className="mb-2">
            Please note that this frontend may not always be up to date with new code features due to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Frontend updates may lag behind backend development</li>
            <li>Some logic and implementation details cannot be fully checked through the API and frontend alone</li>
          </ul>
          <p className="mt-2">
            <strong>To fully understand and work with MiniDB, you must examine the source code.</strong> The code is the source of truth for this project.
          </p>
        </AlertDescription>
      </Alert>

      {/* Introduction */}
      <section className="mb-12">
        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
          MiniDB can be used in two ways: via command line (curl) for direct API access, or through this web interface for easy visualization and testing without installation. This guide covers both approaches.
        </p>
      </section>

      {/* Prerequisites */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          Prerequisites
        </h2>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Start the Backend Server</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Before using MiniDB, you need to start the backend API server:
            </p>
            <div className="bg-background border rounded-md p-3 font-mono text-sm">
              <code>cd back-end</code>
              <br />
              <code>go run cmd/minidb/main.go -server -addr :8080</code>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              The API will be available at <code className="bg-background px-1 rounded">http://localhost:8080/api</code>
            </p>
          </div>
        </div>
      </section>

      {/* Command Line Usage */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Terminal className="h-6 w-6" />
          Command Line Usage (curl)
        </h2>
        <p className="text-muted-foreground mb-6">
          Use curl commands to interact with MiniDB directly via the REST API. This is useful for scripting, automation, or when you don't need the visual interface.
        </p>

        <div className="space-y-6">
          {/* Create Database */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Create a Database</h3>
            </div>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                curl -X POST http://localhost:8080/api/databases \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{'{'}<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"name": "mydb",<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"config": {'{'}<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"cacheSize": 100<br />
                &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br />
                &nbsp;&nbsp;{'}'}
              </code>
            </div>
          </div>

          {/* List Databases */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">List All Databases</h3>
            </div>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                curl http://localhost:8080/api/databases
              </code>
            </div>
          </div>

          {/* Insert Data */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Insert Data</h3>
            </div>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto mb-3">
              <code className="text-foreground">
                curl -X POST http://localhost:8080/api/databases/mydb/insert \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{'{'}<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"key": {'{'}"values": [{'{"type": "int", "value": 42}'}]{'}'},<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"value": {'{'}"columns": [{'{"type": "string", "value": "Hello"}'}]{'}'}<br />
                &nbsp;&nbsp;{'}'}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Returns step-by-step execution traces showing how the B+Tree was modified.
            </p>
          </div>

          {/* Search */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Search for a Key</h3>
            </div>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                curl -X POST http://localhost:8080/api/databases/mydb/search \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '{'{'}<br />
                &nbsp;&nbsp;&nbsp;&nbsp;"key": {'{'}"values": [{'{"type": "int", "value": 42}'}]{'}'}<br />
                &nbsp;&nbsp;{'}'}
              </code>
            </div>
          </div>

          {/* Delete Database */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h3 className="text-xl font-semibold">Delete a Database</h3>
            </div>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                curl -X DELETE http://localhost:8080/api/databases/mydb
              </code>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> For complete API documentation including all endpoints (update, delete, range queries, tree structure, cache stats), see the{" "}
            <a href="/documentation" className="text-primary hover:underline">Documentation</a> page.
          </p>
        </div>
      </section>

      {/* Web Interface Usage */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <Globe className="h-6 w-6" />
          Web Interface Usage
        </h2>
        <p className="text-muted-foreground mb-6">
          The web interface provides an easy way to interact with MiniDB without installing any tools. Simply start the frontend and use the visual interface.
        </p>

        <div className="space-y-6">
          {/* Starting Frontend */}
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Starting the Frontend</h3>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto mb-3">
              <code className="text-foreground">
                cd front-end<br />
                npm install<br />
                npm run dev
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              Then open <code className="bg-background px-1 rounded">http://localhost:5173</code> in your browser.
            </p>
          </div>

          {/* Features */}
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Available Features</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">Database Management:</strong> Create, view, and delete databases through an intuitive interface</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">Visual Tree Structure:</strong> Inspect B+Tree structure and see how data is organized</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">Step-by-Step Visualization:</strong> See execution traces for each operation showing tree modifications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">Performance Monitoring:</strong> View cache statistics, I/O reads, and WAL information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">No Installation Required:</strong> Works directly in your browser - just ensure the backend server is running</span>
              </li>
            </ul>
          </div>

          {/* Current Status */}
          <div className="border rounded-lg p-6 bg-muted/50">
            <h3 className="text-xl font-semibold mb-4">Current Status</h3>
            <p className="text-muted-foreground mb-3">
              The web interface currently supports:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Database creation and management</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Database listing and deletion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">○</span>
                <span>Data operations (insert, search, update, delete) - Coming soon</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">○</span>
                <span>Tree visualization - Coming soon</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground mt-1">○</span>
                <span>Performance monitoring - Coming soon</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Data Types */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6 flex items-center gap-2">
          <FileCode className="h-6 w-6" />
          Data Types
        </h2>
        <p className="text-muted-foreground mb-6">
          MiniDB supports structured data with typed columns. Understanding the data format is essential for using the API.
        </p>

        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Supported Column Types</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><code className="bg-muted px-2 py-1 rounded">"int"</code> - Integer (int64)</li>
              <li><code className="bg-muted px-2 py-1 rounded">"string"</code> - String</li>
              <li><code className="bg-muted px-2 py-1 rounded">"float"</code> - Float64</li>
              <li><code className="bg-muted px-2 py-1 rounded">"bool"</code> - Boolean</li>
            </ul>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Key Format (CompositeKey)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Keys can be single or multi-column (composite keys):
            </p>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                {'{'}"values": [{'{"type": "int", "value": 42}'}]{'}'}<br />
                <span className="text-muted-foreground">// Multi-column key example:</span><br />
                {'{'}"values": [<br />
                &nbsp;&nbsp;{'{"type": "int", "value": 10}'},<br />
                &nbsp;&nbsp;{'{"type": "string", "value": "hello"}'}<br />
                ]{'}'}
              </code>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Value Format (Record)</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Values are structured records with multiple typed columns:
            </p>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
              <code className="text-foreground">
                {'{'}"columns": [<br />
                &nbsp;&nbsp;{'{"type": "string", "value": "Alice"}'},<br />
                &nbsp;&nbsp;{'{"type": "int", "value": 25}'},<br />
                &nbsp;&nbsp;{'{"type": "bool", "value": true}'}<br />
                ]{'}'}
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h2 className="text-3xl font-semibold mb-6">Tips & Best Practices</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Database Names:</strong> Use only letters, numbers, underscores, and hyphens. No spaces or special characters allowed.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Cache Size:</strong> Default is 100 pages (~400KB). Adjust based on your data size and available memory.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Persistence:</strong> Database files are stored in the <code className="bg-muted px-1 rounded">database/</code> folder. Files persist between server restarts.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Transactions:</strong> All operations are automatically transactional. Use explicit transactions for multi-operation atomicity.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Error Handling:</strong> API returns JSON error responses. Check the <code className="bg-muted px-1 rounded">success</code> field and <code className="bg-muted px-1 rounded">error</code> message for details.</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
