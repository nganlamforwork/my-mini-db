const API_BASE_URL = 'http://localhost:8080/api'

export interface Database {
  name: string
}

export interface DatabaseInfo {
  name: string
  filename: string
  order: number
  pageSize: number
  walEnabled: boolean
  cacheSize: number
  rootPage: number
  height: number
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
}
