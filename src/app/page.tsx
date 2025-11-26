'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEditorStore } from '@/lib/store';
import { useFieldSync } from '@/hooks/use-field-sync';
import { PDFUploader } from '@/components/pdf/PDFUploader';
import { PDFCanvas } from '@/components/pdf/PDFCanvas';
import { Sidebar } from '@/components/pdf/Sidebar';
import { PageThumbnailSidebar } from '@/components/pdf/PageThumbnailSidebar';
import { FileText, ArrowLeft, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PdfInput } from '@/lib/types';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'api_key';
const FIELDS_BACKUP_KEY = 'pdf-editor-fields-backup';

/**
 * Load fields backup from localStorage
 */
function loadFieldsFromLocalStorage(pdfId: string): PdfInput[] | null {
  try {
    const data = localStorage.getItem(`${FIELDS_BACKUP_KEY}-${pdfId}`);
    if (data) {
      const backup = JSON.parse(data);
      // Only use backup if it's less than 24 hours old
      if (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000) {
        console.log(`[Backup] Found ${backup.fields.length} fields in localStorage`);
        return backup.fields;
      }
    }
  } catch (error) {
    console.error('[Backup] Failed to load from localStorage:', error);
  }
  return null;
}

export default function Home() {
  const searchParams = useSearchParams();
  const { currentPdf, setPdf, setFields, reset } = useEditorStore();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState<string | null>(null);
  const hasCheckedExisting = useRef(false);
  const hasLoadedFields = useRef(false);

  // Sync fields to database when they change (with localStorage backup)
  useFieldSync();

  // Load fields from database for a PDF, with localStorage fallback
  const loadFieldsFromDatabase = useCallback(async (pdfId: string) => {
    // Prevent duplicate loading
    if (hasLoadedFields.current) return;
    hasLoadedFields.current = true;

    try {
      const response = await fetch(`/api/inputs/${pdfId}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      const data = await response.json();
      let dbFields: PdfInput[] = [];

      if (data.success && data.data && data.data.length > 0) {
        // Transform database fields to match store format
        dbFields = data.data.map((input: Record<string, unknown>) => ({
          id: input.id,
          pdfFileId: input.pdfFileId,
          slug: input.slug,
          label: input.label,
          inputType: input.inputType,
          pageNumber: input.pageNumber,
          xCoord: input.xCoord,
          yCoord: input.yCoord,
          width: input.width,
          height: input.height,
          fontSize: input.fontSize,
          fontFamily: input.fontFamily,
          fontWeight: input.fontWeight,
          fontStyle: input.fontStyle,
          textAlign: input.textAlign,
          textColor: input.textColor,
          iconVariant: input.iconVariant,
          iconColor: input.iconColor,
          defaultVisible: input.defaultVisible,
          createdAt: new Date(input.createdAt as string),
          updatedAt: new Date(input.updatedAt as string),
        }));
      }

      // Check localStorage for backup (may have unsaved changes)
      const localBackup = loadFieldsFromLocalStorage(pdfId);

      // Use whichever has more fields (localStorage backup may have unsaved work)
      if (localBackup && localBackup.length > dbFields.length) {
        console.log(`[Fields] Using localStorage backup (${localBackup.length} fields) over DB (${dbFields.length} fields)`);
        setFields(localBackup);
      } else if (dbFields.length > 0) {
        console.log(`[Fields] Loaded ${dbFields.length} fields from database`);
        setFields(dbFields);
      } else if (localBackup && localBackup.length > 0) {
        console.log(`[Fields] Using localStorage backup (${localBackup.length} fields), DB was empty`);
        setFields(localBackup);
      } else {
        console.log('[Fields] No fields found in database or localStorage');
      }
    } catch (error) {
      console.error('Failed to load fields from database:', error);
      
      // On database error, try localStorage backup
      const localBackup = loadFieldsFromLocalStorage(pdfId);
      if (localBackup && localBackup.length > 0) {
        console.log(`[Fields] Database failed, using localStorage backup (${localBackup.length} fields)`);
        setFields(localBackup);
      }
    }
  }, [setFields]);

  // Check if PDF already exists in database
  const checkExistingPdf = useCallback(async (url: string): Promise<{ found: boolean; data?: Record<string, unknown> }> => {
    try {
      const response = await fetch(`/api/pdf/find-by-url?url=${encodeURIComponent(url)}`, {
        headers: {
          'x-api-key': API_KEY,
        },
      });

      const data = await response.json();

      if (data.success && data.found && data.data) {
        return { found: true, data: data.data };
      }
      return { found: false };
    } catch (error) {
      console.error('Failed to check existing PDF:', error);
      return { found: false };
    }
  }, []);

  // Check for fileUrl parameter and auto-import PDF (or load existing)
  useEffect(() => {
    const fileUrl = searchParams.get('fileUrl');
    const fileName = searchParams.get('fileName');
    
    if (fileUrl && !currentPdf && !isImporting && !hasCheckedExisting.current) {
      hasCheckedExisting.current = true;
      setImportUrl(fileUrl);
      importPdfFromUrl(fileUrl, fileName);
    }
  }, [searchParams, currentPdf, isImporting]);

  // Clear state when fileUrl parameter is removed from URL (for URL-imported PDFs only)
  useEffect(() => {
    const fileUrl = searchParams.get('fileUrl');
    
    // If there's no fileUrl in URL but we have an importUrl (meaning PDF was imported via URL)
    // and we have a currentPdf, then the URL parameter was removed - clear state
    if (!fileUrl && importUrl && currentPdf) {
      console.log('[PDF] URL parameter removed, clearing imported PDF state');
      setImportUrl(null);
      hasCheckedExisting.current = false;
      hasLoadedFields.current = false;
      reset();
    }
  }, [searchParams, importUrl, currentPdf, reset]);

  // Load fields when currentPdf changes (either from localStorage or after import)
  useEffect(() => {
    if (currentPdf?.id) {
      // Reset the flag when PDF ID changes to allow loading for new PDFs
      hasLoadedFields.current = false;
      loadFieldsFromDatabase(currentPdf.id);
    }
  }, [currentPdf?.id, loadFieldsFromDatabase]);

  const importPdfFromUrl = async (url: string, customFileName?: string | null) => {
    setIsImporting(true);
    setImportError(null);

    try {
      // First check if PDF already exists in database
      const existing = await checkExistingPdf(url);

      if (existing.found && existing.data) {
        console.log('[PDF] Found existing PDF, loading from database');
        // Use existing PDF - no need to re-import
        // Mark as imported via URL so it won't persist to localStorage
        setPdf({
          id: existing.data.id as string,
          fileName: existing.data.fileName as string,
          filePath: existing.data.filePath as string,
          pageCount: existing.data.pageCount as number,
          fileSize: existing.data.fileSize as number,
          createdAt: new Date(existing.data.createdAt as string),
          updatedAt: new Date(existing.data.updatedAt as string),
        }, true); // true = isImportedViaUrl
        // Fields will be loaded by the useEffect above
        setIsImporting(false);
        return;
      }

      // PDF doesn't exist, import it
      console.log('[PDF] Importing new PDF from URL');
      const response = await fetch('/api/pdf/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ 
          url,
          fileName: customFileName || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Set the PDF in store - mark as imported via URL
        setPdf({
          id: data.data.id,
          fileName: data.data.fileName,
          filePath: data.data.filePath,
          pageCount: data.data.pageCount,
          fileSize: data.data.fileSize,
          createdAt: new Date(),
          updatedAt: new Date(),
        }, true); // true = isImportedViaUrl
      } else {
        setImportError(data.error || 'Failed to import PDF from URL');
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportError('Failed to connect to server. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Show loading state while importing from URL
  if (isImporting) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-surface p-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative p-6 bg-primary/10 rounded-full">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Importing PDF...</h2>
            <p className="text-muted-foreground max-w-md">
              Downloading and processing your PDF from the provided URL
            </p>
            {importUrl && (
              <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                  {importUrl}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Show error state if import failed
  if (importError) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-surface p-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Import Failed</h2>
            <p className="text-muted-foreground">{importError}</p>
            {importUrl && (
              <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {importUrl}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setImportError(null);
                setImportUrl(null);
                // Clear URL params
                window.history.replaceState({}, '', '/');
              }}
            >
              Upload Manually
            </Button>
            {importUrl && (
              <Button
                onClick={() => importPdfFromUrl(importUrl)}
              >
                Try Again
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!currentPdf) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-surface p-4 relative overflow-hidden">
        {/* Subtle decorative pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[size:32px_32px] opacity-30" />
        <div className="absolute h-full w-full bg-gradient-to-b from-surface via-surface to-background" />

        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-4xl">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
              PDF Field Editor
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform static PDFs into dynamic forms. Drag, drop, and configure fields with pixel-perfect precision.
            </p>
          </div>

          <PDFUploader />
          
          {/* URL Import hint */}
          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>
              💡 <strong className="text-foreground">Tip:</strong> You can also import a PDF via URL by adding{' '}
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border border-border">?fileUrl=YOUR_PDF_URL</code>{' '}
              to the page URL
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header - Clean minimalistic design */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur-sm z-50">
        <div className="flex items-center gap-4">
          {/* Hide Back button if PDF was imported via URL to prevent navigation issues */}
          {!importUrl && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                  window.history.replaceState({}, '', '/');
                }}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
            </>
          )}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium text-sm truncate max-w-[200px] text-foreground">
              {currentPdf.fileName}
            </span>
            {/* Show imported badge when loaded from URL */}
            {importUrl && (
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                Imported
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="border-border hover:bg-muted">
            <a href={`/fill/${currentPdf.id}`} target="_blank" rel="noopener noreferrer">
              Preview Form
            </a>
          </Button>
        </div>
      </header>

      {/* Editor Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Page Thumbnails */}
        <PageThumbnailSidebar />
        
        {/* Main PDF Canvas */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          <PDFCanvas />
        </div>
        
        {/* Right Sidebar - Field Tools */}
        <Sidebar />
      </div>
    </main>
  );
}
