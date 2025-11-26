/**
 * @fileoverview Environment configuration with validation
 * @description Centralized environment variable management with Zod validation
 * for type-safe configuration access throughout the application.
 */

import { z } from 'zod';

// =============================================================================
// ENVIRONMENT SCHEMA
// =============================================================================

/**
 * Schema for validating environment variables
 * @description All required and optional environment variables with their types
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().describe('MySQL database connection URL'),

  // API Security
  API_KEY: z.string().min(16).optional().describe('API key for route protection'),

  // File Upload Configuration
  UPLOAD_DIR: z.string().default('./public/uploads').describe('Directory for file uploads'),
  MAX_FILE_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('104857600')
    .describe('Maximum file size in bytes'),

  // Node Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('Application environment'),

  // Next.js
  NEXT_PUBLIC_APP_URL: z.string().url().optional().describe('Public application URL'),
});

// =============================================================================
// ENVIRONMENT PARSING
// =============================================================================

/**
 * Parse and validate environment variables
 * @description Validates all environment variables against the schema
 * @throws {z.ZodError} If validation fails
 */
function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    
    // In development, show helpful message
    if (process.env.NODE_ENV === 'development') {
      console.error('\n💡 Tip: Create a .env file with the required variables.');
      console.error('See .env.example for reference.\n');
    }
    
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Validated environment configuration
 * @description Type-safe access to all environment variables
 * 
 * @example
 * ```typescript
 * import { env } from '@/lib/env';
 * 
 * // Type-safe access
 * const dbUrl = env.DATABASE_URL;
 * const maxSize = env.MAX_FILE_SIZE; // number
 * ```
 */
export const env = parseEnv();

/**
 * Environment type derived from schema
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Check if running in development mode
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in test mode
 */
export const isTest = env.NODE_ENV === 'test';
