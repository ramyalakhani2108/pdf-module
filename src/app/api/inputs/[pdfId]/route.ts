/**
 * @fileoverview Get Inputs API Route
 * @description Retrieves input field definitions for a specific PDF
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/lib/constants';

/**
 * GET /api/inputs/[pdfId]
 * @description Get all input fields for a PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pdfId: string }> }
) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const { pdfId } = await params;

    if (!pdfId) {
      return createErrorResponse('PDF ID is required');
    }

    // Fetch inputs ordered by page and creation date
    const inputs = await prisma.pdfInput.findMany({
      where: { pdfFileId: pdfId },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });

    return createSuccessResponse({
      success: true,
      data: inputs,
    });
  } catch (error) {
    console.error('Failed to fetch inputs:', error);
    return createErrorResponse('Failed to fetch inputs', 500);
  }
}
