import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DatabaseHeader } from '@/components/DatabaseHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SchemaBuilder } from '@/components/SchemaBuilder';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTableSchema, type CreateTableInput } from '@/lib/validations';
import { api } from '@/lib/api';
import { Plus, Table as TableIcon } from 'lucide-react';

export function DatabaseDetail() {
  const { name: dbName } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [tables, setTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [useCustomConfig, setUseCustomConfig] = useState(false);
  const [schemaData, setSchemaData] = useState<{
    columns: Array<{ name: string; type: 'INT' | 'STRING' | 'FLOAT' | 'BOOL' }>;
    primaryKey: string[];
  }>({
    columns: [],
    primaryKey: [],
  });

  // Form setup for table creation
  const form = useForm<CreateTableInput>({
    resolver: zodResolver(createTableSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      config: {
        order: 4,
        pageSize: 4096,
        walEnabled: true,
        cacheSize: 100,
      },
      schema: {
        columns: [],
        primaryKey: [],
      },
    },
  });

  // Sync schemaData with form state
  useEffect(() => {
    form.setValue('schema.columns', schemaData.columns, { shouldValidate: true });
    form.setValue('schema.primaryKey', schemaData.primaryKey, { shouldValidate: true });
  }, [schemaData, form]);

  // Load tables when component mounts
  useEffect(() => {
    if (!dbName) return;
    
    const loadTables = async () => {
      setIsLoading(true);
      try {
        // TODO: Backend needs GET /api/databases/{dbName}/tables endpoint
        // For now, try to connect and infer tables, or use empty array
        const tablesList = await api.listTables(dbName);
        setTables(tablesList);
      } catch (error) {
        console.error('Failed to load tables:', error);
        // For now, set empty array - tables will be discovered when connecting
        setTables([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTables();
  }, [dbName]);

  const handleCreateTable = async (data: CreateTableInput) => {
    if (!dbName) return;
    
    setIsCreating(true);
    
    try {
      const createResponse = await api.createTable(dbName, {
        name: data.name,
        config: useCustomConfig ? data.config : undefined,
        schema: {
          columns: schemaData.columns,
          primaryKey: schemaData.primaryKey,
        },
      });

      if (!createResponse.success) {
        throw new Error('Table creation failed');
      }

      // Refresh tables list
      const tablesList = await api.listTables(dbName);
      setTables(tablesList);

      // Close dialog and reset form
      setCreateTableOpen(false);
      setUseCustomConfig(false);
      setSchemaData({
        columns: [],
        primaryKey: [],
      });
      form.reset();

      toast.success('Table created successfully', {
        description: `Table "${data.name}" has been created.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while creating the table.';
      toast.error('Failed to create table', {
        description: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    if (!dbName) return;
    navigate(`/databases/${dbName}/tables/${tableName}`);
  };

  const isSchemaValid = schemaData.columns.length > 0 &&
    schemaData.columns.every(col => col.name.trim() !== '') &&
    schemaData.primaryKey.length > 0 &&
    schemaData.primaryKey.every(pk => schemaData.columns.some(col => col.name === pk));
  
  const isFormValid = form.formState.isValid && isSchemaValid;

  if (!dbName) {
    return <div>Database name is required</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DatabaseHeader databaseName={dbName} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Database: {dbName}</h1>
              <p className="text-sm text-muted-foreground">Manage tables in this database</p>
            </div>
            <Dialog open={createTableOpen} onOpenChange={setCreateTableOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Table
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateTable)}>
                    <DialogHeader>
                      <DialogTitle>Create New Table</DialogTitle>
                      <DialogDescription>
                        Create a new table with a schema and B+ Tree configuration. Each table has its own B+ Tree.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required>Table Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="users"
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
                            Define columns, types, and primary key. Required for all tables.
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
                            Customize B+ Tree settings (order, page size, cache, WAL)
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
                          <h3 className="text-sm font-semibold">B+ Tree Configuration</h3>
                        
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
                          setCreateTableOpen(false);
                          setUseCustomConfig(false);
                          form.reset();
                        }}
                        disabled={isCreating}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isCreating || !isFormValid}
                      >
                        {isCreating ? 'Creating...' : 'Create Table'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tables List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <TableIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No tables yet</p>
              <Dialog open={createTableOpen} onOpenChange={setCreateTableOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first table
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tables.map((tableName) => (
                <div
                  key={tableName}
                  className="border rounded-lg p-4 transition-colors hover:border-primary/50 cursor-pointer group relative"
                  onClick={() => handleTableClick(tableName)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <TableIcon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">{tableName}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click to view table details and B+ Tree visualization
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
