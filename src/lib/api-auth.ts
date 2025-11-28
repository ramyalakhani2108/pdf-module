/**
 * @fileoverview API Authentication Utilities
 * @description Handles API key validation for all API routes.
 * Supports API key via query parameter (?api_key=xxx) or request body ({ api_key: xxx }).
 * Validates against registered domains in the database.
 */

import { NextRequest } from 'next/server';

// =============================================================================
// TYPES
// =============================================================================

export interface ApiKeyValidationResult {
  isValid: boolean;
  domain?: string;
  error?: string;
}

// Cache for API key validation to reduce database calls
// Key: apiKey, Value: { domain, isActive, timestamp }
const apiKeyCache = new Map<string, { domain: string; isActive: boolean; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL

// Flag to track if cache has been initialized
let cacheInitialized = false;
let cacheInitializing = false;

// =============================================================================
// CACHE INITIALIZATION
// =============================================================================

/**
 * Initialize the API key cache by loading all active API keys from the database
 * This is called on first API request to ensure sync validation works
 * Only runs on server-side
 */
async function initializeCache(): Promise<void> {
  if (cacheInitialized || cacheInitializing) return;
  
  // Only run on server
  if (typeof window !== 'undefined') return;
  
  cacheInitializing = true;
  
  try {
    // Dynamic import to avoid bundling Prisma for client
    const { default: prisma } = await import('./prisma');
    
    const apiKeys = await prisma.apiKey.findMany({
      select: {
        apiKey: true,
        domain: true,
        isActive: true,
      },
    });
    
    const now = Date.now();
    for (const key of apiKeys) {
      apiKeyCache.set(key.apiKey, {
        domain: key.domain,
        isActive: key.isActive,
        timestamp: now,
      });
    }
    
    cacheInitialized = true;
    console.log(`[API Auth] Cache initialized with ${apiKeys.length} API keys`);
  } catch (error) {
    console.error('[API Auth] Failed to initialize cache:', error);
  } finally {
    cacheInitializing = false;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract API key from various sources in the request
 * Priority: 1) Query param (?api_key=xxx), 2) Already parsed body if available
 * 
 * @param request - Next.js Request object
 * @param parsedBody - Optional pre-parsed body (for POST/PUT requests)
 * @returns The API key if found, null otherwise
 */
export function extractApiKey(request: NextRequest, parsedBody?: Record<string, unknown>): string | null {
  // 1. Check query parameter first (highest priority for GET requests)
  const queryApiKey = request.nextUrl.searchParams.get('api_key');
  if (queryApiKey) {
    return queryApiKey;
  }

  // 2. Check pre-parsed body for api_key
  if (parsedBody && typeof parsedBody.api_key === 'string') {
    return parsedBody.api_key;
  }

  return null;
}

/**
 * Check if the current request is from the same origin (internal request)
 * This allows the frontend to make API calls without an API key
 * 
 * @param request - Next.js Request object
 * @returns True if the request is from the same origin
 */
export function isInternalRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Get the app URL from environment
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${host}`;
  
  try {
    const appHost = new URL(appUrl).host;
    
    // Check if origin matches
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost === appHost || originHost === host) {
        return true;
      }
    }
    
    // Check if referer matches
    if (referer) {
      const refererHost = new URL(referer).host;
      if (refererHost === appHost || refererHost === host) {
        return true;
      }
    }
  } catch {
    // URL parsing failed, not an internal request
  }
  
  return false;
}

/**
 * Validate the API key against the database
 * Uses caching to reduce database calls
 * 
 * @param apiKey - The API key to validate
 * @returns Validation result with domain information
 */
export async function validateApiKeyFromDb(apiKey: string): Promise<ApiKeyValidationResult> {
  // Check cache first
  const cached = apiKeyCache.get(apiKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (cached.isActive) {
      return { isValid: true, domain: cached.domain };
    } else {
      return { isValid: false, error: 'API key is deactivated' };
    }
  }

  try {
    // Dynamic import to avoid bundling Prisma for client
    const { default: prisma } = await import('./prisma');
    
    // Query database for API key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { apiKey },
      select: {
        domain: true,
        isActive: true,
      },
    });

    if (!apiKeyRecord) {
      return { isValid: false, error: 'Invalid API key' };
    }

    // Update cache
    apiKeyCache.set(apiKey, {
      domain: apiKeyRecord.domain,
      isActive: apiKeyRecord.isActive,
      timestamp: Date.now(),
    });

    if (!apiKeyRecord.isActive) {
      return { isValid: false, error: 'API key is deactivated' };
    }

    return { isValid: true, domain: apiKeyRecord.domain };
  } catch (error) {
    console.error('[API Auth] Database error:', error);
    return { isValid: false, error: 'Authentication service unavailable' };
  }
}

/**
 * Validate the master/environment API key
 * This is the fallback for backward compatibility
 * 
 * @param apiKey - The API key to validate
 * @returns True if the key matches the environment API_KEY
 */
export function validateMasterApiKey(apiKey: string): boolean {
  const masterKey = process.env.API_KEY;
  
  if (!masterKey) {
    // In development, allow empty master key for testing
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ No API_KEY configured - development mode');
      return true;
    }
    return false;
  }
  
  return apiKey === masterKey;
}

/**
 * Clear the API key cache (useful for testing or after key updates)
 */
export function clearApiKeyCache(): void {
  apiKeyCache.clear();
  cacheInitialized = false;
}

/**
 * Remove a specific key from cache (useful after deactivation)
 */
export function invalidateCachedApiKey(apiKey: string): void {
  apiKeyCache.delete(apiKey);
}

/**
 * Refresh the cache by reloading all API keys from database
 */
export async function refreshApiKeyCache(): Promise<void> {
  // Only run on server
  if (typeof window !== 'undefined') return;
  
  cacheInitialized = false;
  cacheInitializing = false;
  apiKeyCache.clear();
  await initializeCache();
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate API key from request
 * 
 * This function validates API keys from multiple sources:
 * 1. Query parameter: ?api_key=xxx
 * 2. Request body: { api_key: xxx }
 * 3. Internal requests (same origin) are allowed without API key
 * 
 * The API key is validated against:
 * 1. Registered domains in the database
 * 2. Master API key from environment (backward compatibility)
 * 
 * @param request - Next.js Request object
 * @param parsedBody - Optional pre-parsed request body
 * @returns Promise<ApiKeyValidationResult>
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const body = await request.json();
 *   const authResult = await validateApiKeyAsync(request, body);
 *   
 *   if (!authResult.isValid) {
 *     return createErrorResponse(authResult.error || 'Unauthorized', 401);
 *   }
 *   
 *   // Continue with authorized request
 *   // authResult.domain contains the registered domain if available
 * }
 * ```
 */
export async function validateApiKeyAsync(
  request: NextRequest,
  parsedBody?: Record<string, unknown>
): Promise<ApiKeyValidationResult> {
  // 1. Check if it's an internal request (same origin)
  if (isInternalRequest(request)) {
    return { isValid: true, domain: 'internal' };
  }

  // 2. Extract API key from request
  const apiKey = extractApiKey(request, parsedBody);
  
  if (!apiKey) {
    return { isValid: false, error: 'API key is required. Provide via ?api_key=xxx query parameter or api_key in request body.' };
  }

  // 3. First, check against master API key (for backward compatibility)
  if (validateMasterApiKey(apiKey)) {
    return { isValid: true, domain: 'master' };
  }

  // 4. Validate against registered domains in database
  return validateApiKeyFromDb(apiKey);
}

// =============================================================================
// SYNCHRONOUS WRAPPER (for backward compatibility)
// =============================================================================

/**
 * Synchronous API key validation
 * 
 * This function validates API keys synchronously by:
 * 1. Checking if it's an internal request (same origin)
 * 2. Checking query parameter against master key
 * 3. Checking query parameter against cached API keys from database
 * 
 * Note: For full database validation, use validateApiKeyAsync
 * 
 * @param request - Request object
 * @returns True if valid (master key, internal request, or cached API key)
 */
export function validateApiKey(request: Request): boolean {
  // Check if it's an internal request
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${host}`;
  
  try {
    const appHost = new URL(appUrl).host;
    
    if (origin) {
      const originHost = new URL(origin).host;
      if (originHost === appHost || originHost === host) {
        return true;
      }
    }
    
    if (referer) {
      const refererHost = new URL(referer).host;
      if (refererHost === appHost || refererHost === host) {
        return true;
      }
    }
  } catch {
    // URL parsing failed
  }

  // Check query parameter
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('api_key');
  
  if (queryApiKey) {
    // Check against master API key first
    if (validateMasterApiKey(queryApiKey)) {
      return true;
    }
    
    // Check against cached API keys (for database-registered keys)
    const cached = apiKeyCache.get(queryApiKey);
    if (cached && cached.isActive && Date.now() - cached.timestamp < CACHE_TTL) {
      return true;
    }
    
    // For uncached keys, trigger async validation to populate cache
    // This will make the NEXT request work
    if (!cacheInitialized) {
      // If cache is not initialized, do it now (but we can't wait synchronously)
      initializeCache().catch(() => {});
    }
    
    // Also validate this specific key
    validateApiKeyFromDb(queryApiKey).then(result => {
      if (result.isValid) {
        console.log(`[API Auth] Key validated and cached: ${result.domain}`);
      }
    }).catch(() => {});
    
    // Since we're doing sync validation, check if this key exists in cache after init
    // This is a workaround - the first request may fail, but subsequent ones will work
    const cachedAfterInit = apiKeyCache.get(queryApiKey);
    if (cachedAfterInit && cachedAfterInit.isActive) {
      return true;
    }
    
    return false;
  }

  // For development without API_KEY configured
  const masterKey = process.env.API_KEY;
  if (!masterKey && process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}
