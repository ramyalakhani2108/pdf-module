/**
 * @fileoverview Global state management with Zustand
 * @description Centralized store for PDF editor state with persistence.
 * Uses Zustand for lightweight state management with middleware support.
 * 
 * @architecture
 * - State: PDF data, fields, UI state
 * - Actions: CRUD operations for fields, navigation
 * - Persistence: LocalStorage with selective state
 * - Selectors: Derived state for common use cases
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS, FIELD_DEFAULTS, FONT_CONFIG } from './constants';
import type { PdfFile, PdfInput, InputType, IconVariant } from '@/lib/types';

// =============================================================================
// ACTIVE TOOL TYPES
// =============================================================================

/**
 * Active tool for click-to-place functionality
 * Similar to MS Word/Paint where you select a tool then click to place
 */
export interface ActiveTool {
  type: InputType;
  iconVariant?: IconVariant;
  iconColor?: string;
}

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * PDF Editor state interface
 */
interface EditorState {
  // -------------------------------------------------------------------------
  // PDF State
  // -------------------------------------------------------------------------
  /** Currently loaded PDF file */
  currentPdf: PdfFile | null;
  /** Whether current PDF was imported via URL (should not persist across sessions) */
  isImportedViaUrl: boolean;
  /** Current page being viewed (1-indexed) */
  currentPage: number;
  /** Total pages in the PDF */
  totalPages: number;
  /** Custom page order for reordering (array of page numbers) */
  pageOrder: number[] | null;

  // -------------------------------------------------------------------------
  // Fields State
  // -------------------------------------------------------------------------
  /** Array of input fields on the PDF */
  fields: PdfInput[];
  /** ID of currently selected field */
  selectedFieldId: string | null;

  // -------------------------------------------------------------------------
  // Tool State (MS Word/Paint-like)
  // -------------------------------------------------------------------------
  /** Currently active tool for click-to-place */
  activeTool: ActiveTool | null;

  // -------------------------------------------------------------------------
  // UI State
  // -------------------------------------------------------------------------
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current zoom level */
  zoom: number;
  /** Whether preview mode is active */
  isPreviewMode: boolean;
  /** Whether to show borders on all fields (toggle with Cmd+Shift+H) */
  showFieldBorders: boolean;
  /** Which field type to highlight ('ALL' for all types, or specific InputType, null for none) */
  highlightFieldType: InputType | 'ALL' | null;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  // PDF Actions
  setPdf: (pdf: PdfFile | null, isImportedViaUrl?: boolean) => void;
  setCurrentPage: (page: number) => void;
  setPageOrder: (order: number[]) => void;
  reorderPages: (newOrder: number[]) => void;
  
