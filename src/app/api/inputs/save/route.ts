/**
 * @fileoverview Save Inputs API Route
 * @description Saves PDF input field definitions to the database.
 * Supports batch processing for large PDFs with 1000+ pages.
 */

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { InputType } from '@prisma/client';
import { validateApiKeyAsync } from '@/lib/api-auth';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { 
  PDF_CONFIG, 
  FONT_CONFIG, 
  ERROR_MESSAGES 
} from '@/lib/constants';

// Configure route for large payloads
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/inputs/save
 * @description Save input fields for a PDF
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key (async for full database validation)
    const authResult = await validateApiKeyAsync(request);
    if (!authResult.isValid) {
      console.error('API key validation failed:', authResult.error);
      return createErrorResponse(authResult.error || ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const body = await request.json();
    const { pdfFileId, inputs } = body;

    console.log('Saving inputs:', { pdfFileId, inputCount: inputs?.length });

    if (!pdfFileId || !Array.isArray(inputs)) {
      console.error('Invalid request body:', { pdfFileId, inputsType: typeof inputs });
      return createErrorResponse(ERROR_MESSAGES.INVALID_REQUEST);
    }

    // Verify PDF exists
    const pdfFile = await prisma.pdfFile.findUnique({
      where: { id: pdfFileId },
    });

    if (!pdfFile) {
      console.error('PDF file not found:', pdfFileId);
      return createErrorResponse(ERROR_MESSAGES.PDF_NOT_FOUND, 404);
    }

    console.log('PDF found:', { fileName: pdfFile.fileName, pageCount: pdfFile.pageCount });

    // Delete existing inputs for this PDF (always delete, even if new inputs array is empty)
    const deleteResult = await prisma.pdfInput.deleteMany({
      where: { pdfFileId },
    });

    console.log('Deleted existing inputs:', deleteResult.count);

    // If no inputs to save, return success (all inputs were deleted)
    if (inputs.length === 0) {
      console.log('All inputs removed for PDF:', pdfFileId);
      return createSuccessResponse({
        success: true,
        data: { count: 0, deleted: deleteResult.count },
      });
    }

    // Batch inserts for large PDFs with many inputs
    const batchSize = PDF_CONFIG.BATCH_SIZE;
    let totalCreated = 0;

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      
      const createdInputs = await prisma.pdfInput.createMany({
        data: batch.map((input: Record<string, unknown>) => ({
          pdfFileId,
          slug: String(input.slug),
          label: String(input.label),
          inputType: input.inputType as InputType,
          pageNumber: Number(input.pageNumber),
          xCoord: Number(input.xCoord),
          yCoord: Number(input.yCoord),
          width: Number(input.width),
          height: Number(input.height),
          fontSize: Number(input.fontSize) || 12,
          fontFamily: String(input.fontFamily || FONT_CONFIG.DEFAULT_FAMILY),
          fontWeight: String(input.fontWeight || FONT_CONFIG.DEFAULT_WEIGHT),
          fontStyle: String(input.fontStyle || FONT_CONFIG.DEFAULT_STYLE),
          textAlign: String(input.textAlign || FONT_CONFIG.DEFAULT_ALIGN),
          textColor: String(input.textColor || FONT_CONFIG.DEFAULT_COLOR),
          iconVariant: input.iconVariant ? String(input.iconVariant) : 'CHECK',
          iconColor: input.iconColor ? String(input.iconColor) : '#000000',
        })),
      });

      totalCreated += createdInputs.count;
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: Created ${createdInputs.count} inputs`);
    }

    console.log('Successfully saved all inputs:', totalCreated);

    return createSuccessResponse({
      success: true,
      data: { count: totalCreated },
    });
  } catch (error) {
    console.error('Failed to save inputs:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.SAVE_FAILED,
      500
    );
  }
}
