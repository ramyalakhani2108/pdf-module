'use client';

import { useEditorStore, ActiveTool } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { InputType, IconVariant } from '@/lib/types';
import {
    Type, Calendar, Hash, Mail, PenTool, Image as ImageIcon, 
    Save, Trash2, Settings, Check, X as XIcon, Circle, 
    CheckCircle, XCircle, Square, CheckSquare, Star, Heart,
    ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ChevronDown, Shapes,
    ToggleLeft, ToggleRight, Eye, EyeOff, MousePointer, Crosshair
} from 'lucide-react';
import { cn, generateSlug } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { ICON_VARIANTS, ICON_COLORS, FONT_CONFIG } from '@/lib/constants';

// Icon mapping for lucide-react icons
const iconComponentMap: Record<string, React.ElementType> = {
    'Check': Check,
    'X': XIcon,
    'Circle': Circle,
    'CheckCircle': CheckCircle,
    'XCircle': XCircle,
    'Square': Square,
    'CheckSquare': CheckSquare,
    'Star': Star,
    'Heart': Heart,
    'ArrowRight': ArrowRight,
    'ArrowLeft': ArrowLeft,
    'ArrowUp': ArrowUp,
    'ArrowDown': ArrowDown,
};

const fieldTypes: { type: InputType; label: string; icon: React.ElementType }[] = [
    { type: 'TEXT', label: 'Text Field', icon: Type },
    { type: 'DATE', label: 'Date Picker', icon: Calendar },
    { type: 'NUMBER', label: 'Number', icon: Hash },
    { type: 'EMAIL', label: 'Email', icon: Mail },
    { type: 'ICON', label: 'Icons', icon: Shapes },
    { type: 'SIGNATURE', label: 'Signature', icon: PenTool },
    { type: 'IMAGE', label: 'Image', icon: ImageIcon },
];

