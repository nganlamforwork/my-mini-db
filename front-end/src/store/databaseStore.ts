import { create } from 'zustand'
import type { DatabaseInfo } from '@/types/database'

interface DatabaseStore {
  databases: string[]
  selectedDatabase: string | null
  databaseInfo: { [key: string]: DatabaseInfo }
  setDatabases: (databases: string[]) => void
  setSelectedDatabase: (name: string | null) => void
  setDatabaseInfo: (name: string, info: DatabaseInfo) => void
  addDatabase: (name: string) => void
  removeDatabase: (name: string) => void
  clearDatabases: () => void
}

export const useDatabaseStore = create<DatabaseStore>((set) => ({
  databases: [],
  selectedDatabase: null,
  databaseInfo: {},
  setDatabases: (databases) => set({ databases }),
  setSelectedDatabase: (name) => set({ selectedDatabase: name }),
  setDatabaseInfo: (name, info) =>
    set((state) => ({
      databaseInfo: { ...state.databaseInfo, [name]: info },
    })),
  addDatabase: (name) =>
    set((state) => ({
      databases: [...state.databases, name],
    })),
  removeDatabase: (name) =>
    set((state) => {
      const { [name]: removed, ...rest } = state.databaseInfo
      return {
        databases: state.databases.filter((db) => db !== name),
        databaseInfo: rest,
        selectedDatabase:
          state.selectedDatabase === name ? null : state.selectedDatabase,
      }
    }),
  clearDatabases: () =>
    set({
      databases: [],
      databaseInfo: {},
      selectedDatabase: null,
    }),
}))
