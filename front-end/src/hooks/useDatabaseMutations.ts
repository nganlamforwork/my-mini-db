import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useDatabaseStore } from '@/store/databaseStore'

export function useCreateDatabase() {
  const queryClient = useQueryClient()
  const { addDatabase } = useDatabaseStore()

  return useMutation({
    mutationFn: (name: string) =>
      api.createDatabase({
        name,
        config: {
          cacheSize: 100,
          walEnabled: true,
        },
      }),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      addDatabase(name)
      toast.success('Database created successfully', {
        description: `${name} has been created.`,
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to create database', {
        description: error.message || 'An error occurred while creating the database.',
      })
    },
  })
}

export function useDeleteDatabase() {
  const queryClient = useQueryClient()
  const { removeDatabase } = useDatabaseStore()

  return useMutation({
    mutationFn: (name: string) => api.dropDatabase(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      removeDatabase(name)
      toast.success('Database deleted successfully', {
        description: `${name} has been deleted.`,
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to delete database', {
        description: error.message || 'An error occurred while deleting the database.',
      })
    },
  })
}

export function useClearAllDatabases() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const allDbs = await api.listDatabases()
      await Promise.all(allDbs.map((name) => api.dropDatabase(name)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      toast.success('All databases cleared', {
        description: 'All databases have been deleted.',
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to clear all databases', {
        description: error.message || 'An error occurred while clearing databases.',
      })
    },
  })
}