export function Sidebar() {
    const {
        currentPdf,
        currentPage,
        addField,
        selectedFieldId,
        fields,
        updateField,
        deleteField,
        selectField,
        activeTool,
        setActiveTool,
        clearActiveTool
    } = useEditorStore();

    const [saving, setSaving] = useState(false);
    const [iconDropdownOpen, setIconDropdownOpen] = useState(false);
    const [selectedIconColor, setSelectedIconColor] = useState('#000000');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIconDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle ESC key to deselect tool
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && activeTool) {
                clearActiveTool();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeTool, clearActiveTool]);

    const selectedField = fields.find(f => f.id === selectedFieldId);

    // Toggle tool selection (click again to deselect)
    const handleToolSelect = (type: InputType, iconVariant?: IconVariant, iconColor?: string) => {
        // If clicking the same tool, deselect it
        if (activeTool?.type === type && 
            (type !== 'ICON' || activeTool.iconVariant === iconVariant)) {
            clearActiveTool();
            return;
        }
        
        // Set the active tool
        setActiveTool({
            type,
            iconVariant: type === 'ICON' ? iconVariant : undefined,
            iconColor: type === 'ICON' ? (iconColor || selectedIconColor) : undefined,
        });
        
        // Close icon dropdown after selection
        if (type === 'ICON') {
            setIconDropdownOpen(false);
        }
    };

    // Legacy function for backwards compatibility
    const handleAddField = (type: InputType, iconVariant?: IconVariant, iconColor?: string) => {
        handleToolSelect(type, iconVariant, iconColor);
    };

    const handleAddIconField = (variant: IconVariant) => {
        handleToolSelect('ICON', variant, selectedIconColor);
    };

    const handleSave = async () => {
        if (!currentPdf) return;

        setSaving(true);
        try {
            const response = await fetch('/api/inputs/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'your-secure-api-key-here-change-in-production',
                },
                body: JSON.stringify({
                    pdfFileId: currentPdf.id,
                    inputs: fields,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Save failed:', errorData);
                throw new Error(errorData.error || 'Failed to save');
            }

            const result = await response.json();
            console.log('Saved successfully:', result);
            alert(`Successfully saved ${result.data?.count || fields.length} inputs!`);
        } catch (error) {
            console.error('Save error:', error);
            alert(error instanceof Error ? error.message : 'Failed to save inputs');
        } finally {
            setSaving(false);
        }
    };

    if (!currentPdf) return null;

    return (
        <div className="w-80 border-l border-border bg-surface flex flex-col h-full">
            <div className="p-4 border-b border-border flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg text-foreground">PDF Editor Tools</h2>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Click a field type to add to PDF. Drag to position, resize with corners, edit properties below.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Active Tool Indicator - Clean and minimal */}
                {activeTool && (
                    <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crosshair className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {activeTool.type === 'ICON' 
                                        ? `${activeTool.iconVariant} Icon` 
                                        : `${activeTool.type} Field`}
                                </span>
                            </div>
                            <button
                                onClick={clearActiveTool}
                                className="p-1 hover:bg-foreground/10 rounded transition-colors"
                                title="Cancel (ESC)"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs opacity-80 mt-1">
                            Click on PDF to place • ESC to cancel
                        </p>
                    </div>
                )}

                {/* Field Types */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground">Select Tool</h3>
                        {activeTool && (
                            <button
                                onClick={clearActiveTool}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                <MousePointer className="w-3 h-3" />
                                Deselect
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {fieldTypes.map((item) => (
                            item.type === 'ICON' ? (
                                <div key={item.type} className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setIconDropdownOpen(!iconDropdownOpen)}
                                        className={cn(
                                            "w-full flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-muted transition-all gap-2",
                                            iconDropdownOpen && "ring-2 ring-primary bg-muted",
                                            activeTool?.type === 'ICON' && "ring-2 ring-primary bg-primary/5 border-primary/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-1">
                                            <item.icon className={cn(
                                                "w-5 h-5",
                                                activeTool?.type === 'ICON' && "text-primary"
                                            )} />
                                            <ChevronDown className={cn(
                                                "w-3 h-3 transition-transform", 
                                                iconDropdownOpen && "rotate-180"
                                            )} />
                                        </div>
                                        <span className={cn(
                                            "text-xs font-medium",
                                            activeTool?.type === 'ICON' && "text-primary"
                                        )}>
                                            {activeTool?.type === 'ICON' ? `✓ ${activeTool.iconVariant}` : item.label}
                                        </span>
                                    </button>
                                    
                                    {/* Icons Dropdown */}
                                    {iconDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 p-3 space-y-3 min-w-[280px]">
                                            {/* Color Selection */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Icon Color</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {ICON_COLORS.map((color) => (
                                                        <button
                                                            key={color.value}
                                                            onClick={() => setSelectedIconColor(color.value)}
                                                            className={cn(
                                                                "w-6 h-6 rounded-full border-2 transition-all",
                                                                selectedIconColor === color.value 
                                                                    ? "ring-2 ring-primary ring-offset-2" 
                                                                    : "border-border hover:scale-110"
                                                            )}
                                                            style={{ backgroundColor: color.value }}
                                                            title={color.label}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            {/* Icon Selection */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-muted-foreground">Select Icon</label>
                                                <div className="grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto">
                                                    {ICON_VARIANTS.map((variant) => {
                                                        const IconComp = iconComponentMap[variant.icon];
                                                        return (
                                                            <button
                                                                key={variant.value}
                                                                onClick={() => handleAddIconField(variant.value as IconVariant)}
                                                                className="flex flex-col items-center justify-center p-2 rounded-md border border-border hover:bg-muted hover:border-primary transition-colors gap-1"
                                                                title={variant.label}
                                                            >
                                                                <IconComp 
                                                                    className="w-5 h-5" 
                                                                    style={{ color: selectedIconColor }}
                                                                />
                                                                <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                                                    {variant.label.split(' ')[0]}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    key={item.type}
                                    onClick={() => handleToolSelect(item.type)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-muted transition-all gap-2",
                                        activeTool?.type === item.type && "ring-2 ring-primary bg-primary/5 border-primary/30"
                                    )}
                                >
                                    <item.icon className={cn(
                                        "w-5 h-5",
                                        activeTool?.type === item.type && "text-primary"
                                    )} />
                                    <span className={cn(
                                        "text-xs font-medium",
                                        activeTool?.type === item.type && "text-primary"
                                    )}>
                                        {activeTool?.type === item.type ? `✓ ${item.label}` : item.label}
                                    </span>
                                </button>
                            )
                        ))}
                    </div>
                </div>

                {/* Properties Panel */}
                {selectedField ? (
                    <div className="space-y-4 border-t pt-4 animate-slide-up">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Properties
                            </h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => deleteField(selectedField.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {/* Quick Size Presets for Small Fields */}
                            {(selectedField.width < 50 || selectedField.height < 50) && (
                                <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-3 space-y-2 shadow-sm">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold text-primary uppercase">⚡ Tiny Field Detected ({selectedField.width}×{selectedField.height}px)</span>
                                    </div>
                                    <p className="text-[10px] text-primary/80 font-semibold">Quick sizes for icons:</p>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[8, 10, 12, 15, 18, 20].map((size) => (
                                            <button
                                                key={size}
                                                onClick={() => {
                                                    const updates: Partial<typeof selectedField> = { width: size, height: size };
                                                    if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                        updates.fontSize = Math.max(FONT_CONFIG.MIN_FONT_SIZE, Math.floor(size * 0.65));
                                                    }
                                                    updateField(selectedField.id, updates);
                                                }}
                                                className="text-[9px] font-bold bg-white border-2 border-primary/20 hover:bg-primary/10 hover:border-primary/40 rounded px-1 py-1 transition-all"
                                            >
                                                {size}×{size}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="bg-green-50 border border-green-200 rounded p-2 space-y-1">
                                        <p className="text-[9px] text-green-700 font-bold">🎯 Auto-Zoom Feature:</p>
                                        <p className="text-[9px] text-green-600">When you drag this field, it will automatically zoom to <span className="font-bold">300%</span> and center in your viewport for pixel-perfect placement!</p>
                                    </div>
                                    {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType) && (
                                        <div className="bg-primary/5 border border-primary/20 rounded p-2">
                                            <p className="text-[9px] text-primary font-bold">✨ Auto Font Scaling:</p>
                                            <p className="text-[9px] text-primary/80">Width/height changes automatically adjust font size to fit. Current: <span className="font-bold">{selectedField.fontSize}px</span></p>
                                        </div>
                                    )}
                                    <p className="text-[9px] text-muted-foreground italic">💡 Tip: Enable Precision Mode (green magnifier in toolbar) for even more control</p>
                                </div>
                            )}
                            
                            <div className="space-y-1">
                                <label className="text-xs font-medium">Label</label>
                                <input
                                    type="text"
                                    value={selectedField.label}
                                    onChange={(e) => {
                                        updateField(selectedField.id, {
                                            label: e.target.value,
                                            slug: generateSlug(e.target.value)
                                        });
                                    }}
                                    className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium">Slug (ID)</label>
                                <input
                                    type="text"
                                    value={selectedField.slug}
                                    readOnly
                                    className="w-full h-8 rounded-md border bg-muted px-2 text-sm text-muted-foreground font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Width</label>
                                    <input
                                        type="number"
                                        value={Math.round(selectedField.width)}
                                        onChange={(e) => {
                                            const newWidth = Number(e.target.value);
                                            const updates: Partial<typeof selectedField> = { width: newWidth };
                                            
                                            // Auto-adjust font size for text fields when making them tiny
                                            if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                const currentHeight = selectedField.height;
                                                const minDimension = Math.min(newWidth, currentHeight);
                                                
                                                // If either dimension is tiny (< 30px), scale font proportionally
                                                if (minDimension < 30) {
                                                    const suggestedFontSize = Math.max(FONT_CONFIG.MIN_FONT_SIZE, Math.floor(minDimension * 0.65));
                                                    updates.fontSize = suggestedFontSize;
                                                }
                                            }
                                            
                                            updateField(selectedField.id, updates);
                                        }}
                                        className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Height</label>
                                    <input
                                        type="number"
                                        value={Math.round(selectedField.height)}
                                        onChange={(e) => {
                                            const newHeight = Number(e.target.value);
                                            const updates: Partial<typeof selectedField> = { height: newHeight };
                                            
                                            // Auto-adjust font size for text fields when making them tiny
                                            if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                const currentWidth = selectedField.width;
                                                const minDimension = Math.min(currentWidth, newHeight);
                                                
                                                // If either dimension is tiny (< 30px), scale font proportionally
                                                if (minDimension < 30) {
                                                    const suggestedFontSize = Math.max(FONT_CONFIG.MIN_FONT_SIZE, Math.floor(minDimension * 0.65));
                                                    updates.fontSize = suggestedFontSize;
                                                }
                                            }
                                            
                                            updateField(selectedField.id, updates);
                                        }}
                                        className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Icon Properties */}
                            {selectedField.inputType === 'ICON' && (
                                <>
                                    {/* Default Visibility Toggle */}
                                    <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {selectedField.defaultVisible !== false ? (
                                                    <Eye className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                                                )}
                                                <label className="text-xs font-medium">Default Visibility</label>
                                            </div>
                                            <button
                                                onClick={() => updateField(selectedField.id, { 
                                                    defaultVisible: selectedField.defaultVisible === false ? true : false 
                                                })}
                                                className={cn(
                                                    "relative w-12 h-6 rounded-full transition-colors duration-200",
                                                    selectedField.defaultVisible !== false 
                                                        ? "bg-green-500" 
                                                        : "bg-muted"
                                                )}
                                            >
                                                <span className={cn(
                                                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200",
                                                    selectedField.defaultVisible !== false 
                                                        ? "left-6" 
                                                        : "left-0.5"
                                                )} />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-primary/80">
                                            {selectedField.defaultVisible !== false 
                                                ? "✅ Icon will show by default in filled PDF" 
                                                : "⚪ Icon will be hidden by default (can be enabled via API)"}
                                        </p>
                                        <div className="mt-2 p-2 bg-card rounded border border-border">
                                            <p className="text-[9px] text-muted-foreground font-medium mb-1">💡 API Usage:</p>
                                            <code className="text-[9px] text-foreground bg-muted px-1 py-0.5 rounded block font-mono">
                                                {`{ "${selectedField.slug}": ${selectedField.defaultVisible !== false ? 'false' : 'true'} }`}
                                            </code>
                                            <p className="text-[9px] text-muted-foreground mt-1">
                                                Pass this in the fill API to {selectedField.defaultVisible !== false ? 'hide' : 'show'} this icon
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Icon Type</label>
                                        <select
                                            value={selectedField.iconVariant || 'CHECK'}
                                            onChange={(e) => updateField(selectedField.id, { iconVariant: e.target.value as IconVariant })}
                                            className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                        >
                                            {ICON_VARIANTS.map((variant) => (
                                                <option key={variant.value} value={variant.value}>
                                                    {variant.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Icon Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={selectedField.iconColor || '#000000'}
                                                onChange={(e) => updateField(selectedField.id, { iconColor: e.target.value })}
                                                className="w-12 h-8 rounded-md border cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedField.iconColor || '#000000'}
                                                onChange={(e) => updateField(selectedField.id, { iconColor: e.target.value })}
                                                className="flex-1 h-8 rounded-md border bg-transparent px-2 text-sm font-mono"
                                                placeholder="#000000"
                                            />
                                        </div>
                                        {/* Quick color buttons */}
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {ICON_COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => updateField(selectedField.id, { iconColor: color.value })}
                                                    className={cn(
                                                        "w-5 h-5 rounded-full border transition-all",
                                                        selectedField.iconColor === color.value && "ring-2 ring-primary ring-offset-1"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.label}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType) && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Font Size (min: {FONT_CONFIG.MIN_FONT_SIZE}px)</label>
                                        <input
                                            type="number"
                                            min={FONT_CONFIG.MIN_FONT_SIZE}
                                            step="0.5"
                                            value={selectedField.fontSize}
                                            onChange={(e) => updateField(selectedField.id, { 
                                                fontSize: Math.max(FONT_CONFIG.MIN_FONT_SIZE, Number(e.target.value)) 
                                            })}
                                            className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Font Family</label>
                                        <select
                                            value={selectedField.fontFamily || 'Arial'}
                                            onChange={(e) => updateField(selectedField.id, { fontFamily: e.target.value })}
                                            className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                        >
                                            <option value="Arial, sans-serif">Arial</option>
                                            <option value="'Times New Roman', serif">Times New Roman</option>
                                            <option value="'Courier New', monospace">Courier New</option>
                                            <option value="Georgia, serif">Georgia</option>
                                            <option value="Verdana, sans-serif">Verdana</option>
                                            <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                                            <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
                                            <option value="Impact, sans-serif">Impact</option>
                                            <option value="'Lucida Console', monospace">Lucida Console</option>
                                            <option value="Tahoma, sans-serif">Tahoma</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium">Font Weight</label>
                                            <select
                                                value={selectedField.fontWeight || 'normal'}
                                                onChange={(e) => updateField(selectedField.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                                                className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="bold">Bold</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium">Font Style</label>
                                            <select
                                                value={selectedField.fontStyle || 'normal'}
                                                onChange={(e) => updateField(selectedField.id, { fontStyle: e.target.value as 'normal' | 'italic' })}
                                                className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="italic">Italic</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Text Align</label>
                                        <select
                                            value={selectedField.textAlign || 'left'}
                                            onChange={(e) => updateField(selectedField.id, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                                            className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                        >
                                            <option value="left">Left</option>
                                            <option value="center">Center</option>
                                            <option value="right">Right</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Text Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={selectedField.textColor || '#000000'}
                                                onChange={(e) => updateField(selectedField.id, { textColor: e.target.value })}
                                                className="w-12 h-8 rounded-md border cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedField.textColor || '#000000'}
                                                onChange={(e) => updateField(selectedField.id, { textColor: e.target.value })}
                                                className="flex-1 h-8 rounded-md border bg-transparent px-2 text-sm font-mono"
                                                placeholder="#000000"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="border-t pt-4 text-center text-sm text-muted-foreground">
                        Select a field to edit properties
                    </div>
                )}
            </div>
        </div>
    );
}
