import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Type, Calendar, Hash, Mail, CheckSquare, Circle, PenTool, Image as ImageIcon, X, Move, Maximize2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PdfInput, InputType } from '@/lib/types';
import { useEditorStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';

interface DraggableFieldProps {
    field: PdfInput;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    scale: number;
}

const GRID_SIZE = 1; // Snap to 1px grid for pixel-perfect precision
const SNAP_THRESHOLD = 10; // Pixels to trigger snap

const typeIcons: Record<InputType, React.ElementType> = {
    TEXT: Type,
    DATE: Calendar,
    NUMBER: Hash,
    EMAIL: Mail,
    CHECKBOX: CheckSquare,
    RADIO: Circle,
    CHECK: Check,
    CROSS: X,
    SIGNATURE: PenTool,
    IMAGE: ImageIcon,
};

export function DraggableField({ field, isSelected, onSelect, onDelete, scale }: DraggableFieldProps) {
    const { updateField, fields } = useEditorStore();
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<'se' | 'ne' | 'sw' | 'nw' | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; xCoord: number; yCoord: number } | null>(null);
    const [showAlignmentGuides, setShowAlignmentGuides] = useState(false);
    const [alignmentGuides, setAlignmentGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: field.id,
        data: field,
        disabled: isResizing // Disable dragging while resizing
    });

    // Snap to grid helper
    const snapToGrid = useCallback((value: number) => {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }, []);

    // Find alignment guides
    const findAlignmentGuides = useCallback((x: number, y: number, w: number, h: number) => {
        const guides = { x: [] as number[], y: [] as number[] };
        const otherFields = fields.filter(f => f.id !== field.id && f.pageNumber === field.pageNumber);

        otherFields.forEach(other => {
            const otherScaled = {
                x: other.xCoord * scale,
                y: other.yCoord * scale,
                w: other.width * scale,
                h: other.height * scale,
            };

            // Vertical alignment checks
            if (Math.abs(x - otherScaled.x) < SNAP_THRESHOLD) guides.x.push(otherScaled.x);
            if (Math.abs(x + w - (otherScaled.x + otherScaled.w)) < SNAP_THRESHOLD) guides.x.push(otherScaled.x + otherScaled.w);
            if (Math.abs(x + w / 2 - (otherScaled.x + otherScaled.w / 2)) < SNAP_THRESHOLD) guides.x.push(otherScaled.x + otherScaled.w / 2);

            // Horizontal alignment checks
            if (Math.abs(y - otherScaled.y) < SNAP_THRESHOLD) guides.y.push(otherScaled.y);
            if (Math.abs(y + h - (otherScaled.y + otherScaled.h)) < SNAP_THRESHOLD) guides.y.push(otherScaled.y + otherScaled.h);
            if (Math.abs(y + h / 2 - (otherScaled.y + otherScaled.h / 2)) < SNAP_THRESHOLD) guides.y.push(otherScaled.y + otherScaled.h / 2);
        });

        return guides;
    }, [field.id, field.pageNumber, fields, scale]);

    // PIXEL-PERFECT POSITIONING WITH MATHEMATICAL PRECISION
    // Apply sub-pixel accuracy to eliminate any placement offset
    const precisionFactor = 1000000;
    const preciseLeft = Math.round((field.xCoord * scale) * precisionFactor) / precisionFactor;
    const preciseTop = Math.round((field.yCoord * scale) * precisionFactor) / precisionFactor;
    const preciseWidth = Math.round((field.width * scale) * precisionFactor) / precisionFactor;
    const preciseHeight = Math.round((field.height * scale) * precisionFactor) / precisionFactor;
    
    const style = {
        transform: CSS.Translate.toString(transform),
        left: `${preciseLeft}px`,
        top: `${preciseTop}px`,
        width: `${preciseWidth}px`,
        height: `${preciseHeight}px`,
        position: 'absolute' as const,
        zIndex: isSelected || isDragging || isResizing ? 50 : 10,
        // CRITICAL: Ensure no box model offsets
        margin: 0,
        padding: 0,
        boxSizing: 'border-box' as const,
        // Force pixel-perfect rendering
        transform: CSS.Translate.toString(transform),
        transformOrigin: '0 0',
        willChange: isDragging || isResizing ? 'transform' : 'auto',
    };

    const Icon = typeIcons[field.inputType];

    const handleResizePointerDown = useCallback((e: React.PointerEvent, direction: 'se' | 'ne' | 'sw' | 'nw') => {
        e.stopPropagation();
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        setIsResizing(true);
        setResizeDirection(direction);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: field.width,
            height: field.height,
            xCoord: field.xCoord,
            yCoord: field.yCoord
        });
        onSelect(field.id);
    }, [field.id, field.width, field.height, field.xCoord, field.yCoord, onSelect]);

    const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        if (!isResizing || !resizeStart || !resizeDirection) return;

        // Convert screen pixel delta to PDF points
        const deltaX = (e.clientX - resizeStart.x) / scale;
        const deltaY = (e.clientY - resizeStart.y) / scale;

        let updates: Partial<PdfInput> = {};

        switch (resizeDirection) {
            case 'se': // Southeast (bottom-right)
                // Only resize, no position change - allow any size down to 1x1
                const newWidthSE = Math.max(1, resizeStart.width + deltaX);
                const newHeightSE = Math.max(1, resizeStart.height + deltaY);
                updates = {
                    width: snapToGrid(newWidthSE),
                    height: snapToGrid(newHeightSE)
                };
                break;
            case 'ne': // Northeast (top-right)
                // Resize width right, height up (move Y) - allow any size
                const newWidthNE = Math.max(1, resizeStart.width + deltaX);
                const newHeightNE = Math.max(1, resizeStart.height - deltaY);
                const snappedHeightNE = snapToGrid(newHeightNE);
                updates = {
                    width: snapToGrid(newWidthNE),
                    height: snappedHeightNE,
                    yCoord: snapToGrid(resizeStart.yCoord + resizeStart.height - snappedHeightNE)
                };
                break;
            case 'sw': // Southwest (bottom-left)
                // Resize width left (move X), height down - allow any size
                const newWidthSW = Math.max(1, resizeStart.width - deltaX);
                const newHeightSW = Math.max(1, resizeStart.height + deltaY);
                const snappedWidthSW = snapToGrid(newWidthSW);
                updates = {
                    width: snappedWidthSW,
                    height: snapToGrid(newHeightSW),
                    xCoord: snapToGrid(resizeStart.xCoord + resizeStart.width - snappedWidthSW)
                };
                break;
            case 'nw': // Northwest (top-left)
                // Resize both dimensions from top-left (move both X and Y) - allow any size
                const newWidthNW = Math.max(1, resizeStart.width - deltaX);
                const newHeightNW = Math.max(1, resizeStart.height - deltaY);
                const snappedWidthNW = snapToGrid(newWidthNW);
                const snappedHeightNW = snapToGrid(newHeightNW);
                updates = {
                    width: snappedWidthNW,
                    height: snappedHeightNW,
                    xCoord: snapToGrid(resizeStart.xCoord + resizeStart.width - snappedWidthNW),
                    yCoord: snapToGrid(resizeStart.yCoord + resizeStart.height - snappedHeightNW)
                };
                break;
        }

        // Auto-adjust font size for text fields during resize
        if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(field.inputType) && updates.width && updates.height) {
            const minDimension = Math.min(updates.width, updates.height);
            
            // If field becomes tiny (< 30px), scale font proportionally (no minimum!)
            if (minDimension < 30) {
                // Allow any size down to 1px for ultra-tiny fields
                const suggestedFontSize = Math.max(1, Math.floor(minDimension * 0.65));
                updates.fontSize = suggestedFontSize;
            } else if (minDimension >= 30 && minDimension < 50) {
                // Transition zone: scale proportionally for medium-small fields
                const suggestedFontSize = Math.floor(minDimension * 0.5);
                updates.fontSize = Math.min(14, Math.max(10, suggestedFontSize));
            } else if (minDimension >= 50) {
                // Larger fields: scale up to reasonable size
                const suggestedFontSize = Math.floor(minDimension * 0.35);
                updates.fontSize = Math.min(24, Math.max(12, suggestedFontSize));
            }
        }

        updateField(field.id, updates);
    }, [isResizing, resizeStart, resizeDirection, scale, snapToGrid, field.id, field.inputType, updateField]);

    const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.releasePointerCapture(e.pointerId);
        setIsResizing(false);
        setResizeStart(null);
        setResizeDirection(null);
    }, []);

    // Update alignment guides during drag
    useEffect(() => {
        if (isDragging && transform) {
            const currentX = field.xCoord * scale + transform.x;
            const currentY = field.yCoord * scale + transform.y;
            const guides = findAlignmentGuides(currentX, currentY, field.width * scale, field.height * scale);
            setAlignmentGuides(guides);
            setShowAlignmentGuides(guides.x.length > 0 || guides.y.length > 0);
        } else {
            setShowAlignmentGuides(false);
        }
    }, [isDragging, transform, field, scale, findAlignmentGuides]);

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                className={cn(
                    "group absolute transition-all overflow-visible",
                    // Clean transparent design - minimal UI
                    // Highlight small fields with yellow tint for visibility
                    (field.width < 30 || field.height < 30) && isSelected
                        ? "bg-yellow-100/20"
                        : "bg-transparent",
                    field.inputType === 'TEXT' || field.inputType === 'EMAIL' || field.inputType === 'NUMBER' || field.inputType === 'DATE'
                        ? "border-b border-gray-300/40"
                        : field.inputType === 'CHECKBOX'
                        ? "border border-gray-300/40"
                        : field.inputType === 'RADIO'
                        ? "border border-gray-300/40 rounded-full"
                        : field.inputType === 'CHECK' || field.inputType === 'CROSS'
                        ? "border border-dashed border-gray-300/40"
                        : "border border-dashed border-gray-300/40",
                    isSelected 
                        ? (field.width < 30 || field.height < 30) 
                            ? "ring-2 ring-yellow-500/70" 
                            : "ring-1 ring-gray-400/50"
                        : "hover:ring-1 hover:ring-gray-400/30",
                    isDragging && "opacity-50 cursor-grabbing",
                    !isDragging && !isResizing && "cursor-move",
                    isResizing && "transition-none"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(field.id);
                }}
                {...attributes}
                {...listeners}
            >
                {/* Header/Handle Bar */}
                <div className={cn(
                    "absolute -top-7 left-0 right-0 h-6 bg-gray-800/90 rounded-t flex items-center justify-between px-2 transition-all z-50",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-90",
                    isDragging && "opacity-100"
                )}>
                    <div className="flex items-center gap-1">
                        <Move className="w-3 h-3 text-white/70" />
                        <span className="text-[10px] text-white/90 truncate">
                            {field.label}
                        </span>
                        {/* Small field indicator */}
                        {(field.width < 30 || field.height < 30) && (
                            <span className="text-[8px] bg-yellow-500 text-black px-1 rounded">
                                TINY
                            </span>
                        )}
                        {/* Font size indicator for text fields - show for all tiny fonts */}
                        {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(field.inputType) && field.fontSize && field.fontSize < 14 && (
                            <span className={cn(
                                "text-[8px] text-white px-1 rounded font-bold",
                                field.fontSize < 6 ? "bg-orange-500" : "bg-blue-500"
                            )}>
                                {field.fontSize}px
                            </span>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(field.id);
                        }}
                        className="text-white hover:text-red-400 transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Content Preview - Show how it will look in PDF */}
                <div className="w-full h-full flex items-start justify-start pointer-events-none" style={{ padding: 0, margin: 0 }}>
                    {(field.inputType === 'TEXT' || field.inputType === 'EMAIL' || field.inputType === 'NUMBER' || field.inputType === 'DATE') && (
                        <span
                            className="text-gray-400/60 truncate"
                            style={{
                                fontSize: `${field.fontSize * scale}px`,
                                fontFamily: field.fontFamily || 'Arial, sans-serif',
                                fontWeight: field.fontWeight || 'normal',
                                fontStyle: field.fontStyle || 'normal',
                                textAlign: field.textAlign || 'left',
                                width: '100%',
                                lineHeight: '1',
                                paddingLeft: '2px',
                                paddingTop: '0px',
                                display: 'block',
                            }}
                        >
                            {field.label}
                        </span>
                    )}
                    {(field.inputType === 'CHECKBOX' || field.inputType === 'RADIO') && (
                        <div className="w-full h-full flex items-center justify-center">
                            <Icon className="text-gray-400/50" style={{ width: '60%', height: '60%', strokeWidth: 2 }} />
                        </div>
                    )}
                    {(field.inputType === 'CHECK' || field.inputType === 'CROSS') && (
                        <div className="w-full h-full flex items-center justify-center">
                            <Icon 
                                className={cn(
                                    field.inputType === 'CHECK' ? "text-green-500/70" : "text-red-500/70"
                                )}
                                style={{
                                    width: '80%',
                                    height: '80%',
                                    strokeWidth: 2.5,
                                }}
                            />
                        </div>
                    )}
                    {(field.inputType === 'SIGNATURE' || field.inputType === 'IMAGE') && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <Icon className="w-5 h-5 text-black/40" />
                            <span className="text-[9px] text-black/40 uppercase tracking-wider">
                                {field.inputType}
                            </span>
                        </div>
                    )}
                </div>

                {/* Corner Resize Handles */}
                {isSelected && (
                    <>
                        {/* Resize handles - yellow for tiny fields */}
                        {/* Southeast (bottom-right) */}
                        <div
                            className={cn(
                                "absolute -bottom-1 -right-1 w-3 h-3 cursor-nwse-resize border border-white/50 rounded-full hover:scale-150 transition-all z-50",
                                (field.width < 30 || field.height < 30)
                                    ? "bg-yellow-500/80 hover:bg-yellow-600"
                                    : "bg-gray-500/60 hover:bg-gray-600/80"
                            )}
                            onPointerDown={(e) => handleResizePointerDown(e, 'se')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                        />
                        
                        {/* Northeast (top-right) */}
                        <div
                            className={cn(
                                "absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize border border-white/50 rounded-full hover:scale-150 transition-all z-50",
                                (field.width < 30 || field.height < 30)
                                    ? "bg-yellow-500/80 hover:bg-yellow-600"
                                    : "bg-gray-500/60 hover:bg-gray-600/80"
                            )}
                            onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                        />
                        
                        {/* Southwest (bottom-left) */}
                        <div
                            className={cn(
                                "absolute -bottom-1 -left-1 w-3 h-3 cursor-nesw-resize border border-white/50 rounded-full hover:scale-150 transition-all z-50",
                                (field.width < 30 || field.height < 30)
                                    ? "bg-yellow-500/80 hover:bg-yellow-600"
                                    : "bg-gray-500/60 hover:bg-gray-600/80"
                            )}
                            onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                        />
                        
                        {/* Northwest (top-left) */}
                        <div
                            className={cn(
                                "absolute -top-1 -left-1 w-3 h-3 cursor-nwse-resize border border-white/50 rounded-full hover:scale-150 transition-all z-50",
                                (field.width < 30 || field.height < 30)
                                    ? "bg-yellow-500/80 hover:bg-yellow-600"
                                    : "bg-gray-500/60 hover:bg-gray-600/80"
                            )}
                            onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                        />

                        {/* Size Display */}
                        <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-1">
                            <div className="bg-gray-800/80 text-white text-[9px] px-2 py-0.5 rounded">
                                {Math.round(field.width)}×{Math.round(field.height)}
                            </div>
                            {/* Font size indicator for text fields - pulses during resize */}
                            {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(field.inputType) && field.fontSize && (
                                <div className={cn(
                                    "bg-blue-500/90 text-white text-[9px] px-2 py-0.5 rounded font-bold",
                                    isResizing && "animate-pulse ring-2 ring-blue-400"
                                )}>
                                    {field.fontSize}px {isResizing && '⚡'}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Alignment Guides */}
            {showAlignmentGuides && (
                <>
                    {alignmentGuides.x.map((x, i) => (
                        <div
                            key={`x-${i}`}
                            className="alignment-guide-vertical"
                            style={{ left: `${x}px` }}
                        />
                    ))}
                    {alignmentGuides.y.map((y, i) => (
                        <div
                            key={`y-${i}`}
                            className="alignment-guide-horizontal"
                            style={{ top: `${y}px` }}
                        />
                    ))}
                </>
            )}
        </>
    );
}
