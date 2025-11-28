/**
 * @fileoverview Domain Management API Route
 * @description Manages individual domain registrations - update, deactivate, delete.
 * 
 * @swagger
 * /api/domains/{id}:
 *   get:
 *     summary: Get domain details
 *     description: Retrieve details of a specific domain registration
 *     tags: [Domain Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Domain registration ID
 *       - in: query
 *         name: api_key
 *         required: true
 *         schema:
 *           type: string
 *         description: Master API key for authorization
 *     responses:
 *       200:
 *         description: Domain details retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Domain not found
 * 
 *   patch:
 *     summary: Update domain settings
 *     description: Update webhook URL or active status for a domain
 *     tags: [Domain Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               webhook:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *               master_key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Domain updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Domain not found
 * 
 *   delete:
 *     summary: Delete domain registration
 *     description: Permanently remove a domain registration and revoke its API key
 *     tags: [Domain Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: api_key
 *         required: true
 *         schema:
 *           type: string
 *         description: Master API key for authorization
 *     responses:
 *       200:
 *         description: Domain deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Domain not found
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { invalidateCachedApiKey } from '@/lib/api-auth';
import { z } from 'zod';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const updateDomainSchema = z.object({
  webhook: z.string().url('Invalid webhook URL').optional().nullable(),
  isActive: z.boolean().optional(),
  master_key: z.string().min(1, 'Master key is required').optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate master key for domain management
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
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/domains/[id]
 * @description Get details of a specific domain registration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const masterKey = searchParams.get('master_key') || searchParams.get('api_key');

    if (!validateMasterKey(masterKey || undefined)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    const domain = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        domain: true,
        apiKey: true,
        webhook: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!domain) {
      return createErrorResponse('Domain not found', 404);
    }

    return createSuccessResponse({
      success: true,
      data: domain,
    });
  } catch (error) {
    console.error('[Domain Get] Error:', error);
    return createErrorResponse('Failed to get domain', 500);
  }
}

/**
 * PATCH /api/domains/[id]
 * @description Update a domain registration (webhook, active status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    const validation = updateDomainSchema.safeParse(body);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(', ');
      return createErrorResponse(errors, 400);
    }

    const { webhook, isActive, master_key } = validation.data;

    if (!validateMasterKey(master_key)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    // Check if domain exists
    const existingDomain = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingDomain) {
      return createErrorResponse('Domain not found', 404);
    }

    // Build update data
    const updateData: { webhook?: string | null; isActive?: boolean } = {};
    
    if (webhook !== undefined) {
      updateData.webhook = webhook;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      
      // Invalidate cache if deactivating
      if (!isActive) {
        invalidateCachedApiKey(existingDomain.apiKey);
      }
    }

    const updatedDomain = await prisma.apiKey.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        domain: true,
        webhook: true,
        isActive: true,
        updatedAt: true,
      },
    });

    console.log(`[Domain Update] Updated domain: ${updatedDomain.domain}`);

    return createSuccessResponse({
      success: true,
      data: updatedDomain,
      message: 'Domain updated successfully',
    });
  } catch (error) {
    console.error('[Domain Update] Error:', error);
    return createErrorResponse('Failed to update domain', 500);
  }
}

/**
 * DELETE /api/domains/[id]
 * @description Delete a domain registration and revoke its API key
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const masterKey = searchParams.get('master_key') || searchParams.get('api_key');

    if (!validateMasterKey(masterKey || undefined)) {
      return createErrorResponse('Unauthorized - Invalid master key', 401);
    }

    // Check if domain exists
    const existingDomain = await prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existingDomain) {
      return createErrorResponse('Domain not found', 404);
    }

    // Invalidate cache before deletion
    invalidateCachedApiKey(existingDomain.apiKey);

    // Delete the domain
    await prisma.apiKey.delete({
      where: { id },
    });

    console.log(`[Domain Delete] Deleted domain: ${existingDomain.domain}`);

    return createSuccessResponse({
      success: true,
      message: `Domain "${existingDomain.domain}" has been deleted and its API key revoked.`,
    });
  } catch (error) {
    console.error('[Domain Delete] Error:', error);
    return createErrorResponse('Failed to delete domain', 500);
  }
}
