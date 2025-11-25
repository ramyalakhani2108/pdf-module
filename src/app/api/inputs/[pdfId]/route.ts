import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ pdfId: string }> }
) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return createErrorResponse('Unauthorized', 401);
        }

        const { pdfId } = await params;

        if (!pdfId) {
            return createErrorResponse('PDF ID is required');
        }

        // Fetch inputs for this PDF
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
