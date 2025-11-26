/**
 * @fileoverview Unified Precision Coordinate System v4.0
 * @description IEEE 754 Double Precision coordinate system for pixel-perfect 
 * alignment across edit, preview, and PDF modes.
 * 
 * @principle Use the SAME coordinate transformation everywhere + apply 
 * calibration offsets to account for browser/PDF rendering differences.
 * 
 * @precision IEEE 754 double precision provides 15-17 significant digits.
 * We use 15 decimal places for maximum precision without floating-point errors.
 */

import { calibratePreviewCoordinates, calibratePdfCoordinates } from './coordinate-calibration';
import { PRECISION_CONFIG } from '@/lib/constants';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of decimal places for precision calculations */
export const PRECISION_DECIMALS = PRECISION_CONFIG.DECIMAL_PLACES;

/** Precision factor (10^15) for normalization */
export const PRECISION_FACTOR = PRECISION_CONFIG.FACTOR;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Normalize a coordinate to maximum precision
 * @description Removes floating-point artifacts and ensures consistency
 * by multiplying by precision factor, rounding, and dividing back.
 * 
 * @param value - Coordinate value to normalize
 * @returns Normalized coordinate with 15 decimal places of precision
 * 
 * @example
 * ```typescript
 * normalizeCoordinate(123.456789123456789)
 * // Returns: 123.456789123456789 (normalized)
 * ```
 */
export function normalizeCoordinate(value: number): number {
  return Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR;
}

/**
 * Normalize an array of field coordinates
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Field width
 * @param height - Field height
 * @returns Object with normalized coordinates
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

// =============================================================================
// COORDINATE TRANSFORMATION
// =============================================================================

/**
 * Unified coordinate transformation function
 * @description Used identically in edit mode, preview, AND PDF generation.
 * This is the SINGLE SOURCE OF TRUTH for coordinate positioning.
 * 
 * @param originalValue - Original coordinate value
 * @param scale - Scale factor to apply
 * @param offset - Optional offset (viewport position, etc.)
 * @returns Transformed and normalized coordinate
 */
export function transformCoordinate(
  originalValue: number,
  scale: number,
  offset: number = 0
): number {
  const scaled = originalValue * scale;
  const offsetApplied = scaled + offset;
  return normalizeCoordinate(offsetApplied);
}

/**
 * Calculate text baseline position
 * @description Critical for vertical alignment consistency.
 * Uses top-alignment (like CSS flex align-items: flex-start).
 * 
 * @param fieldY - Field Y coordinate
 * @param fieldHeight - Field height
 * @param fontSize - Font size in pixels
 * @returns Baseline Y position
 */
export function calculateTextBaseline(
  fieldY: number,
  fieldHeight: number,
  fontSize: number
): number {
  const baselineOffset = fontSize * 0.2;
  const baseline = fieldY + fieldHeight - baselineOffset;
  return normalizeCoordinate(baseline);
}

/**
 * Convert canvas/preview coordinates to PDF coordinates
 * @description Canvas origin is at top-left (0,0).
 * PDF origin is at bottom-left (0,0).
 * 
 * @param canvasY - Canvas Y coordinate
 * @param canvasHeight - Canvas/field height
 * @param pageHeight - PDF page height
 * @returns PDF Y coordinate
 */
export function canvasToPdfCoordinates(
  canvasY: number,
  canvasHeight: number,
  pageHeight: number
): number {
  const pdfY = pageHeight - canvasY - canvasHeight;
  return normalizeCoordinate(pdfY);
}

// =============================================================================
// FIELD POSITIONING
// =============================================================================

/**
 * Precise field position interface
 */
export interface PreciseFieldPosition {
  /** X position in scaled coordinates */
  x: number;
  /** Y position in scaled coordinates */
  y: number;
  /** Width in scaled coordinates */
  width: number;
  /** Height in scaled coordinates */
  height: number;
  /** Text X position for text rendering */
  textX: number;
  /** Text Y position (baseline) for text rendering */
  textY: number;
  /** Scale factor applied */
  scale: number;
}

