/**
 * UNIFIED PRECISION COORDINATE SYSTEM v4.0
 * IEEE 754 Double Precision - 15-17 significant digits
 * WITH CALIBRATION SYSTEM for render-time alignment correction
 * 
 * Ensures pixel-perfect alignment across edit, preview, and PDF modes
 * 
 * Key principle: Use the SAME coordinate transformation everywhere
 * + Apply calibration offsets to account for browser/PDF rendering differences
 */

import { calibratePreviewCoordinates, calibratePdfCoordinates } from './coordinate-calibration';

// IEEE 754 double precision: ~15-17 significant digits
// We use 15 decimal places for maximum precision without floating-point errors
const PRECISION_DECIMALS = 15;
const PRECISION_FACTOR = Math.pow(10, PRECISION_DECIMALS); // 10^15

/**
 * Normalize a coordinate to maximum precision
 * Removes floating-point artifacts and ensures consistency
 */
export function normalizeCoordinate(value: number): number {
    // Multiply by precision factor, round to nearest integer, divide back
    // This ensures we have exactly 15 decimal places of precision
    return Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR;
}

/**
 * Normalize an array of coordinates (x, y, width, height)
 */
export function normalizeFieldCoordinates(
    x: number,
    y: number,
    width: number,
    height: number
): { x: number; y: number; width: number; height: number } {
    return {
        x: normalizeCoordinate(x),
        y: normalizeCoordinate(y),
        width: normalizeCoordinate(width),
        height: normalizeCoordinate(height),
    };
}

/**
 * UNIFIED COORDINATE TRANSFORMATION
 * Used identically in edit mode, preview, AND PDF generation
 * 
 * This is the SINGLE SOURCE OF TRUTH for coordinate positioning
 * No modifications, no view-specific adjustments
 */
export function transformCoordinate(
    originalValue: number,
    scale: number,
    offset: number = 0
): number {
    // Step 1: Apply scale factor
    const scaled = originalValue * scale;
    
    // Step 2: Add any offset (viewport position, etc.)
    const offsetApplied = scaled + offset;
    
    // Step 3: Normalize to IEEE 754 precision
    const normalized = normalizeCoordinate(offsetApplied);
    
    return normalized;
}

/**
 * Calculate text baseline position
 * Critical for vertical alignment consistency
 */
export function calculateTextBaseline(
    fieldY: number,
    fieldHeight: number,
    fontSize: number
): number {
    // Text baseline position from field top
    // Using top-alignment (like CSS flex align-items: flex-start)
    const baselineOffset = fontSize * 0.2; // Adjustment for font metrics
    const baseline = fieldY + fieldHeight - baselineOffset;
    
    return normalizeCoordinate(baseline);
}

/**
 * Convert canvas/preview coordinates to PDF coordinates
 * Canvas: origin at top-left (0,0)
 * PDF: origin at bottom-left (0,0)
 */
export function canvasToPdfCoordinates(
    canvasY: number,
    canvasHeight: number,
    pageHeight: number
): number {
    // PDF Y = PageHeight - CanvasY - FieldHeight
    const pdfY = pageHeight - canvasY - canvasHeight;
    return normalizeCoordinate(pdfY);
}

/**
 * FIELD POSITIONING SYSTEM
 * Used for rendering fields in both preview and PDF modes
 */
export interface PreciseFieldPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    textX: number;
    textY: number;
    scale: number;
}

/**
 * Calculate precise field position for rendering
 * Use this in BOTH preview and PDF rendering for consistency
 * 
 * CRITICAL: scale parameter is different for preview vs PDF
 * - Preview: pageScale (1-2, varies by zoom)
 * - PDF: 1 (no scaling, use raw coordinates)
 */
