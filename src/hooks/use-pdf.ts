/**
 * @fileoverview PDF-related custom hooks
 * @description Reusable hooks for PDF operations including upload, fill, and form handling
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { pdfApi, downloadPdfFromBase64 } from '@/lib/api-client';
import { useEditorStore } from '@/lib/store';
import { PDF_CONFIG, UI_CONFIG, ERROR_MESSAGES } from '@/lib/constants';
import type { PdfInput, FillPdfRequest } from '@/lib/types';
import type { PdfFile } from '@/lib/types';

// =============================================================================
// PDF UPLOAD HOOK
// =============================================================================

/**
 * Hook for handling PDF file uploads
 * @returns Upload state and handlers
 * 
 * @example
 * ```tsx
 * const { upload, uploading, error, reset } = usePdfUpload();
 * 
 * const handleFile = async (file: File) => {
 *   const result = await upload(file);
 *   if (result) console.log('Uploaded:', result.fileName);
 * };
 * ```
 */
export function usePdfUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPdf = useEditorStore((state) => state.setPdf);

  const upload = useCallback(async (file: File) => {
    // Validate file type
    if (file.type !== PDF_CONFIG.MIME_TYPE) {
      setError(ERROR_MESSAGES.INVALID_FILE_TYPE);
      return null;
    }

    // Validate file size
    if (file.size > PDF_CONFIG.MAX_FILE_SIZE) {
      setError(ERROR_MESSAGES.FILE_TOO_LARGE);
      return null;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await pdfApi.uploadPdf(file);

      if (result.error) {
        setError(result.error);
        return null;
      }

      if (result.data?.data) {
        // Construct full PdfFile with timestamps
        const pdfFile: PdfFile = {
          id: result.data.data.id,
          fileName: result.data.data.fileName,
          filePath: result.data.data.filePath,
          pageCount: result.data.data.pageCount,
          fileSize: result.data.data.fileSize,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setPdf(pdfFile);
        return pdfFile;
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.UPLOAD_FAILED;
      setError(message);
      return null;
    } finally {
      setUploading(false);
    }
  }, [setPdf]);

  const reset = useCallback(() => {
    setError(null);
    setUploading(false);
  }, []);

  return {
    upload,
    uploading,
    error,
    reset,
  };
}

// =============================================================================
// PDF FILL HOOK
// =============================================================================

/**
 * Hook for filling and downloading PDF forms
 * @returns Fill state and handlers
 * 
 * @example
 * ```tsx
 * const { fill, filling, error } = usePdfFill();
 * 
 * const handleSubmit = async () => {
 *   await fill({
 *     pdfFileId: 'abc-123',
 *     values: { name: 'John', email: 'john@example.com' }
 *   });
 * };
 * ```
 */
export function usePdfFill() {
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fill = useCallback(async (
    request: FillPdfRequest,
    filename: string = 'filled_document.pdf'
  ) => {
    setFilling(true);
    setError(null);

    try {
      const result = await pdfApi.fillPdf(request);

      if (result.error) {
        setError(result.error);
        return false;
      }

      if (result.data?.pdfBase64) {
        downloadPdfFromBase64(result.data.pdfBase64, filename);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.FILL_FAILED;
      setError(message);
      return false;
    } finally {
      setFilling(false);
    }
  }, []);

  return {
    fill,
    filling,
    error,
  };
}

// =============================================================================
// PDF INPUTS HOOK
// =============================================================================

/**
 * Hook for managing PDF input fields
 * @returns Input management state and handlers
 */
export function usePdfInputs() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentPdf, fields, setFields } = useEditorStore();

  const save = useCallback(async () => {
    if (!currentPdf) {
      setError('No PDF selected');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await pdfApi.saveInputs(currentPdf.id, fields);

      if (result.error) {
        setError(result.error);
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.SAVE_FAILED;
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentPdf, fields]);

  const load = useCallback(async (pdfId: string) => {
    try {
      const result = await pdfApi.getInputs(pdfId);

      if (result.error) {
        setError(result.error);
        return false;
      }

      if (result.data?.data) {
        setFields(result.data.data);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load inputs';
      setError(message);
      return false;
    }
  }, [setFields]);

  return {
    save,
    load,
    saving,
    error,
  };
}

// =============================================================================
// DRAG AND DROP HOOK
// =============================================================================

/**
 * Hook for drag and drop file handling
 * @param onFile - Callback when file is dropped
 * @returns Drag state and event handlers
 * 
 * @example
 * ```tsx
 * const { isDragging, handlers } = useDropzone(handleFile);
 * 
 * <div {...handlers}>
 *   {isDragging ? 'Drop here' : 'Drag file here'}
 * </div>
 * ```
 */
export function useDropzone(onFile: (file: File) => void) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      onFile(files[0]);
    }
  }, [onFile]);

  const handlers = {
    onDragEnter: handleDrag,
    onDragLeave: handleDrag,
    onDragOver: handleDrag,
    onDrop: handleDrop,
  };

  return {
    isDragging,
    handlers,
  };
}

