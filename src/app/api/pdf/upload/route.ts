import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';

// Configure route for large file uploads (100MB PDFs with 1000+ pages)
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600'); // 100MB default
const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return createErrorResponse('Unauthorized', 401);
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return createErrorResponse('No file provided');
        }

        // Validate file type
        if (file.type !== 'application/pdf') {
            return createErrorResponse('Only PDF files are allowed');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return createErrorResponse(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`);
        }

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Parse PDF to get metadata
        let pdfDoc: PDFDocument;
        try {
            pdfDoc = await PDFDocument.load(buffer);
        } catch (error) {
            return createErrorResponse('Invalid PDF file');
        }

        const pageCount = pdfDoc.getPageCount();

        // Create upload directory if it doesn't exist
        const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
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
        return createErrorResponse('Failed to upload PDF', 500);
    }
}

export async function GET(request: NextRequest) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return createErrorResponse('Unauthorized', 401);
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
