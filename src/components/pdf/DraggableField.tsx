import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Type, Calendar, Hash, Mail, PenTool, Image as ImageIcon, X, Maximize2, Check, Circle, CheckCircle, XCircle, Square, CheckSquare, Star, Heart, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Shapes, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PdfInput, InputType, IconVariant } from '@/lib/types';
import { useEditorStore } from '@/lib/store';
import { useState, useEffect, useCallback } from 'react';
import { FONT_CONFIG } from '@/lib/constants';

interface DraggableFieldProps {
    field: PdfInput;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onSmartZoom?: (fieldId: string) => void; // Trigger smart zoom for tiny fields
    scale: number;
    showBorder?: boolean; // Toggle for showing all field borders (Cmd+Shift+H)
    highlightType?: InputType | 'ALL' | null; // Which type to highlight with color
}

// Color mapping for each input type - vibrant colors for visibility
const INPUT_TYPE_COLORS: Record<InputType, { border: string; bg: string; ring: string }> = {
    TEXT: { border: 'border-blue-500', bg: 'bg-blue-500/20', ring: 'ring-blue-500' },
    DATE: { border: 'border-orange-500', bg: 'bg-orange-500/20', ring: 'ring-orange-500' },
    NUMBER: { border: 'border-green-500', bg: 'bg-green-500/20', ring: 'ring-green-500' },
    EMAIL: { border: 'border-cyan-500', bg: 'bg-cyan-500/20', ring: 'ring-cyan-500' },
    ICON: { border: 'border-purple-500', bg: 'bg-purple-500/20', ring: 'ring-purple-500' },
    SIGNATURE: { border: 'border-pink-500', bg: 'bg-pink-500/20', ring: 'ring-pink-500' },
    IMAGE: { border: 'border-amber-500', bg: 'bg-amber-500/20', ring: 'ring-amber-500' },
};

// Professional grid snapping - flexible options for different use cases
const GRID_OPTIONS = {
    SMALL: 8,  // 8px grid for standard control
    MEDIUM: 10, // 10px grid for standard placement
    FINE: 4,   // 4px grid for fine control
    PIXEL: 1   // 1px precision for pixel-perfect placement
};

const CURRENT_GRID = GRID_OPTIONS.PIXEL; // Use 1px grid for smooth resizing
const SNAP_THRESHOLD = 5; // Reduced threshold for more precise snapping
const MIN_FIELD_SIZE = 4; // Minimum field size in pixels (very small for icons)

const typeIcons: Record<InputType, React.ElementType> = {
    TEXT: Type,
    DATE: Calendar,
    NUMBER: Hash,
    EMAIL: Mail,
    ICON: Shapes,
    SIGNATURE: PenTool,
    IMAGE: ImageIcon,
};

// Icon variant to component mapping
const iconVariantComponents: Record<string, React.ElementType> = {
    'CHECK': Check,
    'CROSS': X,
    'CIRCLE': Circle,
    'CIRCLE_CHECK': CheckCircle,
    'CIRCLE_CROSS': XCircle,
    'SQUARE': Square,
    'SQUARE_CHECK': CheckSquare,
    'STAR': Star,
    'HEART': Heart,
    'ARROW_RIGHT': ArrowRight,
    'ARROW_LEFT': ArrowLeft,
    'ARROW_UP': ArrowUp,
    'ARROW_DOWN': ArrowDown,
};

