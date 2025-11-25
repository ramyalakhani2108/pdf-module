'use client';

import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { InputType } from '@/lib/types';
import {
    Type, Calendar, Hash, Mail, CheckSquare, Circle,
    PenTool, Image as ImageIcon, Save, Trash2, Settings, Check, X as XIcon
} from 'lucide-react';
import { cn, generateSlug } from '@/lib/utils';
import { useState } from 'react';

const fieldTypes: { type: InputType; label: string; icon: React.ElementType }[] = [
    { type: 'TEXT', label: 'Text Field', icon: Type },
    { type: 'DATE', label: 'Date Picker', icon: Calendar },
    { type: 'NUMBER', label: 'Number', icon: Hash },
    { type: 'EMAIL', label: 'Email', icon: Mail },
    { type: 'CHECKBOX', label: 'Checkbox', icon: CheckSquare },
    { type: 'RADIO', label: 'Radio Group', icon: Circle },
    { type: 'CHECK', label: 'Check Icon', icon: Check },
    { type: 'CROSS', label: 'Cross Icon', icon: XIcon },
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
        selectField
    } = useEditorStore();

    const [saving, setSaving] = useState(false);

    const selectedField = fields.find(f => f.id === selectedFieldId);

    const handleAddField = (type: InputType) => {
        const label = `New ${type.toLowerCase()}`;
        
        // Smart default sizes based on input type
        let width = 200;
        let height = 35;
        let fontSize = 14;
        
        if (type === 'CHECKBOX' || type === 'RADIO') {
            width = 25;
            height = 25;
        } else if (type === 'CHECK' || type === 'CROSS') {
            width = 30;
            height = 30;
        } else if (type === 'TEXT' || type === 'EMAIL') {
            width = 250;
            height = 35;
            fontSize = 14;
        } else if (type === 'NUMBER') {
            width = 120;
            height = 35;
            fontSize = 14;
        } else if (type === 'DATE') {
            width = 150;
            height = 35;
            fontSize = 14;
        } else if (type === 'SIGNATURE') {
            width = 300;
            height = 80;
        } else if (type === 'IMAGE') {
            width = 200;
            height = 150;
        }
        
        addField({
            pdfFileId: currentPdf!.id,
            slug: generateSlug(label) + '_' + Date.now(),
            label,
            inputType: type,
            pageNumber: currentPage,
            xCoord: 100,
            yCoord: 100,
            width,
            height,
            fontSize,
        });
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
        <div className="w-80 border-l bg-background flex flex-col h-full">
            <div className="p-4 border-b flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">PDF Editor Tools</h2>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
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
                {/* Field Types */}
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Add Fields</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {fieldTypes.map((item) => (
                            <button
                                key={item.type}
                                onClick={() => handleAddField(item.type)}
                                className="flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors gap-2"
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-xs font-medium">{item.label}</span>
                            </button>
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
                                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg p-3 space-y-2 shadow-md">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold text-yellow-700 uppercase">⚡ Tiny Field Detected ({selectedField.width}×{selectedField.height}px)</span>
                                    </div>
                                    <p className="text-[10px] text-yellow-700 font-semibold">Quick sizes for checkboxes:</p>
                                    <div className="grid grid-cols-3 gap-1">
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 8, height: 8 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 5; // 8 * 0.65 ≈ 5px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            8×8
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 10, height: 10 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 7; // 10 * 0.65 ≈ 6-7px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            10×10
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 12, height: 12 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 8; // 12 * 0.65 ≈ 7-8px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            12×12
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 15, height: 15 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 10; // 15 * 0.65 ≈ 9-10px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            15×15
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 18, height: 18 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 12; // 18 * 0.65 ≈ 11-12px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            18×18
                                        </button>
                                        <button
                                            onClick={() => {
                                                const updates: any = { width: 20, height: 20 };
                                                if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                    updates.fontSize = 13; // 20 * 0.65 ≈ 13px
                                                }
                                                updateField(selectedField.id, updates);
                                            }}
                                            className="text-[9px] font-bold bg-white border-2 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400 rounded px-1 py-1 transition-all"
                                        >
                                            20×20
                                        </button>
                                    </div>
                                    <div className="bg-green-100 border border-green-300 rounded p-2 space-y-1">
                                        <p className="text-[9px] text-green-700 font-bold">🎯 Auto-Zoom Feature:</p>
                                        <p className="text-[9px] text-green-700">When you drag this field, it will automatically zoom to <span className="font-bold">300%</span> and center in your viewport for pixel-perfect placement!</p>
                                    </div>
                                    {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType) && (
                                        <div className="bg-blue-50 border border-blue-300 rounded p-2">
                                            <p className="text-[9px] text-blue-700 font-bold">✨ Auto Font Scaling:</p>
                                            <p className="text-[9px] text-blue-700">Width/height changes automatically adjust font size to fit. Current: <span className="font-bold">{selectedField.fontSize}px</span></p>
                                        </div>
                                    )}
                                    <p className="text-[9px] text-yellow-600 italic">💡 Tip: Enable Precision Mode (green magnifier in toolbar) for even more control</p>
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
                                            const updates: any = { width: newWidth };
                                            
                                            // Auto-adjust font size for text fields when making them tiny
                                            if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                const currentHeight = selectedField.height;
                                                const minDimension = Math.min(newWidth, currentHeight);
                                                
                                                // If either dimension is tiny (< 30px), scale font proportionally
                                                if (minDimension < 30) {
                                                    // Calculate appropriate font size: down to 1px minimum
                                                    const suggestedFontSize = Math.max(1, Math.floor(minDimension * 0.65));
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
                                            const updates: any = { height: newHeight };
                                            
                                            // Auto-adjust font size for text fields when making them tiny
                                            if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType)) {
                                                const currentWidth = selectedField.width;
                                                const minDimension = Math.min(currentWidth, newHeight);
                                                
                                                // If either dimension is tiny (< 30px), scale font proportionally
                                                if (minDimension < 30) {
                                                    // Calculate appropriate font size: down to 1px minimum
                                                    const suggestedFontSize = Math.max(1, Math.floor(minDimension * 0.65));
                                                    updates.fontSize = suggestedFontSize;
                                                }
                                            }
                                            
                                            updateField(selectedField.id, updates);
                                        }}
                                        className="w-full h-8 rounded-md border bg-transparent px-2 text-sm"
                                    />
                                </div>
                            </div>

                            {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(selectedField.inputType) && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium">Font Size</label>
                                        <input
                                            type="number"
                                            value={selectedField.fontSize}
                                            onChange={(e) => updateField(selectedField.id, { fontSize: Number(e.target.value) })}
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
