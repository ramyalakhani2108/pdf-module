/**
 * @fileoverview PDF Fill API Route
 * @description Fills PDF forms with user-provided values using pixel-perfect positioning.
 * Supports text, icons (check, cross, etc.), signatures, and images.
 * 
 * @architecture
 * 1. Load original PDF from storage
 * 2. Fetch input field definitions from database
 * 3. Calculate precise coordinates using unified precision system
 * 4. Draw values at exact positions with proper font styling
 * 5. Return filled PDF as base64
 */

import { NextRequest } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { validateApiKey, createErrorResponse, createSuccessResponse } from '@/lib/utils';
import { API_CONFIG, ERROR_MESSAGES, CALIBRATION_CONFIG } from '@/lib/constants';
import { IconVariant } from '@/lib/types';

// Configure route for large PDFs (100MB, 1000+ pages)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Standard PDF fonts indexed by style
 */
interface FontMap {
  helvetica: PDFFont;
  helveticaBold: PDFFont;
  helveticaOblique: PDFFont;
  helveticaBoldOblique: PDFFont;
  timesRoman: PDFFont;
  timesRomanBold: PDFFont;
  timesRomanItalic: PDFFont;
  timesRomanBoldItalic: PDFFont;
  courier: PDFFont;
  courierBold: PDFFont;
  courierOblique: PDFFont;
  courierBoldOblique: PDFFont;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Embed all standard fonts in the PDF document
 */
async function embedFonts(pdfDoc: PDFDocument): Promise<FontMap> {
  return {
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
}

/**
 * Select appropriate font based on family, weight, and style
 */
function selectFont(
  fonts: FontMap,
  fontFamily: string | null | undefined,
  fontWeight: string | null | undefined,
  fontStyle: string | null | undefined
): PDFFont {
  const family = (fontFamily || 'arial').toLowerCase();
  const isBold = fontWeight === 'bold';
  const isItalic = fontStyle === 'italic';

  if (family.includes('times')) {
    if (isBold && isItalic) return fonts.timesRomanBoldItalic;
    if (isBold) return fonts.timesRomanBold;
    if (isItalic) return fonts.timesRomanItalic;
    return fonts.timesRoman;
  }
  
  if (family.includes('courier')) {
    if (isBold && isItalic) return fonts.courierBoldOblique;
    if (isBold) return fonts.courierBold;
    if (isItalic) return fonts.courierOblique;
    return fonts.courier;
  }
  
  // Default to Helvetica
  if (isBold && isItalic) return fonts.helveticaBoldOblique;
  if (isBold) return fonts.helveticaBold;
  if (isItalic) return fonts.helveticaOblique;
  return fonts.helvetica;
}

/**
 * Parse hex color to RGB values (0-1 range)
 */
function parseColor(hexColor: string | null | undefined): { r: number; g: number; b: number } {
  const color = hexColor || '#000000';
  return {
    r: parseInt(color.slice(1, 3), 16) / 255,
    g: parseInt(color.slice(3, 5), 16) / 255,
    b: parseInt(color.slice(5, 7), 16) / 255,
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/pdf/fill
 * @description Fill a PDF with provided field values
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const body = await request.json();
    const { pdfFileId, values, adjustedPositions = {} } = body;

    if (!pdfFileId || !values) {
      return createErrorResponse(ERROR_MESSAGES.INVALID_REQUEST);
    }

    // Fetch PDF file with all input fields
    const pdfFile = await prisma.pdfFile.findUnique({
      where: { id: pdfFileId },
      include: { inputs: true },
    });

    if (!pdfFile) {
      return createErrorResponse(ERROR_MESSAGES.PDF_NOT_FOUND, 404);
    }

    // Load the original PDF
    const pdfPath = path.join(process.cwd(), 'public', pdfFile.filePath);
    const existingPdfBytes = await readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Embed fonts
    const fonts = await embedFonts(pdfDoc);

    // Process each input field
    for (const input of pdfFile.inputs) {
      const value = values[input.slug];
      const inputType = input.inputType as string;
      
      // Handle ICON fields - they use boolean values for visibility
      if (inputType === 'ICON') {
        // Determine if icon should be visible
        // Priority: 1) Explicit value from API, 2) defaultVisible from field config, 3) false (default hidden)
        const isVisible = value !== undefined 
          ? value === true || value === 'true'  // Accept boolean or string 'true'
          : (input as any).defaultVisible === true; // Default to hidden (false) for icons
        
        if (!isVisible) continue; // Skip drawing this icon if visibility is false
      } else if (inputType === 'FILLABLE') {
        // FILLABLE fields are always rendered as native PDF form fields
        // They don't need a value - they're meant to be filled by the end user
      } else {
        // For other non-icon fields, skip if no value provided
        if (value === undefined || value === null) continue;
      }

      const page = pdfDoc.getPages()[input.pageNumber - 1];
      if (!page) continue;

      const { height: pageHeight } = page.getSize();

      // Use adjusted position if available
      const adjustedPos = adjustedPositions[input.id];
      const xCoord = adjustedPos ? adjustedPos.x : input.xCoord;
      const yCoord = adjustedPos ? adjustedPos.y : input.yCoord;

      // PRECISION FIX: Direct coordinate mapping from editor to PDF
      // 
      // Editor coordinate system: Origin at TOP-LEFT, Y increases downward
      // PDF coordinate system: Origin at BOTTOM-LEFT, Y increases upward
      //
      // The editor stores coordinates in PDF points (72 DPI) at scale=1
      // These coordinates represent the TOP-LEFT corner of the field
      //
      // To convert to PDF coordinates:
      // - X stays the same (both measure from left edge)
      // - Y needs to be flipped: pdfY = pageHeight - editorY - fieldHeight
      //   This gives us the BOTTOM-LEFT corner of the field in PDF coords
      //
      // NO additional offsets needed - the coordinates should map directly
      const pdfX = xCoord;
      const pdfY = (pageHeight - yCoord - input.height) - 0.5;

      const fontSize = input.fontSize;

      switch (input.inputType as any) {
        case 'TEXT':
        case 'EMAIL':
        case 'NUMBER':
        case 'DATE':
          if (typeof value === 'string' && value.trim()) {
            const selectedFont = selectFont(fonts, input.fontFamily, input.fontWeight, input.fontStyle);
            const { r, g, b } = parseColor(input.textColor);
            
            // Calculate text position based on alignment
            const textWidth = selectedFont.widthOfTextAtSize(value, fontSize);
            let textX = pdfX;
            
            if (input.textAlign === 'center') {
              textX = pdfX + (input.width - textWidth) / 2;
            } else if (input.textAlign === 'right') {
              textX = pdfX + input.width - textWidth;
            }

            // TEXT BASELINE POSITIONING
            // In PDF, text is drawn from the baseline (bottom of text excluding descenders)
            // The field's pdfY is the bottom-left corner of the field box
            // We want text to appear vertically centered or aligned to match the editor preview
            // 
            // For vertical centering within the field:
            // - Field height is input.height
            // - Text height is approximately fontSize (cap height)
            // - Position baseline at: pdfY + (input.height - fontSize) / 2 + (fontSize * 0.15)
            //   The 0.15 factor accounts for the baseline being slightly below the visual center
            const textY = pdfY + (input.height - fontSize) / 2 + (fontSize * 0.15);

            page.drawText(value, {
              x: textX,
              y: textY,
              size: fontSize,
              font: selectedFont,
              color: rgb(r, g, b),
            });
          }
          break;

        case 'ICON':
          // Draw icon based on variant
          const iconVariant = ((input as any).iconVariant || 'CHECK') as IconVariant;
          const iconColor = parseColor((input as any).iconColor);
          
          if (iconVariant === 'CHECK' || iconVariant === 'CIRCLE_CHECK' || iconVariant === 'SQUARE_CHECK') {
            drawCheckmark(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant === 'CROSS' || iconVariant === 'CIRCLE_CROSS') {
            drawCross(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant === 'CIRCLE') {
            drawCircle(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant === 'SQUARE') {
            drawSquare(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant === 'STAR') {
            drawStar(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant === 'HEART') {
            drawHeart(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          } else if (iconVariant.startsWith('ARROW_')) {
            drawArrow(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor, iconVariant);
          } else {
            // Default to checkmark
            drawCheckmark(page, { x: pdfX, y: pdfY }, input.width, input.height, iconColor);
          }
          break;

        case 'SIGNATURE':
        case 'IMAGE':
          if (typeof value === 'string') {
            // Handle both base64 data URLs and absolute image URLs
            if (value.startsWith('data:image')) {
              await drawImage(pdfDoc, page, value, { x: pdfX, y: pdfY }, input.width, input.height);
            } else if (value.startsWith('http://') || value.startsWith('https://')) {
              // Handle absolute URL - fetch the image
              await drawImageFromUrl(pdfDoc, page, value, { x: pdfX, y: pdfY }, input.width, input.height);
            }
          }
          break;

        case 'FILLABLE':
          // Create a native PDF form text field that can be filled in external viewers
          await createFillableTextField(
            pdfDoc,
            page,
            input.slug,
            { x: pdfX, y: pdfY },
            input.width,
            input.height,
            {
              fontSize: input.fontSize,
              fontFamily: input.fontFamily,
              fontWeight: input.fontWeight,
              textColor: input.textColor,
              placeholder: (input as any).placeholder,
              borderRadius: (input as any).borderRadius,
              borderEnabled: (input as any).borderEnabled,
              borderWidth: (input as any).borderWidth,
              borderColor: (input as any).borderColor,
            },
            fonts
          );
          break;
      }
    }

    // Save and return filled PDF
    const pdfBytes = await pdfDoc.save();
    
    // Create filled PDFs directory if it doesn't exist
    const filledPdfsDir = path.join(process.cwd(), 'public', 'uploads', 'filled-pdfs');
    await mkdir(filledPdfsDir, { recursive: true });
    
    // Generate unique filename for the filled PDF
    const fileName = `filled_${uuidv4()}.pdf`;
    const filePath = path.join(filledPdfsDir, fileName);
    
    // Write PDF to disk
    await writeFile(filePath, pdfBytes);
    
    // Construct the server URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const pdfUrl = `${baseUrl}/uploads/filled-pdfs/${fileName}`;

    return createSuccessResponse({
      success: true,
      pdfUrl: pdfUrl,
    });
  } catch (error) {
    console.error('PDF fill error:', error);
    return createErrorResponse(ERROR_MESSAGES.FILL_FAILED, 500);
  }
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

/**
 * Draw a checkmark symbol
 */
function drawCheckmark(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number } = { r: 0, g: 0.6, b: 0 }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  
  // Checkmark geometry using optimal proportions
  const armLength = symbolSize * 0.35;
  const verticalOffset = symbolSize * 0.15;
  
  const leftArmStartX = centerX - armLength;
  const leftArmStartY = centerY - verticalOffset;
  const junctionX = centerX - armLength * 0.3;
  const junctionY = centerY - verticalOffset - symbolSize * 0.15;
  const rightArmEndX = centerX + armLength;
  const rightArmEndY = centerY + verticalOffset + symbolSize * 0.2;
  
  const lineThickness = Math.max(1, symbolSize * 0.12);
  
  page.drawLine({
    start: { x: leftArmStartX, y: leftArmStartY },
    end: { x: junctionX, y: junctionY },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  page.drawLine({
    start: { x: junctionX, y: junctionY },
    end: { x: rightArmEndX, y: rightArmEndY },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw a cross/X symbol
 */
function drawCross(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number } = { r: 0.8, g: 0, b: 0 }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  
  const radius = symbolSize * 0.4;
  
  const topRightX = centerX + radius;
  const topRightY = centerY + radius;
  const bottomLeftX = centerX - radius;
  const bottomLeftY = centerY - radius;
  const topLeftX = centerX - radius;
  const topLeftY = centerY + radius;
  const bottomRightX = centerX + radius;
  const bottomRightY = centerY - radius;
  
  const lineThickness = Math.max(1, symbolSize * 0.12);
  
  page.drawLine({
    start: { x: bottomLeftX, y: bottomLeftY },
    end: { x: topRightX, y: topRightY },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  page.drawLine({
    start: { x: topLeftX, y: topLeftY },
    end: { x: bottomRightX, y: bottomRightY },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw a circle symbol
 */
function drawCircle(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  const radius = symbolSize * 0.4;
  const lineThickness = Math.max(1, symbolSize * 0.1);
  
  page.drawCircle({
    x: centerX,
    y: centerY,
    size: radius,
    borderWidth: lineThickness,
    borderColor: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw a square symbol
 */
function drawSquare(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const offsetX = (width - symbolSize) / 2;
  const offsetY = (height - symbolSize) / 2;
  const lineThickness = Math.max(1, symbolSize * 0.1);
  
  page.drawRectangle({
    x: fieldPosition.x + offsetX,
    y: fieldPosition.y + offsetY,
    width: symbolSize,
    height: symbolSize,
    borderWidth: lineThickness,
    borderColor: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw a star symbol (5-pointed)
 */
function drawStar(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  const outerRadius = symbolSize * 0.45;
  const innerRadius = outerRadius * 0.4;
  const lineThickness = Math.max(1, symbolSize * 0.08);
  
  // Draw 5-pointed star using lines
  const points = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }
  
  for (let i = 0; i < points.length; i++) {
    page.drawLine({
      start: points[i],
      end: points[(i + 1) % points.length],
      thickness: lineThickness,
      color: rgb(color.r, color.g, color.b),
    });
  }
}

/**
 * Draw a heart symbol
 */
function drawHeart(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  const size = symbolSize * 0.5;
  const lineThickness = Math.max(1, symbolSize * 0.1);
  
  // Simplified heart using lines (V-shape with bumps)
  page.drawLine({
    start: { x: centerX, y: centerY - size * 0.6 },
    end: { x: centerX - size, y: centerY + size * 0.3 },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  page.drawLine({
    start: { x: centerX, y: centerY - size * 0.6 },
    end: { x: centerX + size, y: centerY + size * 0.3 },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  // Top curves
  page.drawCircle({
    x: centerX - size * 0.5,
    y: centerY + size * 0.3,
    size: size * 0.5,
    borderWidth: lineThickness,
    borderColor: rgb(color.r, color.g, color.b),
  });
  page.drawCircle({
    x: centerX + size * 0.5,
    y: centerY + size * 0.3,
    size: size * 0.5,
    borderWidth: lineThickness,
    borderColor: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw an arrow symbol
 */
function drawArrow(
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  direction: string
): void {
  // Use the exact field dimensions for the icon size - no padding reduction
  const symbolSize = Math.min(width, height);
  const centerX = fieldPosition.x + width / 2;
  const centerY = fieldPosition.y + height / 2;
  const size = symbolSize * 0.35;
  const lineThickness = Math.max(1, symbolSize * 0.1);
  
  let dx = 0, dy = 0;
  if (direction === 'ARROW_RIGHT') { dx = 1; dy = 0; }
  else if (direction === 'ARROW_LEFT') { dx = -1; dy = 0; }
  else if (direction === 'ARROW_UP') { dx = 0; dy = 1; }
  else if (direction === 'ARROW_DOWN') { dx = 0; dy = -1; }
  
  const startX = centerX - dx * size;
  const startY = centerY - dy * size;
  const endX = centerX + dx * size;
  const endY = centerY + dy * size;
  
  // Main line
  page.drawLine({
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  
  // Arrowhead
  const headSize = size * 0.5;
  const angle = Math.atan2(dy, dx);
  const headAngle1 = angle + Math.PI * 0.75;
  const headAngle2 = angle - Math.PI * 0.75;
  
  page.drawLine({
    start: { x: endX, y: endY },
    end: { x: endX + headSize * Math.cos(headAngle1), y: endY + headSize * Math.sin(headAngle1) },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
  page.drawLine({
    start: { x: endX, y: endY },
    end: { x: endX + headSize * Math.cos(headAngle2), y: endY + headSize * Math.sin(headAngle2) },
    thickness: lineThickness,
    color: rgb(color.r, color.g, color.b),
  });
}

/**
 * Draw an image (signature or image field)
 */
async function drawImage(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['getPages']>[0],
  value: string,
  fieldPosition: { x: number; y: number },
  width: number,
  height: number
): Promise<void> {
  try {
    const base64Data = value.split(',')[1];
    const imageBytes = Buffer.from(base64Data, 'base64');

    let image;
    if (value.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (value.includes('image/jpeg') || value.includes('image/jpg')) {
      image = await pdfDoc.embedJpg(imageBytes);
    }

    if (image) {
      const imgDims = image.scale(1);
      const scaleX = width / imgDims.width;
      const scaleY = height / imgDims.height;
      const imgScale = Math.min(scaleX, scaleY);

      const scaledWidth = imgDims.width * imgScale;
      const scaledHeight = imgDims.height * imgScale;

      const imgX = fieldPosition.x + (width - scaledWidth) / 2;
      const imgY = fieldPosition.y + (height - scaledHeight) / 2;

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

/**
 * Draw an image from an absolute URL (signature or image field)
 */
async function drawImageFromUrl(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['getPages']>[0],
  imageUrl: string,
  fieldPosition: { x: number; y: number },
  width: number,
  height: number
): Promise<void> {
  try {
    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error(`Failed to fetch image from URL: ${imageUrl}. Status: ${response.status}`);
      return;
    }

    const contentType = response.headers.get('content-type');
    const arrayBuffer = await response.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer);

    let image;
    if (contentType?.includes('image/png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (contentType?.includes('image/jpeg') || contentType?.includes('image/jpg')) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      console.error(`Unsupported image format: ${contentType}`);
      return;
    }

    if (image) {
      const imgDims = image.scale(1);
      const scaleX = width / imgDims.width;
      const scaleY = height / imgDims.height;
      const imgScale = Math.min(scaleX, scaleY);

      const scaledWidth = imgDims.width * imgScale;
      const scaledHeight = imgDims.height * imgScale;

      const imgX = fieldPosition.x + (width - scaledWidth) / 2;
      const imgY = fieldPosition.y + (height - scaledHeight) / 2;

      page.drawImage(image, {
        x: imgX,
        y: imgY,
        width: scaledWidth,
        height: scaledHeight,
      });
    }
  } catch (error) {
    console.error(`Failed to fetch or embed image from URL: ${imageUrl}`, error);
  }
}

/**
 * Create a native PDF form text field (fillable in external viewers like Adobe Acrobat)
 */
async function createFillableTextField(
  pdfDoc: PDFDocument,
  page: ReturnType<PDFDocument['getPages']>[0],
  fieldName: string,
  fieldPosition: { x: number; y: number },
  width: number,
  height: number,
  options: {
    fontSize?: number;
    fontFamily?: string | null;
    fontWeight?: string | null;
    textColor?: string | null;
    placeholder?: string | null;
    borderRadius?: number | null;
    borderEnabled?: boolean | null;
    borderWidth?: number | null;
    borderColor?: string | null;
  },
  fonts: FontMap
): Promise<void> {
  try {
    // Get or create the form
    const form = pdfDoc.getForm();
    
    // Create a unique field name (add timestamp to avoid conflicts)
    const uniqueFieldName = `${fieldName}_${Date.now()}`;
    
    // Create a text field
    const textField = form.createTextField(uniqueFieldName);
    
    // Get the page index
    const pages = pdfDoc.getPages();
    const pageIndex = pages.indexOf(page);
    
    // Add the field widget to the page at the specified position
    textField.addToPage(page, {
      x: fieldPosition.x,
      y: fieldPosition.y,
      width: width,
      height: height,
      borderWidth: options.borderEnabled ? (options.borderWidth || 1) : 0,
      borderColor: options.borderEnabled && options.borderColor 
        ? rgb(
            parseInt(options.borderColor.slice(1, 3), 16) / 255,
            parseInt(options.borderColor.slice(3, 5), 16) / 255,
            parseInt(options.borderColor.slice(5, 7), 16) / 255
          )
        : rgb(0.8, 0.8, 0.8),
      backgroundColor: rgb(1, 1, 1), // White background
    });
    
    // Set text appearance
    const selectedFont = selectFont(fonts, options.fontFamily, options.fontWeight, null);
    const textColor = options.textColor 
      ? rgb(
          parseInt(options.textColor.slice(1, 3), 16) / 255,
          parseInt(options.textColor.slice(3, 5), 16) / 255,
          parseInt(options.textColor.slice(5, 7), 16) / 255
        )
      : rgb(0, 0, 0);
    
    textField.setFontSize(options.fontSize || 12);
    textField.updateAppearances(selectedFont);
    
    // Set default/placeholder text if provided
    if (options.placeholder) {
      textField.setText(options.placeholder);
    }
    
  } catch (error) {
    console.error('Failed to create fillable text field:', error);
  }
}
