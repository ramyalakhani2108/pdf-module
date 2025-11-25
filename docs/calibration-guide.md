/**
 * ADVANCED CALIBRATION GUIDE
 * 
 * This document explains how to use the calibration system to fix alignment issues.
 * 
 * The calibration system has TWO MODES:
 * 1. STATIC OFFSETS (already configured)
 * 2. DYNAMIC MEASUREMENT (for precision tuning)
 */

// ============================================================================
// MODE 1: STATIC CALIBRATION OFFSETS (Currently Active)
// ============================================================================

/*
Current calibration values in `/src/utils/coordinate-calibration.ts`:

PREVIEW_Y_CALIBRATION = -0.5
- Accounts for browser sub-pixel rendering in preview mode
- Compensates for 1-2 pixel downward drift when clicking Preview Form
- Value is: -0.5 pixels (moves field up by 0.5px)

PDF_Y_CALIBRATION = 0.75
- Accounts for PDF coordinate system differences
- Compensates for 3-4 pixel upward drift in downloaded PDF
- Value is: +0.75 pixels (moves field down by 0.75px)

HOW IT WORKS:
1. User places field at Y=100 in edit mode
2. In preview: field renders at Y=100-0.5 = 99.5 (visually aligns with edit)
3. In PDF: field renders at Y=100+0.75 = 100.75 (aligns with preview)

This creates the illusion that all three views show the field at Y=100.
*/

// ============================================================================
// MODE 2: DYNAMIC MEASUREMENT (For Fine-Tuning)
// ============================================================================

/*
HOW TO USE THE DYNAMIC CALIBRATION SYSTEM:

STEP 1: Enable calibration recording
-------
Open browser DevTools console and run:
  localStorage.setItem('enableCalibrationRecording', 'true');

STEP 2: Measure field positions
-------
1. Place a field at a KNOWN POSITION in Edit mode (e.g., Y=200)
2. Click Preview Form - note the exact pixel position visually
3. Open DevTools > Inspector, use element picker on the field
4. Check the "top" CSS property - record actual Y position in preview
5. Download PDF and measure exact visual position using a PDF viewer
6. Record the PDF's visual Y position

STEP 3: Analyze results
-------
After measuring several fields, run in console:
  const analysis = window.__calibrationAnalysis();
  console.table(analysis);

This shows:
- previewYDrift: How many pixels lower/higher fields appear in preview
- pdfYDrift: How many pixels lower/higher fields appear in PDF
- Recommended calibration values

STEP 4: Apply calibration
-------
Update `/src/utils/coordinate-calibration.ts`:
  PREVIEW_Y_CALIBRATION = -[previewYDrift]
  PDF_Y_CALIBRATION = -[pdfYDrift]

Example:
If analysis shows:
  - Preview fields appear 1.5px LOWER (drift = +1.5)
    → Set PREVIEW_Y_CALIBRATION = -1.5
  
  - PDF fields appear 2.0px HIGHER (drift = -2.0)
    → Set PDF_Y_CALIBRATION = 2.0

STEP 5: Verify
-------
1. Refresh browser and clear localStorage calibration:
  localStorage.removeItem('calibrationData');
  
2. Test with a field at 100% zoom - it should align perfectly now
3. Test with different zoom levels (75%, 125%, 200%)
4. Test different field sizes

STEP 6: Submit findings
-------
If you discover patterns, document them:
  localStorage.getItem('calibrationData')
  
This gives the exact measurements that can be used to improve the system.
*/

// ============================================================================
// MANUAL CALCULATION (If Dynamic Mode Doesn't Work)
// ============================================================================

/*
If automatic calibration isn't working, calculate manually:

FORMULA 1: Preview Calibration
  
  PREVIEW_Y_CALIBRATION = -(actualPreviewY - intendedY)
  
  Example:
  - You place field at Y=100
  - Preview shows it at pixel 101.5
  - Calibration = -(101.5 - 100) = -1.5
  
FORMULA 2: PDF Calibration
  
  PDF_Y_CALIBRATION = -(actualPdfY - intendedY)
  
  Example:
  - You place field at Y=100
  - PDF shows it at pixel 96.5
  - Calibration = -(96.5 - 100) = 3.5

Then update coordinate-calibration.ts with these values.
*/

