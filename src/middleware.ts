/**
 * @fileoverview Next.js Middleware for CORS and API Key Validation
 * @description Handles CORS preflight requests, adds CORS headers to API responses,
 * and validates API keys for all API requests.
 * 
 * SECURITY: 
 * - Only allows origins from registered domains in the api_keys table
 * - Validates API keys on every request (not just CORS)
 * - NO CACHING: Always validates against the database to ensure deleted keys are immediately blocked
 */

import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for Prisma compatibility
export const runtime = 'nodejs';

// CORS headers configuration
const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization, X-Requested-With, x-api-key, Accept, Origin';
const CORS_MAX_AGE = '86400'; // 24 hours

// Always allowed origin patterns (localhost for development)
const ALWAYS_ALLOWED_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

// Routes that don't require API key validation (but still need CORS)
const PUBLIC_ROUTES = [
  '/api/domains/register', // Registration needs master_key, not api_key
  '/api/docs',
  '/api/health',
];

// =============================================================================
// DATABASE FUNCTIONS (NO CACHING - Always validate against current database state)
// =============================================================================

/**
 * Validate an API key directly against the database (no caching)
 * This ensures deleted/deactivated API keys are immediately blocked
 */
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; domain?: string; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: prisma } = await import('@/lib/prisma') as any;
    
    const record = await prisma.apiKey.findUnique({
      where: { apiKey },
      select: {
        domain: true,
        isActive: true,
      },
    });
    
    if (!record) {
      console.log(`[Middleware] API key not found in database: ${apiKey.substring(0, 8)}...`);
      return { valid: false, error: 'Invalid API key' };
    }
    
    if (!record.isActive) {
      console.log(`[Middleware] API key is deactivated: ${apiKey.substring(0, 8)}...`);
      return { valid: false, error: 'API key is deactivated' };
    }
    
    return { valid: true, domain: record.domain };
  } catch (error) {
    console.error('[Middleware] Failed to validate API key:', error);
    return { valid: false, error: 'Failed to validate API key' };
  }
}

/**
 * Check if an origin's domain is registered and active (no caching)
 * This ensures deleted domains are immediately blocked
 */