  // Field Actions
  setFields: (fields: PdfInput[]) => void;
  addField: (field: Omit<PdfInput, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addFieldWithDefaults: (
    pdfFileId: string,
    inputType: InputType,
    pageNumber: number,
    position: { x: number; y: number }
  ) => void;
  addFieldAtPosition: (position: { x: number; y: number }) => void;
  updateField: (id: string, updates: Partial<PdfInput>) => void;
  deleteField: (id: string) => void;
  duplicateField: (id: string) => void;
  selectField: (id: string | null) => void;
  
  // Z-Index / Layer Actions
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  reorderFields: (pageNumber: number, orderedIds: string[]) => void;
  
  // Tool Actions (MS Word/Paint-like)
  setActiveTool: (tool: ActiveTool | null) => void;
  clearActiveTool: () => void;
  
  // UI Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setZoom: (zoom: number) => void;
  setPreviewMode: (isPreview: boolean) => void;
  toggleFieldBorders: () => void;
  setFieldBorders: (show: boolean) => void;
  setHighlightFieldType: (type: InputType | 'ALL' | null) => void;
  toggleHighlightAll: () => void;
  reset: () => void;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Default state values
 */
const initialState = {
  currentPdf: null,
  isImportedViaUrl: false,
  currentPage: 1,
  totalPages: 0,
  pageOrder: null as number[] | null,
  fields: [],
  selectedFieldId: null,
  activeTool: null,
  isLoading: false,
  error: null,
  zoom: 1,
  isPreviewMode: false,
  showFieldBorders: true, // Show borders by default
  highlightFieldType: null as InputType | 'ALL' | null, // No highlight by default
};

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * PDF Editor Store
 * @description Main state store for the PDF form editor application
 * 
 * @example
 * ```tsx
 * // In a component
 * const { currentPdf, fields, addField } = useEditorStore();
 * 
 * // With selector for performance
 * const fields = useEditorStore((state) => state.fields);
 * ```
 */
export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // PDF Actions
      // -----------------------------------------------------------------------
      
      /**
       * Set the current PDF file
       * @param pdf - PDF file to set, or null to clear
       * @param isImportedViaUrl - Whether this PDF was imported via URL parameter
       */
      setPdf: (pdf, isImportedViaUrl = false) => {
        set({
          currentPdf: pdf,
          isImportedViaUrl,
          totalPages: pdf?.pageCount || 0,
          currentPage: 1,
          pageOrder: pdf ? Array.from({ length: pdf.pageCount }, (_, i) => i + 1) : null,
          fields: [], // Clear fields when changing PDF
          selectedFieldId: null,
        });
      },

      /**
       * Set the current page
       * @param page - Page number (1-indexed)
       */
      setCurrentPage: (page) => {
        const { totalPages } = get();
        const validPage = Math.max(1, Math.min(page, totalPages));
        set({ currentPage: validPage, selectedFieldId: null });
      },

      /**
       * Set the page order array
       * @param order - Array of page numbers in display order
       */
      setPageOrder: (order) => set({ pageOrder: order }),

      /**
       * Reorder pages (for drag and drop in thumbnail sidebar)
       * @param newOrder - New array of page numbers in display order
       */
      reorderPages: (newOrder) => {
        set({ pageOrder: newOrder });
        // Note: This only affects the visual order in the sidebar
        // Actual PDF page reordering would require server-side processing
      },

      // -----------------------------------------------------------------------
      // Field Actions
      // -----------------------------------------------------------------------

      /**
       * Set all fields (typically from API response)
       * @param fields - Array of PDF input fields
       */
      setFields: (fields) => set({ fields }),

      /**
       * Add a new field
       * @param field - Field data without auto-generated properties
       */
      addField: (field) =>
        set((state) => ({
          fields: [
            ...state.fields,
            {
              ...field,
              id: crypto.randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
            } as PdfInput,
          ],
        })),

      /**
       * Add a field with default dimensions based on type
       * @param pdfFileId - Associated PDF file ID
       * @param inputType - Type of input field
       * @param pageNumber - Page to add field to
       * @param position - X/Y coordinates
       */
      addFieldWithDefaults: (pdfFileId, inputType, pageNumber, position) => {
        const { fields } = get();
        const defaults = FIELD_DEFAULTS[inputType] || FIELD_DEFAULTS.TEXT;
        // Calculate max zIndex for this page
        const pageFields = fields.filter(f => f.pageNumber === pageNumber);
        const maxZIndex = pageFields.reduce((max, f) => Math.max(max, f.zIndex || 0), 0);
        
        const newField: PdfInput = {
          id: crypto.randomUUID(),
          pdfFileId,
          slug: `${inputType.toLowerCase()}_${Date.now()}`,
          label: `${inputType.charAt(0) + inputType.slice(1).toLowerCase()} Field`,
          inputType,
          pageNumber,
          xCoord: position.x,
          yCoord: position.y,
          width: defaults.width,
          height: defaults.height,
          fontSize: defaults.fontSize,
          fontFamily: FONT_CONFIG.DEFAULT_FAMILY,
          fontWeight: FONT_CONFIG.DEFAULT_WEIGHT,
          fontStyle: FONT_CONFIG.DEFAULT_STYLE,
          textAlign: FONT_CONFIG.DEFAULT_ALIGN,
          textColor: FONT_CONFIG.DEFAULT_COLOR,
          iconVariant: inputType === 'ICON' ? 'CHECK' : null,
          iconColor: inputType === 'ICON' ? '#000000' : null,
          defaultVisible: inputType === 'ICON' ? false : null,
          zIndex: maxZIndex + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          fields: [...state.fields, newField],
          selectedFieldId: newField.id,
        }));
      },

      /**
       * Update a field's properties
       * @param id - Field ID to update
       * @param updates - Partial field updates
       */
      updateField: (id, updates) =>
        set((state) => ({
          fields: state.fields.map((field) =>
            field.id === id
              ? { ...field, ...updates, updatedAt: new Date() }
              : field
          ),
        })),

      /**
       * Delete a field
       * @param id - Field ID to delete
       */
      deleteField: (id) =>
        set((state) => ({
          fields: state.fields.filter((field) => field.id !== id),
          selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
        })),

      /**
       * Duplicate a field
       * @param id - Field ID to duplicate
       */
      duplicateField: (id) => {
        const { fields } = get();
        const fieldToDuplicate = fields.find((f) => f.id === id);
        
        if (fieldToDuplicate) {
          const newField: PdfInput = {
            ...fieldToDuplicate,
            id: crypto.randomUUID(),
            slug: `${fieldToDuplicate.slug}_copy_${Date.now()}`,
            xCoord: fieldToDuplicate.xCoord + 20,
            yCoord: fieldToDuplicate.yCoord + 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            fields: [...state.fields, newField],
            selectedFieldId: newField.id,
          }));
        }
      },

      /**
       * Select a field
       * @param id - Field ID to select, or null to deselect
       */
      selectField: (id) => set({ selectedFieldId: id }),

      // -----------------------------------------------------------------------
      // Z-Index / Layer Actions
      // -----------------------------------------------------------------------

      /**
       * Bring a field to the front (highest z-index on its page)
       * @param id - Field ID to bring to front
       */
      bringToFront: (id) => {
        const { fields } = get();
        const field = fields.find(f => f.id === id);
        if (!field) return;
        
        const pageFields = fields.filter(f => f.pageNumber === field.pageNumber);
        const maxZIndex = pageFields.reduce((max, f) => Math.max(max, f.zIndex || 0), 0);
        
        set((state) => ({
          fields: state.fields.map(f => 
            f.id === id ? { ...f, zIndex: maxZIndex + 1, updatedAt: new Date() } : f
          ),
        }));
      },

      /**
       * Send a field to the back (lowest z-index on its page)
       * @param id - Field ID to send to back
       */
      sendToBack: (id) => {
        const { fields } = get();
        const field = fields.find(f => f.id === id);
        if (!field) return;
        
        const pageFields = fields.filter(f => f.pageNumber === field.pageNumber);
        const minZIndex = pageFields.reduce((min, f) => Math.min(min, f.zIndex || 0), 0);
        
        set((state) => ({
          fields: state.fields.map(f => 
            f.id === id ? { ...f, zIndex: minZIndex - 1, updatedAt: new Date() } : f
          ),
        }));
      },

      /**
       * Bring a field forward by one layer
       * @param id - Field ID to bring forward
       */
      bringForward: (id) => {
        const { fields } = get();
        const field = fields.find(f => f.id === id);
        if (!field) return;
        
        const currentZIndex = field.zIndex || 0;
        const pageFields = fields.filter(f => f.pageNumber === field.pageNumber && f.id !== id);
        
        // Find the next higher z-index
        const higherFields = pageFields.filter(f => (f.zIndex || 0) > currentZIndex);
        if (higherFields.length === 0) return; // Already at front
        
        const nextZIndex = Math.min(...higherFields.map(f => f.zIndex || 0));
        
        set((state) => ({
          fields: state.fields.map(f => 
            f.id === id ? { ...f, zIndex: nextZIndex + 1, updatedAt: new Date() } : f
          ),
        }));
      },

      /**
       * Send a field backward by one layer
       * @param id - Field ID to send backward
       */
      sendBackward: (id) => {
        const { fields } = get();
        const field = fields.find(f => f.id === id);
        if (!field) return;
        
        const currentZIndex = field.zIndex || 0;
        const pageFields = fields.filter(f => f.pageNumber === field.pageNumber && f.id !== id);
        
        // Find the next lower z-index
        const lowerFields = pageFields.filter(f => (f.zIndex || 0) < currentZIndex);
        if (lowerFields.length === 0) return; // Already at back
        
        const prevZIndex = Math.max(...lowerFields.map(f => f.zIndex || 0));
        
        set((state) => ({
          fields: state.fields.map(f => 
            f.id === id ? { ...f, zIndex: prevZIndex - 1, updatedAt: new Date() } : f
          ),
        }));
      },

      /**
       * Reorder fields on a page based on drag-and-drop order
       * @param pageNumber - Page number
       * @param orderedIds - Array of field IDs in new order (first = back, last = front)
       */
      reorderFields: (pageNumber, orderedIds) => {
        set((state) => ({
          fields: state.fields.map(f => {
            if (f.pageNumber !== pageNumber) return f;
            const newIndex = orderedIds.indexOf(f.id);
            if (newIndex === -1) return f;
            return { ...f, zIndex: newIndex, updatedAt: new Date() };
          }),
        }));
      },

      // -----------------------------------------------------------------------
      // Tool Actions (MS Word/Paint-like click-to-place)
      // -----------------------------------------------------------------------

      /**
       * Set the active tool for click-to-place
       * @param tool - Tool configuration or null to deselect
       */
      setActiveTool: (tool) => set({ 
        activeTool: tool,
        selectedFieldId: null // Deselect any field when selecting a tool
      }),

      /**
       * Clear the active tool
       */
      clearActiveTool: () => set({ activeTool: null }),

      /**
       * Add a field at a specific position using the active tool
       * @param position - X/Y coordinates where user clicked
       */
      addFieldAtPosition: (position) => {
        const { activeTool, currentPdf, currentPage, fields } = get();
        
        if (!activeTool || !currentPdf) return;
        
        const defaults = FIELD_DEFAULTS[activeTool.type] || FIELD_DEFAULTS.TEXT;
        
        // Calculate max zIndex for this page
        const pageFields = fields.filter(f => f.pageNumber === currentPage);
        const maxZIndex = pageFields.reduce((max, f) => Math.max(max, f.zIndex || 0), 0);
        
        const newField: PdfInput = {
          id: crypto.randomUUID(),
          pdfFileId: currentPdf.id,
          slug: `${activeTool.type.toLowerCase()}_${Date.now()}`,
          label: activeTool.type === 'ICON' 
            ? `${activeTool.iconVariant || 'CHECK'} Icon` 
            : `${activeTool.type.charAt(0) + activeTool.type.slice(1).toLowerCase()} Field`,
          inputType: activeTool.type,
          pageNumber: currentPage,
          xCoord: position.x,
          yCoord: position.y,
          width: defaults.width,
          height: defaults.height,
          fontSize: defaults.fontSize,
          fontFamily: FONT_CONFIG.DEFAULT_FAMILY,
          fontWeight: FONT_CONFIG.DEFAULT_WEIGHT,
          fontStyle: FONT_CONFIG.DEFAULT_STYLE,
          textAlign: FONT_CONFIG.DEFAULT_ALIGN,
          textColor: FONT_CONFIG.DEFAULT_COLOR,
          iconVariant: activeTool.type === 'ICON' ? (activeTool.iconVariant || 'CHECK') : null,
          iconColor: activeTool.type === 'ICON' ? (activeTool.iconColor || '#000000') : null,
          defaultVisible: activeTool.type === 'ICON' ? false : null,
          zIndex: maxZIndex + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          fields: [...state.fields, newField],
          selectedFieldId: newField.id,
          // Clear the active tool after placing - single placement mode
          activeTool: null,
        }));
      },

      // -----------------------------------------------------------------------
      // UI Actions
      // -----------------------------------------------------------------------

      /**
       * Set loading state
       * @param loading - Whether loading is in progress
       */
      setLoading: (loading) => set({ isLoading: loading }),

      /**
       * Set error message
       * @param error - Error message or null to clear
       */
      setError: (error) => set({ error }),

      /**
       * Set zoom level
       * @param zoom - Zoom factor (1 = 100%)
       */
      setZoom: (zoom) => set({ zoom }),

      /**
       * Set preview mode
       * @param isPreview - Whether preview mode is active
       */
      setPreviewMode: (isPreview) => set({ isPreviewMode: isPreview }),

      /**
       * Toggle field borders visibility
       */
      toggleFieldBorders: () => set((state) => ({ showFieldBorders: !state.showFieldBorders })),

      /**
       * Set field borders visibility
       * @param show - Whether to show field borders
       */
      setFieldBorders: (show) => set({ showFieldBorders: show }),

      /**
       * Set which field type to highlight
       * @param type - InputType to highlight, 'ALL' for all types, or null for none
       */
      setHighlightFieldType: (type) => set({ highlightFieldType: type }),

      /**
       * Toggle highlight all fields mode (Cmd+Shift+H)
       */
      toggleHighlightAll: () => set((state) => ({ 
        highlightFieldType: state.highlightFieldType === 'ALL' ? null : 'ALL' 
      })),

      /**
       * Reset store to initial state
       */
      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEYS.EDITOR_STATE,
      storage: createJSONStorage(() => localStorage),
      // Persist all essential state including URL-imported PDFs
      // The app will re-validate URL-imported PDFs on page load if fileUrl param exists
      partialize: (state) => ({
        currentPdf: state.currentPdf,
        isImportedViaUrl: state.isImportedViaUrl,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        // Fields are always synced to database, so we can persist them
        // They'll be loaded from DB when PDF is loaded
        fields: state.fields,
        zoom: state.zoom,
      }),
    }
  )
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selectors for derived state
 * @description Use these for performance optimization to prevent unnecessary re-renders
 * 
 * @example
 * ```tsx
 * const selectedField = useEditorStore(selectors.selectedField);
 * const currentPageFields = useEditorStore(selectors.currentPageFields);
 * ```
 */
