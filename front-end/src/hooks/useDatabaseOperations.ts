import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CompositeKey, Record, OperationResponse, TreeStructure, WALInfo, CacheStats, CachePages, IOReadInfo } from '@/types/database'

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
export function useTreeStructure(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'tree'],
    queryFn: () => api.getTreeStructure(name!),
    enabled: !!name,
    // No refetchInterval - tree is updated via query invalidation on mutations
  })
}

// Hook for getting WAL info
export function useWALInfo(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'wal'],
    queryFn: () => api.getWALInfo(name!),
    enabled: !!name,
    refetchInterval: 3000, // Refetch every 3 seconds
  })
}

// Hook for insert operation
export function useInsert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { name: string; key: CompositeKey; value: Record }) =>
      api.insert(params.name, params.key, params.value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'wal'] })
    },
  })
}

// Hook for update operation
export function useUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { name: string; key: CompositeKey; value: Record }) =>
      api.update(params.name, params.key, params.value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'wal'] })
    },
  })
}

// Hook for delete operation
export function useDelete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { name: string; key: CompositeKey }) =>
      api.delete(params.name, params.key),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'tree'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'cache'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.name, 'wal'] })
    },
  })
}

// Hook for search operation
export function useSearch() {
  return useMutation({
    mutationFn: (params: { name: string; key: CompositeKey }) =>
      api.search(params.name, params.key),
  })
}

// Hook for range query operation
export function useRangeQuery() {
  return useMutation({
    mutationFn: (params: { name: string; startKey: CompositeKey; endKey: CompositeKey }) =>
      api.rangeQuery(params.name, params.startKey, params.endKey),
  })
}

// Hook for getting cache statistics
export function useCacheStats(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'cache'],
    queryFn: () => api.getCacheStats(name!),
    enabled: !!name,
    // No refetchInterval - cache is updated via query invalidation on mutations
  })
}

// Hook for getting cached pages
export function useCachePages(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'cache', 'pages'],
    queryFn: () => api.getCachePages(name!),
    enabled: !!name,
    // No refetchInterval - cache is updated via query invalidation on mutations
  })
}

// Hook for getting I/O read statistics
export function useIOReads(name: string | undefined) {
  return useQuery({
    queryKey: ['database', name, 'io'],
    queryFn: () => api.getIOReads(name!),
    enabled: !!name,
    refetchInterval: 3000,
  })
}