// =============================================================================
// PDF ZOOM HOOK
// =============================================================================

/**
 * Hook for managing PDF zoom level
 * @param initialZoom - Initial zoom level (default: 1)
 * @returns Zoom state and handlers
 */
export function usePdfZoom(initialZoom: number = UI_CONFIG.DEFAULT_ZOOM) {
  const [zoom, setZoom] = useState(initialZoom);
  const [autoZoom, setAutoZoom] = useState<number | null>(null);
  const [stickyZoom, setStickyZoom] = useState(false);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + UI_CONFIG.ZOOM_STEP, UI_CONFIG.MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - UI_CONFIG.ZOOM_STEP, UI_CONFIG.MIN_ZOOM));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(UI_CONFIG.DEFAULT_ZOOM);
    setAutoZoom(null);
    setStickyZoom(false);
  }, []);

  const setTinyFieldZoom = useCallback(() => {
    if (!stickyZoom) {
      setAutoZoom(zoom);
    }
    setZoom(UI_CONFIG.TINY_FIELD_ZOOM);
    setStickyZoom(true);
  }, [zoom, stickyZoom]);

  const exitTinyFieldZoom = useCallback(() => {
    setStickyZoom(false);
    if (autoZoom !== null) {
      setZoom(autoZoom);
      setAutoZoom(null);
    } else {
      setZoom(UI_CONFIG.DEFAULT_ZOOM);
    }
  }, [autoZoom]);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    autoZoom,
    stickyZoom,
    setTinyFieldZoom,
    exitTinyFieldZoom,
  };
}

// =============================================================================
// PDF PAGE NAVIGATION HOOK
// =============================================================================

/**
 * Hook for managing PDF page navigation
 * @param totalPages - Total number of pages
 * @returns Page navigation state and handlers
 */
export function usePdfNavigation(totalPages: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  return {
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
}

// =============================================================================
// FORM VALUES HOOK
// =============================================================================

/**
 * Hook for managing form field values
 * @returns Form values state and handlers
 */
export function useFormValues<T extends Record<string, any>>(initialValues: T = {} as T) {
  const [values, setValues] = useState<T>(initialValues);

  const setValue = useCallback((key: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setMultipleValues = useCallback((newValues: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  const resetValues = useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  const clearValue = useCallback((key: keyof T) => {
    setValues((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest as T;
    });
  }, []);

  return {
    values,
    setValue,
    setMultipleValues,
    resetValues,
    clearValue,
  };
}

// =============================================================================
// KEYBOARD SHORTCUTS HOOK
// =============================================================================

/**
 * Hook for handling keyboard shortcuts
 * @param shortcuts - Map of key combinations to handlers
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Build key combination string
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      
      const combo = parts.join('+');
      
      if (shortcuts[combo]) {
        e.preventDefault();
        shortcuts[combo]();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [shortcuts, enabled]);
}

// =============================================================================
// RESIZE OBSERVER HOOK
// =============================================================================

/**
 * Hook for observing element resize
 * @param callback - Callback when element resizes
 * @returns Ref to attach to element
 */
export function useResizeObserver<T extends HTMLElement>(
  callback: (entry: ResizeObserverEntry) => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        callback(entries[0]);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [callback]);

  return ref;
}
