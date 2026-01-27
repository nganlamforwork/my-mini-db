import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Plus, Trash2, Network } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// Zod schema for tree name validation
const createTreeSchema = z.object({
  treeName: z
    .string()
    .min(1, 'Tree name is required')
    .min(2, 'Tree name must be at least 2 characters')
    .max(50, 'Tree name must be at most 50 characters')
})

type CreateTreeFormValues = z.infer<typeof createTreeSchema>

export function Home() {
  const navigate = useNavigate()
  const [trees, setTrees] = useState<Array<{ name: string; metadata: any }>>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Load trees
  useEffect(() => {
    loadTrees()
  }, [])

  const loadTrees = () => {
    const allTrees = api.getAllTrees()
    setTrees(allTrees)
  }

  const form = useForm<CreateTreeFormValues>({
    resolver: zodResolver(createTreeSchema),
    defaultValues: {
      treeName: ''
    }
  })

  const handleCreateTree = async (values: CreateTreeFormValues) => {
    if (trees.length >= 6) {
      toast.error('Maximum 6 trees allowed')
      return
    }

    const trimmedName = values.treeName.trim()
    
    // Check for duplicate names
    if (trees.some(t => t.name === trimmedName)) {
      form.setError('treeName', {
        type: 'manual',
        message: 'Tree with this name already exists'
      })
      return
    }

    setIsCreating(true)
    try {
      api.createTree(trimmedName)
      api.setCurrentTreeName(trimmedName)
      setCreateDialogOpen(false)
      form.reset()
      loadTrees()
      navigate(`/tree/${encodeURIComponent(trimmedName)}`)
      toast.success('Tree created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tree')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open)
    if (!open) {
      form.reset()
    }
  }

  const handleDeleteTree = (name: string) => {
    try {
      api.deleteTree(name)
      loadTrees()
      setDeleteDialogOpen(null)
      toast.success('Tree deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tree')
    }
  }

  const handleOpenTree = (name: string) => {
    api.setCurrentTreeName(name)
    navigate(`/tree/${encodeURIComponent(name)}`)
  }

  const canCreate = trees.length < 6

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          MiniDB B+Tree Visualizer
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Interactive B+Tree visualization tool. Create and manage multiple B+Tree visualizations for presentations.
          Explore how B+Tree operations work with real-time tree visualization and step-by-step execution traces.
        </p>
      </section>

      {/* Trees Management Section */}
      <section className="container mx-auto px-4 pb-16 flex-1">
        <div className="max-w-4xl mx-auto">
          {trees.length > 0 && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Your B+Tree Visualizations</h2>
              <Dialog open={createDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button disabled={!canCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Tree
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New B+Tree</DialogTitle>
                  <DialogDescription>
                    Create a new B+Tree visualization. You can have up to 6 trees.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateTree)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="treeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Tree Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="My Presentation Tree"
                              disabled={isCreating}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Choose a descriptive name for your tree visualization
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDialogOpenChange(false)}
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          )}

          {trees.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No trees yet</p>
              <Dialog open={createDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first tree
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New B+Tree</DialogTitle>
                    <DialogDescription>
                      Create a new B+Tree visualization. You can have up to 6 trees.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateTree)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="treeName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>Tree Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="My Presentation Tree"
                                disabled={isCreating}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Choose a descriptive name for your tree visualization
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleDialogOpenChange(false)}
                          disabled={isCreating}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                          {isCreating ? 'Creating...' : 'Create'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trees.map((tree) => (
                <div
                  key={tree.name}
                  className="border rounded-lg p-4 transition-colors hover:border-primary/50 cursor-pointer group relative"
                  onClick={() => handleOpenTree(tree.name)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Network className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">{tree.name}</h3>
                    </div>
                    <AlertDialog open={deleteDialogOpen === tree.name} onOpenChange={(open) => setDeleteDialogOpen(open ? tree.name : null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteDialogOpen(tree.name)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the tree "{tree.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTree(tree.name)
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click to open and visualize
                  </p>
                  {tree.metadata && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(tree.metadata.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!canCreate && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-400">
                Maximum number of trees (6) reached. Delete a tree to create a new one.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
