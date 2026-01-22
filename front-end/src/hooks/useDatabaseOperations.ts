import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Hook for connecting to a database
export function useConnectDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { name: string; config?: { cacheSize?: number } }) =>
      api.connectDatabase({
        name: params.name,
        config: params.config,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'info'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'wal'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'io'] })
    },
  })
}

// Hook for closing a database
export function useCloseDatabase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => api.closeDatabase(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', name] })
    },
  })
}

// Hook for getting database info
export function useDatabaseInfo(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'info'],
    queryFn: () => api.getDatabaseInfo(name!),
    enabled: !!name,
  })
}

// Hook for getting tree structure
export function useTreeStructure(dbName: string | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: ['database', dbName, 'table', tableName, 'tree'],
    queryFn: () => api.getTreeStructure(dbName!, tableName!),
    enabled: !!dbName && !!tableName,
    // No refetchInterval - tree is updated via query invalidation on mutations
  })
}

// Hook for getting WAL info
export function useWALInfo(dbName: string | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: ['database', dbName, 'table', tableName, 'wal'],
    queryFn: () => api.getWALInfo(dbName!, tableName!),
    enabled: !!dbName && !!tableName,
    refetchInterval: 3000, // Refetch every 3 seconds
  })
}

// Hook for insert operation (schema-based)
export function useInsertRow(enableSteps: boolean = false) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { dbName: string; tableName: string; rowData: { [key: string]: any } }) =>
      api.insertRow(params.dbName, params.tableName, params.rowData, enableSteps),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'wal'] })
    },
  })
}

// Hook for update operation (schema-based)
export function useUpdateRow(enableSteps: boolean = false) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { dbName: string; tableName: string; rowData: { [key: string]: any } }) =>
      api.updateRow(params.dbName, params.tableName, params.rowData, enableSteps),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'wal'] })
    },
  })
}

// Hook for delete operation (schema-based)
export function useDeleteByKey(enableSteps: boolean = false) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { dbName: string; tableName: string; keyData: { [key: string]: any } }) =>
      api.deleteByKey(params.dbName, params.tableName, params.keyData, enableSteps),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.dbName, 'table', variables.tableName, 'wal'] })
    },
  })
}

// Hook for search operation (schema-based)
export function useSearchByKey(enableSteps: boolean = false) {
  return useMutation({
    mutationFn: (params: { dbName: string; tableName: string; keyData: { [key: string]: any } }) =>
      api.searchByKey(params.dbName, params.tableName, params.keyData, enableSteps),
  })
}

// Hook for range query operation (schema-based)
export function useRangeQueryByKeys(enableSteps: boolean = false) {
  return useMutation({
    mutationFn: (params: { dbName: string; tableName: string; startKeyData: { [key: string]: any }; endKeyData: { [key: string]: any } }) =>
      api.rangeQueryByKeys(params.dbName, params.tableName, params.startKeyData, params.endKeyData, enableSteps),
  })
}

// Hook for getting cache statistics
export function useCacheStats(dbName: string | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: ['database', dbName, 'table', tableName, 'cache'],
    queryFn: () => api.getCacheStats(dbName!, tableName!),
    enabled: !!dbName && !!tableName,
    // No refetchInterval - cache is updated via query invalidation on mutations
  })
}

// Hook for getting cached pages
export function useCachePages(dbName: string | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: ['database', dbName, 'table', tableName, 'cache', 'pages'],
    queryFn: () => api.getCachePages(dbName!, tableName!),
    enabled: !!dbName && !!tableName,
    // No refetchInterval - cache is updated via query invalidation on mutations
  })
}

// Hook for getting I/O read statistics
export function useIOReads(dbName: string | undefined, tableName: string | undefined) {
  return useQuery({
    queryKey: ['database', dbName, 'table', tableName, 'io'],
    queryFn: () => api.getIOReads(dbName!, tableName!),
    enabled: !!dbName && !!tableName,
    refetchInterval: 3000,
  })
}
