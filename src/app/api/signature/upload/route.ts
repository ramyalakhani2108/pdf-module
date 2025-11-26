/**
 * @fileoverview Signature Upload API Route
 * @description Handles signature/image uploads for PDF forms
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { FILE_CONFIG, ERROR_MESSAGES } from '@/lib/constants';

/**
 * POST /api/signature/upload
 * @description Upload a signature or image file
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file) {
      return createErrorResponse(ERROR_MESSAGES.NO_FILE_PROVIDED);
    }

    // Validate file type
    if (!FILE_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type as typeof FILE_CONFIG.ALLOWED_IMAGE_TYPES[number])) {
      return createErrorResponse('Only PNG and JPEG images are allowed');
    }

    // Validate file size
    if (file.size > FILE_CONFIG.MAX_IMAGE_SIZE) {
      return createErrorResponse(ERROR_MESSAGES.FILE_TOO_LARGE);
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create upload directory if it doesn't exist
    const uploadPath = path.join(process.cwd(), FILE_CONFIG.UPLOAD_DIR, FILE_CONFIG.SIGNATURE_DIR);
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const fileExtension = path.extname(file.name);
    const uniqueFileName = `${fileId}${fileExtension}`;
    const filePath = path.join(uploadPath, uniqueFileName);
    const relativeFilePath = `/uploads/${FILE_CONFIG.SIGNATURE_DIR}/${uniqueFileName}`;

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
    return createErrorResponse(ERROR_MESSAGES.UPLOAD_FAILED, 500);
  }
}
