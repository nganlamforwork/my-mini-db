import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Database, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { createDatabaseSchema, type CreateDatabaseInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useDatabaseStore } from '@/store/databaseStore'

export function Home() {
  const queryClient = useQueryClient()
  const { addDatabase, removeDatabase } = useDatabaseStore()
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)

  // Fetch databases list
  const { data: databases = [], isLoading } = useQuery({
    queryKey: ['databases'],
    queryFn: api.listDatabases,
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  // Form setup with zod validation
  const form = useForm<CreateDatabaseInput>({
    resolver: zodResolver(createDatabaseSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
    },
  })

  // Create database mutation
  const createMutation = useMutation({
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
      setOpen(false)
      form.reset()
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

  const handleCreateDatabase = (data: CreateDatabaseInput) => {
    createMutation.mutate(data.name)
  }

  // Delete database mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.dropDatabase(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      removeDatabase(name)
      setDeleteDialogOpen(null)
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

  // Clear all databases mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const allDbs = await api.listDatabases()
      await Promise.all(allDbs.map((name) => api.dropDatabase(name)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      setClearAllDialogOpen(false)
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

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name)
  }

  const handleClearAll = () => {
    clearAllMutation.mutate()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
          {/* Hero Section */}
          <section className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              MiniDB
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              A lightweight, educational B+Tree database implementation with step-by-step
              visualization. Explore how databases work under the hood with real-time
              tree operations and execution traces.
            </p>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Create Database
              </Button>
            </DialogTrigger>
          </section>

          {/* Databases List Section */}
          <section className="container mx-auto px-4 pb-16 flex-1">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Your Databases</h2>
                {databases.length > 0 && (
                  <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={clearAllMutation.isPending}>
                        <X className="h-4 w-4 mr-2" />
                        {clearAllMutation.isPending ? 'Clearing...' : 'Clear All'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete all {databases.length} database{databases.length !== 1 ? 's' : ''} from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={clearAllMutation.isPending}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearAll}
                          disabled={clearAllMutation.isPending}
                        >
                          {clearAllMutation.isPending ? 'Clearing...' : 'Clear All'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading databases...
                </div>
              ) : databases.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                  <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">No databases yet</p>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first database
                    </Button>
                  </DialogTrigger>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {databases.map((dbName) => (
                    <div
                      key={dbName}
                      className="border rounded-lg p-4 hover:border-primary/50 transition-colors group relative"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Database className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">{dbName}</h3>
                        </div>
                        <AlertDialog open={deleteDialogOpen === dbName} onOpenChange={(open) => setDeleteDialogOpen(open ? dbName : null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteDialogOpen(dbName)
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the database "{dbName}" from the system.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deleteMutation.isPending}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(dbName)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click to view details
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateDatabase)}>
              <DialogHeader>
                <DialogTitle>Create New Database</DialogTitle>
                <DialogDescription>
                  Enter a name for your new database. Only letters, numbers, underscores, and hyphens are allowed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Database Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="mydb"
                          disabled={createMutation.isPending}
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    form.reset()
                  }}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
