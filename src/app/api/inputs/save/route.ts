import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';

// Configure route for large payloads (100MB PDFs with 1000+ pages)
export const maxDuration = 60; // 60 seconds timeout for large operations
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            console.error('API key validation failed');
            return createErrorResponse('Unauthorized', 401);
        }

        const body = await request.json();
        const { pdfFileId, inputs } = body;

        console.log('Saving inputs:', { pdfFileId, inputCount: inputs?.length });

        if (!pdfFileId || !Array.isArray(inputs)) {
            console.error('Invalid request body:', { pdfFileId, inputsType: typeof inputs });
            return createErrorResponse('Invalid request body: pdfFileId and inputs array required');
        }

        if (inputs.length === 0) {
            console.warn('No inputs to save');
            return createSuccessResponse({
                success: true,
                data: { count: 0 },
            });
        }

        // Verify PDF exists
        const pdfFile = await prisma.pdfFile.findUnique({
            where: { id: pdfFileId },
        });

        if (!pdfFile) {
            console.error('PDF file not found:', pdfFileId);
            return createErrorResponse('PDF file not found', 404);
        }

        console.log('PDF found:', { fileName: pdfFile.fileName, pageCount: pdfFile.pageCount });

        // Delete existing inputs for this PDF (use transaction for large datasets)
        const deleteResult = await prisma.pdfInput.deleteMany({
            where: { pdfFileId },
        });

        console.log('Deleted existing inputs:', deleteResult.count);

        // For large PDFs with 1000+ pages and many inputs, batch the inserts
        const batchSize = 500;
        let totalCreated = 0;

        for (let i = 0; i < inputs.length; i += batchSize) {
            const batch = inputs.slice(i, i + batchSize);
            
            const createdInputs = await prisma.pdfInput.createMany({
                data: batch.map((input: any) => ({
                    pdfFileId,
                    slug: input.slug,
                    label: input.label,
                    inputType: input.inputType,
                    pageNumber: input.pageNumber,
                    xCoord: input.xCoord,
                    yCoord: input.yCoord,
                    width: input.width,
                    height: input.height,
                    fontSize: input.fontSize || 12,
                    fontFamily: input.fontFamily || 'Arial, sans-serif',
                    fontWeight: input.fontWeight || 'normal',
                    fontStyle: input.fontStyle || 'normal',
                    textAlign: input.textAlign || 'left',
                    textColor: input.textColor || '#000000',
                })),
            });

            totalCreated += createdInputs.count;
            console.log(`Batch ${Math.floor(i / batchSize) + 1}: Created ${createdInputs.count} inputs`);
        }

        console.log('Successfully saved all inputs:', totalCreated);

        return createSuccessResponse({
            success: true,
            data: {
                count: totalCreated,
            },
        });
    } catch (error) {
        console.error('Failed to save inputs - Full error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return createErrorResponse(
            error instanceof Error ? error.message : 'Failed to save inputs',
            500
        );
    }
}
