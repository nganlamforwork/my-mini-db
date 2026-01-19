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
})

export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>
