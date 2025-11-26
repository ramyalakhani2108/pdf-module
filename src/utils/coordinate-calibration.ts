/**
 * @fileoverview Coordinate Calibration System
 * @description Accounts for rendering differences between visual placement
 * and actual rendering in browser/PDF contexts.
 * 
 * @root_causes Root causes of misalignment:
 * - Browser sub-pixel rendering (1-2 pixels drift in preview)
 * - PDF coordinate system differences (3-4 pixels drift in PDF)
 * - Font baseline calculation variations
 * - Scale application differences
 */

import { CALIBRATION_CONFIG, STORAGE_KEYS } from '@/lib/constants';

// =============================================================================
// CALIBRATION FUNCTIONS
// =============================================================================

/**
 * Apply visual placement calibration for PREVIEW mode
 * @description Adjusts coordinates to match what the browser actually renders
 * vs what we intend. Browser renders text/fields slightly lower than CSS coordinates.
 * 
 * @param x - X coordinate to calibrate
 * @param y - Y coordinate to calibrate
 * @returns Calibrated coordinates
 */
export function calibratePreviewCoordinates(
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: x + CALIBRATION_CONFIG.PREVIEW_X_OFFSET,
    y: y + CALIBRATION_CONFIG.PREVIEW_Y_OFFSET,
  };
}

/**
 * Apply visual placement calibration for PDF mode
 * @description Adjusts coordinates to match PDF rendering with precise positioning.
 * PDF rendering positions fields slightly higher than preview.
 * 
 * @param x - X coordinate to calibrate
 * @param y - Y coordinate to calibrate
 * @returns Calibrated coordinates
 */
export function calibratePdfCoordinates(
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: x + CALIBRATION_CONFIG.PDF_X_OFFSET,
    y: y + CALIBRATION_CONFIG.PDF_Y_OFFSET,
  };
}

// =============================================================================
// CALIBRATION DATA MANAGEMENT
// =============================================================================

/**
 * Calibration measurement data structure
 */
export interface CalibrationData {
  /** Intended X position */
  intendedX: number;
  /** Intended Y position */
  intendedY: number;
  /** Actual X position in preview */
  actualPreviewX: number;
  /** Actual Y position in preview */
  actualPreviewY: number;
  /** Actual X position in PDF */
  actualPdfX: number;
  /** Actual Y position in PDF */
  actualPdfY: number;
  /** Current zoom level */
  zoom: number;
  /** Recording timestamp */
  timestamp: number;
}

/**
 * Record calibration measurement in localStorage
 * @description Helps identify patterns in rendering discrepancies.
 * Keeps only the last MAX_CALIBRATION_RECORDS calibrations.
 * 
 * @param data - Calibration measurement data
 */
export function recordCalibration(data: CalibrationData): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);
    const calibrations: CalibrationData[] = stored ? JSON.parse(stored) : [];
    
    calibrations.push(data);
    
    // Keep only recent calibrations
    while (calibrations.length > CALIBRATION_CONFIG.MAX_CALIBRATION_RECORDS) {
      calibrations.shift();
    }
    
    localStorage.setItem(STORAGE_KEYS.CALIBRATION_DATA, JSON.stringify(calibrations));
  } catch (error) {
    console.error('Failed to record calibration:', error);
  }
}

/**
 * Analysis result for calibration data
 */
export interface CalibrationAnalysis {
  /** Mean Y drift in preview mode */
  previewYMean: number;
  /** Standard deviation of Y drift in preview mode */
  previewYStdDev: number;
  /** Mean Y drift in PDF mode */
  pdfYMean: number;
  /** Standard deviation of Y drift in PDF mode */
  pdfYStdDev: number;
}

/**
 * Analyze calibration data to determine optimal offsets
 * @description Run in browser console to see calibration analysis.
 * Use results to fine-tune CALIBRATION_CONFIG values.
 * 
 * @returns Analysis results with suggested calibration values
 * 
 * @example
 * ```javascript
 * // In browser console:
 * import { analyzeCalibrations } from '@/utils/coordinate-calibration';
 * const analysis = analyzeCalibrations();
 * console.log('Suggested PREVIEW_Y_CALIBRATION:', -analysis.previewYMean);
 * console.log('Suggested PDF_Y_CALIBRATION:', -analysis.pdfYMean);
 * ```
 */
export function analyzeCalibrations(): CalibrationAnalysis {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA);
    const calibrations: CalibrationData[] = stored ? JSON.parse(stored) : [];

    if (calibrations.length === 0) {
      return { previewYMean: 0, previewYStdDev: 0, pdfYMean: 0, pdfYStdDev: 0 };
    }

    // Calculate preview Y drift statistics
    const previewYDrifts = calibrations.map((c) => c.actualPreviewY - c.intendedY);
    const previewYMean = calculateMean(previewYDrifts);
    const previewYStdDev = calculateStdDev(previewYDrifts, previewYMean);

    // Calculate PDF Y drift statistics
    const pdfYDrifts = calibrations.map((c) => c.actualPdfY - c.intendedY);
    const pdfYMean = calculateMean(pdfYDrifts);
    const pdfYStdDev = calculateStdDev(pdfYDrifts, pdfYMean);

    // Log analysis results
    console.log('📊 CALIBRATION ANALYSIS');
    console.log(`Preview Y - Mean drift: ${previewYMean.toFixed(3)}px, Std Dev: ${previewYStdDev.toFixed(3)}px`);
    console.log(`PDF Y - Mean drift: ${pdfYMean.toFixed(3)}px, Std Dev: ${pdfYStdDev.toFixed(3)}px`);
    console.log('\nSuggested calibrations:');
    console.log(`PREVIEW_Y_CALIBRATION = ${(-previewYMean).toFixed(3)}`);
    console.log(`PDF_Y_CALIBRATION = ${(-pdfYMean).toFixed(3)}`);

    return { previewYMean, previewYStdDev, pdfYMean, pdfYStdDev };
  } catch (error) {
    console.error('Failed to analyze calibrations:', error);
    return { previewYMean: 0, previewYStdDev: 0, pdfYMean: 0, pdfYStdDev: 0 };
  }
}

/**
 * Reset all calibration data
 */
export function clearCalibrations(): void {
  localStorage.removeItem(STORAGE_KEYS.CALIBRATION_DATA);
  console.log('✅ Calibration data cleared');
}

/**
 * Export calibrations for backup/analysis
 * @returns JSON string of calibration data
 */
export function exportCalibrations(): string {
  return localStorage.getItem(STORAGE_KEYS.CALIBRATION_DATA) || '[]';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