export function calculatePreciseFieldPosition(
    storedX: number,
    storedY: number,
    storedWidth: number,
    storedHeight: number,
    fontSize: number,
    scale: number,
    isPdfMode: boolean = false,
    pageHeight: number = 0
): PreciseFieldPosition {
    // Normalize stored coordinates
    const normalizedStored = normalizeFieldCoordinates(storedX, storedY, storedWidth, storedHeight);
    
    // Apply calibration BEFORE any transformations
    // This corrects for browser/PDF rendering differences at the source
    const calibrated = isPdfMode 
        ? calibratePdfCoordinates(normalizedStored.x, normalizedStored.y)
        : calibratePreviewCoordinates(normalizedStored.x, normalizedStored.y);
    
    const calibratedStored = {
        x: normalizeCoordinate(calibrated.x),
        y: normalizeCoordinate(calibrated.y),
        width: normalizedStored.width,
        height: normalizedStored.height,
    };
    
    // Apply scale with precision
    const scaledPosition = {
        x: transformCoordinate(calibratedStored.x, scale),
        y: transformCoordinate(calibratedStored.y, scale),
        width: transformCoordinate(calibratedStored.width, scale),
        height: transformCoordinate(calibratedStored.height, scale),
    };
    
    // Normalize font size with scale
    const scaledFontSize = transformCoordinate(fontSize, scale);
    
    // Calculate text position
    let textY = scaledPosition.y;
    
    if (isPdfMode) {
        // For PDF: NO SCALE (scale = 1)
        // Convert canvas Y to PDF Y coordinates (origin at bottom-left)
        const pdfY = canvasToPdfCoordinates(calibratedStored.y, calibratedStored.height, pageHeight);
        
        // Text baseline adjustment - SAME as preview
        // pdfY is the bottom of the field in PDF coordinates
        // Add height and subtract baseline offset to position text from top
        const baselineOffset = fontSize * 0.2;
        textY = normalizeCoordinate(pdfY + calibratedStored.height - baselineOffset);
    } else {
        // For preview/edit: scale IS applied (pageScale)
        // Use scaled position and calculate baseline in scaled space
        textY = calculateTextBaseline(scaledPosition.y, scaledPosition.height, scaledFontSize);
    }
    
    return {
        x: scaledPosition.x,
        y: scaledPosition.y,
        width: scaledPosition.width,
        height: scaledPosition.height,
        textX: transformCoordinate(calibratedStored.x, scale),
        textY: textY,
        scale: scale,
    };
}

/**
 * DRAG-DROP COORDINATE STORAGE
 * Store coordinates with maximum precision during drag operations
 */
export function storeDragCoordinate(
    screenX: number,
    screenY: number,
    containerRect: DOMRect,
    scale: number
): { x: number; y: number } {
    // Calculate relative position within container
    const relativeX = (screenX - containerRect.left) / scale;
    const relativeY = (screenY - containerRect.top) / scale;
    
    // Normalize to maximum precision
    return {
        x: normalizeCoordinate(relativeX),
        y: normalizeCoordinate(relativeY),
    };
}

/**
 * Validation: Check if two coordinates are within acceptable tolerance
 * Used for alignment verification
 */
export function validateCoordinateMatch(
    coord1: number,
    coord2: number,
    tolerancePixels: number = 0.01 // 0.01 pixel tolerance
): boolean {
    const difference = Math.abs(coord1 - coord2);
    return difference <= tolerancePixels;
}

/**
 * Debug helper: Format coordinates for logging
 */
export function formatCoordinate(value: number): string {
    return value.toFixed(PRECISION_DECIMALS);
}

/**
 * Debug helper: Log field position with full precision
 */
export function logFieldPosition(
    fieldId: string,
    position: PreciseFieldPosition,
    mode: 'edit' | 'preview' | 'pdf'
): void {
    console.log(`[${mode.toUpperCase()}] Field ${fieldId}:`, {
        x: formatCoordinate(position.x),
        y: formatCoordinate(position.y),
        width: formatCoordinate(position.width),
        height: formatCoordinate(position.height),
        textX: formatCoordinate(position.textX),
        textY: formatCoordinate(position.textY),
        scale: formatCoordinate(position.scale),
    });
}

/**
 * Export precision factor for external use
 */
export { PRECISION_DECIMALS, PRECISION_FACTOR };

/**
 * Export calibration utilities
 */
export { 
    calibratePreviewCoordinates, 
    calibratePdfCoordinates,
    recordCalibration,
    analyzeCalibrations,
    clearCalibrations,
    exportCalibrations,
    type CalibrationData
} from './coordinate-calibration';
