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
}: ThumbnailCardProps) {
    return (
        <div
            className={cn(
                'group relative flex items-start gap-2 p-2 rounded-xl transition-all duration-200',
                'border cursor-pointer select-none',
                'backdrop-blur-md',
                isActive
                    ? 'bg-primary/15 border-primary/40 shadow-lg shadow-primary/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                isDragging && 'opacity-50 scale-[1.02] shadow-2xl'
            )}
            onClick={onClick}
        >
            {/* Drag Handle */}
            <div
                {...dragListeners}
                className={cn(
                    'shrink-0 p-1.5 rounded-md cursor-grab active:cursor-grabbing',
                    'transition-all duration-150',
                    'hover:bg-white/10 text-slate-500 hover:text-slate-300',
                    isActive && 'text-primary/70 hover:text-primary'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/*
                    DISABLED: Drag Handle Icon
                    The visible drag handle icon was commented out to reduce visual clutter.
                    To re-enable the handle, uncomment the next line below.
                */}
                {/* <GripVertical className="w-3.5 h-3.5" /> */}
            </div>

            {/* Thumbnail Container */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
                <div
                    className={cn(
                        'relative overflow-hidden rounded-lg bg-white',
                        'transition-all duration-200 shadow-md',
                        isActive
                            ? 'ring-2 ring-primary shadow-primary/20'
                            : 'ring-1 ring-black/10 hover:ring-2 hover:ring-blue-400/40'
                    )}
                    style={{
                        width: `${72 * thumbnailScale}px`,
                        height: `${100 * thumbnailScale}px`,
                    }}
                >
                    {/* Loading State */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
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
                        isActive ? 'text-primary' : 'text-slate-400'
                    )}
                >
                    {pageNumber}
                </span>
            </div>
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
}: {
    pageNumber: number;
    thumbnailScale: number;
}) {
    return (
        <div
            className={cn(
                'flex items-start gap-2 p-2 rounded-xl',
                'bg-slate-800/95 border border-primary/50',
                'shadow-2xl shadow-black/50',
                'backdrop-blur-xl'
            )}
        >
            <div className="p-1.5 text-primary/70">
                <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
                <div
                    className="rounded-lg bg-white shadow-lg ring-2 ring-primary overflow-hidden flex items-center justify-center"
                    style={{
                        width: `${72 * thumbnailScale}px`,
                        height: `${100 * thumbnailScale}px`,
                    }}
                >
                    <div className="flex flex-col items-center gap-1 text-slate-400">
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

    // Handle page load
    const handlePageLoad = useCallback((pageNumber: number) => {
        setLoadedPages((prev) => new Set(prev).add(pageNumber));
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
                // Glass morphism effect
                'bg-slate-900/80 backdrop-blur-xl',
                'border-r border-white/10',
                isCollapsed ? 'w-14' : 'w-52',
                className
            )}
        >
            {/* Header */}
            <div
                className={cn(
                    'flex items-center gap-2 p-3 border-b border-white/10',
                    'bg-slate-800/50'
                )}
            >
                {!isCollapsed && (
                    <>
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-white truncate">
                            Pages
                        </span>
                        <span className="text-xs text-slate-400 ml-auto mr-1">
                            {totalPages}
                        </span>
                    </>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                        'h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 shrink-0',
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
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-slate-800/30">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-0.5 bg-slate-700/50 rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'h-6 w-6 rounded',
                                viewMode === 'list'
                                    ? 'bg-primary/20 text-primary'
                                    : 'text-slate-400 hover:text-white hover:bg-white/10'
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
                                    ? 'bg-primary/20 text-primary'
                                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                            )}
                        >
                            <LayoutGrid className="w-3 h-3" />
                        </Button>
                    </div>

                    {/* Thumbnail Size */}
                    <div className="flex items-center gap-0.5 bg-slate-700/50 rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setThumbnailScale((s) => Math.max(0.7, s - 0.15))
                            }
                            disabled={thumbnailScale <= 0.7}
                            className="h-6 w-6 rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
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
                            className="h-6 w-6 rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
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
                    'scrollbar-thin scrollbar-thumb-slate-600/50 scrollbar-track-transparent',
                    isCollapsed ? 'p-1.5' : 'p-2'
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
                                        : 'bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white hover:border-white/20'
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
                                    {displayOrder.map((pageNum) => (
                                        <div key={pageNum} data-page-item={pageNum}>
                                            <SortableThumbnail
                                                id={`page-${pageNum}`}
                                                pageNumber={pageNum}
                                                isActive={currentPage === pageNum}
                                                onClick={() => handlePageClick(pageNum)}
                                                thumbnailScale={thumbnailScale}
                                                fieldCount={fieldCountsPerPage[pageNum] || 0}
                                                isLoading={!loadedPages.has(pageNum)}
                                            >
                                                {pdfLoaded && (
                                                    <Page
                                                        pageNumber={pageNum}
                                                        width={72 * thumbnailScale}
                                                        renderTextLayer={false}
                                                        renderAnnotationLayer={false}
                                                        onRenderSuccess={() => handlePageLoad(pageNum)}
                                                        loading={null}
                                                        className="thumbnail-page"
                                                    />
                                                )}
                                            </SortableThumbnail>
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>

                            {/* Drag Overlay - Simple placeholder, no PDF rendering */}
                            <DragOverlay dropAnimation={null}>
                                {activePageNumber ? (
                                    <DragOverlayCard
                                        pageNumber={activePageNumber}
                                        thumbnailScale={thumbnailScale}
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </Document>
                )}
            </div>

            {/* Footer - Navigation */}
            {!isCollapsed && totalPages > 1 && (
                <div className="p-2 border-t border-white/10 bg-slate-800/30">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
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
                                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
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
                                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                    
                    {/* Drag hint */}
                    <p className="text-[10px] text-slate-500 text-center mt-1.5">
                        Drag to reorder pages
                    </p>
                </div>
            )}
        </div>
    );
}
