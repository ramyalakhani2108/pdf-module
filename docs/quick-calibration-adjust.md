# Quick Calibration Adjustment Guide

## Your Current Measurements
- **Preview**: Fields appear 1-2 pixels **lower** ↓
- **PDF**: Fields appear 3-4 pixels **higher** ↑

## Current Calibration Applied
```
PREVIEW_Y_CALIBRATION = -1.5   (moves field UP by 1.5px)
PDF_Y_CALIBRATION = 3.5        (moves field DOWN by 3.5px)
```

## Testing Instructions

### Step 1: Test at 100% Zoom
1. Open the form editor
2. Place a field at a clear position (e.g., Y=200px)
3. Click "Preview Form" button
4. Check if field appears at approximately same position
5. Download PDF and check alignment

### Step 2: If Preview Still Shifts Down
The field appears lower than expected in preview.

**Increase the negative offset** (move field UP more):
```typescript
// In /src/utils/coordinate-calibration.ts, line 18:
// BEFORE:
const PREVIEW_Y_CALIBRATION = -1.5;

// AFTER:
const PREVIEW_Y_CALIBRATION = -2.0;  // or -2.5 for more correction
```

Then refresh browser and test again.

### Step 3: If Preview Still Shifts Up
The field appears higher than expected in preview.

**Decrease the negative offset** (move field DOWN):
```typescript
// In /src/utils/coordinate-calibration.ts, line 18:
// BEFORE:
const PREVIEW_Y_CALIBRATION = -1.5;

// AFTER:
const PREVIEW_Y_CALIBRATION = -1.0;  // or -0.5 for less correction
```

### Step 4: If PDF Still Shifts Up
The field appears higher than expected in PDF.

**Increase the positive offset** (move field DOWN more):
```typescript
// In /src/utils/coordinate-calibration.ts, line 23:
// BEFORE:
const PDF_Y_CALIBRATION = 3.5;

// AFTER:
const PDF_Y_CALIBRATION = 4.0;  // or 4.5 for more correction
```

### Step 5: If PDF Still Shifts Down
The field appears lower than expected in PDF.

**Decrease the positive offset** (move field UP):
```typescript
// In /src/utils/coordinate-calibration.ts, line 23:
// BEFORE:
const PDF_Y_CALIBRATION = 3.5;

// AFTER:
const PDF_Y_CALIBRATION = 3.0;  // or 2.5 for less correction
```

## The Calibration File
Location: `/src/utils/coordinate-calibration.ts`

Lines 12-24:
```typescript
// Preview mode calibration
const PREVIEW_Y_CALIBRATION = -1.5;    // ← ADJUST THIS
const PREVIEW_X_CALIBRATION = 0;

// PDF mode calibration  
const PDF_Y_CALIBRATION = 3.5;         // ← ADJUST THIS
const PDF_X_CALIBRATION = 0;
```

## Adjustment Strategy

**Start with current values: `-1.5` and `3.5`**

| Issue | Adjustment | New Values |
|-------|------------|-----------|
| Preview too low | Increase -1.5 → -2.0 | More negative |
| Preview too high | Decrease -1.5 → -1.0 | Less negative |
| PDF too high | Increase 3.5 → 4.0 | More positive |
| PDF too low | Decrease 3.5 → 3.0 | Less positive |

## After Each Change

1. Edit the file
2. Save (Ctrl+S or Cmd+S)
3. Browser should auto-refresh
4. Test placement in Editor → Preview Form → PDF Download
5. If not perfect, adjust by ±0.25 pixels and repeat

## Target Alignment

When properly calibrated:
- Edit mode: Field at Y=100
- Preview: Field shows at Y≈100 (±0.1px)
- PDF: Field shows at Y≈100 (±0.1px)

If you see less than 0.5px difference across all three views, that's **perfect alignment** - imperceptible to human eye!

## Reset to Defaults (If You Want to Start Over)

```typescript
const PREVIEW_Y_CALIBRATION = -1.5;   // Default
const PDF_Y_CALIBRATION = 3.5;        // Default
```

Then adjust from there based on your observations.

---

**Pro Tip**: Take a screenshot of each test showing the exact pixel position. Compare side-by-side to see exactly how many pixels of adjustment you need.
