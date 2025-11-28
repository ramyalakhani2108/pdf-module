/**
 * @fileoverview Regenerate API Key Route
 * @description Generates a new API key for an existing domain registration.
 * The old key is immediately invalidated.
 * 
 * @swagger
 * /api/domains/{id}/regenerate:
 *   post:
 *     summary: Regenerate API key
 *     description: Generate a new API key for a domain. The old key is immediately invalidated.
 *     tags: [Domain Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Domain registration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - master_key
 *             properties:
 *               master_key:
 *                 type: string
 *                 description: Master API key for authorization
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: string
 *                       description: The new API key
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Domain not found
 */

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { invalidateCachedApiKey } from '@/lib/api-auth';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a secure API key with prefix for easy identification
 */
function generateApiKey(): string {
  const uuid = uuidv4().replace(/-/g, '');
  return `pdf_sk_${uuid}`;
}

/**
 * Validate master key
 */
function validateMasterKey(providedKey: string | undefined): boolean {
  const masterKey = process.env.API_KEY;
  
  if (!masterKey) {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
  
  return providedKey === masterKey;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/domains/[id]/regenerate
 * @description Regenerate the API key for a domain
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let body: { master_key?: string };
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    const { master_key } = body;

    if (!validateMasterKey(master_key)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    // Find existing domain
    const existingDomain = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingDomain) {
      return createErrorResponse('Domain not found', 404);
    }

    // Invalidate old API key in cache
    invalidateCachedApiKey(existingDomain.apiKey);

    // Generate new API key
    const newApiKey = generateApiKey();

    // Update the domain with new API key
    const updatedDomain = await prisma.apiKey.update({
      where: { id },
      data: { apiKey: newApiKey },
      select: {
        id: true,
        domain: true,
        apiKey: true,
        isActive: true,
        updatedAt: true,
      },
    });

    console.log(`[API Key Regenerate] New key generated for domain: ${updatedDomain.domain}`);

    return createSuccessResponse({
      success: true,
      data: {
        id: updatedDomain.id,
        domain: updatedDomain.domain,
        apiKey: updatedDomain.apiKey,
        isActive: updatedDomain.isActive,
      },
      message: 'API key regenerated successfully. The old key is no longer valid.',
    });
  } catch (error) {
    console.error('[API Key Regenerate] Error:', error);
    return createErrorResponse('Failed to regenerate API key', 500);
  }
}
