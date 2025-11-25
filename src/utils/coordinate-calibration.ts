/**
 * COORDINATE CALIBRATION SYSTEM
 * 
 * Accounts for the differences between:
 * 1. Where we WANT a field to be (visual placement)
 * 2. Where it ACTUALLY RENDERS (browser/PDF rendering precision)
 * 
 * Root causes of misalignment:
 * - Browser sub-pixel rendering (1-2 pixels drift in preview)
 * - PDF coordinate system differences (3-4 pixels drift in PDF)
 * - Font baseline calculation variations
 * - Scale application differences
 */

/**
 * CALIBRATION OFFSETS
 * These are empirically measured differences between visual and actual rendering
 * 
 * IMPORTANT: Fine-tune these values based on your measurements
 * User reported: Preview -1-2px downward shift, PDF +3-4px upward shift
 */

// Preview mode calibration: Account for browser rendering imprecision
// Browser renders text/fields slightly lower than CSS coordinates
// To compensate: add a NEGATIVE offset (move field UP)
// Recommended range: -1.0 to -2.0 (test with -1.5 first)
const PREVIEW_Y_CALIBRATION = -1.5; // Adjusted from -0.5 to -1.5 to correct 1-2px downward drift

// PDF mode calibration: Account for PDF coordinate system and rendering differences  
// PDF rendering positions fields slightly higher than preview
// To compensate: add a POSITIVE offset (move field DOWN)
// Recommended range: 3.0 to 4.0 (test with 3.5 first)
const PDF_Y_CALIBRATION = 3.5; // Adjusted from 0.75 to 3.5 to correct 3-4px upward drift

const PREVIEW_X_CALIBRATION = 0; // No X drift observed
const PDF_X_CALIBRATION = 0; // No X drift observed

/**
 * Apply visual placement calibration for PREVIEW mode
 * Adjusts coordinates to match what the browser actually renders vs what we intend
 */
export function calibratePreviewCoordinates(
    x: number,
    y: number
): { x: number; y: number } {
    return {
        x: x + PREVIEW_X_CALIBRATION,
        y: y + PREVIEW_Y_CALIBRATION,
    };
}

/**
 * Apply visual placement calibration for PDF mode
 * Adjusts coordinates to match PDF rendering with precise positioning
 */
export function calibratePdfCoordinates(
    x: number,
    y: number
): { x: number; y: number } {
    return {
        x: x + PDF_X_CALIBRATION,
        y: y + PDF_Y_CALIBRATION,
    };
}

/**
 * Alternative approach: Measure the actual rendered position vs intended
 * This is used during field placement to record calibration data
 */
export interface CalibrationData {
    intendedX: number;
    intendedY: number;
    actualPreviewX: number;
    actualPreviewY: number;
    actualPdfX: number;
    actualPdfY: number;
    zoom: number;
    timestamp: number;
}

/**
 * Store calibration measurements in localStorage for analysis
 * Helps identify patterns in rendering discrepancies
 */
export function recordCalibration(data: CalibrationData): void {
    try {
        const calibrations = JSON.parse(localStorage.getItem('calibrationData') || '[]');
        calibrations.push(data);
        // Keep only last 50 calibrations
        if (calibrations.length > 50) {
            calibrations.shift();
        }
        localStorage.setItem('calibrationData', JSON.stringify(calibrations));
    } catch (error) {
        console.error('Failed to record calibration:', error);
    }
}

/**
 * Analyze calibration data to determine optimal offsets
 * Run this in browser console to see calibration analysis
 */
export function analyzeCalibrations(): {
    previewYMean: number;
    previewYStdDev: number;
    pdfYMean: number;
    pdfYStdDev: number;
} {
    try {
        const calibrations = JSON.parse(localStorage.getItem('calibrationData') || '[]') as CalibrationData[];
        
        if (calibrations.length === 0) {
            return { previewYMean: 0, previewYStdDev: 0, pdfYMean: 0, pdfYStdDev: 0 };
        }

        // Calculate preview Y drift
        const previewYDrifts = calibrations.map(c => c.actualPreviewY - c.intendedY);
        const previewYMean = previewYDrifts.reduce((a, b) => a + b, 0) / previewYDrifts.length;
        const previewYVariance = previewYDrifts.reduce((a, b) => a + Math.pow(b - previewYMean, 2), 0) / previewYDrifts.length;
        const previewYStdDev = Math.sqrt(previewYVariance);

        // Calculate PDF Y drift
        const pdfYDrifts = calibrations.map(c => c.actualPdfY - c.intendedY);
        const pdfYMean = pdfYDrifts.reduce((a, b) => a + b, 0) / pdfYDrifts.length;
        const pdfYVariance = pdfYDrifts.reduce((a, b) => a + Math.pow(b - pdfYMean, 2), 0) / pdfYDrifts.length;
        const pdfYStdDev = Math.sqrt(pdfYVariance);

        console.log('📊 CALIBRATION ANALYSIS');
        console.log(`Preview Y - Mean drift: ${previewYMean.toFixed(3)}px, Std Dev: ${previewYStdDev.toFixed(3)}px`);
        console.log(`PDF Y - Mean drift: ${pdfYMean.toFixed(3)}px, Std Dev: ${pdfYStdDev.toFixed(3)}px`);
        console.log(`\nSuggested calibrations:`);
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
    localStorage.removeItem('calibrationData');
    console.log('✅ Calibration data cleared');
}

/**
 * Export calibrations for backup/analysis
 */
export function exportCalibrations(): string {
    return localStorage.getItem('calibrationData') || '[]';
}
