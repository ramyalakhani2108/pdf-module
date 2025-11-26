'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/lib/store';
import { PdfInput, InputType } from '@/lib/types';
import { cn, generateSlug } from '@/lib/utils';
import {
    Type, Calendar, Hash, Mail, PenTool, Image as ImageIcon, Shapes,
    Trash2, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
    GripVertical, Check, X as XIcon, Circle, 
    CheckCircle, XCircle, Square, CheckSquare, Star, Heart,
    ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Layers, Eye, EyeOff, MoreHorizontal,
    // New icons
    CircleDot, ThumbsUp, ThumbsDown, Flag, MapPin, Bookmark, Info, AlertTriangle, Minus, Plus,
    FormInput
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Type icons map
const typeIcons: Record<InputType, React.ElementType> = {
    TEXT: Type,
    DATE: Calendar,
    NUMBER: Hash,
    EMAIL: Mail,
    ICON: Shapes,
    SIGNATURE: PenTool,
    IMAGE: ImageIcon,
    FILLABLE: FormInput,
};

// Icon variant to component mapping
const iconVariantComponents: Record<string, React.ElementType> = {
    'CHECK': Check,
    'CROSS': XIcon,
    'CIRCLE': Circle,
    'CIRCLE_FILLED': CircleDot,
    'CIRCLE_CHECK': CheckCircle,
    'CIRCLE_CROSS': XCircle,
    'SQUARE': Square,
    'SQUARE_FILLED': Square,
    'SQUARE_CHECK': CheckSquare,
    'STAR': Star,
    'STAR_FILLED': Star,
    'HEART': Heart,
    'HEART_FILLED': Heart,
    'ARROW_RIGHT': ArrowRight,
    'ARROW_LEFT': ArrowLeft,
    'ARROW_UP': ArrowUp,
    'ARROW_DOWN': ArrowDown,
    'THUMBS_UP': ThumbsUp,
    'THUMBS_DOWN': ThumbsDown,
    'FLAG': Flag,
    'PIN': MapPin,
    'BOOKMARK': Bookmark,
    'INFO': Info,
    'WARNING': AlertTriangle,
    'MINUS': Minus,
    'PLUS': Plus,
};

// Color mapping for each input type
const typeColors: Record<InputType, string> = {
    TEXT: 'bg-blue-500',
    DATE: 'bg-orange-500',
    NUMBER: 'bg-green-500',
    EMAIL: 'bg-cyan-500',
    ICON: 'bg-purple-500',
    SIGNATURE: 'bg-pink-500',
    IMAGE: 'bg-amber-500',
    FILLABLE: 'bg-emerald-500',
};

const typeBorderColors: Record<InputType, string> = {
    TEXT: 'border-l-blue-500',
    DATE: 'border-l-orange-500',
    NUMBER: 'border-l-green-500',
    EMAIL: 'border-l-cyan-500',
    ICON: 'border-l-purple-500',
    SIGNATURE: 'border-l-pink-500',
    IMAGE: 'border-l-amber-500',
    FILLABLE: 'border-l-emerald-500',
};

interface SortableItemProps {
    field: PdfInput;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onBringForward: (id: string) => void;
    onSendBackward: (id: string) => void;
    onBringToFront: (id: string) => void;
    onSendToBack: (id: string) => void;
    onUpdateLabel: (id: string, newLabel: string) => void;
    onToggleVisibility: (id: string) => void;
    onShowProperties: (id: string) => void;
    allFields: PdfInput[];
    isFirst: boolean;
    isLast: boolean;
}

function SortableItem({
    field,
    isSelected,
    onSelect,
    onDelete,
    onBringForward,
    onSendBackward,
    onBringToFront,
    onSendToBack,
    onUpdateLabel,
    onToggleVisibility,
    onShowProperties,
    allFields,
    isFirst,
    isLast,
}: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: field.id });

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [editLabelValue, setEditLabelValue] = useState(field.label);
    const [undoStack, setUndoStack] = useState<string[]>([field.label]);
    const labelInputRef = useRef<HTMLInputElement>(null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const TypeIcon = typeIcons[field.inputType];
    const IconComp = field.inputType === 'ICON' && field.iconVariant 
        ? iconVariantComponents[field.iconVariant] || Check
        : null;

    // Handle triple click to enter edit mode using native dblclick
    const handleLabelDoubleClick = () => {
        // Enter edit mode on double click
        setIsEditingLabel(true);
        setEditLabelValue(field.label);
        setUndoStack([field.label]);
        setTimeout(() => labelInputRef.current?.focus(), 0);
    };

    // Handle label input change
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setEditLabelValue(newValue);
        // Update undo stack as user types
        if (newValue !== undoStack[undoStack.length - 1]) {
            setUndoStack([...undoStack, newValue]);
        }
    };

    // Handle label input blur (save changes)
    const handleLabelBlur = () => {
        const finalLabel = editLabelValue.trim() || field.label;
        
        if (finalLabel !== field.label) {
            onUpdateLabel(field.id, finalLabel);
        }
        setIsEditingLabel(false);
        setEditLabelValue(finalLabel);
        setUndoStack([finalLabel]);
    };

    // Handle undo (Ctrl/Cmd + Z)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;

        if (cmdKey && e.key === 'z') {
            e.preventDefault();
            if (undoStack.length > 1) {
                const newStack = undoStack.slice(0, -1);
                setUndoStack(newStack);
                setEditLabelValue(newStack[newStack.length - 1]);
            }
            return;
        }

        // Close edit mode on Enter or Escape
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLabelBlur();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsEditingLabel(false);
            setEditLabelValue(field.label);
            setUndoStack([field.label]);
            return;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={() => onSelect(field.id)}
            className={cn(
                "group flex flex-col gap-1.5 px-3 py-2 rounded-md transition-all border-l-2 cursor-pointer",
                typeBorderColors[field.inputType],
                isSelected 
                    ? "bg-primary/10 ring-1 ring-primary/30" 
                    : "bg-card hover:bg-muted/50",
                isDragging && "opacity-50 shadow-lg ring-2 ring-primary/50 z-50"
            )}
        >
            {/* Main row: Drag handle, icon, label, actions */}
            <div className="flex items-center gap-2.5">
                {/* Drag Handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </button>

                {/* Type Icon */}
                <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center shrink-0",
                    typeColors[field.inputType]
                )}>
                    {IconComp ? (
                        <IconComp className="w-3 h-3 text-white" />
                    ) : (
                        <TypeIcon className="w-3 h-3 text-white" />
                    )}
                </div>

                {/* Label - Clickable to select */}
                <button
                    onClick={() => onSelect(field.id)}
                    onDoubleClick={handleLabelDoubleClick}
                    className="flex-1 text-left truncate text-xs font-medium text-foreground hover:text-primary transition-colors"
                    title="Double-click to edit"
                >
                    {field.label}
                </button>

                {/* Quick Actions - Visible on hover or when selected */}
                <div className={cn(
                    "flex items-center gap-1 transition-opacity shrink-0",
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                    {/* Layer Order Controls */}
                    <button
                        onClick={() => onBringToFront(field.id)}
                        disabled={isFirst}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            isFirst ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Bring to front"
                    >
                        <ChevronsUp className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => onBringForward(field.id)}
                        disabled={isFirst}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            isFirst ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Bring forward"
                    >
                        <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => onSendBackward(field.id)}
                        disabled={isLast}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            isLast ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Send backward"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => onSendToBack(field.id)}
                        disabled={isLast}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            isLast ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Send to back"
                    >
                        <ChevronsDown className="w-3 h-3" />
                    </button>
                    
                    {/* Delete */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(field.id);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Hide/Show (for all field types) */}
                    <button
                        onClick={() => {
                            onToggleVisibility(field.id);
                        }}
                        className={cn(
                            "p-1 rounded transition-colors",
                            field.isVisible === false 
                                ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        title={field.isVisible === false ? "Show field" : "Hide field"}
                    >
                        {field.isVisible === false ? (
                            <EyeOff className="w-3 h-3" />
                        ) : (
                            <Eye className="w-3 h-3" />
                        )}
                    </button>

                    {/* More button - Shows properties tab */}
                    <button
                        onClick={() => onShowProperties(field.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="More options (Properties)"
                    >
                        <MoreHorizontal className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Label Edit Row - Only visible when selected or editing */}
            {isSelected && (
                <>
                    <div className="flex items-center gap-2 pl-8 pr-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase shrink-0">Label:</span>
                        {isEditingLabel ? (
                            <input
                                ref={labelInputRef}
                                type="text"
                                value={editLabelValue}
                                onChange={handleLabelChange}
                                onBlur={handleLabelBlur}
                                onKeyDown={handleKeyDown}
                                className="flex-1 min-w-0 h-6 px-2 text-xs rounded border border-primary bg-transparent font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                spellCheck="false"
                            />
                        ) : (
                            <button
                                onClick={() => onSelect(field.id)}
                                onDoubleClick={handleLabelDoubleClick}
                                className="flex-1 min-w-0 text-left h-6 px-2 text-xs rounded border border-border bg-muted/30 font-medium text-foreground hover:border-primary hover:bg-muted/50 transition-colors cursor-text truncate"
                                title="Double-click to edit"
                            >
                                {field.label}
                            </button>
                        )}
                    </div>

                    {/* Slug Display Row - Only visible when selected */}
                    <div className="flex items-center gap-2 pl-8 pr-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase shrink-0">Slug:</span>
                        <div className="flex-1 min-w-0 h-6 px-2 text-xs rounded border border-border bg-muted/30 font-mono text-muted-foreground flex items-center truncate overflow-hidden">
                            {field.slug}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface PageGroup {
    pageNumber: number;
    fields: PdfInput[];
}

export function ItemsPanel({ onSwitchToProperties }: { onSwitchToProperties?: () => void }) {
    const {
        fields,
        currentPage,
        selectedFieldId,
        selectField,
        deleteField,
        bringToFront,
        sendToBack,
        bringForward,
        sendBackward,
        reorderFields,
        updateField,
        setCurrentPage,
    } = useEditorStore();

    // Group all fields by page number and sort pages
    const pageGroups: PageGroup[] = [];
    const pageMap = new Map<number, PdfInput[]>();
    
    fields.forEach(field => {
        if (!pageMap.has(field.pageNumber)) {
            pageMap.set(field.pageNumber, []);
        }
        pageMap.get(field.pageNumber)!.push(field);
    });
    
    // Sort by page number and create groups
    Array.from(pageMap.entries())
        .sort(([pageA], [pageB]) => pageA - pageB)
        .forEach(([pageNumber, pageFields]) => {
            pageGroups.push({
                pageNumber,
                fields: pageFields.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
            });
        });

    // Get fields for current page for drag and drop
    const currentPageFields = fields
        .filter(f => f.pageNumber === currentPage)
        .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = currentPageFields.findIndex(f => f.id === active.id);
            const newIndex = currentPageFields.findIndex(f => f.id === over.id);
            
            const newOrder = arrayMove(currentPageFields, oldIndex, newIndex);
            // Reverse because our list shows front-to-back, but zIndex should be back-to-front
            const orderedIds = [...newOrder].reverse().map(f => f.id);
            reorderFields(currentPage, orderedIds);
        }
    }, [currentPageFields, currentPage, reorderFields]);

    const handleUpdateSlug = useCallback((fieldId: string, newSlug: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (field) {
            updateField(fieldId, { ...field, slug: newSlug });
        }
    }, [fields, updateField]);

    const handleUpdateLabel = useCallback((fieldId: string, newLabel: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (field) {
            // Auto-generate slug from label, ensuring uniqueness
            const newSlug = generateSlug(newLabel);
            updateField(fieldId, { ...field, label: newLabel, slug: newSlug });
        }
    }, [fields, updateField]);

    const handleToggleVisibility = useCallback((fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (field) {
            updateField(fieldId, { ...field, isVisible: field.isVisible === false ? true : false });
        }
    }, [fields, updateField]);

    const handleShowProperties = useCallback((fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (field && field.pageNumber !== currentPage) {
            // Navigate to the field's page
            setCurrentPage(field.pageNumber);
        }
        // Select the field first
        selectField(fieldId);
        // Switch to properties tab
        if (onSwitchToProperties) {
            onSwitchToProperties();
        }
    }, [selectField, onSwitchToProperties, fields, currentPage, setCurrentPage]);

    const handleSelectField = useCallback((fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        if (field && field.pageNumber !== currentPage) {
            // Navigate to the field's page
            setCurrentPage(field.pageNumber);
        }
        // Select the field
        selectField(fieldId);
    }, [selectField, fields, currentPage, setCurrentPage]);

    if (pageGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No items added yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                    Add fields using the toolbar above
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        All Items
                    </span>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {fields.length}
                </span>
            </div>

            {/* Page Groups */}
            <div className="space-y-4">
                {pageGroups.map((group) => (
                    <div key={`page-${group.pageNumber}`} className="space-y-2">
                        {/* Page Group Header */}
                        <div className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md border-l-2 transition-colors",
                            group.pageNumber === currentPage
                                ? "border-l-primary bg-primary/5"
                                : "border-l-border bg-muted/30"
                        )}>
                            <span className="text-xs font-semibold text-foreground">
                                Page {group.pageNumber}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {group.fields.length}
                            </span>
                        </div>

                        {/* Items for this page */}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={group.fields.map(f => f.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-1 pl-1">
                                    {group.fields.map((field, index) => (
                                        <SortableItem
                                            key={field.id}
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            onSelect={handleSelectField}
                                            onDelete={deleteField}
                                            onBringForward={bringForward}
                                            onSendBackward={sendBackward}
                                            onBringToFront={bringToFront}
                                            onSendToBack={sendToBack}
                                            onUpdateLabel={handleUpdateLabel}
                                            onToggleVisibility={handleToggleVisibility}
                                            onShowProperties={handleShowProperties}
                                            allFields={fields}
                                            isFirst={index === 0}
                                            isLast={index === group.fields.length - 1}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="pt-3 mt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-2">Layer Order (top = front)</p>
                <div className="grid grid-cols-4 gap-1 text-[9px]">
                    {Object.entries(typeColors).map(([type, color]) => (
                        <div key={type} className="flex items-center gap-1">
                            <div className={cn("w-2 h-2 rounded-sm", color)} />
                            <span className="text-muted-foreground">{type}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
