/**
 * @fileoverview PDF Import from URL API Route
 * @description Downloads a PDF from a remote URL and saves it to the system.
 * This allows skipping the manual upload process by providing a URL parameter.
 * 
 * @swagger
 * /api/pdf/import:
 *   post:
 *     summary: Import PDF from URL
 *     description: Downloads a PDF from a remote URL and saves it to the system
 *     tags: [PDF]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL of the PDF file to download
 *                 example: "https://example.com/document.pdf"
 *               fileName:
 *                 type: string
 *                 description: Optional custom filename (defaults to extracted from URL)
 *                 example: "my-document.pdf"
 *     responses:
 *       201:
 *         description: PDF imported successfully
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
 *                     fileName:
 *                       type: string
 *                     pageCount:
 *                       type: integer
 *                     fileSize:
 *                       type: integer
 *                     filePath:
 *                       type: string
 *       400:
 *         description: Invalid URL or not a PDF file
 *       401:
 *         description: Unauthorized - Invalid API key
 *       500:
 *         description: Failed to download or process PDF
 */

import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { 
  API_CONFIG, 
  PDF_CONFIG, 
  FILE_CONFIG, 
  ERROR_MESSAGES 
} from '@/lib/constants';

// Configure route for potentially slow downloads
export const maxDuration = API_CONFIG.MAX_DURATION;
export const dynamic = 'force-dynamic';

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts filename from URL or Content-Disposition header
 */
function extractFileName(url: string, contentDisposition?: string | null): string {
  // Try to get filename from Content-Disposition header
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      return filenameMatch[1].replace(/['"]/g, '');
    }
  }
  
  // Extract from URL path
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || 'document.pdf';
    
    // Ensure it has .pdf extension
    if (!lastSegment.toLowerCase().endsWith('.pdf')) {
      return `${lastSegment}.pdf`;
    }
    return decodeURIComponent(lastSegment);
  } catch {
    return 'document.pdf';
  }
}

/**
 * POST /api/pdf/import
 * @description Import a PDF from a remote URL
 * @param request - Next.js request with JSON body containing URL
 * @returns Imported PDF metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    // Parse request body
    let body: { url: string; fileName?: string };
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    const { url, fileName: customFileName } = body;

    // Validate URL
    if (!url) {
      return createErrorResponse('URL is required', 400);
    }

    if (!isValidUrl(url)) {
      return createErrorResponse('Invalid URL format. Must be http:// or https://', 400);
    }

    // Download PDF from URL
    console.log(`[PDF Import] Downloading from: ${url}`);
    
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'PDF-Editor/1.0',
          'Accept': 'application/pdf,*/*',
        },
        // Follow redirects
        redirect: 'follow',
      });
    } catch (fetchError) {
      console.error('[PDF Import] Fetch error:', fetchError);
      return createErrorResponse('Failed to download PDF from URL. The URL may be inaccessible.', 400);
    }

    if (!response.ok) {
      return createErrorResponse(
        `Failed to download PDF: ${response.status} ${response.statusText}`, 
        400
      );
    }

    // Check content type (some servers may not return correct MIME type)
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');
    
    // Get file buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file size
    if (buffer.length > PDF_CONFIG.MAX_FILE_SIZE) {
      return createErrorResponse(
        `File too large. Maximum size is ${PDF_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`, 
        400
      );
    }

    if (buffer.length === 0) {
      return createErrorResponse('Downloaded file is empty', 400);
    }

    // Parse PDF to validate and get metadata
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch (pdfError) {
      console.error('[PDF Import] PDF parse error:', pdfError);
      return createErrorResponse(
        'The downloaded file is not a valid PDF. Please check the URL.', 
        400
      );
    }

    const pageCount = pdfDoc.getPageCount();

    // Determine filename
    const fileName = customFileName || extractFileName(url, contentDisposition);

    // Create upload directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), FILE_CONFIG.UPLOAD_DIR);
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // Generate unique filename for storage
    const fileId = uuidv4();
    const fileExtension = '.pdf';
    const uniqueFileName = `${fileId}${fileExtension}`;
    const filePath = path.join(uploadPath, uniqueFileName);
    const relativeFilePath = `/uploads/${uniqueFileName}`;

    // Save file
    await writeFile(filePath, buffer);

    // Save to database
    const pdfFile = await prisma.pdfFile.create({
      data: {
        fileName,
        filePath: relativeFilePath,
        pageCount,
        fileSize: buffer.length,
      },
    });

    console.log(`[PDF Import] Successfully imported: ${fileName} (${pageCount} pages, ${buffer.length} bytes)`);

    return createSuccessResponse({
      success: true,
      data: {
        id: pdfFile.id,
        fileName: pdfFile.fileName,
        pageCount: pdfFile.pageCount,
        fileSize: pdfFile.fileSize,
        filePath: pdfFile.filePath,
      },
    }, 201);
  } catch (error) {
    console.error('[PDF Import] Error:', error);
    return createErrorResponse('Failed to import PDF', 500);
  }
}

/**
 * GET /api/pdf/import
 * @description Import a PDF from URL via query parameter (convenience endpoint)
 * @param request - Next.js request with ?url= query parameter
 * @returns Imported PDF metadata
 * 
 * @swagger
 * /api/pdf/import:
 *   get:
 *     summary: Import PDF from URL (GET method)
 *     description: Downloads a PDF from a remote URL provided as query parameter
 *     tags: [PDF]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: URL of the PDF file to download
 *         example: "https://example.com/document.pdf"
 *       - in: query
 *         name: fileName
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional custom filename
 *     responses:
 *       201:
 *         description: PDF imported successfully
 *       400:
 *         description: Invalid URL or not a PDF file
 *       401:
 *         description: Unauthorized - Invalid API key
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const fileName = searchParams.get('fileName');

  if (!url) {
    return createErrorResponse('URL query parameter is required', 400);
  }

  // Create a mock request with JSON body and forward to POST handler
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ url, fileName }),
  });

  return POST(mockRequest);
}
