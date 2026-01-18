import type { 
  DatabaseInfo, 
  TreeStructure, 
  CacheStats, 
  CachePages, 
  IOReadInfo,
  CompositeKey,
  Record,
  OperationResponse,
  WALInfo
} from '@/types/database'

const API_BASE_URL = 'http://localhost:8080/api'

export interface Database {
  name: string
}

export interface CreateDatabaseRequest {
  name: string
  config?: {
    order?: number
    pageSize?: number
    walEnabled?: boolean
    cacheSize?: number
  }
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const api = {
  // List all databases
  async listDatabases(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/databases`)
    if (!response.ok) {
      throw new Error('Failed to fetch databases')
    }
    const data = await response.json()
    return data.databases || []
  },

  // Get database info
  async getDatabaseInfo(name: string): Promise<DatabaseInfo> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch database info: ${name}`)
    }
    return await response.json()
  },

  // Create a new database
  async createDatabase(request: CreateDatabaseRequest): Promise<{ success: boolean; name: string }> {
    const response = await fetch(`${API_BASE_URL}/databases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create database')
    }
    
    return await response.json()
  },

  // Drop a database
  async dropDatabase(name: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to drop database')
    }
  },

  // Delete all databases
  async deleteAllDatabases(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/databases`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete all databases')
    }
    
    return await response.json()
  },

  // Get tree structure
  async getTreeStructure(name: string): Promise<TreeStructure> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/tree`)
    if (!response.ok) {
      throw new Error(`Failed to fetch tree structure: ${name}`)
    }
    return await response.json()
  },

  // Get cache statistics
  async getCacheStats(name: string): Promise<CacheStats> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/cache`)
    if (!response.ok) {
      throw new Error(`Failed to fetch cache stats: ${name}`)
    }
    return await response.json()
  },

  // Get cached pages
  async getCachePages(name: string): Promise<CachePages> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/cache/pages`)
    if (!response.ok) {
      throw new Error(`Failed to fetch cache pages: ${name}`)
    }
    return await response.json()
  },

  // Get I/O read statistics
  async getIOReads(name: string): Promise<IOReadInfo> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/io`)
    if (!response.ok) {
      throw new Error(`Failed to fetch I/O reads: ${name}`)
    }
    return await response.json()
  },

  // Connect to an existing database (loads from disk)
  async connectDatabase(request: CreateDatabaseRequest): Promise<{ success: boolean; name: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/databases/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to connect database')
    }
    
    return await response.json()
  },

  // Close a database connection (keeps data on disk)
  async closeDatabase(name: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to close database')
    }
    
    return await response.json()
  },

  // Insert a key-value pair
  async insert(name: string, key: CompositeKey, value: Record): Promise<OperationResponse> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to insert')
    }
    
    return await response.json()
  },

  // Update a key-value pair
  async update(name: string, key: CompositeKey, value: Record): Promise<OperationResponse> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, value }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update')
    }
    
    return await response.json()
  },

  // Delete a key-value pair
  async delete(name: string, key: CompositeKey): Promise<OperationResponse> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete')
    }
    
    return await response.json()
  },

  // Search for a key
  async search(name: string, key: CompositeKey): Promise<OperationResponse> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to search')
    }
    
    return await response.json()
  },

  // Range query
  async rangeQuery(name: string, startKey: CompositeKey, endKey: CompositeKey): Promise<OperationResponse> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/range`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startKey, endKey }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to perform range query')
    }
    
    return await response.json()
  },

  // Get WAL info
  async getWALInfo(name: string): Promise<WALInfo> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/wal`)
    if (!response.ok) {
      throw new Error(`Failed to fetch WAL info: ${name}`)
    }
    return await response.json()
  },
}
