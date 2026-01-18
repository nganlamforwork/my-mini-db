import type { 
  DatabaseInfo, 
  TreeStructure, 
  CacheStats, 
  CachePages, 
  IOReadInfo 
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
      throw new Error('Failed to drop database')
    }
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

  // Reset cache statistics
  async resetCacheStats(name: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/databases/${name}/cache`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`Failed to reset cache stats: ${name}`)
    }
  },
}
