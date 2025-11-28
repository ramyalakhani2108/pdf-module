/**
 * @fileoverview Find PDF by URL API Route
 * @description Checks if a PDF has already been imported from a given URL.
 * Used to prevent duplicate imports when refreshing the page.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { validateApiKeyAsync } from '@/lib/api-auth';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Extracts filename from URL
 */
function extractFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || 'document.pdf';
    
    if (!lastSegment.toLowerCase().endsWith('.pdf')) {
      return `${lastSegment}.pdf`;
    }
    return decodeURIComponent(lastSegment);
  } catch {
    return 'document.pdf';
  }
}

/**
 * GET /api/pdf/find-by-url
 * @description Find an existing PDF by the source URL filename
 * @param request - Next.js request with ?url= query parameter
 * @returns PDF metadata if found, null otherwise
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key (async for full database validation)
    const authResult = await validateApiKeyAsync(request);
    if (!authResult.isValid) {
      return createErrorResponse(authResult.error || ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return createErrorResponse('URL query parameter is required', 400);
    }

    // Extract filename from URL to match against stored PDFs
    const fileName = extractFileName(url);

    // Try to find PDF by fileName (most reliable for URL imports)
    const pdfFile = await prisma.pdfFile.findFirst({
      where: {
        fileName: fileName,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!pdfFile) {
      return createSuccessResponse({
        success: true,
        found: false,
        data: null,
      });
    }

    return createSuccessResponse({
      success: true,
      found: true,
      data: {
        id: pdfFile.id,
        fileName: pdfFile.fileName,
        pageCount: pdfFile.pageCount,
        fileSize: pdfFile.fileSize,
        filePath: pdfFile.filePath,
        createdAt: pdfFile.createdAt,
        updatedAt: pdfFile.updatedAt,
      },
    });
  } catch (error) {
    console.error('[PDF Find] Error:', error);
    return createErrorResponse('Failed to find PDF', 500);
  }
}

/**
 * POST /api/pdf/find-by-url
 * @description Find an existing PDF by ID
 * @param request - Next.js request with JSON body containing id
 * @returns PDF metadata if found, null otherwise
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    // Validate API key (async for full database validation)
    const authResult = await validateApiKeyAsync(request, body);
    if (!authResult.isValid) {
      return createErrorResponse(authResult.error || ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    if (!id) {
      return createErrorResponse('PDF ID is required', 400);
    }

    const pdfFile = await prisma.pdfFile.findUnique({
      where: { id },
    });

    if (!pdfFile) {
      return createSuccessResponse({
        success: true,
        found: false,
        data: null,
      });
    }

    return createSuccessResponse({
      success: true,
      found: true,
      data: {
        id: pdfFile.id,
        fileName: pdfFile.fileName,
        pageCount: pdfFile.pageCount,
        fileSize: pdfFile.fileSize,
        filePath: pdfFile.filePath,
        createdAt: pdfFile.createdAt,
        updatedAt: pdfFile.updatedAt,
      },
    });
  } catch (error) {
    console.error('[PDF Find by ID] Error:', error);
    return createErrorResponse('Failed to find PDF', 500);
  }
}
