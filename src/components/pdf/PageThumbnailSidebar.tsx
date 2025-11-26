'use client';

import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    UniqueIdentifier,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useEditorStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
    ChevronLeft,
    ChevronRight,
    GripVertical,
    FileText,
    Loader2,
    LayoutGrid,
    List,
    ZoomIn,
    ZoomOut,
    Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
    cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
};

// =============================================================================
// THUMBNAIL CARD (Visual wrapper - no PDF rendering)
// =============================================================================

interface ThumbnailCardProps {
    pageNumber: number;
    isActive: boolean;
    onClick: () => void;
    thumbnailScale: number;
    fieldCount: number;
    isLoading: boolean;
    isDragging?: boolean;
    dragListeners?: Record<string, unknown>;
    children?: React.ReactNode;
    aspectRatio?: number; // width / height ratio of the page
}

const ThumbnailCard = memo(function ThumbnailCard({
    pageNumber,
    isActive,
    onClick,
    thumbnailScale,
    fieldCount,
    isLoading,
    isDragging,
    dragListeners,
    children,
    aspectRatio,
}: ThumbnailCardProps) {
    // Calculate thumbnail dimensions based on aspect ratio
    // Default to portrait A4 ratio (~0.707) if not provided
    const baseWidth = 100;
    const baseHeight = 140;
    
    let thumbnailWidth: number;
    let thumbnailHeight: number;
    
    if (aspectRatio && aspectRatio > 1) {
        // Landscape: width is larger, fit to baseHeight and calculate width
        thumbnailWidth = baseHeight * aspectRatio * thumbnailScale;
        thumbnailHeight = baseHeight * thumbnailScale;
        // Cap the width to prevent very wide thumbnails
        if (thumbnailWidth > 180 * thumbnailScale) {
            thumbnailWidth = 180 * thumbnailScale;
            thumbnailHeight = thumbnailWidth / aspectRatio;
        }
    } else if (aspectRatio) {
        // Portrait: height is larger, fit to baseWidth and calculate height
        thumbnailWidth = baseWidth * thumbnailScale;
        thumbnailHeight = (baseWidth / aspectRatio) * thumbnailScale;
        // Cap the height to prevent very tall thumbnails
        if (thumbnailHeight > 160 * thumbnailScale) {
            thumbnailHeight = 160 * thumbnailScale;
            thumbnailWidth = thumbnailHeight * aspectRatio;
        }
    } else {
        // Default portrait dimensions
        thumbnailWidth = baseWidth * thumbnailScale;
        thumbnailHeight = baseHeight * thumbnailScale;
    }

    return (
        <div
            className={cn(
                'group relative flex flex-col items-center gap-1.5 cursor-pointer select-none',
                'transition-all duration-200'
            )}
            onClick={onClick}
        >
            {/* Thumbnail Container - just the image */}
            <div
                className={cn(
                    'relative overflow-hidden rounded-lg',
                    'transition-all duration-200',
                    isActive
                        ? 'ring-2 ring-primary shadow-lg shadow-primary/20'
                        : 'ring-1 ring-border/50 hover:ring-2 hover:ring-primary/40 hover:shadow-md'
                )}
                style={{
                    width: `${thumbnailWidth}px`,
                    height: `${thumbnailHeight}px`,
                }}
            >
                {/* Loading State */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* PDF Page (rendered via children) */}
                <div className="absolute inset-0 overflow-hidden">
                    {children}
                </div>

                {/* Field Count Badge */}
                {fieldCount > 0 && (
                    <div
                        className={cn(
                            'absolute top-1 right-1 min-w-[16px] h-[16px] px-1 z-20',
                            'flex items-center justify-center',
                            'text-[9px] font-bold rounded-full',
                            'bg-primary text-white shadow-sm',
                            'border border-white/20'
                        )}
                    >
                        {fieldCount}
                    </div>
                )}

                {/* Active overlay */}
                {isActive && (
                    <div className="absolute inset-0 bg-primary/5 pointer-events-none z-10" />
                )}
            </div>

            {/* Page Number */}
            <span
                className={cn(
                    'text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                )}
            >
                {pageNumber}
            </span>
        </div>
    );
});

// =============================================================================
// SORTABLE THUMBNAIL WRAPPER
// =============================================================================

interface SortableThumbnailProps {
    id: string;
    pageNumber: number;
    isActive: boolean;
    onClick: () => void;
    thumbnailScale: number;
    fieldCount: number;
    isLoading: boolean;
    children?: React.ReactNode;
    aspectRatio?: number;
}

function SortableThumbnail({
    id,
    pageNumber,
    isActive,
    onClick,
    thumbnailScale,
    fieldCount,
    isLoading,
    children,
    aspectRatio,
}: SortableThumbnailProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <ThumbnailCard
                pageNumber={pageNumber}
                isActive={isActive}
                onClick={onClick}
                thumbnailScale={thumbnailScale}
                fieldCount={fieldCount}
                isLoading={isLoading}
                isDragging={isDragging}
                dragListeners={listeners}
                aspectRatio={aspectRatio}
            >
                {children}
            </ThumbnailCard>
        </div>
    );
}

// =============================================================================
// DRAG OVERLAY CARD
// =============================================================================

/**
 * FEATURE: Drag Overlay Icons (Currently Disabled)
 * 
 * TO ENABLE THIS FEATURE IN THE FUTURE:
 * Uncomment the following 2 lines in the DragOverlayCard function below:
 * 
 * LINE 1 (Icon): Uncomment this line
 *   <Layers className="w-5 h-5" />
 * 
 * LINE 2 (Label): Uncomment this line
 *   <span className="text-[10px] font-medium">Page {pageNumber}</span>
 * 
 * These lines are currently commented out for a cleaner drag preview UI.
 * The page number at the bottom of the drag card will still be visible.
 */

function DragOverlayCard({
    pageNumber,
    thumbnailScale,
    aspectRatio,
}: {
    pageNumber: number;
    thumbnailScale: number;
    aspectRatio?: number;
}) {
    // Calculate dimensions based on aspect ratio
    const baseWidth = 72;
    const baseHeight = 100;
    
    let overlayWidth: number;
    let overlayHeight: number;
    
    if (aspectRatio && aspectRatio > 1) {
        // Landscape
        overlayWidth = baseHeight * aspectRatio * thumbnailScale;
        overlayHeight = baseHeight * thumbnailScale;
        if (overlayWidth > 140 * thumbnailScale) {
            overlayWidth = 140 * thumbnailScale;
            overlayHeight = overlayWidth / aspectRatio;
        }
    } else if (aspectRatio) {
        // Portrait
        overlayWidth = baseWidth * thumbnailScale;
        overlayHeight = (baseWidth / aspectRatio) * thumbnailScale;
        if (overlayHeight > 120 * thumbnailScale) {
            overlayHeight = 120 * thumbnailScale;
            overlayWidth = overlayHeight * aspectRatio;
        }
    } else {
        overlayWidth = baseWidth * thumbnailScale;
        overlayHeight = baseHeight * thumbnailScale;
    }

    return (
        <div
            className={cn(
                'flex items-start gap-2 p-2 rounded-xl',
                'bg-card border border-primary/50',
                'shadow-xl',
                'backdrop-blur-sm'
            )}
        >
            <div className="p-1.5 text-primary/70">
                <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
                <div
                    className="rounded-lg shadow-lg ring-2 ring-primary overflow-hidden flex items-center justify-center"
                    style={{
                        width: `${overlayWidth}px`,
                        height: `${overlayHeight}px`,
                    }}
                >
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        {/* DISABLED: Drag overlay icon - TO ENABLE: uncomment line below */}
                        {/* <Layers className="w-5 h-5" /> */}
                        
                        {/* DISABLED: Page number label - TO ENABLE: uncomment line below */}
                        {/* <span className="text-[10px] font-medium">Page {pageNumber}</span> */}
                    </div>
                </div>
                <span className="text-[11px] font-medium text-primary">
                    {pageNumber}
                </span>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface PageThumbnailSidebarProps {
    className?: string;
}

export function PageThumbnailSidebar({ className }: PageThumbnailSidebarProps) {
    const {
        currentPdf,
        currentPage,
        setCurrentPage,
        fields,
        totalPages,
        pageOrder,
        setPageOrder,
        reorderPages,
    } = useEditorStore();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [thumbnailScale, setThumbnailScale] = useState(1);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({}); 
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Initialize page order when PDF loads
    useEffect(() => {
        if (currentPdf && totalPages > 0) {
            const existingOrder = pageOrder;
            if (!existingOrder || existingOrder.length !== totalPages) {
                setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
            }
        }
        // Reset state when PDF changes
        setLoadedPages(new Set());
        setPdfLoaded(false);
        setPageDimensions({});
    }, [currentPdf?.id, totalPages]);

    // Sensors for drag and drop with proper activation constraint
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Minimum drag distance before activation
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Memoize field counts per page
    const fieldCountsPerPage = useMemo(() => {
        const counts: Record<number, number> = {};
        fields.forEach((f) => {
            counts[f.pageNumber] = (counts[f.pageNumber] || 0) + 1;
        });
        return counts;
    }, [fields]);

    // Handle page selection
    const handlePageClick = useCallback(
        (pageNumber: number) => {
            setCurrentPage(pageNumber);
        },
        [setCurrentPage]
    );

    // Handle page load with dimensions
    const handlePageLoad = useCallback((pageNumber: number, width?: number, height?: number) => {
        setLoadedPages((prev) => new Set(prev).add(pageNumber));
        if (width && height) {
            setPageDimensions((prev) => ({
                ...prev,
                [pageNumber]: { width, height },
            }));
        }
    }, []);

    // Scroll active page into view
    useEffect(() => {
        if (scrollContainerRef.current && currentPage) {
            const activeElement = scrollContainerRef.current.querySelector(
                `[data-page-item="${currentPage}"]`
            );
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                });
            }
        }
    }, [currentPage]);

    // Handle drag start
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id);
    }, []);

    // Handle drag end
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            setActiveId(null);

            if (over && active.id !== over.id) {
                const currentOrder =
                    pageOrder || Array.from({ length: totalPages }, (_, i) => i + 1);
                const oldIndex = currentOrder.findIndex((p) => `page-${p}` === active.id);
                const newIndex = currentOrder.findIndex((p) => `page-${p}` === over.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
                    reorderPages(newOrder);
                }
            }
        },
        [pageOrder, totalPages, reorderPages]
    );

    // Handle drag cancel
    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    // Don't render if no PDF is loaded
    if (!currentPdf) return null;

    const displayOrder =
        pageOrder || Array.from({ length: totalPages }, (_, i) => i + 1);
    const activePageNumber = activeId
        ? Number(String(activeId).replace('page-', ''))
        : null;

    return (
        <div
            className={cn(
                'relative flex flex-col h-full transition-all duration-300 ease-in-out',
                // Clean off-white background
                'bg-surface',
                'border-r border-border',
                isCollapsed ? 'w-14' : 'w-52',
                className
            )}
        >
            {/* Header */}
            <div
                className={cn(
                    'flex items-center gap-2 p-3 border-b border-border',
                    'bg-card'
                )}
            >
                {!isCollapsed && (
                    <>
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">
                            Pages
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto mr-1">
                            {totalPages}
                        </span>
                    </>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                        'h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0',
                        isCollapsed && 'mx-auto'
                    )}
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                    ) : (
                        <ChevronLeft className="w-4 h-4" />
                    )}
                </Button>
            </div>

            {/* Toolbar (when expanded) */}
            {!isCollapsed && (
                <div className="hidden">
                    {/* View Mode Toggle - HIDDEN */}
                    <div className="flex items-center gap-0.5 bg-card rounded-md p-0.5 border border-border">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'h-6 w-6 rounded',
                                viewMode === 'list'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                        >
                            <List className="w-3 h-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                'h-6 w-6 rounded',
                                viewMode === 'grid'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                        >
                            <LayoutGrid className="w-3 h-3" />
                        </Button>
                    </div>

                    {/* Thumbnail Size - HIDDEN */}
                    <div className="flex items-center gap-0.5 bg-card rounded-md p-0.5 border border-border">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setThumbnailScale((s) => Math.max(0.7, s - 0.15))
                            }
                            disabled={thumbnailScale <= 0.7}
                            className="h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                        >
                            <ZoomOut className="w-3 h-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setThumbnailScale((s) => Math.min(1.3, s + 0.15))
                            }
                            disabled={thumbnailScale >= 1.3}
                            className="h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                        >
                            <ZoomIn className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Thumbnails Container */}
            <div
                ref={scrollContainerRef}
                className={cn(
                    'flex-1 overflow-y-auto overflow-x-hidden',
                    'scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent',
                    isCollapsed ? 'p-1' : 'p-1'
                )}
            >
                {isCollapsed ? (
                    // Collapsed view - compact page numbers
                    <div className="flex flex-col items-center gap-1.5">
                        {displayOrder.map((pageNum) => (
                            <button
                                key={pageNum}
                                data-page-item={pageNum}
                                onClick={() => handlePageClick(pageNum)}
                                className={cn(
                                    'w-9 h-9 rounded-lg flex items-center justify-center',
                                    'text-xs font-semibold transition-all duration-150',
                                    'border',
                                    currentPage === pageNum
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                                        : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground hover:border-border'
                                )}
                            >
                                {pageNum}
                            </button>
                        ))}
                    </div>
                ) : (
                    // Expanded view with thumbnails - Single Document wrapper
                    <Document
                        file={currentPdf.filePath}
                        options={PDF_OPTIONS}
                        loading={
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        }
                        error={
                            <div className="text-xs text-red-400 text-center p-4">
                                Failed to load PDF
                            </div>
                        }
                        onLoadSuccess={() => setPdfLoaded(true)}
                    >
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragCancel={handleDragCancel}
                            modifiers={[restrictToVerticalAxis]}
                        >
                            <SortableContext
                                items={displayOrder.map((p) => `page-${p}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div
                                    className={cn(
                                        'flex gap-2',
                                        viewMode === 'list'
                                            ? 'flex-col'
                                            : 'flex-wrap justify-center'
                                    )}
                                >
                                    {displayOrder.map((pageNum) => {
                                        const dims = pageDimensions[pageNum];
                                        const aspectRatio = dims ? dims.width / dims.height : undefined;
                                        
                                        // Calculate the width needed for the Page component to fill the thumbnail
                                        // This should match the calculation in ThumbnailCard
                                        const baseWidth = 100;
                                        const baseHeight = 140;
                                        let pageRenderWidth: number;
                                        
                                        if (aspectRatio && aspectRatio > 1) {
                                            // Landscape
                                            let thumbnailWidth = baseHeight * aspectRatio * thumbnailScale;
                                            if (thumbnailWidth > 180 * thumbnailScale) {
                                                thumbnailWidth = 180 * thumbnailScale;
                                            }
                                            pageRenderWidth = thumbnailWidth;
                                        } else if (aspectRatio) {
                                            // Portrait
                                            let thumbnailHeight = (baseWidth / aspectRatio) * thumbnailScale;
                                            if (thumbnailHeight > 160 * thumbnailScale) {
                                                thumbnailHeight = 160 * thumbnailScale;
                                                pageRenderWidth = thumbnailHeight * aspectRatio;
                                            } else {
                                                pageRenderWidth = baseWidth * thumbnailScale;
                                            }
                                        } else {
                                            pageRenderWidth = baseWidth * thumbnailScale;
                                        }
                                        
                                        return (
                                            <div key={pageNum} data-page-item={pageNum}>
                                                <SortableThumbnail
                                                    id={`page-${pageNum}`}
                                                    pageNumber={pageNum}
                                                    isActive={currentPage === pageNum}
                                                    onClick={() => handlePageClick(pageNum)}
                                                    thumbnailScale={thumbnailScale}
                                                    fieldCount={fieldCountsPerPage[pageNum] || 0}
                                                    isLoading={!loadedPages.has(pageNum)}
                                                    aspectRatio={aspectRatio}
                                                >
                                                    {pdfLoaded && (
                                                        <Page
                                                            pageNumber={pageNum}
                                                            width={pageRenderWidth}
                                                            renderTextLayer={false}
                                                            renderAnnotationLayer={false}
                                                            onLoadSuccess={(page) => {
                                                                handlePageLoad(pageNum, page.originalWidth, page.originalHeight);
                                                            }}
                                                            loading={null}
                                                            className="thumbnail-page"
                                                        />
                                                    )}
                                                </SortableThumbnail>
                                            </div>
                                        );
                                    })}
                                </div>
                            </SortableContext>

                            {/* Drag Overlay - Simple placeholder, no PDF rendering */}
                            <DragOverlay dropAnimation={null}>
                                {activePageNumber ? (
                                    <DragOverlayCard
                                        pageNumber={activePageNumber}
                                        thumbnailScale={thumbnailScale}
                                        aspectRatio={pageDimensions[activePageNumber] ? pageDimensions[activePageNumber].width / pageDimensions[activePageNumber].height : undefined}
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </Document>
                )}
            </div>

            {/* Footer - Navigation */}
            {!isCollapsed && totalPages > 1 && (
                <div className="p-2 border-t border-border bg-muted/30">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                            {currentPage} / {totalPages}
                        </span>
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    setCurrentPage(Math.max(1, currentPage - 1))
                                }
                                disabled={currentPage <= 1}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                                }
                                disabled={currentPage >= totalPages}
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                    
                    {/* Drag hint */}
                    <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                        Drag to reorder pages
                    </p>
                </div>
            )}
        </div>
    );
}