export function DraggableField({ field, isSelected, onSelect, onDelete, onSmartZoom, scale, showBorder = true, highlightType = null }: DraggableFieldProps) {
    const { updateField, fields } = useEditorStore();
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<'se' | 'ne' | 'sw' | 'nw' | 'e' | 'w' | 'n' | 's' | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number; xCoord: number; yCoord: number } | null>(null);
    const [showAlignmentGuides, setShowAlignmentGuides] = useState(false);
    const [alignmentGuides, setAlignmentGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: field.id,
        data: field,
        disabled: isResizing // Disable dragging while resizing
    });

    // Professional grid snapping with 8px/10px units
    const snapToGrid = useCallback((value: number) => {
        return Math.round(value / CURRENT_GRID) * CURRENT_GRID;
    }, []);

    // Enhanced alignment guide detection
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

            // Vertical alignment checks with grid snapping
            if (Math.abs(x - otherScaled.x) < SNAP_THRESHOLD) guides.x.push(otherScaled.x);
            if (Math.abs(x + w - (otherScaled.x + otherScaled.w)) < SNAP_THRESHOLD) guides.x.push(otherScaled.x + otherScaled.w);
            if (Math.abs(x + w / 2 - (otherScaled.x + otherScaled.w / 2)) < SNAP_THRESHOLD) guides.x.push(otherScaled.x + otherScaled.w / 2);

            // Horizontal alignment checks with grid snapping
            if (Math.abs(y - otherScaled.y) < SNAP_THRESHOLD) guides.y.push(otherScaled.y);
            if (Math.abs(y + h - (otherScaled.y + otherScaled.h)) < SNAP_THRESHOLD) guides.y.push(otherScaled.y + otherScaled.h);
            if (Math.abs(y + h / 2 - (otherScaled.y + otherScaled.h / 2)) < SNAP_THRESHOLD) guides.y.push(otherScaled.y + otherScaled.h / 2);
        });

        return guides;
    }, [field.id, field.pageNumber, fields, scale]);

    // ZOOM-ACCURATE POSITIONING - Real pixel coordinates at all zoom levels
    // This ensures perfect positioning at 100%, 200%, and 300% zoom
    const realX = field.xCoord * scale;
    const realY = field.yCoord * scale;
    const realWidth = field.width * scale;
    const realHeight = field.height * scale;
    
    // Calculate final position including drag transform for smooth, accurate positioning
    // During drag, we combine base position with transform for smooth movement
    // This prevents the "jump" issue when dropping
    const transformX = transform?.x ?? 0;
    const transformY = transform?.y ?? 0;
    
    const style: React.CSSProperties = {
        // Use translate3d for GPU acceleration and smooth rendering
        transform: `translate3d(${transformX}px, ${transformY}px, 0)`,
        left: `${realX}px`,
        top: `${realY}px`,
        width: `${realWidth}px`,
        height: `${realHeight}px`,
        position: 'absolute',
        zIndex: isSelected || isDragging || isResizing ? 50 : 10,
        // Clean box model - zero padding/margin for pixel-perfect placement
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        // Optimized rendering for smooth drag/resize
        transformOrigin: '0 0',
        // GPU optimization - use will-change during active operations
        willChange: isDragging || isResizing ? 'transform, width, height' : 'auto',
        // Disable pointer events during drag to prevent interference
        pointerEvents: isDragging ? 'none' : 'auto',
        // Force GPU layer creation for smoother animations
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        // Prevent jittery rendering
        perspective: 1000,
        // Smooth touch handling
        touchAction: isDragging || isResizing ? 'none' : 'auto',
    };

    const Icon = typeIcons[field.inputType];

    const handleResizePointerDown = useCallback((e: React.PointerEvent, direction: 'se' | 'ne' | 'sw' | 'nw' | 'e' | 'w' | 'n' | 's') => {
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

        // Convert screen pixel delta to PDF points - smooth 1:1 pixel movement
        const deltaX = (e.clientX - resizeStart.x) / scale;
        const deltaY = (e.clientY - resizeStart.y) / scale;

        let updates: Partial<PdfInput> = {};

        switch (resizeDirection) {
            case 'se': // Southeast (bottom-right)
                const newWidthSE = Math.max(MIN_FIELD_SIZE, resizeStart.width + deltaX);
                const newHeightSE = Math.max(MIN_FIELD_SIZE, resizeStart.height + deltaY);
                updates = {
                    width: Math.round(newWidthSE * 10) / 10, // Round to 0.1px for smooth but controlled sizing
                    height: Math.round(newHeightSE * 10) / 10
                };
                break;
            case 'ne': // Northeast (top-right)
                const newWidthNE = Math.max(MIN_FIELD_SIZE, resizeStart.width + deltaX);
                const newHeightNE = Math.max(MIN_FIELD_SIZE, resizeStart.height - deltaY);
                const roundedHeightNE = Math.round(newHeightNE * 10) / 10;
                updates = {
                    width: Math.round(newWidthNE * 10) / 10,
                    height: roundedHeightNE,
                    yCoord: Math.round((resizeStart.yCoord + resizeStart.height - roundedHeightNE) * 10) / 10
                };
                break;
            case 'sw': // Southwest (bottom-left)
                const newWidthSW = Math.max(MIN_FIELD_SIZE, resizeStart.width - deltaX);
                const newHeightSW = Math.max(MIN_FIELD_SIZE, resizeStart.height + deltaY);
                const roundedWidthSW = Math.round(newWidthSW * 10) / 10;
                updates = {
                    width: roundedWidthSW,
                    height: Math.round(newHeightSW * 10) / 10,
                    xCoord: Math.round((resizeStart.xCoord + resizeStart.width - roundedWidthSW) * 10) / 10
                };
                break;
            case 'nw': // Northwest (top-left)
                const newWidthNW = Math.max(MIN_FIELD_SIZE, resizeStart.width - deltaX);
                const newHeightNW = Math.max(MIN_FIELD_SIZE, resizeStart.height - deltaY);
                const roundedWidthNW = Math.round(newWidthNW * 10) / 10;
                const roundedHeightNW = Math.round(newHeightNW * 10) / 10;
                updates = {
                    width: roundedWidthNW,
                    height: roundedHeightNW,
                    xCoord: Math.round((resizeStart.xCoord + resizeStart.width - roundedWidthNW) * 10) / 10,
                    yCoord: Math.round((resizeStart.yCoord + resizeStart.height - roundedHeightNW) * 10) / 10
                };
                break;
            // Edge resize handles - width only
            case 'e': // East (right edge) - width only
                const newWidthE = Math.max(MIN_FIELD_SIZE, resizeStart.width + deltaX);
                updates = { width: Math.round(newWidthE * 10) / 10 };
                break;
            case 'w': // West (left edge) - width only
                const newWidthW = Math.max(MIN_FIELD_SIZE, resizeStart.width - deltaX);
                const roundedWidthW = Math.round(newWidthW * 10) / 10;
                updates = {
                    width: roundedWidthW,
                    xCoord: Math.round((resizeStart.xCoord + resizeStart.width - roundedWidthW) * 10) / 10
                };
                break;
            // Edge resize handles - height only
            case 'n': // North (top edge) - height only
                const newHeightN = Math.max(MIN_FIELD_SIZE, resizeStart.height - deltaY);
                const roundedHeightN = Math.round(newHeightN * 10) / 10;
                updates = {
                    height: roundedHeightN,
                    yCoord: Math.round((resizeStart.yCoord + resizeStart.height - roundedHeightN) * 10) / 10
                };
                break;
            case 's': // South (bottom edge) - height only
                const newHeightS = Math.max(MIN_FIELD_SIZE, resizeStart.height + deltaY);
                updates = { height: Math.round(newHeightS * 10) / 10 };
                break;
        }

        // Smart font scaling for text fields - smoother scaling
        if (['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(field.inputType)) {
            // Get the current or updated dimensions
            const currentWidth = updates.width ?? field.width;
            const currentHeight = updates.height ?? field.height;
            const minDimension = Math.min(currentWidth, currentHeight);
            
            if (minDimension < 20) {
                // Very small fields - scale font proportionally with smoother curve
                const suggestedFontSize = Math.max(4, Math.round(minDimension * 0.6 * 10) / 10);
                updates.fontSize = suggestedFontSize;
            } else if (minDimension < 32) {
                // Small fields
                const suggestedFontSize = Math.max(6, Math.round(minDimension * 0.5 * 10) / 10);
                updates.fontSize = suggestedFontSize;
            } else if (minDimension >= 32 && minDimension < 64) {
                // Medium fields - balanced scaling
                const suggestedFontSize = Math.round(minDimension * 0.4 * 10) / 10;
                updates.fontSize = Math.min(16, Math.max(8, suggestedFontSize));
            } else {
                // Large fields - larger font size
                const suggestedFontSize = Math.round(minDimension * 0.3 * 10) / 10;
                updates.fontSize = Math.min(24, Math.max(10, suggestedFontSize));
            }
        }

        updateField(field.id, updates);
    }, [isResizing, resizeStart, resizeDirection, scale, field.id, field.inputType, updateField]);

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

    // Check if this field should be highlighted
    const isHighlighted = highlightType === 'ALL' || highlightType === field.inputType;
    const typeColors = INPUT_TYPE_COLORS[field.inputType];

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                className={cn(
                    "group absolute overflow-visible",
                    // Clean minimal design - no transitions during interaction for smooth feedback
                    "bg-transparent",
                    
                    // HIGHLIGHT MODE - Show vibrant colored borders when highlighted
                    isHighlighted && [
                        "border-2",
                        typeColors.border,
                        typeColors.bg,
                        "shadow-lg",
                        // Pulsing animation for visibility
                        "animate-pulse"
                    ],
                    
                    // Normal border mode (when not highlighted)
                    !isHighlighted && (showBorder || field.width < 15 || field.height < 15) && (
                        field.inputType === 'TEXT' || field.inputType === 'EMAIL' || field.inputType === 'NUMBER' || field.inputType === 'DATE'
                            ? "border border-primary/50"
                            : field.inputType === 'ICON'
                            ? "border-2 border-dashed border-primary/60"
                            : "border-2 border-dashed border-purple-400/60"
                    ),
                    
                    // When borders are hidden (except tiny fields), show very subtle border
                    !isHighlighted && !showBorder && field.width >= 15 && field.height >= 15 && "border border-transparent hover:border-gray-300/30",
                    
                    // Selection states - always visible regardless of showBorder
                    isSelected 
                        ? `ring-2 ${isHighlighted ? typeColors.ring : 'ring-primary/60'} shadow-md ${isHighlighted ? typeColors.bg : 'bg-primary/5'}`
                        : "hover:ring-1 hover:ring-primary/30",
                    
                    // Optimized drag/resize states - NO transitions for smooth interaction
                    isDragging && "opacity-70 cursor-grabbing shadow-lg ring-2 ring-primary/80",
                    !isDragging && !isResizing && "cursor-move transition-shadow duration-150 ease-out",
                    // No transitions during resize for immediate visual feedback
                    isResizing && "ring-2 ring-green-500/70 shadow-lg"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(field.id);
                }}
                {...attributes}
                {...listeners}
            >
                {/* Type indicator badge when highlighted */}
                {isHighlighted && !isDragging && (
                    <div className={cn(
                        "absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-md",
                        field.inputType === 'TEXT' && "bg-blue-500",
                        field.inputType === 'DATE' && "bg-orange-500",
                        field.inputType === 'NUMBER' && "bg-green-500",
                        field.inputType === 'EMAIL' && "bg-cyan-500",
                        field.inputType === 'ICON' && "bg-purple-500",
                        field.inputType === 'SIGNATURE' && "bg-pink-500",
                        field.inputType === 'IMAGE' && "bg-amber-500",
                    )}>
                        {field.inputType}
                    </div>
                )}
                
                {/* REMOVED: Grey header bar and floating toolbar for clean minimal UI */}
                
                {/* Smart Zoom button for very tiny fields (< 15px) - always visible when selected */}
                {isSelected && !isDragging && !isResizing && (field.width < 15 || field.height < 15) && onSmartZoom && scale < 3 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSmartZoom(field.id);
                        }}
                        className="absolute -top-6 -right-1 px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-medium rounded shadow-md flex items-center gap-1 transition-colors z-50 animate-pulse"
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Smart Zoom (400%) for precise editing"
                    >
                        <ZoomIn className="w-3 h-3" />
                        Zoom
                    </button>
                )}
                
                {/* Delete button - positioned above field to avoid overlapping with resize handles */}
                {isSelected && !isDragging && !isResizing && (
                    <>
                        {/* For tiny fields (< 20px), show delete button further above */}
                        {(field.width < 20 || field.height < 20) ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(field.id);
                                }}
                                className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium rounded shadow-md flex items-center gap-1 transition-colors z-[60]"
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Delete field (Del)"
                            >
                                <X className="w-3 h-3" />
                                Delete
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(field.id);
                                }}
                                className="absolute -top-3 -right-3 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md flex items-center justify-center transition-colors z-[60]"
                                onPointerDown={(e) => e.stopPropagation()}
                                title="Delete field (Del)"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </>
                )}

                {/* Content Preview - Optimized for all zoom levels */}
                <div className="w-full h-full flex items-center justify-start pointer-events-none" style={{ padding: 0, margin: 0 }}>
                    {(field.inputType === 'TEXT' || field.inputType === 'EMAIL' || field.inputType === 'NUMBER' || field.inputType === 'DATE') && (
                        <span
                            className="text-gray-500/70 truncate"
                            style={{
                                fontSize: `${Math.max(6, field.fontSize * scale)}px`, // Ensure readable font at all zoom levels
                                fontFamily: field.fontFamily || 'Arial, sans-serif',
                                fontWeight: field.fontWeight || 'normal',
                                fontStyle: field.fontStyle || 'normal',
                                textAlign: (field.textAlign as React.CSSProperties['textAlign']) || 'left',
                                width: '100%',
                                lineHeight: '1.1',
                                padding: '1px 2px',
                                margin: '0px',
                                display: 'block',
                                height: 'fit-content',
                                // Enhanced readability at high zoom
                                WebkitFontSmoothing: 'antialiased',
                                textRendering: 'optimizeLegibility',
                            }}
                        >
                            {field.label}
                        </span>
                    )}
                    {field.inputType === 'ICON' && (
                        <div className="w-full h-full flex items-center justify-center">
                            {(() => {
                                const IconComp = iconVariantComponents[field.iconVariant || 'CHECK'] || Check;
                                return (
                                    <IconComp 
                                        style={{
                                            width: '90%', // Slight inset for cleaner look
                                            height: '90%',
                                            strokeWidth: scale > 2 ? 2 : 2.5, // Adjust stroke for zoom
                                            stroke: field.iconColor || '#4F46E5',
                                            color: field.iconColor || '#4F46E5',
                                        }}
                                    />
                                );
                            })()}
                        </div>
                    )}
                    {(field.inputType === 'SIGNATURE' || field.inputType === 'IMAGE') && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground uppercase tracking-wide font-medium">
                                {field.inputType}
                            </span>
                        </div>
                    )}
                </div>

                {/* Professional Corner & Edge Resize Handles - compact design to not obstruct delete button */}
                {isSelected && (
                    <>
                        {/* Determine if field is tiny and needs slightly bigger handles */}
                        {(() => {
                            const isTiny = field.width < 25 || field.height < 25;
                            // Smaller handles: reduced from w-6/w-5 to w-4/w-3, positioned closer to corners
                            const primarySize = isTiny ? 'w-4 h-4 -bottom-1.5 -right-1.5' : 'w-3 h-3 -bottom-1 -right-1';
                            const secondarySize = isTiny ? 'w-3 h-3 -top-1 -right-1' : 'w-2.5 h-2.5 -top-0.5 -right-0.5';
                            const swSize = isTiny ? 'w-3 h-3 -bottom-1 -left-1' : 'w-2.5 h-2.5 -bottom-0.5 -left-0.5';
                            const nwSize = isTiny ? 'w-3 h-3 -top-1 -left-1' : 'w-2.5 h-2.5 -top-0.5 -left-0.5';
                            const innerDot = isTiny ? 'w-1.5 h-1.5' : 'w-1 h-1';
                            
                            // Smaller edge handles
                            const edgeHandleW = isTiny ? 'w-3 h-2' : 'w-2.5 h-1.5';
                            const edgeHandleH = isTiny ? 'w-2 h-3' : 'w-1.5 h-2.5';
                            
                            return (
                                <>
                                    {/* ===== CORNER HANDLES ===== */}
                                    
                                    {/* Southeast (bottom-right) - Primary handle */}
                                    <div
                                        className={`absolute ${primarySize} cursor-nwse-resize bg-primary border border-white rounded-full shadow-md hover:scale-110 hover:bg-primary/90 transition-transform z-40 flex items-center justify-center`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'se')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                    >
                                        <div className={`${innerDot} bg-white rounded-full`}></div>
                                    </div>
                                    
                                    {/* Northeast (top-right) - positioned to not block delete button */}
                                    <div
                                        className={`absolute ${secondarySize} cursor-nesw-resize bg-primary/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-primary transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                    />
                                    
                                    {/* Southwest (bottom-left) */}
                                    <div
                                        className={`absolute ${swSize} cursor-nesw-resize bg-primary/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-primary transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                    />
                                    
                                    {/* Northwest (top-left) */}
                                    <div
                                        className={`absolute ${nwSize} cursor-nwse-resize bg-primary/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-primary transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                    />
                                    
                                    {/* ===== EDGE HANDLES - Smaller and subtle ===== */}
                                    
                                    {/* East (right edge) - horizontal resize */}
                                    <div
                                        className={`absolute ${edgeHandleH} right-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize bg-emerald-500/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-emerald-600 transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'e')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                        title="Resize width"
                                    />
                                    
                                    {/* West (left edge) - horizontal resize */}
                                    <div
                                        className={`absolute ${edgeHandleH} left-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize bg-emerald-500/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-emerald-600 transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'w')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                        title="Resize width"
                                    />
                                    
                                    {/* North (top edge) - vertical resize */}
                                    <div
                                        className={`absolute ${edgeHandleW} top-[-4px] left-1/2 -translate-x-1/2 cursor-ns-resize bg-emerald-500/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-emerald-600 transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 'n')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                        title="Resize height"
                                    />
                                    
                                    {/* South (bottom edge) - vertical resize */}
                                    <div
                                        className={`absolute ${edgeHandleW} bottom-[-4px] left-1/2 -translate-x-1/2 cursor-ns-resize bg-emerald-500/80 border border-white rounded-full shadow-sm hover:scale-110 hover:bg-emerald-600 transition-transform z-40`}
                                        onPointerDown={(e) => handleResizePointerDown(e, 's')}
                                        onPointerMove={handleResizePointerMove}
                                        onPointerUp={handleResizePointerUp}
                                        title="Resize height"
                                    />
                                </>
                            );
                        })()}

                        {/* Smart font size indicator for text fields */}
                        {['TEXT', 'EMAIL', 'NUMBER', 'DATE'].includes(field.inputType) && field.fontSize && (
                            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                {field.fontSize}px
                                {isResizing && <span className="ml-1 animate-pulse">⚡</span>}
                            </div>
                        )}

                        {/* Zoom level indicator when at high zoom */}
                        {scale >= 2.5 && (
                            <div className="absolute -top-12 right-0 bg-purple-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                {Math.round(scale * 100)}% zoom
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Enhanced Alignment Guides */}
            {showAlignmentGuides && (
                <>
                    {alignmentGuides.x.map((x, i) => (
                        <div
                            key={`x-${i}`}
                            className="alignment-guide-vertical"
                            style={{ 
                                left: `${x}px`,
                                background: 'linear-gradient(180deg, transparent, #3B82F6, transparent)',
                                boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)'
                            }}
                        />
                    ))}
                    {alignmentGuides.y.map((y, i) => (
                        <div
                            key={`y-${i}`}
                            className="alignment-guide-horizontal"
                            style={{ 
                                top: `${y}px`,
                                background: 'linear-gradient(90deg, transparent, #3B82F6, transparent)',
                                boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)'
                            }}
                        />
                    ))}
                </>
            )}
        </>
    );
}
