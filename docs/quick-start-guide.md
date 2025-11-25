# Quick Start Guide - Improved PDF Editor

## 🎉 What's New?

Your PDF editor is now **much more user-friendly** with better sizing, drag-and-drop, and visual feedback!

---

## 🚀 Getting Started

### 1. **Adding Fields**

In the right sidebar, you'll see field types in a grid:
- Click any field type to add it to your PDF
- Fields now have **smart default sizes**:
  - Text boxes are large enough to write full names
  - Checkboxes are easy to click (25x25px)
  - Icons (CHECK/CROSS) are clearly visible (30x30px)

### 2. **Moving Fields (Drag & Drop)**

- **Click and drag** the field to move it
- Look for the **3 horizontal lines** in the blue header bar - that's your drag handle
- While dragging:
  - Field becomes slightly transparent
  - Scales up a bit for visibility
  - Coordinates show in top-right corner
- Fields **snap to a 5px grid** for perfect alignment

### 3. **Resizing Fields**

- **Select a field** by clicking it
- You'll see **4 blue circles** at the corners
- **Drag any corner** to resize
- The size displays below the field in real-time
- All resizing snaps to the grid for precision

### 4. **Editing Properties**

When a field is selected, the sidebar shows:
- **Label**: Change the field name
- **Width & Height**: Fine-tune dimensions
- **Font Settings**: Size, family, weight, style, alignment, color
- **Delete Button**: Remove the field (red trash icon)

### 5. **Saving Your Work**

- Click the blue **"Save"** button in the top-right of sidebar
- All your fields are saved to the database
- You'll see a success message when done

---

## 🎨 Visual Improvements

### Better Colors
- **Blue theme** instead of black (more modern)
- **Green** check icons
- **Red** cross icons
- **Semi-transparent** backgrounds let you see the PDF underneath

### Clear Feedback
- **Hover** over a field → Blue glow appears
- **Click** a field → Blue ring shows it's selected
- **Drag** a field → Scales up and becomes transparent
- **Resize** → Blue handles and size display

### Smart Sizing
You can now easily write:
- ✅ Full names (TEXT fields are 250px wide)
- ✅ Email addresses (EMAIL fields are 250px wide)
- ✅ Numbers (NUMBER fields are 120px wide)
- ✅ Dates (DATE fields are 150px wide)
- ✅ Checkboxes are 25px (easy to click)
- ✅ Icons are 30px (clearly visible)

---

## 🎯 Pro Tips

### Perfect Placement
1. Turn on the **grid** (grid icon in toolbar)
2. Drag your field near where you want it
3. It will snap to the grid automatically
4. Use the coordinate display to verify position

### Quick Resizing
- Grab the **bottom-right corner** (has an icon) for basic resize
- Use **corner handles** for more control
- Check the **size display** below the field

### Copying Text Styles
1. Create one field with your desired font settings
2. Note the settings in the properties panel
3. Apply the same settings to other text fields

### Working with Icons
- **CHECK icons** are green - perfect for approved items
- **CROSS icons** are red - perfect for rejected items
- Resize them larger if needed (they scale perfectly)
- They have a subtle border in edit mode

---

## ⌨️ Keyboard Shortcuts (in Form View)

- **Ctrl/Cmd + Plus**: Zoom in
- **Ctrl/Cmd + Minus**: Zoom out
- **Ctrl/Cmd + 0**: Fit to width
- **Arrow Keys**: Navigate pages
- **Home**: First page
- **End**: Last page

---

## 🐛 Known Behaviors

### Expected Behaviors (Not Bugs)
- Fields snap to 5px grid - this is intentional for alignment
- Coordinates show in PDF points, not screen pixels
- Text fields have padding - this matches PDF output
- Grid is optional - turn it off if you don't need it

### If Something Seems Off
1. Check if the field is selected (blue ring)
2. Make sure you're dragging from the field (not the resize handles)
3. Verify the coordinates in the top-right display
4. Use the grid to ensure proper alignment

---

## 📝 Example Workflow

### Creating a Form
1. **Add fields**:
   - Click "Text Field" for name
   - Click "Email" for email address
   - Click "Date Picker" for date of birth
   - Click "Checkbox" for agreement
   - Click "Check Icon" for approval mark

2. **Position fields**:
   - Turn on grid view
   - Drag each field to its location
   - They'll snap to the grid automatically

3. **Adjust sizes**:
   - Resize name field to 300px wide if needed
   - Make checkboxes larger (30px) if they're too small
   - Icons can be 25-40px depending on your needs

4. **Style text**:
   - Select each text field
   - Set font to Arial 14pt
   - Choose alignment (left, center, right)
   - Pick a color if needed

5. **Save**:
   - Click the blue "Save" button
   - Wait for success message
   - Test by going to fill mode

---

## 🎓 Field Types Explained

### Text-Based
- **TEXT**: Single-line text (names, addresses)
- **EMAIL**: Email addresses (includes validation icon)
- **NUMBER**: Numeric values
- **DATE**: Date picker calendar

### Selections
- **CHECKBOX**: Square box for yes/no
- **RADIO**: Circle for multiple choice

### Icons
- **CHECK**: Green checkmark (✓)
- **CROSS**: Red X mark (✗)

### Special
- **SIGNATURE**: Area for signatures (300x80px default)
- **IMAGE**: Upload image placeholder

---

## ✅ Best Practices

### Sizing
- **Names**: 250-300px wide
- **Short text**: 150-200px wide
- **Numbers**: 80-120px wide
- **Dates**: 150px wide
- **Checkboxes**: 25-30px square
- **Icons**: 25-40px square
- **Signatures**: 300x80px minimum

### Positioning
- Use the grid for alignment
- Group related fields
- Leave spacing between fields (at least 10px)
- Align fields vertically when possible

### Styling
- Keep font sizes consistent (14pt recommended)
- Use one or two font families max
- Match colors to your brand if needed
- Bold important labels

---

## 🆘 Need Help?

### Common Questions

**Q: How do I make text boxes bigger for writing?**
A: They're already sized well by default (250x35px), but you can resize by dragging the corner handles.

**Q: Fields aren't snapping where I want**
A: Turn on the grid view to see the snap points. Fields snap to 5px increments.

**Q: How do I delete a field?**
A: Select the field, then click the red trash icon in the sidebar properties panel.

**Q: Can I change the grid size?**
A: Currently it's fixed at 5px for precision. This provides good balance between flexibility and alignment.

**Q: Icons are too small**
A: Select the icon and resize it using the corner handles. They scale up perfectly.

---

## 🎉 Enjoy Your Improved Editor!

You now have a professional, easy-to-use PDF form editor with:
- ✅ Smart default sizes
- ✅ Beautiful blue theme
- ✅ Smooth drag and drop
- ✅ Easy resizing
- ✅ Perfect alignment
- ✅ Clear visual feedback

**Start editing and see the difference!** 🚀

---

**Server Running**: http://localhost:3000
**Last Updated**: November 24, 2025