async function validateOriginDomain(origin: string): Promise<{ valid: boolean; domain?: string }> {
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: prisma } = await import('@/lib/prisma') as any;
    
    // Check exact match first
    const exactMatch = await prisma.apiKey.findFirst({
      where: {
        domain: originHost,
        isActive: true,
      },
      select: { domain: true },
    });
    
    if (exactMatch) {
      return { valid: true, domain: originHost };
    }
    
    // Check subdomain match - find all active domains and check if any is a parent of originHost
    const allDomains = await prisma.apiKey.findMany({
      where: { isActive: true },
      select: { domain: true },
    });
    
    for (const record of allDomains) {
      if (originHost.endsWith('.' + record.domain)) {
        return { valid: true, domain: record.domain };
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error('[Middleware] Failed to validate origin domain:', error);
    return { valid: false };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract API key from request
 */
function extractApiKey(request: NextRequest): string | null {
  // Check query parameter
  const queryKey = request.nextUrl.searchParams.get('api_key');
  if (queryKey) return queryKey;
  
  // Check x-api-key header
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;
  
  return null;
}

/**
 * Check if origin matches localhost patterns
 */
function isLocalhostOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  for (const pattern of ALWAYS_ALLOWED_PATTERNS) {
    if (pattern.test(origin)) return true;
  }
  
  return false;
}

/**
 * Check if origin matches NEXT_PUBLIC_APP_URL
 */
function isAppOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;
  
  try {
    return origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Check if route is public (doesn't require API key)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if request is from same origin (internal)
 */
function isInternalRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  // No origin = same-origin request
  if (!origin) return true;
  
  // Check if origin host matches request host
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
  } catch {
    // Invalid origin
  }
  
  return false;
}

/**
 * Set CORS headers on response
 */
function setCorsHeaders(response: NextResponse, origin: string | null): void {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', CORS_MAX_AGE);
  response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
}

/**
 * Create an error response
 */
function createErrorResponse(message: string, status: number, origin: string | null): NextResponse {
  const response = new NextResponse(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
  
  // Still set CORS headers on error responses so browser can read the error
  if (origin && (isLocalhostOrigin(origin) || isAppOrigin(origin))) {
    setCorsHeaders(response, origin);
  }
  
  return response;
}

// =============================================================================
// MIDDLEWARE FUNCTION
// =============================================================================

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const origin = request.headers.get('origin');
  const method = request.method;
  
  // ==========================================================================
  // STEP 0: Check if this is an iframe request (page loaded from external origin)
  // ==========================================================================
  const isApiRoute = pathname.startsWith('/api');
  const isPageRoute = !isApiRoute && (pathname === '/' || pathname.startsWith('/fill'));
  
  // For page routes, check if request is coming from an external origin (iframe embed)
  if (isPageRoute) {
    // Check if there's an api_key in the query params (iframe embed scenario)
    const apiKey = request.nextUrl.searchParams.get('api_key');
    
    if (apiKey) {
      // This is an iframe embed - validate the API key
      console.log(`[Middleware] Page request with API key: ${pathname}`);
      
      const keyValidation = await validateApiKey(apiKey);
      
      if (!keyValidation.valid) {
        console.warn(`[Middleware] Blocked iframe with invalid API key: ${keyValidation.error}`);
        // Return an HTML error page instead of JSON for page routes
        return new NextResponse(
          `<!DOCTYPE html>
<html>
<head><title>Access Denied</title></head>
<body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">
  <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #dc2626; margin: 0 0 16px;">Access Denied</h1>
    <p style="color: #666; margin: 0;">${keyValidation.error || 'Invalid API key'}</p>
    <p style="color: #999; font-size: 14px; margin-top: 16px;">Please register your domain to access the PDF editor.</p>
  </div>
</body>
</html>`,
          { 
            status: 403, 
            headers: { 'Content-Type': 'text/html' } 
          }
        );
      }
      
      console.log(`[Middleware] Iframe access granted for domain: ${keyValidation.domain}`);
    }
    
    // Allow page routes without api_key (direct access is fine)
    return NextResponse.next();
  }
  
  // Skip middleware for non-API, non-page routes (static files, etc.)
  if (!isApiRoute) {
    return NextResponse.next();
  }
  
  console.log(`[Middleware] ${method} ${pathname} from origin: ${origin || 'same-origin'}`);
  
  // ==========================================================================
  // STEP 1: Handle OPTIONS preflight requests
  // ==========================================================================
  if (method === 'OPTIONS') {
    // Check if origin is allowed for CORS
    const isLocalhost = isLocalhostOrigin(origin);
    const isApp = isAppOrigin(origin);
    const originValidation = origin ? await validateOriginDomain(origin) : { valid: false };
    
    if (!isLocalhost && !isApp && !originValidation.valid && origin) {
      console.warn(`[Middleware] Blocked preflight from unregistered origin: ${origin}`);
      return createErrorResponse(
        `Origin '${origin}' is not registered. Register your domain to get access.`,
        403,
        origin
      );
    }
    
    // Return successful preflight
    const response = new NextResponse(null, { status: 204 });
    setCorsHeaders(response, origin);
    return response;
  }
  
  // ==========================================================================
  // STEP 2: Check if origin is allowed
  // ==========================================================================
  const isLocalhost = isLocalhostOrigin(origin);
  const isApp = isAppOrigin(origin);
  const isInternal = isInternalRequest(request);
  
  let originAllowed = isLocalhost || isApp || isInternal;
  let registeredDomain: string | undefined;
  
  if (!originAllowed && origin) {
    const originValidation = await validateOriginDomain(origin);
    originAllowed = originValidation.valid;
    registeredDomain = originValidation.domain;
  }
  
  // ==========================================================================
  // STEP 3: Validate API key for non-public routes
  // ==========================================================================
  if (!isPublicRoute(pathname)) {
    // Internal/same-origin requests don't need API key
    if (!isInternal) {
      const apiKey = extractApiKey(request);
      
      if (!apiKey) {
        console.warn(`[Middleware] Missing API key for ${pathname} from ${origin || 'unknown'}`);
        return createErrorResponse(
          'API key is required. Provide via ?api_key=xxx query parameter.',
          401,
          origin
        );
      }
      
      // Validate the API key
      const keyValidation = await validateApiKey(apiKey);
      
      if (!keyValidation.valid) {
        console.warn(`[Middleware] Invalid API key for ${pathname}: ${keyValidation.error}`);
        return createErrorResponse(
          keyValidation.error || 'Invalid API key',
          401,
          origin
        );
      }
      
      // Verify API key matches the origin's registered domain
      if (registeredDomain && keyValidation.domain !== registeredDomain) {
        console.warn(`[Middleware] API key domain mismatch: key=${keyValidation.domain}, origin=${registeredDomain}`);
        return createErrorResponse(
          'API key does not match the request origin domain',
          403,
          origin
        );
      }
      
      console.log(`[Middleware] API key validated for domain: ${keyValidation.domain}`);
    }
  }
  
  // ==========================================================================
  // STEP 4: Continue with CORS headers
  // ==========================================================================
  const response = NextResponse.next();
  
  if (origin && originAllowed) {
    setCorsHeaders(response, origin);
  } else if (origin && !originAllowed) {
    console.warn(`[Middleware] Request from unregistered origin (no CORS): ${origin}`);
  }
  
  return response;
}

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match page routes that can be embedded in iframes
    '/',
    '/fill/:path*',
  ],
};