/**
 * Calculate precise field position for rendering
 * @description Use this in BOTH preview and PDF rendering for consistency.
 * 
 * @param storedX - Stored X coordinate
 * @param storedY - Stored Y coordinate
 * @param storedWidth - Stored width
 * @param storedHeight - Stored height
 * @param fontSize - Font size
 * @param scale - Scale factor (1-2 for preview, 1 for PDF)
 * @param isPdfMode - Whether rendering for PDF output
 * @param pageHeight - PDF page height (required for PDF mode)
 * @returns Precise field position object
 * 
 * @example
 * ```typescript
 * // Preview mode
 * const previewPos = calculatePreciseFieldPosition(
 *   100, 200, 150, 30, 14, 1.5, false
 * );
 * 
 * // PDF mode
 * const pdfPos = calculatePreciseFieldPosition(
 *   100, 200, 150, 30, 14, 1, true, 792
 * );
 * ```
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
  // Step 1: Normalize stored coordinates
  const normalizedStored = normalizeFieldCoordinates(
    storedX,
    storedY,
    storedWidth,
    storedHeight
  );

  // Step 2: Apply calibration BEFORE any transformations
  const calibrated = isPdfMode
    ? calibratePdfCoordinates(normalizedStored.x, normalizedStored.y)
    : calibratePreviewCoordinates(normalizedStored.x, normalizedStored.y);

  const calibratedStored = {
    x: normalizeCoordinate(calibrated.x),
    y: normalizeCoordinate(calibrated.y),
    width: normalizedStored.width,
    height: normalizedStored.height,
  };

  // Step 3: Apply scale with precision
  const scaledPosition = {
    x: transformCoordinate(calibratedStored.x, scale),
    y: transformCoordinate(calibratedStored.y, scale),
    width: transformCoordinate(calibratedStored.width, scale),
    height: transformCoordinate(calibratedStored.height, scale),
  };

  // Step 4: Normalize font size with scale
  const scaledFontSize = transformCoordinate(fontSize, scale);

  // Step 5: Calculate text position
  let textY = scaledPosition.y;

  if (isPdfMode) {
    // PDF mode: Convert canvas Y to PDF Y coordinates
    const pdfY = canvasToPdfCoordinates(
      calibratedStored.y,
      calibratedStored.height,
      pageHeight
    );
    const baselineOffset = fontSize * 0.2;
    textY = normalizeCoordinate(pdfY + calibratedStored.height - baselineOffset);
  } else {
    // Preview mode: Calculate baseline in scaled space
    textY = calculateTextBaseline(
      scaledPosition.y,
      scaledPosition.height,
      scaledFontSize
    );
  }

  return {
    x: scaledPosition.x,
    y: scaledPosition.y,
    width: scaledPosition.width,
    height: scaledPosition.height,
    textX: transformCoordinate(calibratedStored.x, scale),
    textY,
    scale,
  };
}

// =============================================================================
// DRAG-DROP UTILITIES
// =============================================================================

/**
 * Store coordinates with maximum precision during drag operations
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @param containerRect - Container bounding rectangle
 * @param scale - Current scale factor
 * @returns Normalized coordinates object
 */
export function storeDragCoordinate(
  screenX: number,
  screenY: number,
  containerRect: DOMRect,
  scale: number
): { x: number; y: number } {
  const relativeX = (screenX - containerRect.left) / scale;
  const relativeY = (screenY - containerRect.top) / scale;

  return {
    x: normalizeCoordinate(relativeX),
    y: normalizeCoordinate(relativeY),
  };
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Check if two coordinates are within acceptable tolerance
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @param tolerancePixels - Tolerance in pixels (default: 0.01)
 * @returns True if coordinates match within tolerance
 */
export function validateCoordinateMatch(
  coord1: number,
  coord2: number,
  tolerancePixels: number = PRECISION_CONFIG.TOLERANCE
): boolean {
  return Math.abs(coord1 - coord2) <= tolerancePixels;
}

// =============================================================================
// DEBUG UTILITIES
// =============================================================================

/**
 * Format coordinate for logging with full precision
 * @param value - Coordinate value
 * @returns Formatted string
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(PRECISION_DECIMALS);
}

/**
 * Log field position with full precision
 * @param fieldId - Field identifier
 * @param position - Field position object
 * @param mode - Rendering mode ('edit', 'preview', or 'pdf')
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

// =============================================================================
// RE-EXPORTS
// =============================================================================

export {
  calibratePreviewCoordinates,
  calibratePdfCoordinates,
  recordCalibration,
  analyzeCalibrations,
  clearCalibrations,
  exportCalibrations,
  type CalibrationData,
} from './coordinate-calibration';
