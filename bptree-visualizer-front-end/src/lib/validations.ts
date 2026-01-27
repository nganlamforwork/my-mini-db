import { z } from 'zod'

// Database name validation schema
// Rules: no spaces, no special characters like @, #, etc.
// Only alphanumeric characters, underscores, and hyphens allowed
export const createDatabaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Database name is required')
    .max(50, 'Database name must be 50 characters or less')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Database name can only contain letters, numbers, underscores, and hyphens. No spaces or special characters allowed.'
    )
    .refine(
      (val) => !val.startsWith('-') && !val.startsWith('_'),
      'Database name cannot start with a hyphen or underscore'
    )
    .refine(
      (val) => !val.endsWith('-') && !val.endsWith('_'),
      'Database name cannot end with a hyphen or underscore'
    ),
})

// Table creation validation schema
export const createTableSchema = z.object({
  name: z
    .string()
    .min(1, 'Table name is required')
    .max(50, 'Table name must be 50 characters or less')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Table name can only contain letters, numbers, underscores, and hyphens. No spaces or special characters allowed.'
    )
    .refine(
      (val) => !val.startsWith('-') && !val.startsWith('_'),
      'Table name cannot start with a hyphen or underscore'
    )
    .refine(
      (val) => !val.endsWith('-') && !val.endsWith('_'),
      'Table name cannot end with a hyphen or underscore'
    ),
  config: z
    .object({
      order: z
        .number()
        .int('B+Tree order must be an integer')
        .min(2, 'B+Tree order must be at least 2')
        .max(100, 'B+Tree order must be at most 100')
        .optional(),
      pageSize: z
        .number()
        .int('Page size must be an integer')
        .min(512, 'Page size must be at least 512 bytes')
        .max(65536, 'Page size must be at most 65536 bytes')
        .optional(),
      walEnabled: z.boolean().optional(),
      cacheSize: z
        .number()
        .int('Cache size must be an integer')
        .min(1, 'Cache size must be at least 1')
        .max(10000, 'Cache size must be at most 10000')
        .optional(),
    })
    .optional(),
  schema: z.object({
    columns: z.array(z.object({
      name: z.string().min(1, 'Column name is required'),
      type: z.enum(['INT', 'STRING', 'FLOAT', 'BOOL']),
    })).min(1, 'At least one column is required'),
    primaryKey: z.array(z.string()).min(1, 'At least one primary key column is required'),
  }),
}).refine(
  (data) => {
    // All primary key columns must exist in columns
    if (data.schema.columns && data.schema.primaryKey) {
      const columnNames = new Set(data.schema.columns.map(col => col.name));
      return data.schema.primaryKey.every(pk => columnNames.has(pk));
    }
    return true;
  },
  {
    message: 'All primary key columns must exist in the columns list',
    path: ['schema', 'primaryKey'],
  }
)

export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>
export type CreateTableInput = z.infer<typeof createTableSchema>
