import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useDatabaseStore } from '@/store/databaseStore'
import type { CreateDatabaseInput } from '@/lib/validations'

export function useCreateDatabase() {
  const queryClient = useQueryClient()
  const { addDatabase } = useDatabaseStore()

  return useMutation({
    mutationFn: (data: CreateDatabaseInput) =>
      api.createDatabase({
        name: data.name,
        config: data.config,
        columns: data.columns,
        primaryKey: data.primaryKey,
      }),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      addDatabase(data.name)
      toast.success('Database created successfully', {
        description: `${data.name} has been created.`,
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
  const { clearDatabases } = useDatabaseStore()

  return useMutation({
    mutationFn: () => api.deleteAllDatabases(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      clearDatabases()
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
