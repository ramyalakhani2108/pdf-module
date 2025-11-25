'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, DragEndEvent, useDroppable, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { useEditorStore } from '@/lib/store';
import { DraggableField } from './DraggableField';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Grid3x3, Ruler } from 'lucide-react';
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

const GRID_SIZE = 1; // Snap to 1px grid for pixel-perfect precision

// Custom snap-to-grid modifier
const snapToGridModifier = ({ transform }: any) => {
    return {
        ...transform,
        x: Math.round(transform.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(transform.y / GRID_SIZE) * GRID_SIZE,
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
        deleteField
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
    const [targetHelper, setTargetHelper] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [magnifierPosition, setMagnifierPosition] = useState<{ x: number; y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
        
        // Clear target helper
        setTargetHelper(null);
        
        // Only reset zoom if not in sticky mode
        if (autoZoom && !stickyZoom) {
            setZoom(autoZoom);
            setAutoZoom(null);
        }
        
        const field = fields.find(f => f.id === fieldId);

        if (field) {
            // PIXEL-PERFECT DRAG POSITIONING ALGORITHM
            // Apply mathematical precision for exact placement where user drops
            
            // Convert delta from screen pixels to PDF points with sub-pixel precision
            const precisionFactor = 1000000;
            
            // Calculate exact delta in PDF coordinates
            const deltaXInPDF = delta.x / zoom;
            const deltaYInPDF = delta.y / zoom;
            
            // Calculate new position with precision
            const rawX = field.xCoord + deltaXInPDF;
            const rawY = field.yCoord + deltaYInPDF;
            
            // Apply precision rounding to eliminate floating-point errors
            const preciseX = Math.round(rawX * precisionFactor) / precisionFactor;
            const preciseY = Math.round(rawY * precisionFactor) / precisionFactor;
            
            // Snap to 1px grid for pixel-perfect alignment
            const snappedX = Math.round(preciseX / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(preciseY / GRID_SIZE) * GRID_SIZE;

            // Update with exact coordinates - field appears EXACTLY where dropped
            updateField(fieldId, {
                xCoord: Math.max(0, snappedX),
                yCoord: Math.max(0, snappedY),
            });
        }
        setCursorPosition(null);
    }, [fields, zoom, updateField, autoZoom, stickyZoom]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const fieldId = event.active.id as string;
        selectField(fieldId);
        
        // Smart zoom for tiny fields (under 30px)
        const field = fields.find(f => f.id === fieldId);
        if (field && (field.width < 30 || field.height < 30)) {
            // Save current zoom if not already in sticky mode
            if (!stickyZoom) {
                setAutoZoom(zoom);
            }
            
            // Zoom to 300% for ultra-precision with tiny fields
            setZoom(3);
            setStickyZoom(true);
            
            // Show visual target helper
            setTargetHelper({
                x: field.xCoord,
                y: field.yCoord,
                width: field.width,
                height: field.height
            });
            
            // Auto-center the field in viewport after zoom
            setTimeout(() => {
                if (containerRef.current && pageDimensions) {
                    const container = containerRef.current;
                    const fieldCenterX = (field.xCoord + field.width / 2) * 3;
                    const fieldCenterY = (field.yCoord + field.height / 2) * 3;
                    
                    // Smooth scroll to center
                    container.scrollTo({
                        left: fieldCenterX - container.clientWidth / 2,
                        top: fieldCenterY - container.clientHeight / 2,
                        behavior: 'smooth'
                    });
                }
            }, 100);
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

    if (!currentPdf) return null;

    // Filter fields for current page
    const pageFields = fields.filter(f => f.pageNumber === currentPage);

    return (
        <div className="flex flex-col h-full w-full bg-slate-900 p-4 gap-4">
            {/* Tiny Field Helper Banner */}
            {stickyZoom && (
                <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-lg shadow-lg border-2 border-green-300 animate-pulse">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <ZoomIn className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">🎯 Tiny Field Mode (300% Zoom)</h3>
                                <p className="text-sm text-white/90">
                                    Field is auto-centered and zoomed for pixel-perfect placement. 
                                    <span className="font-semibold"> Drag to fine-tune position</span> with 1px precision.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setStickyZoom(false);
                                if (autoZoom) {
                                    setZoom(autoZoom);
                                    setAutoZoom(null);
                                } else {
                                    setZoom(1);
                                }
                                setTargetHelper(null);
                            }}
                            className="bg-white/20 hover:bg-white/30 text-white border-2 border-white/50"
                        >
                            Exit Zoom Mode
                        </Button>
                    </div>
                </div>
            )}

            {/* Enhanced Toolbar */}
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-700">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="text-white hover:bg-slate-700"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[100px] text-center text-white">
                        Page {currentPage} of {numPages}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                        disabled={currentPage >= numPages}
                        className="text-white hover:bg-slate-700"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoom(s => Math.max(0.5, s - 0.1))}
                        className="text-white hover:bg-slate-700"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium w-16 text-center text-white">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setZoom(s => Math.min(2, s + 0.1))}
                        className="text-white hover:bg-slate-700"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={showGrid ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setShowGrid(!showGrid)}
                        className={cn(
                            showGrid ? "bg-blue-600 text-white" : "text-white hover:bg-slate-700"
                        )}
                        title="Toggle Grid (Snap to 5px)"
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={showRulers ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setShowRulers(!showRulers)}
                        className={cn(
                            showRulers ? "bg-blue-600 text-white" : "text-white hover:bg-slate-700"
                        )}
                        title="Toggle Rulers"
                    >
                        <Ruler className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={precisionMode ? 'default' : 'ghost'}
                        size="icon"
                        onClick={() => setPrecisionMode(!precisionMode)}
                        className={cn(
                            precisionMode ? "bg-green-600 text-white ring-2 ring-green-400" : "text-white hover:bg-slate-700"
                        )}
                        title="Precision Mode (Magnifier)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    
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
                                setTargetHelper(null);
                            }}
                            className="bg-blue-600 text-white ring-2 ring-blue-400 hover:bg-blue-700 animate-pulse"
                            title="Exit Sticky Zoom (300%) - Click to return to normal view"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Canvas with Rulers */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Horizontal Ruler */}
                {showRulers && (
                    <div className="h-6 bg-slate-700 border-b border-slate-600 flex items-end overflow-hidden">
                        <div className="w-6 h-6 bg-slate-800 border-r border-slate-600" /> {/* Corner */}
                        <div className="flex-1 relative h-full">
                            {pageDimensions && Array.from({ length: Math.ceil((pageDimensions.width * zoom) / 50) + 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute bottom-0 text-[9px] text-slate-400"
                                    style={{ left: `${i * 50}px` }}
                                >
                                    <div className="w-px h-2 bg-slate-500" />
                                    <span className="ml-1">{i * 50}</span>
                                </div>
                            ))}
                            {cursorPosition && (
                                <div
                                    className="absolute bottom-0 w-px h-full bg-blue-400"
                                    style={{ left: `${cursorPosition.x}px` }}
                                />
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden">
                    {/* Vertical Ruler */}
                    {showRulers && (
                        <div className="w-6 bg-slate-700 border-r border-slate-600 overflow-hidden">
                            <div className="relative h-full">
                                {pageDimensions && Array.from({ length: Math.ceil((pageDimensions.height * zoom) / 50) + 1 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute left-0 text-[9px] text-slate-400 flex items-center"
                                        style={{ top: `${i * 50}px` }}
                                    >
                                        <div className="h-px w-2 bg-slate-500" />
                                        <span className="ml-0.5 -rotate-90 origin-left whitespace-nowrap">{i * 50}</span>
                                    </div>
                                ))}
                                {cursorPosition && (
                                    <div
                                        className="absolute left-0 h-px w-full bg-blue-400"
                                        style={{ top: `${cursorPosition.y}px` }}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Canvas */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-auto flex justify-center items-start p-8 bg-slate-900"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <DndContext
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            modifiers={[snapToGridModifier, restrictToParentElement]}
                        >
                            <div
                                ref={setNodeRef}
                                className={cn(
                                    "relative shadow-2xl transition-all bg-white",
                                    isOver && "ring-4 ring-blue-500 ring-offset-4 ring-offset-slate-900"
                                )}
                                style={{
                                    width: pageDimensions ? pageDimensions.width * zoom : 'auto',
                                    height: pageDimensions ? pageDimensions.height * zoom : 'auto',
                                    backgroundImage: showGrid ? `
                                        linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
                                    ` : 'none',
                                    backgroundSize: showGrid ? `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px` : 'auto',
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

                                {/* Target Helper - Shows precise placement zone for tiny fields */}
                                {targetHelper && (
                                    <div
                                        className="absolute pointer-events-none z-[9]"
                                        style={{
                                            left: targetHelper.x * zoom,
                                            top: targetHelper.y * zoom,
                                            width: Math.max(targetHelper.width * zoom, 60),
                                            height: Math.max(targetHelper.height * zoom, 60),
                                            transform: 'translate(-10px, -10px)',
                                        }}
                                    >
                                        {/* Pulsing border */}
                                        <div className="absolute inset-0 border-4 border-green-400 rounded-lg animate-pulse" />
                                        
                                        {/* Corner markers */}
                                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-green-500 rounded-full" />
                                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full" />
                                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-green-500 rounded-full" />
                                        <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-green-500 rounded-full" />
                                        
                                        {/* Center crosshair */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <div className="w-12 h-0.5 bg-green-500" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 bg-green-500" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full" />
                                        </div>
                                        
                                        {/* Size label */}
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                                            {targetHelper.width}×{targetHelper.height}px Target Zone
                                        </div>
                                    </div>
                                )}

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
                                        />
                                    ))}
                                </div>

                                {/* Coordinates Display */}
                                {cursorPosition && (
                                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border-2 border-white pointer-events-none">
                                        X: {Math.round(cursorPosition.x / zoom)} Y: {Math.round(cursorPosition.y / zoom)} px
                                        {precisionMode && <span className="ml-2 text-green-200">🎯 PRECISION</span>}
                                        {stickyZoom && <span className="ml-2 text-yellow-200">⚡ 300% ZOOM</span>}
                                    </div>
                                )}
                                
                                {/* Enhanced Magnifier for Precision Mode */}
                                {precisionMode && magnifierPosition && pageDimensions && (
                                    <div 
                                        className="absolute pointer-events-none z-[100]"
                                        style={{
                                            left: Math.min(magnifierPosition.x + 30, pageDimensions.width * zoom - 250),
                                            top: Math.max(magnifierPosition.y - 220, 10),
                                        }}
                                    >
                                        <div className="bg-white border-4 border-green-500 rounded-xl shadow-2xl p-2">
                                            <div 
                                                className="bg-gray-50 rounded-lg relative"
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
                                                            linear-gradient(rgba(59, 130, 246, 0.2) 1px, transparent 1px),
                                                            linear-gradient(90deg, rgba(59, 130, 246, 0.2) 1px, transparent 1px)
                                                        `,
                                                        backgroundSize: '10px 10px',
                                                    }}
                                                />
                                                
                                                {/* Coordinate display */}
                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                                                    <div className="text-xs font-mono text-gray-700 bg-white px-2 py-1 rounded shadow">
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
    );
}
