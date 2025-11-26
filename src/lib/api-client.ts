/**
 * @fileoverview API Service Layer
 * @description Centralized API client with type-safe requests and responses.
 * Provides a single source of truth for all API interactions.
 */

import { API_CONFIG, ERROR_MESSAGES } from './constants';
import type {
  UploadResponse,
  FillPdfRequest,
  FillPdfResponse,
  SaveInputsResponse,
  SignatureUploadResponse,
} from './schemas';
import type { PdfInput } from './types';

// =============================================================================
// API CLIENT CONFIGURATION
// =============================================================================

/**
 * Base configuration for API requests
 */
interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * API response wrapper
 */
interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// =============================================================================
// API CLIENT CLASS
// =============================================================================

/**
 * PDF Module API Client
 * @description Handles all API requests with proper error handling and typing
 * 
 * @example
 * ```typescript
 * const api = new PdfApiClient({ apiKey: 'your-api-key' });
 * const result = await api.uploadPdf(file);
 * if (result.error) {
 *   console.error(result.error);
 * } else {
 *   console.log(result.data);
 * }
 * ```
 */
export class PdfApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ApiConfig = {}) {
    this.baseUrl = config.baseUrl || '';
    this.apiKey = config.apiKey || API_CONFIG.DEV_API_KEY;
  }

  /**
   * Set the API key
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(contentType?: string): HeadersInit {
    const headers: HeadersInit = {
      [API_CONFIG.API_KEY_HEADER]: this.apiKey,
    };
    
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    return headers;
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResult<T>> {
    try {
      const data = await response.json();
      
      if (!response.ok) {
        return {
          data: null,
          error: data.error || `Request failed with status ${response.status}`,
          status: response.status,
        };
      }
      
      return {
        data: data as T,
        error: null,
        status: response.status,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        status: response.status,
      };
    }
  }

  // ===========================================================================
  // PDF OPERATIONS
  // ===========================================================================

  /**
   * Upload a PDF file
   * @param file - PDF file to upload
   * @returns Upload response with file metadata
   */
  async uploadPdf(file: File): Promise<ApiResult<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/api/pdf/upload`, {
        method: 'POST',
        headers: {
          [API_CONFIG.API_KEY_HEADER]: this.apiKey,
        },
        body: formData,
      });

      return this.handleResponse<UploadResponse>(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UPLOAD_FAILED,
        status: 0,
      };
    }
  }

  /**
   * Get all uploaded PDFs
   * @returns List of PDF files
   */
  async getPdfs(): Promise<ApiResult<{ success: boolean; data: any[] }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pdf/upload`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch PDFs',
        status: 0,
      };
    }
  }

  /**
   * Fill a PDF with provided values
   * @param request - Fill request with PDF ID and field values
   * @returns Filled PDF as base64
   */
  async fillPdf(request: FillPdfRequest): Promise<ApiResult<FillPdfResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pdf/fill`, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify(request),
      });

      return this.handleResponse<FillPdfResponse>(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.FILL_FAILED,
        status: 0,
      };
    }
  }

  // ===========================================================================
  // INPUT OPERATIONS
  // ===========================================================================

  /**
   * Save input fields for a PDF
   * @param pdfFileId - PDF file ID
   * @param inputs - Array of input fields
   * @returns Save result with count
   */
  async saveInputs(pdfFileId: string, inputs: PdfInput[]): Promise<ApiResult<SaveInputsResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inputs/save`, {
        method: 'POST',
        headers: this.getHeaders('application/json'),
        body: JSON.stringify({ pdfFileId, inputs }),
      });

      return this.handleResponse<SaveInputsResponse>(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.SAVE_FAILED,
        status: 0,
      };
    }
  }

  /**
   * Get input fields for a PDF
   * @param pdfId - PDF file ID
   * @returns Array of input fields
   */
  async getInputs(pdfId: string): Promise<ApiResult<{ success: boolean; data: PdfInput[] }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inputs/${pdfId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch inputs',
        status: 0,
      };
    }
  }

  // ===========================================================================
  // SIGNATURE OPERATIONS
  // ===========================================================================

  /**
   * Upload a signature or image
   * @param file - Image file to upload
   * @param uploadedBy - Optional uploader identifier
   * @returns Upload response with base64 data
   */
  async uploadSignature(
    file: File,
    uploadedBy?: string
  ): Promise<ApiResult<SignatureUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    if (uploadedBy) {
      formData.append('uploadedBy', uploadedBy);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/signature/upload`, {
        method: 'POST',
        headers: {
          [API_CONFIG.API_KEY_HEADER]: this.apiKey,
        },
        body: formData,
      });

      return this.handleResponse<SignatureUploadResponse>(response);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : ERROR_MESSAGES.UPLOAD_FAILED,
        status: 0,
      };
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Default API client instance
 * @description Use this for standard API operations throughout the app
 */
export const pdfApi = new PdfApiClient();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Download a PDF from base64 data
 * @param base64 - Base64 encoded PDF data
 * @param filename - Download filename
 */
export function downloadPdfFromBase64(base64: string, filename: string): void {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Convert file to base64 string
 * @param file - File to convert
 * @returns Promise resolving to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
