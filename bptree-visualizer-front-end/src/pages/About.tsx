import { Github, Linkedin, Mail, Phone, MapPin, Database, BookOpen, ExternalLink } from 'lucide-react'

export function About() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl text-left">
      <h1 className="text-5xl font-bold mb-12">About MiniDB</h1>

      {/* About Me Section */}
      <section className="mb-12">
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
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6">Project Overview</h2>
        <p className="text-muted-foreground mb-6 leading-relaxed text-lg">
          MiniDB is a production-ready B+Tree database implementation in Go that demonstrates core database engine concepts. 
          It follows industry-standard patterns used by PostgreSQL, SQLite, and MySQL InnoDB, implementing full CRUD operations, 
          transaction support with Write-Ahead Logging (WAL), and concurrent access capabilities.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Database className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Production-Ready</h3>
            </div>
            <p className="text-muted-foreground">
              Full-featured B+Tree database with crash recovery, transaction support, and thread-safe concurrent access.
            </p>
          </div>
          
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Well Documented</h3>
            </div>
            <p className="text-muted-foreground">
              Comprehensive documentation covering implementation details, algorithms, testing, and development history.
            </p>
          </div>
        </div>
      </section>

      {/* Key Highlights */}
      <section className="mb-12">
        <h2 className="text-3xl font-semibold mb-6">Key Highlights</h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Concurrent Access:</strong> Thread-safe operations with concurrent readers and serialized writers (Phase 3.5)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">ACID Transactions:</strong> Multi-operation atomicity with WAL-based crash recovery</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">LRU Page Cache:</strong> Configurable in-memory cache with automatic eviction</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Full CRUD:</strong> Insert, Search, Update, Delete, and Range Query operations</span>
          </li>
        </ul>
      </section>

      {/* Repository & Learn More */}
      <section className="border-t border-border pt-8">
        <h2 className="text-2xl font-semibold mb-4">Repository</h2>
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
        
        <h2 className="text-2xl font-semibold mb-4">Learn More</h2>
        <p className="text-muted-foreground mb-4">
          For detailed documentation, implementation details, and usage examples, please visit the <strong className="text-foreground">Documentation</strong> page.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Version:</strong> 8.0 (Concurrent Access - Phase 3.5) | <strong className="text-foreground">Last Updated:</strong> January 27, 2026
        </p>
      </section>
    </div>
  )
}
