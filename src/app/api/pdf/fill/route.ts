import { NextRequest } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';

// Import unified precision system
import { 
    normalizeCoordinate, 
    canvasToPdfCoordinates,
    calculatePreciseFieldPosition,
    PRECISION_DECIMALS,
    PRECISION_FACTOR
} from '@/utils/precision-coordinates';

// Configure route for large PDFs (100MB, 1000+ pages)
export const maxDuration = 60; // 60 seconds timeout for processing
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        if (!validateApiKey(request)) {
            return createErrorResponse('Unauthorized', 401);
        }

        const body = await request.json();
        const { pdfFileId, values, adjustedPositions = {} } = body;

        if (!pdfFileId || !values) {
            return createErrorResponse('Invalid request body');
        }

        // Fetch PDF file with all input fields including font styles
        const pdfFile: any = await prisma.pdfFile.findUnique({
            where: { id: pdfFileId },
            include: { inputs: true },
        });

        if (!pdfFile) {
            return createErrorResponse('PDF file not found', 404);
        }

        // Load the original PDF
        const pdfPath = path.join(process.cwd(), 'public', pdfFile.filePath);
        const existingPdfBytes = await readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Embed fonts (we'll embed all standard fonts that might be used)
        const fonts = {
            helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
            helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
            helveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            helveticaBoldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
            timesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
            timesRomanBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
            timesRomanItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
            timesRomanBoldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
            courier: await pdfDoc.embedFont(StandardFonts.Courier),
            courierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
            courierOblique: await pdfDoc.embedFont(StandardFonts.CourierOblique),
            courierBoldOblique: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
        };
        const boldFont = fonts.helveticaBold;

        // Process each input field
        for (const input of pdfFile.inputs) {
            const value = values[input.slug];

            if (value === undefined || value === null) continue;

            const page = pdfDoc.getPages()[input.pageNumber - 1];
            if (!page) continue;

            const { height: pageHeight } = page.getSize();

            // Use adjusted position if available, otherwise use original
            const adjustedPos = adjustedPositions[input.id];
            const xCoord = adjustedPos ? adjustedPos.x : input.xCoord;
            const yCoord = adjustedPos ? adjustedPos.y : input.yCoord;

            // UNIFIED PRECISION COORDINATE SYSTEM
            // Use EXACT same function as preview rendering for consistency
            // This ensures pixel-perfect alignment between preview and PDF
            
            // For PDF generation: use scale = 1 (no scaling) and isPdfMode = true
            const fieldPosition = calculatePreciseFieldPosition(
                xCoord,
                yCoord,
                input.width,
                input.height,
                input.fontSize,
                1.0, // No scaling in PDF - use raw document coordinates
                true, // PDF mode
                pageHeight
            );

            // Extract normalized coordinates from unified system
            const normalizedFontSize = normalizeCoordinate(input.fontSize);

            switch (input.inputType) {
                case 'TEXT':
                case 'EMAIL':
                case 'NUMBER':
                case 'DATE':
                    if (typeof value === 'string' && value.trim()) {
                        // Determine font based on fontFamily, fontWeight, and fontStyle
                        let selectedFont = fonts.helvetica;
                        const fontFamily = input.fontFamily?.toLowerCase() || 'arial';
                        const fontWeight = input.fontWeight || 'normal';
                        const fontStyle = input.fontStyle || 'normal';
                        const isBold = fontWeight === 'bold';
                        const isItalic = fontStyle === 'italic';

                        if (fontFamily.includes('times')) {
                            if (isBold && isItalic) selectedFont = fonts.timesRomanBoldItalic;
                            else if (isBold) selectedFont = fonts.timesRomanBold;
                            else if (isItalic) selectedFont = fonts.timesRomanItalic;
                            else selectedFont = fonts.timesRoman;
                        } else if (fontFamily.includes('courier')) {
                            if (isBold && isItalic) selectedFont = fonts.courierBoldOblique;
                            else if (isBold) selectedFont = fonts.courierBold;
                            else if (isItalic) selectedFont = fonts.courierOblique;
                            else selectedFont = fonts.courier;
                        } else {
                            // Default to Helvetica
                            if (isBold && isItalic) selectedFont = fonts.helveticaBoldOblique;
                            else if (isBold) selectedFont = fonts.helveticaBold;
                            else if (isItalic) selectedFont = fonts.helveticaOblique;
                            else selectedFont = fonts.helvetica;
                        }

                        // Parse color (default black)
                        const textColor = input.textColor || '#000000';
                        const r = parseInt(textColor.slice(1, 3), 16) / 255;
                        const g = parseInt(textColor.slice(3, 5), 16) / 255;
                        const b = parseInt(textColor.slice(5, 7), 16) / 255;

                        // PIXEL-PERFECT TEXT POSITIONING ALGORITHM
                        // Already calculated by unified precision system
                        
                        const fontSize = normalizedFontSize;
                        
                        // Calculate text position based on alignment
                        const textAlign = input.textAlign || 'left';
                        const textWidth = selectedFont.widthOfTextAtSize(value, fontSize);
                        let textX = fieldPosition.x;
                        
                        if (textAlign === 'center') {
                            textX = normalizeCoordinate(fieldPosition.x + (input.width - textWidth) / 2);
                        } else if (textAlign === 'right') {
                            textX = normalizeCoordinate(fieldPosition.x + input.width - textWidth);
                        }

                        // Use unified system's textY calculation
                        const preciseTextX = normalizeCoordinate(textX);
                        const preciseTextY = fieldPosition.textY;
                        
                        page.drawText(value, {
                            x: preciseTextX,
                            y: preciseTextY,
                            size: fontSize,
                            font: selectedFont,
                            color: rgb(r, g, b),
                        });
                    }
                    break;

                case 'CHECK':
                    // ADVANCED VECTOR GRAPHICS ALGORITHM FOR CHECKMARK
                    
                    // Calculate precise symbol dimensions using mathematical scaling
                    const symbolSize = Math.min(input.width, input.height);
                    const symbolCenterX = normalizeCoordinate(fieldPosition.x + input.width / 2);
                    const symbolCenterY = normalizeCoordinate(fieldPosition.y + input.height / 2);
                    
                    // Checkmark geometry using optimal proportions
                    // Based on ISO standard symbol proportions for maximum clarity
                    const checkarmLength = symbolSize * 0.35; // Optimal arm length ratio
                    const checkVerticalOffset = symbolSize * 0.15; // Vertical positioning offset
                    
                    // Calculate precise line endpoints using trigonometry
                    const leftArmStartX = normalizeCoordinate(symbolCenterX - checkarmLength);
                    const leftArmStartY = normalizeCoordinate(symbolCenterY - checkVerticalOffset);
                    const junctionX = normalizeCoordinate(symbolCenterX - checkarmLength * 0.3);
                    const junctionY = normalizeCoordinate(symbolCenterY - checkVerticalOffset - symbolSize * 0.15);
                    const rightArmEndX = normalizeCoordinate(symbolCenterX + checkarmLength);
                    const rightArmEndY = normalizeCoordinate(symbolCenterY + checkVerticalOffset + symbolSize * 0.2);
                    
                    // Calculate optimal line thickness based on symbol size
                    const lineThickness = Math.max(1, normalizeCoordinate(symbolSize * 0.12));
                    
                    // Draw checkmark with pixel-perfect vector positioning
                    page.drawLine({
                        start: { x: leftArmStartX, y: leftArmStartY },
                        end: { x: junctionX, y: junctionY },
                        thickness: lineThickness,
                        color: rgb(0, 0.6, 0),
                    });
                    page.drawLine({
                        start: { x: junctionX, y: junctionY },
                        end: { x: rightArmEndX, y: rightArmEndY },
                        thickness: lineThickness,
                        color: rgb(0, 0.6, 0),
                    });
                    break;

                case 'CROSS':
                    // ADVANCED VECTOR GRAPHICS ALGORITHM FOR CROSS/X SYMBOL
                    
                    // Calculate precise cross dimensions
                    const crossSymbolSize = Math.min(input.width, input.height);
                    const crossCenterX = normalizeCoordinate(fieldPosition.x + input.width / 2);
                    const crossCenterY = normalizeCoordinate(fieldPosition.y + input.height / 2);
                    
                    // Cross geometry using optimal diagonal proportions
                    const crossRadius = crossSymbolSize * 0.4; // Optimal radius for visual balance
                    
                    // Calculate precise diagonal endpoints using 45-degree geometry
                    const topRightX = normalizeCoordinate(crossCenterX + crossRadius);
                    const topRightY = normalizeCoordinate(crossCenterY + crossRadius);
                    const bottomLeftX = normalizeCoordinate(crossCenterX - crossRadius);
                    const bottomLeftY = normalizeCoordinate(crossCenterY - crossRadius);
                    const topLeftX = normalizeCoordinate(crossCenterX - crossRadius);
                    const topLeftY = normalizeCoordinate(crossCenterY + crossRadius);
                    const bottomRightX = normalizeCoordinate(crossCenterX + crossRadius);
                    const bottomRightY = normalizeCoordinate(crossCenterY - crossRadius);
                    
                    // Calculate optimal line thickness
                    const crossLineThickness = Math.max(1, normalizeCoordinate(crossSymbolSize * 0.12));
                    
                    // Draw X using precise diagonal vector lines
                    page.drawLine({
                        start: { x: bottomLeftX, y: bottomLeftY },
                        end: { x: topRightX, y: topRightY },
                        thickness: crossLineThickness,
                        color: rgb(0.8, 0, 0),
                    });
                    page.drawLine({
                        start: { x: topLeftX, y: topLeftY },
                        end: { x: bottomRightX, y: bottomRightY },
                        thickness: crossLineThickness,
                        color: rgb(0.8, 0, 0),
                    });
                    break;

                case 'SIGNATURE':
                case 'IMAGE':
                    if (typeof value === 'string' && value.startsWith('data:image')) {
                        try {
                            // Extract base64 data
                            const base64Data = value.split(',')[1];
                            const imageBytes = Buffer.from(base64Data, 'base64');

                            // Determine image type and embed
                            let image;
                            if (value.includes('image/png')) {
                                image = await pdfDoc.embedPng(imageBytes);
                            } else if (value.includes('image/jpeg') || value.includes('image/jpg')) {
                                image = await pdfDoc.embedJpg(imageBytes);
                            }

                            if (image) {
                                // Calculate dimensions to fit within the field
                                const imgDims = image.scale(1);
                                const scaleX = input.width / imgDims.width;
                                const scaleY = input.height / imgDims.height;
                                const imgScale = Math.min(scaleX, scaleY);

                                const scaledWidth = imgDims.width * imgScale;
                                const scaledHeight = imgDims.height * imgScale;

                                // Center the image in the field using unified coordinates
                                const imgX = fieldPosition.x + (input.width - scaledWidth) / 2;
                                const imgY = fieldPosition.y + (input.height - scaledHeight) / 2;

                                page.drawImage(image, {
                                    x: imgX,
                                    y: imgY,
                                    width: scaledWidth,
                                    height: scaledHeight,
                                });
                            }
                        } catch (error) {
                            console.error('Failed to embed image:', error);
                        }
                    }
                    break;
            }
        }

        // Save the filled PDF
        const pdfBytes = await pdfDoc.save();
        const base64Pdf = Buffer.from(pdfBytes).toString('base64');

        return createSuccessResponse({
            success: true,
            pdfBase64: base64Pdf,
        });
    } catch (error) {
        console.error('PDF fill error:', error);
        return createErrorResponse('Failed to fill PDF', 500);
    }
}
