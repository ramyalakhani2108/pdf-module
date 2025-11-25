import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for images
const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return createErrorResponse('Unauthorized', 401);
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const uploadedBy = formData.get('uploadedBy') as string | null;

        if (!file) {
            return createErrorResponse('No file provided');
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return createErrorResponse('Only PNG and JPEG images are allowed');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return createErrorResponse('File size exceeds maximum allowed size of 5MB');
        }

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create upload directory if it doesn't exist
        const uploadPath = path.join(process.cwd(), UPLOAD_DIR, 'signatures');
        if (!existsSync(uploadPath)) {
            await mkdir(uploadPath, { recursive: true });
        }

        // Generate unique filename
        const fileId = uuidv4();
        const fileExtension = path.extname(file.name);
        const uniqueFileName = `${fileId}${fileExtension}`;
        const filePath = path.join(uploadPath, uniqueFileName);
        const relativeFilePath = `/uploads/signatures/${uniqueFileName}`;

        // Save file
        await writeFile(filePath, buffer);

        // Save to database
        const signature = await prisma.signatureImage.create({
            data: {
                filePath: relativeFilePath,
                uploadedBy,
            },
        });

        // Convert to base64 for immediate use
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;

        return createSuccessResponse({
            success: true,
            data: {
                id: signature.id,
                filePath: signature.filePath,
                base64: dataUrl,
            },
        }, 201);
    } catch (error) {
        console.error('Signature upload error:', error);
        return createErrorResponse('Failed to upload signature', 500);
    }
}
