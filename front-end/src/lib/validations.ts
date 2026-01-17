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

export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>