// ============================================================================
// DEBUGGING: Real-Time Coordinate Inspection
// ============================================================================

/*
To see exact coordinates being used, add this to PDFFormFiller.tsx:

In the field rendering loop, add:
  if (debugMode) {
    console.log(`Field ${field.id}:`, {
      stored: { x: finalX, y: finalY },
      calibrated: calculateStored ? calculateStored.y : 'N/A',
      preview: { x: fieldPosition.x, y: fieldPosition.y },
      scale: pageScale,
    });
  }

This shows:
- What coordinates are stored
- What they become after calibration
- Where they actually render in preview
- The scale being applied

Run this at different zoom levels and screenshot the console output.
*/

// ============================================================================
// EXPECTED ALIGNMENT AFTER CALIBRATION
// ============================================================================

/*
PERFECT ALIGNMENT INDICATORS:
✅ Field placed at Y=100 appears at visual pixel 100 in preview
✅ Same field appears at visual pixel 100 in downloaded PDF (when zoomed to match)
✅ At 100% zoom (1:1), all three views show field at exact same position
✅ At other zoom levels, all three views maintain relative alignment

SIGNS OF MISALIGNMENT:
❌ Preview shows field 1-2 pixels lower than where you placed it
❌ PDF shows field 3-4 pixels higher/lower than preview
❌ Misalignment changes with zoom level
❌ Different field sizes have different alignment errors

COMMON ISSUES & FIXES:

Issue: Fields always appear lower in preview
→ Solution: Decrease PREVIEW_Y_CALIBRATION (make it more negative)
  From: -0.5  →  To: -1.0

Issue: Fields always appear higher in PDF
→ Solution: Increase PDF_Y_CALIBRATION (make it more positive)
  From: 0.75  →  To: 1.5

Issue: Alignment is perfect at 100% zoom but drifts at other zooms
→ Problem: Scale calculation issue, not calibration
→ Check: getPageScale() function in PDFFormFiller.tsx

Issue: Different field heights have different misalignment
→ Problem: Baseline calculation affected by font size
→ Check: calculateTextBaseline() in precision-coordinates.ts
*/

// ============================================================================
// NEXT STEPS FOR YOU
// ============================================================================

/*
1. READ THIS: You're experiencing -1 to -2px drift in preview and +3-4px in PDF
   
2. UPDATE CALIBRATION:
   a. Open: /src/utils/coordinate-calibration.ts
   b. Find: PREVIEW_Y_CALIBRATION and PDF_Y_CALIBRATION
   c. Based on your measurements:
      - PREVIEW_Y_CALIBRATION should be between -1.0 and -2.0
      - PDF_Y_CALIBRATION should be between 3.0 and 4.0
   
3. TEST: Place a field, check preview and PDF alignment
   
4. ITERATE: If still off, adjust in 0.25 pixel increments:
   - PREVIEW_Y_CALIBRATION from -1.0 to -1.5
   - PDF_Y_CALIBRATION from 3.0 to 3.5
   - Until alignment is perfect

5. VERIFY ACROSS ZOOM LEVELS:
   - 50% zoom
   - 75% zoom
   - 100% zoom (most important)
   - 150% zoom
   - 200% zoom
*/

export const CALIBRATION_INSTRUCTIONS = `
Use the calibration system in /src/utils/coordinate-calibration.ts
Adjust PREVIEW_Y_CALIBRATION and PDF_Y_CALIBRATION values
until fields align perfectly across all three views.

Current values:
- PREVIEW_Y_CALIBRATION = -0.5 (adjust if preview drift changes)
- PDF_Y_CALIBRATION = 0.75 (adjust if PDF drift changes)
`;
