/**
 * @fileoverview CORS Utilities
 * @description Handles CORS headers and origin validation against registered domains.
 * Works with the api_keys table to determine allowed origins.
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// TYPES
// =============================================================================

export interface CorsOptions {
  allowedMethods?: string[];
  allowedHeaders?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
}

// =============================================================================
// CACHE
// =============================================================================

// Cache for allowed domains from database
// Key: domain, Value: { origin patterns, timestamp }
interface DomainCache {
  domains: Set<string>;
  timestamp: number;
}

let domainCache: DomainCache = {
  domains: new Set(),
  timestamp: 0,
};

const CACHE_TTL = 60 * 1000; // 1 minute

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-api-key',
  'Accept',
  'Origin',
];

// Always allowed origins (development)
const ALWAYS_ALLOWED_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
];

// =============================================================================
// CACHE FUNCTIONS
// =============================================================================

/**
 * Fetch domains from database
 * Exported for use in middleware
 */
export async function fetchDomainsFromDatabase(): Promise<string[]> {
  try {
    // Dynamic import to avoid bundling Prisma for client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: prisma } = await import('./prisma') as any;
    
    const apiKeys = await prisma.apiKey.findMany({
      where: { isActive: true },
      select: { domain: true },
    });
    
    return apiKeys.map((key: { domain: string }) => key.domain);
  } catch (error) {
    console.error('[CORS] Failed to fetch domains from database:', error);
    return [];
  }
}

/**
 * Refresh the domain cache from the database
 */
export async function refreshDomainCache(): Promise<void> {
  try {
    const domains = await fetchDomainsFromDatabase();
    
    domainCache = {
      domains: new Set(domains),
      timestamp: Date.now(),
    };
    
    console.log(`[CORS] Domain cache refreshed with ${domains.length} domains`);
  } catch (error) {
    console.error('[CORS] Failed to refresh domain cache:', error);
  }
}

/**
 * Get all allowed domains from cache
 */
export async function getAllowedDomains(): Promise<Set<string>> {
  // Refresh cache if expired
  if (Date.now() - domainCache.timestamp > CACHE_TTL) {
    await refreshDomainCache();
  }
  
  return domainCache.domains;
}

/**
 * Clear the domain cache
 */
export function clearDomainCache(): void {
  domainCache = { domains: new Set(), timestamp: 0 };
}

// =============================================================================
// ORIGIN VALIDATION
// =============================================================================

/**
 * Check if an origin matches a domain pattern
 * Supports exact domain match and subdomain match
 */
function originMatchesDomain(origin: string, domain: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    
    // Exact match
    if (originHost === domain) return true;
    
    // Subdomain match (e.g., sub.example.com matches example.com)
    if (originHost.endsWith('.' + domain)) return true;
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if an origin is allowed based on registered domains
 * @param origin - The origin to check
 * @param registeredDomains - Set of registered domains
 * @returns True if origin is allowed
 */
export function isOriginAllowed(origin: string | null, registeredDomains: Set<string>): boolean {
  // No origin header = same-origin request, allow it
  if (!origin) return true;
  
  // Check against always-allowed patterns (localhost, etc.)
  for (const pattern of ALWAYS_ALLOWED_PATTERNS) {
    if (pattern.test(origin)) return true;
  }
  
  // Check against registered domains
  for (const domain of registeredDomains) {
    if (originMatchesDomain(origin, domain)) return true;
  }
  
  // Check NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const appOrigin = new URL(appUrl).origin;
      if (origin === appOrigin) return true;
    } catch {
      // Invalid APP_URL
    }
  }
  
  return false;
}

/**
 * Async version that checks against database
 */
export async function isOriginAllowedAsync(origin: string | null): Promise<boolean> {
  if (!origin) return true;
  
  // Quick check against always-allowed patterns
  for (const pattern of ALWAYS_ALLOWED_PATTERNS) {
    if (pattern.test(origin)) return true;
  }
  
  // Get registered domains from cache/database
  const registeredDomains = await getAllowedDomains();
  
  return isOriginAllowed(origin, registeredDomains);
}

// =============================================================================
// CORS HEADERS
// =============================================================================

/**
 * Create CORS headers for a response
 */
export function createCorsHeaders(
  origin: string | null,
  options: CorsOptions = {}
): Headers {
  const headers = new Headers();
  
  const {
    allowedMethods = DEFAULT_ALLOWED_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    allowCredentials = true,
    maxAge = 86400, // 24 hours
  } = options;
  
  // Set origin - use specific origin for credentials support
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  
  // Set methods
  headers.set('Access-Control-Allow-Methods', allowedMethods.join(', '));
  
  // Set headers
  headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  
  // Set credentials
  if (allowCredentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Set max age for preflight caching
  headers.set('Access-Control-Max-Age', maxAge.toString());
  
  // Expose headers that client can read
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  return headers;
}

/**
 * Add CORS headers to an existing response
 */
export function addCorsToResponse(
  response: Response,
  origin: string | null,
  options: CorsOptions = {}
): Response {
  const corsHeaders = createCorsHeaders(origin, options);
  
  // Clone the response and add CORS headers
  const newHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Add CORS headers to a NextResponse
 */
export function addCorsToNextResponse(
  response: NextResponse,
  origin: string | null,
  options: CorsOptions = {}
): NextResponse {
  const corsHeaders = createCorsHeaders(origin, options);
  
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  
  return response;
}

// =============================================================================
// CORS RESPONSE HELPERS
// =============================================================================

/**
 * Create a preflight OPTIONS response with CORS headers
 */
export function createPreflightResponse(
  origin: string | null,
  options: CorsOptions = {}
): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCorsToNextResponse(response, origin, options);
}

/**
 * Create a CORS error response for blocked origins
 */
export function createCorsErrorResponse(origin: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: `Origin '${origin}' is not allowed. Register your domain at /api/domains/register to get access.`,
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// =============================================================================
// CORS WRAPPER FOR API ROUTES
// =============================================================================

/**
 * Wrap an API route handler with CORS support
 * Use this in API routes to add CORS headers automatically
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withCors(request, async () => {
 *     // Your API logic here
 *     return createSuccessResponse({ data: 'hello' });
 *   });
 * }
 * 
 * export async function OPTIONS(request: NextRequest) {
 *   return handleCorsPreflightRequest(request);
 * }
 * ```
 */
export async function withCors(
  request: NextRequest,
  handler: () => Promise<Response>,
  options: CorsOptions = {}
): Promise<Response> {
  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  const allowed = await isOriginAllowedAsync(origin);
  
  if (!allowed && origin) {
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return createCorsErrorResponse(origin);
  }
  
  // Execute the handler
  const response = await handler();
  
  // Add CORS headers to the response
  return addCorsToResponse(response, origin, options);
}

/**
 * Handle CORS preflight (OPTIONS) request
 */
export async function handleCorsPreflightRequest(
  request: NextRequest,
  options: CorsOptions = {}
): Promise<Response> {
  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  const allowed = await isOriginAllowedAsync(origin);
  
  if (!allowed && origin) {
    console.warn(`[CORS] Blocked preflight from origin: ${origin}`);
    return createCorsErrorResponse(origin);
  }
  
  return createPreflightResponse(origin, options);
}
