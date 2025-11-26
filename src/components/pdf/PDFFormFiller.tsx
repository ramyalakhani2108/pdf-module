'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, Download, Upload, X, PenTool, ZoomIn, ZoomOut, Maximize2, Minimize2, ChevronLeft, ChevronRight, Grid3x3, Check, Bug, Circle, CheckCircle, XCircle, Square, CheckSquare, Star, Heart, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PdfFile, PdfInput, IconVariant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { alignmentDebugger, useAlignmentTracking } from '@/utils/alignment-debug';
import { 
    normalizeCoordinate, 
    storeDragCoordinate, 
    calculatePreciseFieldPosition,
    logFieldPosition 
} from '@/utils/precision-coordinates';
import { SignaturePad } from './SignaturePad';

// Configure PDF worker with optimizations for large PDFs
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// PDF.js configuration for large PDFs (100MB+, 1000+ pages)
const PDF_OPTIONS = {
    cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    enableXfa: true,
    standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    // Optimize for form filling with large PDFs
    disableTextLayer: false,
    disableAnnotationLayer: true,
    // Enable streaming for faster initial load
    disableStream: false,
    disableAutoFetch: false,
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

interface PDFFormFillerProps {
    pdf: PdfFile;
    fields: PdfInput[];
    isImported?: boolean;
}

type ViewMode = 'fit-width' | 'fit-page' | 'actual-size' | 'custom';

export function PDFFormFiller({ pdf, fields, isImported = false }: PDFFormFillerProps) {
    const [values, setValues] = useState<Record<string, any>>({});
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('fit-width');
    const [customZoom, setCustomZoom] = useState(1);
    const [showGrid, setShowGrid] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [adjustmentMode, setAdjustmentMode] = useState(false);
    const [adjustedPositions, setAdjustedPositions] = useState<Record<string, { x: number; y: number }>>({});
    const [draggingField, setDraggingField] = useState<string | null>(null);
    const [debugMode, setDebugMode] = useState(false);
    const [smartZoomActive, setSmartZoomActive] = useState(false);
    const [previousZoomState, setPreviousZoomState] = useState<{ mode: ViewMode; zoom: number } | null>(null);
    // Signature pad state
    const [signaturePadOpen, setSignaturePadOpen] = useState(false);
    const [activeSignatureField, setActiveSignatureField] = useState<{ slug: string; label: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    
    // Initialize alignment tracking
    const { recordPosition, validateElement, generateReport, debugField, clearDebug, reset } = useAlignmentTracking();

    useEffect(() => {
        if (viewportRef.current) {
            setContainerWidth(viewportRef.current.clientWidth);
        }

        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });

        if (viewportRef.current) {
            observer.observe(viewportRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '=':
                    case '+':
                        e.preventDefault();
                        handleZoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        handleZoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        setViewMode('fit-width');
                        break;
                }
            } else {
                switch (e.key) {
                    case 'ArrowRight':
                    case 'PageDown':
                        e.preventDefault();
                        handleNextPage();
                        break;
                    case 'ArrowLeft':
                    case 'PageUp':
                        e.preventDefault();
                        handlePrevPage();
                        break;
                    case 'Home':
                        e.preventDefault();
                        setCurrentPage(1);
                        break;
                    case 'End':
                        e.preventDefault();
                        setCurrentPage(pdf.pageCount);
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentPage, pdf.pageCount, viewMode, customZoom]);

    const onPageLoadSuccess = useCallback((page: { originalWidth: number; originalHeight: number }, pageNumber: number) => {
        setPageDimensions(prev => ({
            ...prev,
            [pageNumber]: { width: page.originalWidth, height: page.originalHeight }
        }));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage(prev => Math.min(prev + 1, pdf.pageCount));
    }, [pdf.pageCount]);

    const handlePrevPage = useCallback(() => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    }, []);

    const handleZoomIn = useCallback(() => {
        if (viewMode === 'custom') {
            setCustomZoom(prev => Math.min(prev + 0.1, 3));
        } else {
            setViewMode('custom');
            setCustomZoom(1.1);
        }
    }, [viewMode]);

    const handleZoomOut = useCallback(() => {
        if (viewMode === 'custom') {
            setCustomZoom(prev => Math.max(prev - 0.1, 0.3));
        } else {
            setViewMode('custom');
            setCustomZoom(0.9);
        }
    }, [viewMode]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    const getPageScale = useCallback((pageNumber: number) => {
        const dimensions = pageDimensions[pageNumber];
        if (!dimensions || !containerWidth) return 1;

        const viewportHeight = viewportRef.current?.clientHeight || 800;

        switch (viewMode) {
            case 'fit-width':
                return (containerWidth - 80) / dimensions.width;
            case 'fit-page':
                const widthScale = (containerWidth - 80) / dimensions.width;
                const heightScale = (viewportHeight - 80) / dimensions.height;
                return Math.min(widthScale, heightScale);
            case 'actual-size':
                return 1;
            case 'custom':
                return customZoom;
            default:
                return 1;
        }
    }, [pageDimensions, containerWidth, viewMode, customZoom]);

    const handleInputChange = (slug: string, value: any) => {
        setValues(prev => ({ ...prev, [slug]: value }));
    };

    const handleFileUpload = async (slug: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'api_key';
        try {
            const response = await fetch('/api/signature/upload', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                },
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                handleInputChange(slug, data.data.base64);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    const handleSubmit = async () => {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'api_key';
        setSubmitting(true);
        try {
            const response = await fetch('/api/pdf/fill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify({
                    pdfFileId: pdf.id,
                    values,
                    adjustedPositions, // Include adjusted positions
                }),
            });

            const data = await response.json();

            if (data.success && data.pdfUrl) {
                // Download the filled PDF from the server URL
                const link = document.createElement('a');
                link.href = data.pdfUrl;
                link.download = `filled_${pdf.fileName}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Submission failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    // Group fields by page
    const fieldsByPage = fields.reduce((acc, field) => {
        if (!acc[field.pageNumber]) acc[field.pageNumber] = [];
        acc[field.pageNumber].push(field);
        return acc;
    }, {} as Record<number, PdfInput[]>);

    const scale = getPageScale(currentPage);
    const pageFields = fieldsByPage[currentPage] || [];

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-background">
            {/* Adjustment Mode Banner */}
            {adjustmentMode && (
                <div className="bg-linear-to-r from-orange-500 to-yellow-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <Maximize2 className="w-5 h-5" />
                        <div>
                            <p className="font-bold text-sm">🎯 Placement Adjustment Mode Active</p>
                            <p className="text-xs text-white/90">Click and drag any field to adjust its position. Changes will be applied when you download.</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setAdjustmentMode(false);
                            setAdjustedPositions({});
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white"
                    >
                        Reset & Exit
                    </Button>
                </div>
            )}
            
            {/* Compact Toolbar - Hidden when imported */}
            {!isImported && (
                <div className="flex items-center justify-between bg-background px-4 py-2 border-b">
                    <div className="flex items-center gap-2">
                        {/* Page Navigation */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevPage}
                            disabled={currentPage <= 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[100px] text-center">
                            Page {currentPage} of {pdf.pageCount}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextPage}
                            disabled={currentPage >= pdf.pageCount}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        
                        <div className="h-6 w-px bg-border mx-2" />

                        {/* Zoom Controls */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomOut}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-sm min-w-[60px] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleZoomIn}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant={debugMode ? 'default' : 'outline'}
                            onClick={() => {
                                setDebugMode(!debugMode);
                                if (!debugMode) {
                                    reset();
                                    console.log('🎯 Alignment debugging enabled. Report available in console.');
                                } else {
                                    clearDebug();
                                    console.log('📊 Final alignment report:', generateReport());
                                }
                            }}
                            className={cn(
                                "gap-2 text-xs",
                                debugMode && "bg-red-500 hover:bg-red-600 ring-2 ring-red-300"
                            )}
                        >
                            <Bug className="w-4 h-4" />
                            {debugMode ? 'Debug ON' : 'Debug Mode'}
                        </Button>
                        <Button
                            variant={adjustmentMode ? 'default' : 'outline'}
                            onClick={() => setAdjustmentMode(!adjustmentMode)}
                            className={cn(
                                "gap-2",
                                adjustmentMode && "bg-orange-500 hover:bg-orange-600 ring-2 ring-orange-300"
                            )}
                        >
                            <Maximize2 className="w-4 h-4" />
                            {adjustmentMode ? 'Exit Adjust' : 'Adjust Placement'}
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            {submitting ? 'Generating...' : 'Download PDF'}
                        </Button>
                    </div>
                </div>
            )}

            {/* PDF Viewport */}
            <div
                ref={viewportRef}
                className="flex-1 overflow-auto bg-background flex justify-center items-start p-4"
            >
                <div className="relative">{Array.from({ length: 1 }, (_, i) => currentPage).map((pageNum) => {
                const dimensions = pageDimensions[pageNum];
                const pageScale = getPageScale(pageNum);

                return (
                    <div key={pageNum} className="relative shadow-2xl bg-white">
                        <div className={cn(
                            "relative",
                            showGrid && "bg-grid-pattern"
                        )}>
                            <Document
                                file={pdf.filePath}
                                options={PDF_OPTIONS}
                                loading={
                                    <div className="flex items-center justify-center h-[600px] bg-white">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                }
                            >
                                <Page
                                    pageNumber={pageNum}
                                    scale={pageScale}
                                    className="bg-white"
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    onLoadSuccess={(page) => onPageLoadSuccess(page, pageNum)}
                                />
                            </Document>

                            {/* Input Overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="relative w-full h-full pointer-events-auto">
                                {pageFields.map((field) => {
                                    const adjustedPos = adjustedPositions[field.id];
                                    const finalX = adjustedPos ? adjustedPos.x : field.xCoord;
                                    const finalY = adjustedPos ? adjustedPos.y : field.yCoord;
                                    
                                    // SIMPLE RELIABLE POSITIONING
                                    // Multiply coordinates by scale for proper visual display
                                    // This ensures fields appear at the correct position at any zoom level
                                    const scaledX = finalX * pageScale;
                                    const scaledY = finalY * pageScale;
                                    const scaledWidth = field.width * pageScale;
                                    const scaledHeight = field.height * pageScale;
                                    
                                    const ultraConsistentStyles: React.CSSProperties = {
                                        position: 'absolute',
                                        left: `${scaledX}px`,
                                        top: `${scaledY}px`,
                                        width: `${scaledWidth}px`,
                                        height: `${scaledHeight}px`,
                                        margin: '0px',
                                        padding: '0px',
                                        border: '0px solid transparent',
                                        outline: '0px solid transparent',
                                        boxSizing: 'border-box',
                                        willChange: 'auto',
                                        WebkitFontSmoothing: 'antialiased',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        justifyContent: 'flex-start',
                                        verticalAlign: 'baseline',
                                        lineHeight: '1',
                                        minWidth: '0px',
                                        minHeight: '0px',
                                        maxWidth: 'none',
                                        maxHeight: 'none',
                                        fontSize: 'inherit',
                                        fontFamily: 'inherit',
                                        fontWeight: 'inherit',
                                        fontStyle: 'inherit',
                                    };
                                    
                                    // Debug position tracking (moved outside useEffect to avoid hook rules violation)
                                    // Position tracking is now done via data attributes for debugging
                                    const debugDataAttrs = debugMode ? {
                                        'data-debug-x': scaledX,
                                        'data-debug-y': scaledY,
                                        'data-debug-width': scaledWidth,
                                        'data-debug-height': scaledHeight,
                                        'data-debug-mode': 'preview',
                                    } : {};

                                    const handleMouseDown = (e: React.MouseEvent) => {
                                        if (!adjustmentMode) return;
                                        e.preventDefault();
                                        setDraggingField(field.id);
                                        
                                        // Smart zoom: Auto-zoom to 300% for tiny fields to prevent placement misalignment
                                        if ((field.width < 50 || field.height < 50) && !smartZoomActive) {
                                            setPreviousZoomState({ mode: viewMode, zoom: customZoom });
                                            setSmartZoomActive(true);
                                            setViewMode('custom');
                                            setCustomZoom(3); // 300% zoom
                                        }
                                        
                                        const containerElement = e.currentTarget.parentElement?.parentElement;
                                        if (!containerElement) return;
                                        
                                        const containerRect = containerElement.getBoundingClientRect();
                                        const startCoord = storeDragCoordinate(e.clientX, e.clientY, containerRect, pageScale);
                                        const startFieldX = finalX;
                                        const startFieldY = finalY;

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            const moveCoord = storeDragCoordinate(moveEvent.clientX, moveEvent.clientY, containerRect, pageScale);
                                            
                                            const deltaX = normalizeCoordinate(moveCoord.x - startCoord.x);
                                            const deltaY = normalizeCoordinate(moveCoord.y - startCoord.y);
                                            
                                            setAdjustedPositions(prev => ({
                                                ...prev,
                                                [field.id]: {
                                                    x: normalizeCoordinate(Math.max(0, startFieldX + deltaX)),
                                                    y: normalizeCoordinate(Math.max(0, startFieldY + deltaY))
                                                }
                                            }));
                                        };

                                        const handleMouseUp = () => {
                                            setDraggingField(null);
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                            
                                            // Restore previous zoom state after dragging tiny field
                                            if (smartZoomActive && previousZoomState) {
                                                setSmartZoomActive(false);
                                                setViewMode(previousZoomState.mode);
                                                setCustomZoom(previousZoomState.zoom);
                                                setPreviousZoomState(null);
                                            }
                                            
                                            // Log final position with precision
                                            if (debugMode) {
                                                logFieldPosition(field.id, 
                                                    calculatePreciseFieldPosition(
                                                        finalX, finalY, field.width, field.height, 
                                                        field.fontSize, pageScale, false
                                                    ), 
                                                    'edit'
                                                );
                                            }
                                        };

                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    };

                                    return (
                                        <div 
                                            key={field.id} 
                                            data-field-id={field.id}
                                            {...debugDataAttrs}
                                            style={ultraConsistentStyles}
                                            className={cn(
                                                "group/field",
                                                adjustmentMode && "cursor-move ring-2 ring-orange-400/50 hover:ring-orange-500",
                                                draggingField === field.id && "ring-4 ring-orange-500 shadow-2xl z-50",
                                                debugMode && "debug-field"
                                            )}
                                            onMouseDown={handleMouseDown}
                                        >
                                            {field.inputType === 'TEXT' && (
                                                <input
                                                    type="text"
                                                    data-field-type="text"
                                                    className="w-full h-full bg-transparent border-b border-gray-400/30 focus:border-gray-600/50 focus:bg-white/10 hover:bg-white/5 transition-all outline-none"
                                                    style={{
                                                        // Scale font size with zoom
                                                        fontSize: `${field.fontSize * pageScale}px`,
                                                        fontFamily: field.fontFamily || 'Arial, sans-serif',
                                                        fontWeight: field.fontWeight || 'normal',
                                                        fontStyle: field.fontStyle || 'normal',
                                                        textAlign: field.textAlign || 'left',
                                                        color: field.textColor || '#000000',
                                                        lineHeight: '1.0',
                                                        padding: '0px 2px 0px 2px',
                                                        paddingTop: '0px',
                                                        paddingBottom: '0px',
                                                        margin: '0px',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'flex-start',
                                                        flexDirection: 'column',
                                                        boxSizing: 'border-box',
                                                        border: 'none',
                                                        outline: 'none',
                                                        background: 'transparent',
                                                        WebkitFontSmoothing: 'antialiased',
                                                        verticalAlign: 'baseline',
                                                        textIndent: '0px',
                                                        letterSpacing: 'normal',
                                                        wordSpacing: 'normal',
                                                        writingMode: 'horizontal-tb',
                                                        direction: 'ltr',
                                                        resize: 'none',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'clip',
                                                    } as React.CSSProperties}
                                                    placeholder={field.label}
                                                    value={values[field.slug] || ''}
                                                    onChange={(e) => handleInputChange(field.slug, e.target.value)}
                                                />
                                            )}

                                            {field.inputType === 'EMAIL' && (
                                                <input
                                                    type="email"
                                                    className="w-full h-full bg-transparent border-b border-gray-400/30 focus:border-gray-600/50 focus:bg-white/10 hover:bg-white/5 transition-all outline-none"
                                                    style={{
                                                        fontSize: `${field.fontSize}px`,
                                                        fontFamily: field.fontFamily || 'Arial, sans-serif',
                                                        fontWeight: field.fontWeight || 'normal',
                                                        fontStyle: field.fontStyle || 'normal',
                                                        textAlign: field.textAlign || 'left',
                                                        color: field.textColor || '#000000',
                                                        lineHeight: '1.0',
                                                        padding: '0px 2px 0px 2px',
                                                        margin: '0px',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'flex-start',
                                                        flexDirection: 'column',
                                                        boxSizing: 'border-box',
                                                        border: 'none',
                                                        outline: 'none',
                                                        background: 'transparent',
                                                        WebkitFontSmoothing: 'antialiased',
                                                        verticalAlign: 'baseline',
                                                        textIndent: '0px',
                                                        letterSpacing: 'normal',
                                                        wordSpacing: 'normal',
                                                        writingMode: 'horizontal-tb',
                                                        direction: 'ltr',
                                                        resize: 'none',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'clip',
                                                    } as React.CSSProperties}
                                                    placeholder={field.label}
                                                    value={values[field.slug] || ''}
                                                    onChange={(e) => handleInputChange(field.slug, e.target.value)}
                                                />
                                            )}

                                            {field.inputType === 'NUMBER' && (
                                                <input
                                                    type="number"
                                                    className="w-full h-full bg-transparent border-b border-gray-400/30 focus:border-gray-600/50 focus:bg-white/10 hover:bg-white/5 transition-all outline-none"
                                                    style={{
                                                        fontSize: `${field.fontSize}px`,
                                                        fontFamily: field.fontFamily || 'Arial, sans-serif',
                                                        fontWeight: field.fontWeight || 'normal',
                                                        fontStyle: field.fontStyle || 'normal',
                                                        textAlign: field.textAlign || 'left',
                                                        color: field.textColor || '#000000',
                                                        lineHeight: '1.0',
                                                        padding: '0px 2px 0px 2px',
                                                        margin: '0px',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'flex-start',
                                                        flexDirection: 'column',
                                                        boxSizing: 'border-box',
                                                        border: 'none',
                                                        outline: 'none',
                                                        background: 'transparent',
                                                        WebkitFontSmoothing: 'antialiased',
                                                        verticalAlign: 'baseline',
                                                        textIndent: '0px',
                                                        letterSpacing: 'normal',
                                                        wordSpacing: 'normal',
                                                        writingMode: 'horizontal-tb',
                                                        direction: 'ltr',
                                                        resize: 'none',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'clip',
                                                    } as React.CSSProperties}
                                                    placeholder={field.label}
                                                    value={values[field.slug] || ''}
                                                    onChange={(e) => handleInputChange(field.slug, e.target.value)}
                                                />
                                            )}

                                            {field.inputType === 'DATE' && (
                                                <input
                                                    type="date"
                                                    className="w-full h-full bg-transparent border-b border-gray-400/30 focus:border-gray-600/50 focus:bg-white/10 hover:bg-white/5 transition-all outline-none"
                                                    style={{
                                                        fontSize: `${field.fontSize}px`,
                                                        fontFamily: field.fontFamily || 'Arial, sans-serif',
                                                        fontWeight: field.fontWeight || 'normal',
                                                        fontStyle: field.fontStyle || 'normal',
                                                        textAlign: field.textAlign || 'left',
                                                        color: field.textColor || '#000000',
                                                        lineHeight: '1.0',
                                                        padding: '0px 2px 0px 2px',
                                                        margin: '0px',
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'flex-start',
                                                        flexDirection: 'column',
                                                        boxSizing: 'border-box',
                                                        border: 'none',
                                                        outline: 'none',
                                                        background: 'transparent',
                                                        WebkitFontSmoothing: 'antialiased',
                                                        verticalAlign: 'baseline',
                                                        textIndent: '0px',
                                                        letterSpacing: 'normal',
                                                        wordSpacing: 'normal',
                                                        writingMode: 'horizontal-tb',
                                                        direction: 'ltr',
                                                        resize: 'none',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'clip',
                                                    } as React.CSSProperties}
                                                    value={values[field.slug] || ''}
                                                    onChange={(e) => handleInputChange(field.slug, e.target.value)}
                                                />
                                            )}

                                            {field.inputType === 'ICON' && (
                                                <div 
                                                    className="w-full h-full flex items-center justify-center bg-transparent relative group/icon cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Toggle icon visibility
                                                        const currentValue = values[field.slug];
                                                        const defaultValue = field.defaultVisible !== false;
                                                        const newValue = currentValue === undefined ? !defaultValue : !currentValue;
                                                        handleInputChange(field.slug, newValue);
                                                    }}
                                                    title={`Click to toggle icon visibility. Current: ${values[field.slug] === undefined ? (field.defaultVisible !== false ? 'ON' : 'OFF') : (values[field.slug] ? 'ON' : 'OFF')}`}
                                                >
                                                    {(() => {
                                                        const IconComp = iconVariantComponents[field.iconVariant || 'CHECK'] || Check;
                                                        const isVisible = values[field.slug] === undefined 
                                                            ? field.defaultVisible !== false 
                                                            : values[field.slug] === true;
                                                        
                                                        return (
                                                            <>
                                                                {/* Icon Preview - dimmed if off, full color if on */}
                                                                <IconComp
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        strokeWidth: 3,
                                                                        stroke: field.iconColor || '#000000',
                                                                        color: field.iconColor || '#000000',
                                                                        opacity: isVisible ? 1 : 0.2,
                                                                        transition: 'opacity 0.2s ease-in-out',
                                                                    }}
                                                                />
                                                                {/* Toggle indicator overlay */}
                                                                <div className={cn(
                                                                    "absolute inset-0 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity bg-black/10 rounded",
                                                                )}>
                                                                    {isVisible ? (
                                                                        <ToggleRight className="w-4 h-4 text-green-600 drop-shadow-md" />
                                                                    ) : (
                                                                        <ToggleLeft className="w-4 h-4 text-red-500 drop-shadow-md" />
                                                                    )}
                                                                </div>
                                                                {/* Status badge */}
                                                                <div className={cn(
                                                                    "absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white shadow-sm",
                                                                    isVisible ? "bg-green-500" : "bg-gray-400"
                                                                )} />
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {/* SIGNATURE FIELD - Opens Signature Pad */}
                                            {field.inputType === 'SIGNATURE' && (
                                                <div className="w-full h-full border border-dashed border-pink-400/50 bg-pink-50/30 hover:border-pink-500 hover:bg-pink-50/50 transition-all relative group overflow-hidden rounded">
                                                    {values[field.slug] ? (
                                                        <div className="relative w-full h-full flex items-center justify-center p-1">
                                                            <img
                                                                src={values[field.slug]}
                                                                alt="Signature"
                                                                className="max-w-full max-h-full object-contain"
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveSignatureField({ slug: field.slug, label: field.label });
                                                                        setSignaturePadOpen(true);
                                                                    }}
                                                                    className="p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                                                                    title="Re-sign"
                                                                >
                                                                    <PenTool className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleInputChange(field.slug, null);
                                                                    }}
                                                                    className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                                                    title="Remove signature"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveSignatureField({ slug: field.slug, label: field.label });
                                                                setSignaturePadOpen(true);
                                                            }}
                                                            className="flex flex-col items-center justify-center w-full h-full cursor-pointer text-pink-500/60 hover:text-pink-600 transition-colors"
                                                        >
                                                            <PenTool className="w-5 h-5 mb-1" />
                                                            <span className="text-[10px] font-medium uppercase tracking-wider">
                                                                Click to Sign
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* IMAGE FIELD - File Upload */}
                                            {field.inputType === 'IMAGE' && (
                                                <div className="w-full h-full border border-dashed border-amber-400/50 bg-amber-50/30 hover:border-amber-500 hover:bg-amber-50/50 transition-all relative group overflow-hidden rounded">
                                                    {values[field.slug] ? (
                                                        <div className="relative w-full h-full flex items-center justify-center p-1">
                                                            <img
                                                                src={values[field.slug]}
                                                                alt="Uploaded"
                                                                className="max-w-full max-h-full object-contain"
                                                            />
                                                            <button
                                                                onClick={() => handleInputChange(field.slug, null)}
                                                                className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer text-amber-500/60 hover:text-amber-600 transition-colors">
                                                            <Upload className="w-5 h-5 mb-1" />
                                                            <span className="text-[10px] font-medium uppercase tracking-wider">
                                                                Upload
                                                            </span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    if (e.target.files?.[0]) {
                                                                        handleFileUpload(field.slug, e.target.files[0]);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}</div>
            </div>

            {/* Signature Pad Modal */}
            <SignaturePad
                isOpen={signaturePadOpen}
                onClose={() => {
                    setSignaturePadOpen(false);
                    setActiveSignatureField(null);
                }}
                onSave={(signatureData) => {
                    if (activeSignatureField) {
                        handleInputChange(activeSignatureField.slug, signatureData);
                    }
                }}
                fieldLabel={activeSignatureField?.label}
            />
        </div>
    );
}
