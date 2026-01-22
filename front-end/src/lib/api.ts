import type { 
  DatabaseInfo, 
  TreeStructure, 
  CacheStats, 
  CachePages, 
  IOReadInfo,
  CompositeKey,
  Record,
  OperationResponse,
  WALInfo,
  TreeConfig,
  Schema
} from '@/types/database'

const API_BASE_URL = 'http://localhost:8080/api'

export interface Database {
  name: string
}

export interface CreateDatabaseRequest {
  name: string
}

export interface CreateTableRequest {
  name: string
  config?: {
    order?: number
    pageSize?: number
    walEnabled?: boolean
    cacheSize?: number
  }
  schema: {
    columns: Array<{ name: string; type: 'INT' | 'STRING' | 'FLOAT' | 'BOOL' }>
    primaryKey: string[]
  }
}

// ConnectDatabaseRequest is for connecting to existing databases (schema is loaded from disk)
export interface ConnectDatabaseRequest {
  name: string
  config?: {
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

  // Create a new table in a database
  async createTable(dbName: string, request: CreateTableRequest): Promise<{ success: boolean; database: string; name: string; schema: any }> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create table')
    }
    
    return await response.json()
  },

  // List tables in a database
  async listTables(dbName: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${dbName}`);
    }
    const data = await response.json();
    return data.tables || [];
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
  async getTreeStructure(dbName: string, tableName: string): Promise<TreeStructure> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/tree`)
    if (!response.ok) {
      throw new Error(`Failed to fetch tree structure: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Get cache statistics
  async getCacheStats(dbName: string, tableName: string): Promise<CacheStats> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/cache`)
    if (!response.ok) {
      throw new Error(`Failed to fetch cache stats: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Get cached pages
  async getCachePages(dbName: string, tableName: string): Promise<CachePages> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/cache/pages`)
    if (!response.ok) {
      throw new Error(`Failed to fetch cache pages: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Get I/O read statistics
  async getIOReads(dbName: string, tableName: string): Promise<IOReadInfo> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/io`)
    if (!response.ok) {
      throw new Error(`Failed to fetch I/O reads: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Connect to an existing database (loads from disk)
  async connectDatabase(request: ConnectDatabaseRequest): Promise<{ success: boolean; name: string; message: string }> {
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
  async insert(name: string, key: CompositeKey, value: Record, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${name}/insert`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
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
  async update(name: string, key: CompositeKey, value: Record, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${name}/update`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
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
  async delete(name: string, key: CompositeKey, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${name}/delete`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
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
  async search(name: string, key: CompositeKey, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${name}/search`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
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
  async rangeQuery(name: string, startKey: CompositeKey, endKey: CompositeKey, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${name}/range`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
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
  async getWALInfo(dbName: string, tableName: string): Promise<WALInfo> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/wal`)
    if (!response.ok) {
      throw new Error(`Failed to fetch WAL info: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Get tree configuration
  async getTreeConfig(dbName: string, tableName: string): Promise<TreeConfig> {
    const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/config`)
    if (!response.ok) {
      throw new Error(`Failed to fetch tree config: ${dbName}/${tableName}`)
    }
    return await response.json()
  },

  // Get table schema
  async getSchema(dbName: string, tableName: string): Promise<Schema | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/schema`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch schema: ${dbName}/${tableName}`);
      }
      const schemaInfo = await response.json();
      // Convert API schema format to frontend Schema format
      return {
        columns: schemaInfo.columns.map((col: any) => ({
          name: col.name,
          type: col.type as 'INT' | 'STRING' | 'FLOAT' | 'BOOL',
        })),
        primaryKey: schemaInfo.primaryKey || schemaInfo.primaryKeyColumns,
      };
    } catch {
      return null;
    }
  },

  // Insert row data (schema-based)
  async insertRow(dbName: string, tableName: string, rowData: { [key: string]: any }, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/insert`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rowData),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to insert')
    }
    
    return await response.json()
  },

  // Update row data (schema-based)
  async updateRow(dbName: string, tableName: string, rowData: { [key: string]: any }, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/update`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rowData),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update')
    }
    
    return await response.json()
  },

  // Delete by key components (schema-based)
  async deleteByKey(dbName: string, tableName: string, keyData: { [key: string]: any }, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/delete`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(keyData),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete')
    }
    
    return await response.json()
  },

  // Search by key components (schema-based)
  async searchByKey(dbName: string, tableName: string, keyData: { [key: string]: any }, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/search`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(keyData),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to search')
    }
    
    return await response.json()
  },

  // Range query by key components (schema-based)
  async rangeQueryByKeys(dbName: string, tableName: string, startKeyData: { [key: string]: any }, endKeyData: { [key: string]: any }, enableSteps: boolean = false): Promise<OperationResponse> {
    const url = new URL(`${API_BASE_URL}/databases/${dbName}/tables/${tableName}/range`)
    if (enableSteps) {
      url.searchParams.set('enable_steps', 'true')
    }
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startKey: startKeyData, endKey: endKeyData }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to range query')
    }
    
    return await response.json()
  },
}
