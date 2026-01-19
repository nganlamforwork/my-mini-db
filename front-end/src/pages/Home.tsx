import { useState } from 'react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Plus, Database, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createDatabaseSchema, type CreateDatabaseInput } from '@/lib/validations'
import { useDatabases } from '@/hooks/useDatabases'
import { useDeleteDatabase, useClearAllDatabases } from '@/hooks/useDatabaseMutations'
import { Button } from '@/components/ui/button'
import { SchemaBuilder } from '@/components/SchemaBuilder'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ColumnDefinition } from '@/types/database'
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
import { Switch } from '@/components/ui/switch'
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

export function Home() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [useCustomConfig, setUseCustomConfig] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [connectingDbName, setConnectingDbName] = useState<string | null>(null)
  const [schemaData, setSchemaData] = useState<{
    columns: ColumnDefinition[];
    primaryKey: string[];
  }>({
    columns: [],
    primaryKey: [],
  })

  // Fetch databases list
  const { data: databases = [], isLoading } = useDatabases()

  // Mutations (createMutation removed - using direct API calls for synchronous flow)
  const deleteMutation = useDeleteDatabase()
  const clearAllMutation = useClearAllDatabases()

  // Form setup with zod validation
  const form = useForm<CreateDatabaseInput>({
    resolver: zodResolver(createDatabaseSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      config: {
        order: 4,
        pageSize: 4096,
        walEnabled: true,
        cacheSize: 100,
      },
      columns: [],
      primaryKey: [],
    },
  })

  // Sync schemaData with form state whenever it changes
  React.useEffect(() => {
    form.setValue('columns', schemaData.columns, { shouldValidate: true })
    form.setValue('primaryKey', schemaData.primaryKey, { shouldValidate: true })
  }, [schemaData, form])

  const handleCreateDatabase = async (data: CreateDatabaseInput) => {
    // Set loading state
    setIsCreating(true)
    
    try {
      // Build submit data - schema is mandatory (1 Database = 1 Table = 1 B+ Tree)
      const submitData: CreateDatabaseInput = {
        name: data.name,
        ...(useCustomConfig ? { config: data.config } : {}),
        // Schema is always included (mandatory)
        columns: schemaData.columns,
        primaryKey: schemaData.primaryKey,
      }
      
      // Step 1: Create database and await response
      const createResponse = await api.createDatabase({
        name: submitData.name,
        config: submitData.config,
        columns: submitData.columns,
        primaryKey: submitData.primaryKey,
      })
      
      // Check if creation was successful
      if (!createResponse.success) {
        throw new Error('Database creation failed')
      }
      
      // Step 2: Connect to the newly created database and await
      const connectResponse = await api.connectDatabase({
        name: submitData.name,
        config: submitData.config ? { cacheSize: submitData.config.cacheSize } : undefined,
      })
      
      // Check if connection was successful
      if (!connectResponse.success) {
        throw new Error(connectResponse.message || 'Failed to connect to database')
      }
      
      // Step 3: Only navigate on success
      // Close dialog and reset form
      setOpen(false)
      setUseCustomConfig(false)
      setSchemaData({
        columns: [],
        primaryKey: [],
      })
      form.reset()
      
      // Navigate to database detail page
      navigate(`/databases/${submitData.name}`)
      
    } catch (error) {
      // Show error toast and stop - do NOT redirect
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating the database.'
      toast.error('Failed to create database', {
        description: errorMessage,
      })
    } finally {
      // Always reset loading state
      setIsCreating(false)
    }
  }

  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset state when dialog closes
      setUseCustomConfig(false)
      setSchemaData({
        columns: [],
        primaryKey: [],
      })
      form.reset()
    }
  }

  // Handle database card click - connect before navigating
  const handleDatabaseClick = async (dbName: string) => {
    // Set loading state for this specific database
    setConnectingDbName(dbName)
    
    try {
      // Await connection API call - strictly synchronous
      const connectResponse = await api.connectDatabase({
        name: dbName,
        config: { cacheSize: 100 },
      })
      
      // Check if connection was successful
      if (!connectResponse.success) {
        throw new Error(connectResponse.message || 'Failed to connect to database')
      }
      
      // ONLY navigate after successful connection (strictly after await)
      navigate(`/databases/${dbName}`)
      
    } catch (error) {
      // Show error toast and stop - do NOT redirect
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while connecting to the database.'
      toast.error('Failed to connect to database', {
        description: errorMessage,
      })
    } finally {
      // Always reset loading state
      setConnectingDbName(null)
    }
  }

  // Validation: Check if schema is valid (at least one column and primary key)
  // Also check form validation state
  const isSchemaValid = schemaData.columns.length > 0 &&
    schemaData.columns.every(col => col.name.trim() !== '') &&
    schemaData.primaryKey.length > 0 &&
    schemaData.primaryKey.every(pk => schemaData.columns.some(col => col.name === pk))
  
  const isFormValid = form.formState.isValid && isSchemaValid

  const handleDelete = (name: string, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    deleteMutation.mutate(name, {
      onSuccess: () => {
        setDeleteDialogOpen(null)
      },
    })
  }

  const handleClearAll = () => {
    clearAllMutation.mutate(undefined, {
      onSuccess: () => {
        setClearAllDialogOpen(false)
      },
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
          </section>

          {/* Databases List Section */}
          <section className="container mx-auto px-4 pb-16 flex-1">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Your Databases</h2>
                <div className="flex items-center gap-2">
                  {databases.length > 0 && (
                    <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" disabled={clearAllMutation.isPending}>
                          <Trash2 className="h-4 w-4 mr-2" />
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
                  <DialogTrigger asChild>
                    <Button  className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Database
                    </Button>
                  </DialogTrigger>
                </div>
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
                  {databases.map((dbName) => {
                    const isConnecting = connectingDbName === dbName
                    return (
                      <div
                        key={dbName}
                        className={cn(
                          "border rounded-lg p-4 transition-colors group relative",
                          isConnecting ? "cursor-wait opacity-75" : "hover:border-primary/50 cursor-pointer"
                        )}
                        onClick={() => !isConnecting && handleDatabaseClick(dbName)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {isConnecting ? (
                              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Database className="h-5 w-5 text-primary" />
                            )}
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
                                disabled={isConnecting}
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
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDelete(dbName, e)
                                  }}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isConnecting ? 'Connecting...' : 'Click to view details'}
                        </p>
                      </div>
                    )
                  })}
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
                  Create a new database with a mandatory schema. Architecture: 1 Database = 1 Table = 1 B+ Tree. The database name serves as the table identifier. Only letters, numbers, underscores, and hyphens are allowed for the name.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Database Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="mydb"
                          disabled={isCreating}
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Table Schema Definition - Mandatory */}
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Table Schema Definition <span className="text-destructive">*</span></h3>
                    <p className="text-xs text-muted-foreground">
                      Define columns, types, and primary key. Required for all databases.
                    </p>
                  </div>
                  <SchemaBuilder
                    value={schemaData}
                    onChange={setSchemaData}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Use Custom Configuration
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Customize database settings (order, page size, cache, WAL)
                    </p>
                  </div>
                  <Switch
                    checked={useCustomConfig}
                    onCheckedChange={setUseCustomConfig}
                    disabled={isCreating}
                  />
                </div>

                {useCustomConfig && (
                  <div className="space-y-4 pt-2 border-t animate-in slide-in-from-top-2 duration-200">
                    <h3 className="text-sm font-semibold">Configuration</h3>
                  
                  <FormField
                    control={form.control}
                    name="config.order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>B+Tree Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="4"
                            disabled={isCreating}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Number of keys per node (default: 4)
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="config.pageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page Size (bytes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="4096"
                            disabled={isCreating}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Size of each page in bytes (default: 4096)
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="config.cacheSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cache Size (pages)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            disabled={isCreating}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Maximum number of pages in cache (default: 100)
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="config.walEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Write-Ahead Log (WAL)</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Enable WAL for durability (default: enabled)
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                            disabled={isCreating}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    setUseCustomConfig(false)
                    form.reset()
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isCreating || !isFormValid}
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
