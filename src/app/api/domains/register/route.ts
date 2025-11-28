/**
 * @fileoverview Domain Registration API Route
 * @description Registers a domain and webhook, generates an API key for external access.
 * This API key allows the registered domain (and its subdomains) to access all APIs.
 * 
 * SECURITY: Domain is extracted from the request origin/referer header by middleware,
 * not from user input, to prevent domain spoofing.
 * 
 * @swagger
 * /api/domains/register:
 *   post:
 *     summary: Register a domain and get API key
 *     description: |
 *       Register the calling domain with optional webhook URL. Returns a unique API key
 *       that allows the registered domain and all its subdomains to access the PDF APIs.
 *       The domain is automatically detected from the request origin - cannot be spoofed.
 *       If the domain is already registered, returns the existing API key.
 *     tags: [Domain Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhook:
 *                 type: string
 *                 format: uri
 *                 description: Optional webhook URL for notifications
 *                 example: "https://example.com/webhook"
 *               master_key:
 *                 type: string
 *                 description: Master API key for authorization
 *                 example: "your-master-api-key"
 *     responses:
 *       200:
 *         description: Domain already registered - returning existing API key
 *       201:
 *         description: Domain registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique identifier for the registration
 *                     domain:
 *                       type: string
 *                       description: Registered domain
 *                     apiKey:
 *                       type: string
 *                       description: Generated API key for accessing APIs
 *                     webhook:
 *                       type: string
 *                       nullable: true
 *                       description: Registered webhook URL
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request - could not determine domain from request
 *       401:
 *         description: Unauthorized - Invalid master key
 *       500:
 *         description: Server error
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { refreshApiKeyCache } from '@/lib/api-auth';
import { clearDomainCache } from '@/lib/cors';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for domain registration request
 * Note: domain is no longer accepted from user input - extracted from request headers
 */
const registerDomainSchema = z.object({
  webhook: z
    .string()
    .url('Invalid webhook URL format')
    .optional()
    .nullable(),
  master_key: z
    .string()
    .min(1, 'Master key is required')
    .optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a secure API key with prefix for easy identification
 * Format: pdf_sk_<uuid>
 */
function generateApiKey(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `pdf_sk_${uuid}`;
}

/**
 * Validate master key for domain registration
 * Uses the API_KEY from environment as the master key
 */
function validateMasterKey(providedKey: string | undefined): boolean {
  const masterKey = process.env.API_KEY;
  
  if (!masterKey) {
    // In development without API_KEY, allow registration
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ No API_KEY configured - allowing registration in development mode');
      return true;
    }
    return false;
  }
  
  return providedKey === masterKey;
}

/**
 * Extract domain from request origin or referer header
 * This cannot be spoofed by the client as browsers enforce these headers
 */
function extractDomainFromRequest(request: NextRequest): string | null {
  // Try origin header first (set by browser for cross-origin requests)
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      // Invalid origin URL
    }
  }
  
  // Fall back to referer header
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return url.hostname;
    } catch {
      // Invalid referer URL
    }
  }
  
  return null;
}

/**
 * Normalize domain to lowercase
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim();
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /api/domains/register
 * @description Register the calling domain and get an API key
 * Domain is extracted from request headers - cannot be spoofed
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {}; // Allow empty body
    }

    const validation = registerDomainSchema.safeParse(body);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(', ');
      return createErrorResponse(errors, 400);
    }

    const { webhook, master_key } = validation.data;

    // Validate master key for authorization
    if (!validateMasterKey(master_key)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    // Extract domain from request headers (cannot be spoofed)
    const extractedDomain = extractDomainFromRequest(request);
    
    if (!extractedDomain) {
      return createErrorResponse(
        'Could not determine domain from request. Ensure the request includes Origin or Referer header.',
        400
      );
    }

    // Normalize domain
    const normalizedDomain = normalizeDomain(extractedDomain);
    
    console.log(`[Domain Register] Processing registration for domain: ${normalizedDomain}`);

    // Check if domain is already registered
    const existingDomain = await prisma.apiKey.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existingDomain) {
      console.log(`[Domain Register] Domain already registered, returning existing API key: ${normalizedDomain}`);
      
      // Update webhook if provided
      if (webhook && webhook !== existingDomain.webhook) {
        await prisma.apiKey.update({
          where: { domain: normalizedDomain },
          data: { webhook },
        });
      }
      
      // Return existing API key
      return createSuccessResponse({
        success: true,
        data: {
          id: existingDomain.id,
          domain: existingDomain.domain,
          apiKey: existingDomain.apiKey,
          webhook: webhook || existingDomain.webhook,
          isActive: existingDomain.isActive,
          createdAt: existingDomain.createdAt,
        },
        message: 'Domain is already registered. Returning existing API key.',
        isExisting: true,
      }, 200);
    }

    // Generate a new API key
    const apiKey = generateApiKey();

    // Create the domain registration
    const registration = await prisma.apiKey.create({
      data: {
        domain: normalizedDomain,
        apiKey,
        webhook: webhook || null,
        isActive: true,
      },
    });

    console.log(`[Domain Register] New domain registered: ${normalizedDomain}`);

    // Refresh caches to include the new key
    await refreshApiKeyCache();
    clearDomainCache();

    return createSuccessResponse({
      success: true,
      data: {
        id: registration.id,
        domain: registration.domain,
        apiKey: registration.apiKey,
        webhook: registration.webhook,
        isActive: registration.isActive,
        createdAt: registration.createdAt,
      },
      message: 'Domain registered successfully. Use the API key to access all PDF APIs.',
      isExisting: false,
    }, 201);
  } catch (error) {
    console.error('[Domain Register] Error:', error);
    return createErrorResponse('Failed to register domain', 500);
  }
}

/**
 * GET /api/domains/register
 * @description List all registered domains (requires master key)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const masterKey = searchParams.get('master_key') || searchParams.get('api_key');

    // Validate master key
    if (!validateMasterKey(masterKey || undefined)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    const domains = await prisma.apiKey.findMany({
      select: {
        id: true,
        domain: true,
        webhook: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose the API key in list
      },
      orderBy: { createdAt: 'desc' },
    });

    return createSuccessResponse({
      success: true,
      data: domains,
      count: domains.length,
    });
  } catch (error) {
    console.error('[Domain List] Error:', error);
    return createErrorResponse('Failed to list domains', 500);
  }
}
