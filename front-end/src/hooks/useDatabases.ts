import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: api.listDatabases,
    refetchInterval: 5000, // Refetch every 5 seconds
  })
}
