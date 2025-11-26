'use client';

import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { IconVariant } from '@/lib/types';
import {
    Save, Trash2, Settings, Check, X as XIcon, Circle, 
    CheckCircle, XCircle, Square, CheckSquare, Star, Heart,
    ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
    Eye, EyeOff, Layers, GripVertical
} from 'lucide-react';
import { cn, generateSlug } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { ICON_VARIANTS, ICON_COLORS, FONT_CONFIG } from '@/lib/constants';
import { ItemsPanel } from './ItemsPanel';

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

export function Sidebar() {
    const {
        currentPdf,
        selectedFieldId,
        fields,
        updateField,
        deleteField,
    } = useEditorStore();

    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'properties' | 'items'>('properties');
    const [sidebarWidth, setSidebarWidth] = useState(320); // 80 * 4 = 320px (w-80)
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const MIN_WIDTH = 320; // Current width
    const MAX_WIDTH = 640; // Double the current width

    // Handle resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            if (sidebarRef.current) {
                const container = sidebarRef.current.parentElement;
                if (!container) return;

                const containerRight = container.getBoundingClientRect().right;
                const mouseX = e.clientX;
                const newWidth = containerRight - mouseX;

                // Constrain width between min and max
                if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
                    setSidebarWidth(newWidth);
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isResizing]);

    const selectedField = fields.find(f => f.id === selectedFieldId);

    const handleSave = async () => {
        if (!currentPdf) return;

        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'api_key';
        setSaving(true);
        try {
            const response = await fetch('/api/inputs/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
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
        <>
            {/* Resize Handle - Left border */}
            <div
                onMouseDown={() => setIsResizing(true)}
                className={cn(
                    "w-1 bg-border hover:bg-primary transition-colors cursor-col-resize group",
                    isResizing && "bg-primary"
                )}
                title="Drag to resize sidebar"
            />
            
            {/* Sidebar */}
            <div
                ref={sidebarRef}
                style={{ width: `${sidebarWidth}px` }}
                className="border-l border-border bg-surface flex flex-col h-full transition-all"
            >
            {/* Header with Save */}
            <div className="p-3 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm text-foreground">Editor</h2>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-1.5 h-7 text-xs"
                >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('properties')}
                    className={cn(
                        "flex-1 px-4 py-2 text-xs font-medium transition-colors relative",
                        activeTab === 'properties' 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span className="flex items-center justify-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" />
                        Properties
                    </span>
                    {activeTab === 'properties' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('items')}
                    className={cn(
                        "flex-1 px-4 py-2 text-xs font-medium transition-colors relative",
                        activeTab === 'items' 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span className="flex items-center justify-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Items
                    </span>
                    {activeTab === 'items' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'items' ? (
                    <ItemsPanel onSwitchToProperties={() => setActiveTab('properties')} />
                ) : (
                    <>
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
                           {/*  {(selectedField.width < 50 || selectedField.height < 50) && (
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
                            )} */}
                            
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

                            {/* Image Properties */}
                            {selectedField.inputType === 'IMAGE' && (
                                <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                                    <h4 className="text-xs font-medium flex items-center gap-2">
                                        <span>🖼️</span>
                                        Image Fit Mode
                                    </h4>
                                    <div className="grid grid-cols-2 gap-1">
                                        {([
                                            { value: 'contain', label: 'Contain', desc: 'Fit inside, keep ratio' },
                                            { value: 'cover', label: 'Cover', desc: 'Fill area, crop edges' },
                                            { value: 'fill', label: 'Stretch', desc: 'Stretch to fill' },
                                            { value: 'none', label: 'Original', desc: 'No scaling' },
                                        ] as const).map((mode) => (
                                            <button
                                                key={mode.value}
                                                onClick={() => updateField(selectedField.id, { imageFit: mode.value })}
                                                className={cn(
                                                    "p-2 rounded border text-left transition-all",
                                                    (selectedField.imageFit || 'contain') === mode.value
                                                        ? "bg-amber-500/10 border-amber-500 text-amber-700"
                                                        : "bg-muted hover:bg-muted/80 border-border"
                                                )}
                                            >
                                                <span className="text-xs font-medium block">{mode.label}</span>
                                                <span className="text-[9px] text-muted-foreground">{mode.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-amber-600 mt-1">
                                        💡 "Contain" is recommended for best quality without distortion
                                    </p>
                                </div>
                            )}

                            {/* FILLABLE Field Properties */}
                            {selectedField.inputType === 'FILLABLE' && (
                                <div className="space-y-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                                    <h4 className="text-xs font-medium flex items-center gap-2">
                                        <span>📝</span>
                                        Native PDF Form Field
                                    </h4>
                                    <p className="text-[10px] text-emerald-700">
                                        This field will be fillable in PDF viewers like Adobe Reader, Chrome, etc.
                                    </p>
                                    
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Placeholder Text</label>
                                        <input
                                            type="text"
                                            value={selectedField.placeholder || ''}
                                            onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                                            placeholder="Enter placeholder text..."
                                            className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Font Size</label>
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

                                    <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mt-2">
                                        <p className="text-[9px] text-emerald-700 font-medium">📌 How it works:</p>
                                        <ul className="text-[9px] text-emerald-600 mt-1 space-y-0.5 list-disc list-inside">
                                            <li>Cannot be filled in preview mode</li>
                                            <li>After PDF download, open in any PDF viewer</li>
                                            <li>User can type directly into this field</li>
                                            <li>Perfect for end-user fillable forms</li>
                                        </ul>
                                    </div>
                                </div>
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

                            {/* Border & Radius Settings - Available for all field types */}
                            <div className="space-y-3 pt-3 border-t border-border">
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appearance</h4>
                                
                                {/* Border Radius */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Border Radius</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max={Math.round(Math.min(selectedField.width, selectedField.height) / 2)}
                                            value={selectedField.borderRadius || 0}
                                            onChange={(e) => updateField(selectedField.id, { borderRadius: Number(e.target.value) })}
                                            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={selectedField.borderRadius || 0}
                                            onChange={(e) => updateField(selectedField.id, { borderRadius: Number(e.target.value) })}
                                            className="w-14 h-8 rounded-md border bg-transparent px-2 text-sm text-center"
                                        />
                                        <span className="text-xs text-muted-foreground">px</span>
                                    </div>
                                    {/* Quick radius presets */}
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <button
                                            onClick={() => updateField(selectedField.id, { borderRadius: 0 })}
                                            className={cn(
                                                "px-2 py-1 text-[10px] rounded border transition-all",
                                                (selectedField.borderRadius || 0) === 0
                                                    ? "bg-primary text-white border-primary"
                                                    : "bg-muted hover:bg-muted/80 border-border"
                                            )}
                                        >
                                            Square
                                        </button>
                                        {[4, 8, 12].map((radius) => (
                                            <button
                                                key={radius}
                                                onClick={() => updateField(selectedField.id, { borderRadius: radius })}
                                                className={cn(
                                                    "px-2 py-1 text-[10px] rounded border transition-all",
                                                    (selectedField.borderRadius || 0) === radius
                                                        ? "bg-primary text-white border-primary"
                                                        : "bg-muted hover:bg-muted/80 border-border"
                                                )}
                                            >
                                                {radius}px
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const maxRadius = Math.round(Math.min(selectedField.width, selectedField.height) / 2);
                                                updateField(selectedField.id, { borderRadius: maxRadius });
                                            }}
                                            className={cn(
                                                "px-2 py-1 text-[10px] rounded border transition-all",
                                                (selectedField.borderRadius || 0) >= Math.round(Math.min(selectedField.width, selectedField.height) / 2) - 1
                                                    ? "bg-primary text-white border-primary"
                                                    : "bg-muted hover:bg-muted/80 border-border"
                                            )}
                                        >
                                            Circle
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground mt-1">
                                        Max: {Math.round(Math.min(selectedField.width, selectedField.height) / 2)}px (50% = circle)
                                    </p>
                                </div>

                                {/* Border Toggle */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium">Border</label>
                                        <button
                                            onClick={() => updateField(selectedField.id, { 
                                                borderEnabled: !selectedField.borderEnabled,
                                                // Set defaults when enabling
                                                ...((!selectedField.borderEnabled) && {
                                                    borderWidth: selectedField.borderWidth || 1,
                                                    borderStyle: selectedField.borderStyle || 'solid',
                                                    borderColor: selectedField.borderColor || '#000000'
                                                })
                                            })}
                                            className={cn(
                                                "relative w-10 h-5 rounded-full transition-colors duration-200",
                                                selectedField.borderEnabled
                                                    ? "bg-primary" 
                                                    : "bg-muted"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200",
                                                selectedField.borderEnabled
                                                    ? "left-5" 
                                                    : "left-0.5"
                                            )} />
                                        </button>
                                    </div>

                                    {/* Border Properties (shown when enabled) */}
                                    {selectedField.borderEnabled && (
                                        <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-1">
                                            {/* Border Width */}
                                            <div className="space-y-1">
                                                <label className="text-[11px] text-muted-foreground">Width</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="5"
                                                        value={selectedField.borderWidth || 1}
                                                        onChange={(e) => updateField(selectedField.id, { borderWidth: Number(e.target.value) })}
                                                        className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                                                    />
                                                    <span className="text-xs w-8 text-center">{selectedField.borderWidth || 1}px</span>
                                                </div>
                                            </div>

                                            {/* Border Style */}
                                            <div className="space-y-1">
                                                <label className="text-[11px] text-muted-foreground">Style</label>
                                                <div className="flex gap-1">
                                                    {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                                                        <button
                                                            key={style}
                                                            onClick={() => updateField(selectedField.id, { borderStyle: style })}
                                                            className={cn(
                                                                "flex-1 py-1.5 text-[10px] capitalize rounded border-2 transition-all",
                                                                (selectedField.borderStyle || 'solid') === style
                                                                    ? "bg-primary/10 border-primary text-primary"
                                                                    : "bg-muted hover:bg-muted/80 border-transparent"
                                                            )}
                                                            style={{
                                                                borderBottomStyle: style,
                                                                borderBottomWidth: '2px',
                                                                borderBottomColor: (selectedField.borderStyle || 'solid') === style ? 'currentColor' : '#888'
                                                            }}
                                                        >
                                                            {style}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Border Color */}
                                            <div className="space-y-1">
                                                <label className="text-[11px] text-muted-foreground">Color</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        value={selectedField.borderColor || '#000000'}
                                                        onChange={(e) => updateField(selectedField.id, { borderColor: e.target.value })}
                                                        className="w-8 h-7 rounded border cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={selectedField.borderColor || '#000000'}
                                                        onChange={(e) => updateField(selectedField.id, { borderColor: e.target.value })}
                                                        className="flex-1 h-7 rounded-md border bg-transparent px-2 text-xs font-mono"
                                                        placeholder="#000000"
                                                    />
                                                </div>
                                                {/* Quick color buttons */}
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {['#000000', '#374151', '#6B7280', '#DC2626', '#2563EB', '#16A34A', '#CA8A04', '#9333EA'].map((color) => (
                                                        <button
                                                            key={color}
                                                            onClick={() => updateField(selectedField.id, { borderColor: color })}
                                                            className={cn(
                                                                "w-5 h-5 rounded border-2 transition-all",
                                                                selectedField.borderColor === color && "ring-2 ring-primary ring-offset-1"
                                                            )}
                                                            style={{ backgroundColor: color, borderColor: color === '#000000' ? '#333' : color }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        <Settings className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p>Select a field to edit</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Click on any item in the canvas</p>
                    </div>
                )}
                    </>
                )}
            </div>
            </div>
        </>
    );
}