/**
 * @fileoverview PDF Upload API Route
 * @description Handles PDF file uploads with validation, storage, and database persistence.
 * Supports large PDFs (100MB+, 1000+ pages) with configurable limits.
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

// Configure route for large file uploads
export const maxDuration = API_CONFIG.MAX_DURATION;
export const dynamic = 'force-dynamic';

/**
 * POST /api/pdf/upload
 * @description Upload a PDF file
 * @param request - Next.js request with form data
 * @returns Uploaded PDF metadata
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return createErrorResponse(ERROR_MESSAGES.NO_FILE_PROVIDED);
    }

    // Validate file type
    if (file.type !== PDF_CONFIG.MIME_TYPE) {
      return createErrorResponse(ERROR_MESSAGES.INVALID_FILE_TYPE);
    }

    // Validate file size
    if (file.size > PDF_CONFIG.MAX_FILE_SIZE) {
      return createErrorResponse(ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse PDF to get metadata
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch {
      return createErrorResponse(ERROR_MESSAGES.INVALID_PDF);
    }

    const pageCount = pdfDoc.getPageCount();

    // Create upload directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), FILE_CONFIG.UPLOAD_DIR);
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const fileExtension = '.pdf';
    const fileName = file.name;
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
        fileSize: file.size,
      },
    });

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
    console.error('PDF upload error:', error);
    return createErrorResponse(ERROR_MESSAGES.UPLOAD_FAILED, 500);
  }
}

/**
 * GET /api/pdf/upload
 * @description List all uploaded PDFs
 * @returns Array of PDF metadata
 */
export async function GET(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const pdfs = await prisma.pdfFile.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        pageCount: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return createSuccessResponse({ success: true, data: pdfs });
  } catch (error) {
    console.error('Failed to fetch PDFs:', error);
    return createErrorResponse('Failed to fetch PDFs', 500);
  }
}
