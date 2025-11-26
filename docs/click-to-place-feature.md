# Click-to-Place Feature

## Overview

The PDF Form Editor now supports a **Microsoft Word/Paint-like click-to-place workflow** for adding fields to your PDF. This makes it much easier and more intuitive to place fields exactly where you want them.

## How It Works

### Before (Old Workflow)
1. Click a field type in the sidebar
2. Field appears at a random position (100, 100)
3. Drag the field to the correct location
4. Resize and adjust as needed

### After (New Workflow - Like MS Word/Paint)
1. **Select a tool** by clicking a field type in the sidebar (Text, Date, Number, etc.)
2. The tool becomes "active" (highlighted in blue, cursor changes to crosshair)
3. **Click anywhere on the PDF** to place the field at that exact location
4. The field is created right where you clicked!
5. **Tool stays active** - you can continue clicking to place more fields of the same type
6. Press **ESC** or click the X button to stop

## Visual Feedback

### When a Tool is Selected:
- **Blue banner** at the top of the canvas showing the active tool
- **Blue indicator** in the sidebar showing which tool is selected
- **Crosshair cursor** when hovering over the PDF
- **Blue ring** around the PDF canvas indicating it's ready for placement

### Sidebar Changes:
- Selected tool shows a **checkmark (✓)** and blue highlight
- "Select Tool" section header appears
- "Deselect" button appears when a tool is active

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **ESC** | Cancel active tool / Deselect field |
| **Delete / Backspace** | Delete selected field |
| **Cmd/Ctrl + D** | Duplicate selected field |
| **Arrow Keys** | Move selected field (1px) |
| **Shift + Arrow Keys** | Move selected field (10px) |
| **Cmd/Ctrl + Arrow Keys** | Move selected field (50px) |
| **G** | Toggle grid |
| **R** | Toggle rulers |
| **?** | Show keyboard shortcuts |

## Technical Implementation

### State Management
The feature uses Zustand store with a new `activeTool` state:

```typescript
interface ActiveTool {
  type: InputType;           // TEXT, DATE, NUMBER, EMAIL, ICON, SIGNATURE, IMAGE
  iconVariant?: IconVariant; // For ICON type: CHECK, CROSS, CIRCLE, etc.
  iconColor?: string;        // Hex color for icons
}
```

### Store Actions
- `setActiveTool(tool)` - Select a tool
- `clearActiveTool()` - Deselect the current tool
- `addFieldAtPosition({ x, y })` - Add a field at the specified coordinates using the active tool

### Coordinate System
- Click coordinates are captured relative to the PDF canvas
- Coordinates are converted from screen pixels to PDF points (unscaled) using the current zoom level
- Formula: `pdfCoord = screenCoord / zoom`

## Default Field Sizes

When a field is placed, it uses sensible default sizes based on the field type:

| Field Type | Width | Height |
|------------|-------|--------|
| TEXT | 250px | 35px |
| EMAIL | 250px | 35px |
| NUMBER | 120px | 35px |
| DATE | 150px | 35px |
| ICON | 30px | 30px |
| SIGNATURE | 300px | 80px |
| IMAGE | 200px | 150px |

## Benefits

1. **Faster workflow** - No more dragging fields from a random position
2. **More intuitive** - Works like familiar applications (Word, Paint, Photoshop)
3. **Batch placement** - Tool stays active for placing multiple fields quickly
4. **Precise placement** - Click exactly where you want the field (top-left corner aligns with click)
5. **Clean UI** - Simple crosshair cursor, no distracting previews
