'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, DragEndEvent, useDroppable, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { useEditorStore } from '@/lib/store';
import { DraggableField } from './DraggableField';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { 
    Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Grid3x3, Ruler, Keyboard, MousePointer, Crosshair, X, Eye,
    Type, Calendar, Hash, Mail, PenTool, Image as ImageIcon, Shapes, ChevronDown,
    Check, X as XIcon, Circle, CheckCircle, XCircle, Square, CheckSquare, Star, Heart,
    ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
    // New icons
    CircleDot, ThumbsUp, ThumbsDown, Flag, MapPin, Bookmark, Info, AlertTriangle, Minus, Plus,
    FormInput
} from 'lucide-react';
import { InputType, IconVariant } from '@/lib/types';
import { ICON_VARIANTS, ICON_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker with optimizations for large PDFs
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// PDF.js configuration for large PDFs (100MB+, 1000+ pages)
const PDF_OPTIONS = {
    cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    enableXfa: true,
    standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    // Disable text and annotation layers for better performance with large PDFs
    disableTextLayer: false,
    disableAnnotationLayer: true,
    // Enable streaming for faster initial load
    disableStream: false,
    disableAutoFetch: false,
};

// Professional grid system - 8px and 10px units
const GRID_OPTIONS = {
    SMALL: 8,    // 8px grid for precise placement
    MEDIUM: 10,  // 10px grid for standard elements
    OFF: 1       // 1px for pixel-perfect mode
};

const CURRENT_GRID = GRID_OPTIONS.SMALL; // Default to 8px grid

// Field types for the toolbar
const fieldTypes: { type: InputType; label: string; icon: React.ElementType }[] = [
    { type: 'TEXT', label: 'Text', icon: Type },
    { type: 'DATE', label: 'Date', icon: Calendar },
    { type: 'NUMBER', label: 'Number', icon: Hash },
    { type: 'EMAIL', label: 'Email', icon: Mail },
    { type: 'ICON', label: 'Icon', icon: Shapes },
    { type: 'SIGNATURE', label: 'Signature', icon: PenTool },
    { type: 'IMAGE', label: 'Image', icon: ImageIcon },
    { type: 'FILLABLE', label: 'Fillable', icon: FormInput },
];

// Icon component map for lucide icons
const iconComponentMap: Record<string, React.ElementType> = {
    'Check': Check,
    'X': XIcon,
    'Circle': Circle,
    'CircleDot': CircleDot,
    'CheckCircle': CheckCircle,
    'XCircle': XCircle,
    'Square': Square,
    'SquareIcon': Square, // Filled variant uses same icon with fill style
    'CheckSquare': CheckSquare,
    'Star': Star,
    'StarIcon': Star, // Filled variant
    'Heart': Heart,
    'HeartIcon': Heart, // Filled variant
    'ArrowRight': ArrowRight,
    'ArrowLeft': ArrowLeft,
    'ArrowUp': ArrowUp,
    'ArrowDown': ArrowDown,
    'ThumbsUp': ThumbsUp,
    'ThumbsDown': ThumbsDown,
    'Flag': Flag,
    'MapPin': MapPin,
    'Bookmark': Bookmark,
    'Info': Info,
    'AlertTriangle': AlertTriangle,
    'Minus': Minus,
    'Plus': Plus,
};

// Enhanced snap-to-grid modifier with professional grid spacing
const snapToGridModifier = ({ transform }: any) => {
    return {
        ...transform,
        x: Math.round(transform.x / CURRENT_GRID) * CURRENT_GRID,
        y: Math.round(transform.y / CURRENT_GRID) * CURRENT_GRID,
    };
};

export function PDFCanvas() {
    const {
        currentPdf,
        currentPage,
        setCurrentPage,
        fields,
        updateField,
        selectField,
        selectedFieldId,
        deleteField,
        duplicateField,
        activeTool,
        setActiveTool,
        clearActiveTool,
        addFieldAtPosition,
        showFieldBorders,
        toggleFieldBorders,
        highlightFieldType,
        toggleHighlightAll,
        setHighlightFieldType
    } = useEditorStore();

    const [zoom, setZoom] = useState(1);
    const [numPages, setNumPages] = useState<number>(0);
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [showGrid, setShowGrid] = useState(true); // Enable grid by default for precision
    const [showRulers, setShowRulers] = useState(true);
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
    const [precisionMode, setPrecisionMode] = useState(false);
    const [autoZoom, setAutoZoom] = useState<number | null>(null);
    const [stickyZoom, setStickyZoom] = useState(false);
    const [autoZoomEnabled, setAutoZoomEnabled] = useState(false); // Toggle for auto smart zoom
    const [magnifierPosition, setMagnifierPosition] = useState<{ x: number; y: number } | null>(null);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [iconDropdownOpen, setIconDropdownOpen] = useState(false);
    const [selectedIconColor, setSelectedIconColor] = useState('#000000');
    const containerRef = useRef<HTMLDivElement>(null);
    const pdfCanvasRef = useRef<HTMLDivElement>(null);
    const iconDropdownRef = useRef<HTMLDivElement>(null);

    // Close icon dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (iconDropdownRef.current && !iconDropdownRef.current.contains(event.target as Node)) {
                setIconDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Droppable area for the current page
    const { setNodeRef, isOver } = useDroppable({
        id: 'pdf-canvas',
    });

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const onPageLoadSuccess = (page: { originalWidth: number; originalHeight: number }) => {
        setPageDimensions({ width: page.originalWidth, height: page.originalHeight });
    };

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, delta } = event;

        if (!active.data.current) return;

        const fieldId = active.id as string;
        
        // Only reset zoom if not in sticky mode
        if (autoZoom && !stickyZoom) {
            setZoom(autoZoom);
            setAutoZoom(null);
        }
        
        const field = fields.find(f => f.id === fieldId);

        if (field) {
            // PRECISE DRAG POSITIONING - Fixed position mismatch issue
            // The key fix: directly apply the exact delta without additional transformations
            // that could cause the element to "jump" when dropped
            
            // Convert delta from screen pixels to PDF points (unscaled coordinates)
            const deltaXInPDF = delta.x / zoom;
            const deltaYInPDF = delta.y / zoom;
            
            // Calculate new position - apply delta directly to current position
            const newX = field.xCoord + deltaXInPDF;
            const newY = field.yCoord + deltaYInPDF;
            
            // Clamp to canvas bounds (ensure field stays within page)
            const clampedX = Math.max(0, newX);
            const clampedY = Math.max(0, newY);

            // Update with exact coordinates - no grid snapping during drop
            // This ensures the element stays EXACTLY where the user dropped it
            updateField(fieldId, {
                xCoord: clampedX,
                yCoord: clampedY,
            });
        }
        setCursorPosition(null);
    }, [fields, zoom, updateField, autoZoom, stickyZoom]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const fieldId = event.active.id as string;
        selectField(fieldId);
        
        // Smart zoom for tiny fields (under 25px) - zoom to 400% for ultra-precision
        // Only trigger if:
        // 1. autoZoomEnabled is true
        // 2. NOT already in sticky zoom mode (already zoomed in)
        // 3. NOT already at high zoom (>= 2x / 200%)
        const field = fields.find(f => f.id === fieldId);
        if (autoZoomEnabled && !stickyZoom && zoom < 2 && field && (field.width < 25 || field.height < 25)) {
            // Save current zoom for later restoration
            setAutoZoom(zoom);
            
            const targetZoom = 4;
            
            // Get current scroll position and container info BEFORE zoom change
            if (containerRef.current && pageDimensions) {
                const container = containerRef.current;
                const containerRect = container.getBoundingClientRect();
                
                // Center the field in the viewport for better UX
                const centerOffsetX = containerRect.width / 2 - (field.width * targetZoom) / 2;
                const centerOffsetY = containerRect.height / 2 - (field.height * targetZoom) / 2;
                
                // Calculate where the field will be after zoom change
                const fieldNewX = field.xCoord * targetZoom;
                const fieldNewY = field.yCoord * targetZoom;
                
                // Calculate scroll position to center the field in viewport
                const newScrollLeft = fieldNewX - centerOffsetX;
                const newScrollTop = fieldNewY - centerOffsetY;
                
                // SMOOTH ZOOM: Disable smooth scrolling temporarily for instant positioning
                container.style.scrollBehavior = 'auto';
                
                // Batch the state updates together
                setZoom(targetZoom);
                setStickyZoom(true);
                
                // Immediately set scroll position synchronously
                container.scrollLeft = newScrollLeft;
                container.scrollTop = newScrollTop;
                
                // Re-enable smooth scrolling after a brief delay
                setTimeout(() => {
                    container.style.scrollBehavior = '';
                }, 50);
            } else {
                setZoom(targetZoom);
                setStickyZoom(true);
            }
        }
    }, [selectField, fields, zoom, stickyZoom, pageDimensions, autoZoomEnabled]);

    // Smart zoom handler for tiny fields - triggered by magnifying glass button
    // This is manual, so it should work even at high zoom to recenter on the field
    const handleSmartZoom = useCallback((fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (!field) return;
        
        // Select the field first
        selectField(fieldId);
        
        // If already at 400% zoom, just recenter without changing zoom
        const targetZoom = 4;
        const isAlreadyAtTargetZoom = zoom >= 3.9; // Close to 400%
        
        // Save current zoom if not already in sticky mode and not at target zoom
        if (!stickyZoom && !isAlreadyAtTargetZoom) {
            setAutoZoom(zoom);
        }
        
        // Get current scroll position and container info
        if (containerRef.current && pageDimensions) {
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            
            // Use current zoom if already at high zoom, otherwise use target
            const effectiveZoom = isAlreadyAtTargetZoom ? zoom : targetZoom;
            
            // Center the field in the viewport for better UX
            const centerOffsetX = containerRect.width / 2 - (field.width * effectiveZoom) / 2;
            const centerOffsetY = containerRect.height / 2 - (field.height * effectiveZoom) / 2;
            
            // Calculate where the field will be
            const fieldNewX = field.xCoord * effectiveZoom;
            const fieldNewY = field.yCoord * effectiveZoom;
            
            // Calculate scroll position to center the field in viewport
            const newScrollLeft = fieldNewX - centerOffsetX;
            const newScrollTop = fieldNewY - centerOffsetY;
            
            // Smooth scroll to the field position
            container.scrollTo({
                left: newScrollLeft,
                top: newScrollTop,
                behavior: 'smooth'
            });
            
            // Only change zoom if not already at target
            if (!isAlreadyAtTargetZoom) {
                setZoom(targetZoom);
                setStickyZoom(true);
            }
        } else if (!isAlreadyAtTargetZoom) {
            setZoom(targetZoom);
            setStickyZoom(true);
        }
    }, [selectField, fields, zoom, stickyZoom, pageDimensions]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        if (event.delta) {
            const field = fields.find(f => f.id === event.active.id);
            if (field) {
                const x = (field.xCoord + event.delta.x / zoom) * zoom;
                const y = (field.yCoord + event.delta.y / zoom) * zoom;
                setCursorPosition({ x, y });
            }
        }
    }, [fields, zoom]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCursorPosition({ x, y });
        
        // Show magnifier in precision mode
        if (precisionMode) {
            setMagnifierPosition({ x, y });
        }
    }, [precisionMode]);

    const handleMouseLeave = useCallback(() => {
        setCursorPosition(null);
    }, []);

    // Handle click on PDF canvas to place field
    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeTool || !pdfCanvasRef.current || !pageDimensions) return;
        
        // Prevent click if dragging
        if (e.defaultPrevented) return;
        
        const canvasRect = pdfCanvasRef.current.getBoundingClientRect();
        const clickX = e.clientX - canvasRect.left;
        const clickY = e.clientY - canvasRect.top;
        
        // Convert from screen coordinates to PDF coordinates (unscaled)
        const pdfX = clickX / zoom;
        const pdfY = clickY / zoom;
        
        // Ensure click is within bounds
        if (pdfX >= 0 && pdfY >= 0 && 
            pdfX <= pageDimensions.width && pdfY <= pageDimensions.height) {
            addFieldAtPosition({ x: pdfX, y: pdfY });
        }
    }, [activeTool, zoom, pageDimensions, addFieldAtPosition]);

    // Keyboard shortcuts handler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't handle shortcuts if typing in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;

        // ESC to cancel active tool
        if (e.key === 'Escape') {
            e.preventDefault();
            if (activeTool) {
                clearActiveTool();
                return;
            }
            selectField(null);
            setShowShortcutsModal(false);
            return;
        }

        // Show shortcuts modal with ? key
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
            e.preventDefault();
            setShowShortcutsModal(true);
            return;
        }

        // Toggle grid with G key
        if (e.key === 'g' || e.key === 'G') {
            if (!cmdKey) {
                e.preventDefault();
                setShowGrid(prev => !prev);
                return;
            }
        }

        // Toggle rulers with R key
        if (e.key === 'r' || e.key === 'R') {
            if (!cmdKey) {
                e.preventDefault();
                setShowRulers(prev => !prev);
                return;
            }
        }

        // Toggle highlight all fields with Cmd/Ctrl + Shift + H
        if (cmdKey && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            toggleHighlightAll();
            return;
        }

        // Zoom controls - max 400% for precision editing
        if (cmdKey && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            setZoom(z => Math.min(4, z + 0.1));
            return;
        }
        if (cmdKey && e.key === '-') {
            e.preventDefault();
            setZoom(z => Math.max(0.3, z - 0.1));
            return;
        }
        if (cmdKey && e.key === '0') {
            e.preventDefault();
            setZoom(1);
            setStickyZoom(false);
            setAutoZoom(null);
            return;
        }

        // If no field is selected, don't process field-specific shortcuts
        if (!selectedFieldId) return;

        const selectedField = fields.find(f => f.id === selectedFieldId);
        if (!selectedField) return;

        // Delete selected field with Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteField(selectedFieldId);
            return;
        }

        // Duplicate selected field with Cmd/Ctrl + D
        if (cmdKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            duplicateField(selectedFieldId);
            return;
        }

        // Arrow keys for precise movement
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
            e.preventDefault();
            
            // Determine movement amount: 1px normal, 10px with Shift, 50px with Cmd/Ctrl
            let moveAmount = 1;
            if (cmdKey) {
                moveAmount = 50;
            } else if (e.shiftKey) {
                moveAmount = 10;
            }

            let newX = selectedField.xCoord;
            let newY = selectedField.yCoord;

            switch (e.key) {
                case 'ArrowUp':
                    newY = Math.max(0, selectedField.yCoord - moveAmount);
                    break;
                case 'ArrowDown':
                    newY = selectedField.yCoord + moveAmount;
                    break;
                case 'ArrowLeft':
                    newX = Math.max(0, selectedField.xCoord - moveAmount);
                    break;
                case 'ArrowRight':
                    newX = selectedField.xCoord + moveAmount;
                    break;
            }

            updateField(selectedFieldId, { xCoord: newX, yCoord: newY });
            return;
        }
    }, [selectedFieldId, fields, deleteField, duplicateField, updateField, selectField, activeTool, clearActiveTool, toggleHighlightAll]);

    // Mouse wheel zoom handler (Cmd/Ctrl + scroll)
    const handleMouseWheel = useCallback((e: WheelEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;

        // Only zoom if Cmd/Ctrl is pressed and we're in the PDF editor
        if (!cmdKey) return;

        // Check if the event target is within the PDF canvas container
        if (!containerRef.current?.contains(e.target as Node)) return;

        e.preventDefault();

        // Determine zoom direction: deltaY < 0 means scroll up (zoom in), > 0 means scroll down (zoom out)
        const zoomStep = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.max(0.3, Math.min(4, zoom + direction * zoomStep));

        setZoom(newZoom);
    }, [zoom]);

    // Add keyboard and mouse wheel event listeners
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        // Use capture phase for wheel event to ensure we catch it before other handlers
        containerRef.current?.addEventListener('wheel', handleMouseWheel, { passive: false });
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            containerRef.current?.removeEventListener('wheel', handleMouseWheel);
        };
    }, [handleKeyDown, handleMouseWheel]);

    if (!currentPdf) return null;

    // Filter fields for current page
    const pageFields = fields.filter(f => f.pageNumber === currentPage);

    return (
        <div className="flex flex-col h-full w-full bg-surface-secondary p-4 gap-4 overflow-hidden">
            {/* Active Tool Banner - Clean and minimal */}
            {activeTool && (
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crosshair className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            Click to place: {activeTool.type === 'ICON' ? `${activeTool.iconVariant} Icon` : `${activeTool.type} Field`}
                        </span>
                        <span className="text-xs opacity-70 ml-2">
                            (ESC to cancel)
                        </span>
                    </div>
                    <button
                        onClick={clearActiveTool}
                        className="p-1 hover:bg-foreground/10 rounded transition-colors"
                        title="Cancel (ESC)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Enhanced Toolbar - White theme */}
            <div className="flex items-center justify-between bg-card p-3 rounded-lg shadow-sm border border-border">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="text-foreground hover:bg-muted"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[100px] text-center text-foreground">
                        Page {currentPage} of {numPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                        disabled={currentPage >= numPages}
                        className="text-foreground hover:bg-muted"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoom(s => Math.max(0.5, s - 0.1))}
                        className="text-foreground hover:bg-muted"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium w-16 text-center text-foreground">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoom(s => Math.min(4, s + 0.1))}
                        className="text-foreground hover:bg-muted"
                        title="Zoom In (max 400%)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    
                    {/* Separator */}
                    <div className="w-px h-6 bg-border" />
                    
                    {/* Auto Zoom Toggle */}
                    <Button
                        variant={autoZoomEnabled ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setAutoZoomEnabled(!autoZoomEnabled)}
                        className={cn(
                            "text-xs gap-1",
                            autoZoomEnabled 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : "text-foreground hover:bg-muted"
                        )}
                        title={autoZoomEnabled ? "Auto-zoom ON: Tiny fields auto-zoom to 400%" : "Auto-zoom OFF: Manual zoom only"}
                    >
                        <Crosshair className="w-3 h-3" />
                        Auto
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* <Button
                        variant={showGrid ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setShowGrid(!showGrid)}
                        className={cn(
                            showGrid ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                        title="Toggle Grid (8px Professional Grid)"
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </Button> */}
                    <Button
                        variant={showRulers ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setShowRulers(!showRulers)}
                        className={cn(
                            showRulers ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                        title="Toggle Rulers"
                    >
                        <Ruler className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={highlightFieldType ? 'default' : 'ghost'}
                        size="icon"
                        onClick={toggleHighlightAll}
                        className={cn(
                            highlightFieldType === 'ALL' ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : 
                            highlightFieldType ? "bg-primary/80 text-primary-foreground" : 
                            "text-foreground hover:bg-muted"
                        )}
                        title="Highlight All Fields (⌘+Shift+H) - Shows each type in its color"
                    >
                        <Eye className="w-4 h-4" />
                    </Button>
                    {/* <Button
                        variant={precisionMode ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setPrecisionMode(!precisionMode)}
                        className={cn(
                            precisionMode ? "bg-green-600 text-white ring-2 ring-green-400" : "text-foreground hover:bg-muted"
                        )}
                        title="Precision Mode (Magnifier)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button> */}
                    
                    {/* Sticky Zoom Exit Button */}
                    {stickyZoom && (
                        <Button
                            variant="default"
                            size="icon"
                            onClick={() => {
                                setStickyZoom(false);
                                if (autoZoom) {
                                    setZoom(autoZoom);
                                    setAutoZoom(null);
                                } else {
                                    setZoom(1);
                                }
                            }}
                            className="bg-primary text-primary-foreground ring-2 ring-primary/50 hover:bg-primary/90 animate-pulse"
                            title="Exit Sticky Zoom (400%) - Click to return to normal view"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Separator */}
                    <div className="w-px h-6 bg-border mx-1" />

                    {/* Active Tool Cancel Button */}
                    {activeTool && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={clearActiveTool}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 text-xs"
                        >
                            <MousePointer className="w-3 h-3" />
                            Deselect Tool
                        </Button>
                    )}

                    {/* Keyboard Shortcuts Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowShortcutsModal(true)}
                        className="text-foreground hover:bg-muted"
                        title="Keyboard Shortcuts (?)"
                    >
                        <Keyboard className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Tools Toolbar - MS Word/Paint style */}
            <div className="bg-card border-b border-border px-3 py-2">
                <div className="flex items-center gap-1">
                    {/* Tool selection label */}
                    <span className="text-xs font-medium text-muted-foreground mr-2 select-none">Tools:</span>
                    
                    {/* Separator */}
                    <div className="w-px h-7 bg-border mr-1" />
                    
                    {/* Field type buttons */}
                    {fieldTypes.map((item) => (
                        item.type === 'ICON' ? (
                            <div key={item.type} className="relative" ref={iconDropdownRef}>
                                <button
                                    onClick={() => setIconDropdownOpen(!iconDropdownOpen)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm font-medium",
                                        iconDropdownOpen && "bg-muted border-primary/50 shadow-sm",
                                        activeTool?.type === 'ICON' 
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                            : "bg-card border-border hover:bg-muted hover:border-muted-foreground/30"
                                    )}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <span>{activeTool?.type === 'ICON' ? activeTool.iconVariant : item.label}</span>
                                    <ChevronDown className={cn(
                                        "w-3 h-3 transition-transform", 
                                        iconDropdownOpen && "rotate-180"
                                    )} />
                                </button>
                                
                                {/* Icons Dropdown */}
                                {iconDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 p-3 space-y-3 min-w-[300px]">
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
                                                            onClick={() => {
                                                                setActiveTool({
                                                                    type: 'ICON',
                                                                    iconVariant: variant.value as IconVariant,
                                                                    iconColor: selectedIconColor,
                                                                });
                                                                setIconDropdownOpen(false);
                                                            }}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-2 rounded-md border transition-colors gap-1",
                                                                activeTool?.type === 'ICON' && activeTool.iconVariant === variant.value
                                                                    ? "bg-primary/10 border-primary"
                                                                    : "border-border hover:bg-muted hover:border-primary/50"
                                                            )}
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
                                onClick={() => {
                                    if (activeTool?.type === item.type) {
                                        clearActiveTool();
                                    } else {
                                        setActiveTool({ type: item.type });
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm font-medium",
                                    activeTool?.type === item.type 
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                        : "bg-card border-border hover:bg-muted hover:border-muted-foreground/30"
                                )}
                                title={`Add ${item.label} field`}
                            >
                                <item.icon className="w-4 h-4" />
                                <span>{item.label}</span>
                            </button>
                        )
                    ))}
                    
                    {/* Separator */}
                    <div className="w-px h-7 bg-border mx-2" />
                    
                    {/* Deselect tool button - only visible when a tool is active */}
                    {activeTool && (
                        <button
                            onClick={clearActiveTool}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted hover:bg-muted/80 transition-all text-sm font-medium text-foreground"
                            title="Deselect tool (ESC)"
                        >
                            <MousePointer className="w-4 h-4" />
                            <span>Select</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas with Rulers */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Horizontal Ruler */}
                {showRulers && (
                    <div className="h-6 bg-muted border-b border-border flex items-end overflow-hidden">
                        <div className="w-6 h-6 bg-muted border-r border-border" /> {/* Corner */}
                        <div className="flex-1 relative h-full">
                            {pageDimensions && Array.from({ length: Math.ceil((pageDimensions.width * zoom) / 50) + 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute bottom-0 text-[9px] text-muted-foreground"
                                    style={{ left: `${i * 50}px` }}
                                >
                                    <div className="w-px h-2 bg-muted-foreground/50" />
                                    <span className="ml-1">{i * 50}</span>
                                </div>
                            ))}
                            {cursorPosition && (
                                <div
                                    className="absolute bottom-0 w-px h-full bg-primary"
                                    style={{ left: `${cursorPosition.x}px` }}
                                />
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Vertical Ruler */}
                    {showRulers && (
                        <div className="w-6 bg-muted border-r border-border overflow-hidden">
                            <div className="relative h-full">
                                {pageDimensions && Array.from({ length: Math.ceil((pageDimensions.height * zoom) / 50) + 1 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute left-0 text-[9px] text-muted-foreground flex items-center"
                                        style={{ top: `${i * 50}px` }}
                                    >
                                        <div className="h-px w-2 bg-muted-foreground/50" />
                                        <span className="ml-0.5 -rotate-90 origin-left whitespace-nowrap">{i * 50}</span>
                                    </div>
                                ))}
                                {cursorPosition && (
                                    <div
                                        className="absolute left-0 h-px w-full bg-primary"
                                        style={{ top: `${cursorPosition.y}px` }}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Canvas - Full scroll access at any zoom level */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-auto bg-surface-secondary min-w-0 min-h-0"
                        style={{ 
                            cursor: activeTool ? 'crosshair' : 'default',
                            // Enhanced scroll behavior for high zoom navigation
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent',
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        {/* Inner wrapper - centers PDF at low zoom, allows full scroll at high zoom */}
                        <div 
                            style={{
                                // Display as table to auto-size to content while allowing centering
                                display: 'table',
                                // Margin auto centers when content is smaller than container
                                margin: '0 auto',
                                // Minimum height to enable vertical centering at low zoom
                                minHeight: '100%',
                                // Padding around the PDF
                                padding: '32px',
                                // Box sizing
                                boxSizing: 'border-box',
                            }}
                        >
                        <DndContext
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            modifiers={[restrictToParentElement]}
                        >
                            <div
                                ref={(node) => {
                                    setNodeRef(node);
                                    (pdfCanvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                                }}
                                onClick={handleCanvasClick}
                                className={cn(
                                    "relative shadow-lg bg-white rounded-sm",
                                    isOver && "ring-4 ring-primary ring-offset-4 ring-offset-surface-secondary",
                                    activeTool && "ring-2 ring-primary/50 ring-offset-2 ring-offset-surface-secondary"
                                )}
                                style={{
                                    cursor: activeTool ? 'crosshair' : 'default',
                                    width: pageDimensions ? pageDimensions.width * zoom : 'auto',
                                    height: pageDimensions ? pageDimensions.height * zoom : 'auto',
                                    // Prevent shrinking
                                    flexShrink: 0,
                                    // Disable transition during sticky zoom for instant position-preserving zoom
                                    transition: stickyZoom ? 'none' : 'width 0.3s ease-out, height 0.3s ease-out',
                                    backgroundImage: showGrid ? `
                                        linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
                                        linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px)
                                    ` : 'none',
                                    backgroundSize: showGrid ? `${CURRENT_GRID * zoom}px ${CURRENT_GRID * zoom}px` : 'auto',
                                    backgroundPosition: showGrid ? '0 0' : 'auto',
                                }}
                            >
                        <Document
                            file={currentPdf.filePath}
                            onLoadSuccess={onDocumentLoadSuccess}
                            options={PDF_OPTIONS}
                            loading={
                                <div className="flex items-center justify-center h-[600px] bg-white">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            }
                            error={
                                <div className="flex items-center justify-center h-[600px] bg-white text-destructive">
                                    Failed to load PDF
                                </div>
                            }
                        >
                            <Page
                                pageNumber={currentPage}
                                scale={zoom}
                                className="bg-white"
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                onLoadSuccess={onPageLoadSuccess}
                            />
                        </Document>



                                {/* Overlay Layer */}
                                <div className="absolute inset-0 z-10">
                                    {pageDimensions && pageFields.map((field) => (
                                        <DraggableField
                                            key={field.id}
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            onSelect={selectField}
                                            onDelete={deleteField}
                                            scale={zoom}
                                            showBorder={showFieldBorders}
                                            highlightType={
                                                // When a tool is selected from sidebar, highlight only that type
                                                activeTool 
                                                    ? activeTool.type 
                                                    : highlightFieldType
                                            }
                                            onSmartZoom={handleSmartZoom}
                                        />
                                    ))}
                                </div>



                                {/* Coordinates Display */}
                                {cursorPosition && (
                                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-primary/20 pointer-events-none">
                                        X: {Math.round(cursorPosition.x / zoom)} Y: {Math.round(cursorPosition.y / zoom)} px
                                        {precisionMode && <span className="ml-2 text-green-200">🎯 PRECISION</span>}
                                        {stickyZoom && <span className="ml-2 text-primary-foreground/80">⚡ 400% ZOOM</span>}
                                    </div>
                                )}
                                
                                {/* Enhanced Magnifier for Precision Mode */}
                                {precisionMode && magnifierPosition && pageDimensions && (
                                    <div 
                                        className="absolute pointer-events-none z-50"
                                        style={{
                                            left: Math.min(magnifierPosition.x + 30, pageDimensions.width * zoom - 250),
                                            top: Math.max(magnifierPosition.y - 220, 10),
                                        }}
                                    >
                                        <div className="bg-white border-4 border-green-500 rounded-xl shadow-xl p-2">
                                            <div 
                                                className="bg-muted rounded-lg relative"
                                                style={{
                                                    width: '220px',
                                                    height: '220px',
                                                }}
                                            >
                                                {/* Zoom level indicator */}
                                                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                                                    <div className="text-xs font-bold text-green-600 bg-white px-3 py-1 rounded-full shadow-md border-2 border-green-500">
                                                        5× Magnifier
                                                    </div>
                                                </div>
                                                
                                                {/* Precise crosshair */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-full h-px bg-green-500" />
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-px h-full bg-green-500" />
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-3 h-3 border-2 border-green-500 rounded-full bg-white" />
                                                </div>
                                                
                                                {/* Grid overlay */}
                                                <div 
                                                    className="absolute inset-0"
                                                    style={{
                                                        backgroundImage: `
                                                            linear-gradient(hsl(var(--primary) / 0.2) 1px, transparent 1px),
                                                            linear-gradient(90deg, hsl(var(--primary) / 0.2) 1px, transparent 1px)
                                                        `,
                                                        backgroundSize: '10px 10px',
                                                    }}
                                                />
                                                
                                                {/* Coordinate display */}
                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                                                    <div className="text-xs font-mono text-foreground bg-white px-2 py-1 rounded shadow border border-border">
                                                        {Math.round(magnifierPosition.x / zoom)}, {Math.round(magnifierPosition.y / zoom)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </DndContext>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Exit Zoom Panel - Always visible when at high zoom */}
            {stickyZoom && zoom > 2 && (
                <div className="fixed bottom-6 right-6 z-100 animate-fade-in">
                    <div className="bg-card rounded-2xl shadow-xl p-4 border-2 border-primary">
                        <div className="flex items-center gap-4">
                            <div className="text-foreground">
                                <div className="text-lg font-bold flex items-center gap-2">
                                    <ZoomIn className="w-5 h-5 text-primary" />
                                    {Math.round(zoom * 100)}% Zoom
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">⌘+0</kbd> or click to exit
                                </p>
                            </div>
                            <Button
                                variant="default"
                                size="lg"
                                onClick={() => {
                                    setStickyZoom(false);
                                    if (autoZoom) {
                                        setZoom(autoZoom);
                                        setAutoZoom(null);
                                    } else {
                                        setZoom(1);
                                    }
                                }}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md"
                            >
                                <ZoomOut className="w-5 h-5 mr-2" />
                                Exit Zoom
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Highlight Legend */}
            {(highlightFieldType || activeTool) && (
                <div className="fixed bottom-6 left-6 z-100 animate-fade-in">
                    <div className="bg-card text-foreground rounded-xl shadow-xl p-4 border border-border">
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                                <Eye className="w-4 h-4 text-primary" />
                                <span className="text-sm font-bold">
                                    {activeTool 
                                        ? `Highlighting: ${activeTool.type} fields` 
                                        : 'Field Type Legend'}
                                </span>
                            </div>
                            {!activeTool && (
                                <button 
                                    onClick={toggleHighlightAll}
                                    className="px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80 transition-colors"
                                >
                                    Hide (⌘⇧H)
                                </button>
                            )}
                        </div>
                        
                        {/* Color Legend */}
                        <div className="grid grid-cols-4 gap-2 text-[10px]">
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'TEXT' || activeTool?.type === 'TEXT') 
                                    ? "bg-blue-100 ring-1 ring-blue-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
                                <span>TEXT</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'DATE' || activeTool?.type === 'DATE') 
                                    ? "bg-orange-100 ring-1 ring-orange-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-orange-500"></div>
                                <span>DATE</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'NUMBER' || activeTool?.type === 'NUMBER') 
                                    ? "bg-green-100 ring-1 ring-green-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-green-500"></div>
                                <span>NUMBER</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'EMAIL' || activeTool?.type === 'EMAIL') 
                                    ? "bg-cyan-100 ring-1 ring-cyan-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></div>
                                <span>EMAIL</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'ICON' || activeTool?.type === 'ICON') 
                                    ? "bg-purple-100 ring-1 ring-purple-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-purple-500"></div>
                                <span>ICON</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'SIGNATURE' || activeTool?.type === 'SIGNATURE') 
                                    ? "bg-pink-100 ring-1 ring-pink-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-pink-500"></div>
                                <span>SIGNATURE</span>
                            </div>
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded col-span-2",
                                (highlightFieldType === 'ALL' || highlightFieldType === 'IMAGE' || activeTool?.type === 'IMAGE') 
                                    ? "bg-amber-100 ring-1 ring-amber-400" : "bg-muted"
                            )}>
                                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div>
                                <span>IMAGE</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Modal */}
            <KeyboardShortcutsModal 
                isOpen={showShortcutsModal} 
                onClose={() => setShowShortcutsModal(false)} 
            />
        </div>
    );
}