export const selectors = {
  /** Get the currently selected field */
  selectedField: (state: EditorState) =>
    state.fields.find((f) => f.id === state.selectedFieldId) || null,

  /** Get fields for the current page */
  currentPageFields: (state: EditorState) =>
    state.fields.filter((f) => f.pageNumber === state.currentPage),

  /** Get fields grouped by page */
  fieldsByPage: (state: EditorState) =>
    state.fields.reduce(
      (acc, field) => {
        const page = field.pageNumber;
        if (!acc[page]) acc[page] = [];
        acc[page].push(field);
        return acc;
      },
      {} as Record<number, PdfInput[]>
    ),

  /** Get field count */
  fieldCount: (state: EditorState) => state.fields.length,

  /** Get fields by type */
  fieldsByType: (state: EditorState, type: InputType) =>
    state.fields.filter((f) => f.inputType === type),

  /** Check if there are unsaved changes */
  hasFields: (state: EditorState) => state.fields.length > 0,

  /** Check if PDF is loaded */
  hasPdf: (state: EditorState) => state.currentPdf !== null,

  /** Check if a tool is active */
  hasActiveTool: (state: EditorState) => state.activeTool !== null,

  /** Get the active tool */
  activeTool: (state: EditorState) => state.activeTool,

  /** Get navigation state */
  navigation: (state: EditorState) => ({
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    hasNext: state.currentPage < state.totalPages,
    hasPrev: state.currentPage > 1,
  }),
};
