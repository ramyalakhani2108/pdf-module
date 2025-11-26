/**
 * @fileoverview Robust Field Sync Hook
 * @description Implements a multi-layer persistence strategy:
 * 1. Immediate localStorage save (survives connection issues/page refresh)
 * 2. Debounced database sync (for permanent storage)
 * 3. Automatic retry on connection recovery
 * 4. Proper deletion handling
 */

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/lib/store';
import type { PdfInput } from '@/lib/types';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'api_key';
const DEBOUNCE_MS = 800; // Debounce for DB sync
const RETRY_DELAY_MS = 3000; // Retry delay on failure
const MAX_RETRIES = 3;
const PENDING_SYNC_KEY = 'pdf-editor-pending-sync';
const FIELDS_BACKUP_KEY = 'pdf-editor-fields-backup';

interface PendingSyncData {
  pdfId: string;
  fields: PdfInput[];
  timestamp: number;
  retryCount: number;
}

/**
 * Get field signature for comparison (to detect actual changes)
 */
function getFieldsSignature(fields: PdfInput[]): string {
  return JSON.stringify(
    fields
      .map(f => ({
        id: f.id,
        slug: f.slug,
        xCoord: Math.round(f.xCoord * 100) / 100,
        yCoord: Math.round(f.yCoord * 100) / 100,
        width: Math.round(f.width * 100) / 100,
        height: Math.round(f.height * 100) / 100,
        pageNumber: f.pageNumber,
        label: f.label,
        inputType: f.inputType,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

/**
 * Save fields backup to localStorage (immediate, survives refresh)
 */
function saveFieldsToLocalStorage(pdfId: string, fields: PdfInput[]): void {
  try {
    const backup = {
      pdfId,
      fields,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${FIELDS_BACKUP_KEY}-${pdfId}`, JSON.stringify(backup));
    console.log(`[Backup] Saved ${fields.length} fields to localStorage`);
  } catch (error) {
    console.error('[Backup] Failed to save to localStorage:', error);
  }
}

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
        console.log(`[Backup] Loaded ${backup.fields.length} fields from localStorage`);
        return backup.fields;
      }
    }
  } catch (error) {
    console.error('[Backup] Failed to load from localStorage:', error);
  }
  return null;
}

/**
 * Clear fields backup from localStorage (after successful DB sync)
 */
function clearFieldsBackup(pdfId: string): void {
  try {
    localStorage.removeItem(`${FIELDS_BACKUP_KEY}-${pdfId}`);
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch (error) {
    console.error('[Backup] Failed to clear localStorage:', error);
  }
}

/**
 * Mark sync as pending (for retry on reconnection)
 */
function markSyncPending(pdfId: string, fields: PdfInput[], retryCount = 0): void {
  try {
    const pending: PendingSyncData = {
      pdfId,
      fields,
      timestamp: Date.now(),
      retryCount,
    };
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('[Sync] Failed to mark pending:', error);
  }
}

/**
 * Get pending sync data
 */
function getPendingSync(): PendingSyncData | null {
  try {
    const data = localStorage.getItem(PENDING_SYNC_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Sync] Failed to get pending sync:', error);
  }
  return null;
}

/**
 * Hook to sync fields to database with offline support
 * @description Watches for field changes and saves to both localStorage and database
 */
export function useFieldSync() {
  const fields = useEditorStore((state) => state.fields);
  const currentPdf = useEditorStore((state) => state.currentPdf);
  const setFields = useEditorStore((state) => state.setFields);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSignatureRef = useRef<string>('');
  const lastDbSyncSignatureRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const isSyncingRef = useRef(false);

  /**
   * Save fields to database with retry logic
   */
  const saveFieldsToDatabase = useCallback(async (
    pdfId: string, 
    fieldsToSave: PdfInput[],
    retryCount = 0
  ): Promise<boolean> => {
    if (isSyncingRef.current) {
      console.log('[Sync] Already syncing, skipping...');
      return false;
    }

    isSyncingRef.current = true;

    try {
      // Transform fields to match API format
      const inputs = fieldsToSave.map((field) => ({
        slug: field.slug,
        label: field.label,
        inputType: field.inputType,
        pageNumber: field.pageNumber,
        xCoord: field.xCoord,
        yCoord: field.yCoord,
        width: field.width,
        height: field.height,
        fontSize: field.fontSize,
        fontFamily: field.fontFamily,
        fontWeight: field.fontWeight,
        fontStyle: field.fontStyle,
        textAlign: field.textAlign,
        textColor: field.textColor,
        iconVariant: field.iconVariant,
        iconColor: field.iconColor,
        defaultVisible: field.defaultVisible,
      }));

      const response = await fetch('/api/inputs/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({
          pdfFileId: pdfId,
          inputs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`[Sync] ✓ Saved ${inputs.length} fields to database`);
        lastDbSyncSignatureRef.current = getFieldsSignature(fieldsToSave);
        // Clear pending sync and backup after successful save
        clearFieldsBackup(pdfId);
        isSyncingRef.current = false;
        return true;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Sync] ✗ Failed to save to database:', error);
      
      // Mark as pending for retry
      if (retryCount < MAX_RETRIES) {
        markSyncPending(pdfId, fieldsToSave, retryCount + 1);
        console.log(`[Sync] Will retry (${retryCount + 1}/${MAX_RETRIES}) in ${RETRY_DELAY_MS}ms`);
        
        // Schedule retry
        retryTimeoutRef.current = setTimeout(() => {
          saveFieldsToDatabase(pdfId, fieldsToSave, retryCount + 1);
        }, RETRY_DELAY_MS);
      } else {
        console.error('[Sync] Max retries reached. Data is saved in localStorage.');
      }
      
      isSyncingRef.current = false;
      return false;
    }
  }, []);

  /**
   * Handle field changes - save to localStorage immediately, debounce DB sync
   */
  const handleFieldsChange = useCallback((pdfId: string, newFields: PdfInput[]) => {
    const currentSignature = getFieldsSignature(newFields);
    
    // Skip if nothing changed
    if (currentSignature === lastSavedSignatureRef.current) {
      return;
    }
    
    lastSavedSignatureRef.current = currentSignature;
    
    // IMMEDIATE: Save to localStorage (survives refresh/connection loss)
    saveFieldsToLocalStorage(pdfId, newFields);
    
    // DEBOUNCED: Sync to database
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      // Only sync if signature still matches (no newer changes)
      if (getFieldsSignature(newFields) === currentSignature) {
        saveFieldsToDatabase(pdfId, newFields);
      }
    }, DEBOUNCE_MS);
  }, [saveFieldsToDatabase]);

  // Initialize and check for pending syncs or backups
  useEffect(() => {
    if (!currentPdf?.id || isInitializedRef.current) return;
    
    isInitializedRef.current = true;
    
    // Check for pending sync from previous session
    const pendingSync = getPendingSync();
    if (pendingSync && pendingSync.pdfId === currentPdf.id) {
      console.log('[Sync] Found pending sync from previous session, retrying...');
      saveFieldsToDatabase(currentPdf.id, pendingSync.fields, pendingSync.retryCount);
    }
    
    // Initialize signatures
    lastSavedSignatureRef.current = getFieldsSignature(fields);
    lastDbSyncSignatureRef.current = lastSavedSignatureRef.current;
  }, [currentPdf?.id, fields, saveFieldsToDatabase]);

  // Watch for field changes
  useEffect(() => {
    if (!currentPdf?.id || !isInitializedRef.current) return;
    
    handleFieldsChange(currentPdf.id, fields);
  }, [fields, currentPdf?.id, handleFieldsChange]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Sync] Connection restored, checking for pending syncs...');
      const pendingSync = getPendingSync();
      if (pendingSync && currentPdf?.id === pendingSync.pdfId) {
        saveFieldsToDatabase(pendingSync.pdfId, pendingSync.fields, 0);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentPdf?.id, saveFieldsToDatabase]);

  // Handle page unload - ensure data is saved
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentPdf?.id && fields.length > 0) {
        saveFieldsToLocalStorage(currentPdf.id, fields);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentPdf?.id, fields]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // Return utility functions for manual control if needed
  return {
    forceSave: useCallback(() => {
      if (currentPdf?.id) {
        saveFieldsToDatabase(currentPdf.id, fields);
      }
    }, [currentPdf?.id, fields, saveFieldsToDatabase]),
    
    loadBackup: useCallback(() => {
      if (currentPdf?.id) {
        const backup = loadFieldsFromLocalStorage(currentPdf.id);
        if (backup) {
          setFields(backup);
          return true;
        }
      }
      return false;
    }, [currentPdf?.id, setFields]),
  };
}
