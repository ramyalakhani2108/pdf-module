/**
 * @fileoverview Utility functions for the PDF Module
 * @description Common utility functions used throughout the application
 * including CSS class merging, formatting, validation, and API response helpers.
 * 
 * NOTE: API authentication functions are in api-auth.ts and should be imported
 * directly from there in API routes to avoid client-side bundling issues.
 */

import { type ClassValue, clsx } from 'clsx';

// =============================================================================
// CSS UTILITIES
// =============================================================================

/**
 * Merge CSS class names using clsx
 * @param inputs - Class values to merge
 * @returns Merged class string
 * 
 * @example
 * ```typescript
 * cn('base-class', isActive && 'active', { 'hidden': !visible })
 * // Returns: "base-class active" (if isActive is true and visible is true)
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 * 
 * @example
 * ```typescript
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 * formatBytes(0) // "0 Bytes"
 * ```
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate a URL-safe slug from a label
 * @param label - String to convert to slug
 * @returns URL-safe slug string
 * 
 * @example
 * ```typescript
 * generateSlug("Full Name") // "full_name"
 * generateSlug("Email Address!") // "email_address"
 * ```
 */
export function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// =============================================================================
// RESPONSE UTILITIES
// =============================================================================

/**
 * Create a standardized error response
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns JSON Response object
 * 
 * @example
 * ```typescript
 * return createErrorResponse('Invalid input', 400);
 * return createErrorResponse('Not found', 404);
 * ```
 */
export function createErrorResponse(message: string, status: number = 400): Response {
  return Response.json(
    { 
      success: false, 
      error: message 
    }, 
    { status }
  );
}

/**
 * Create a standardized success response
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns JSON Response object
 * 
 * @example
 * ```typescript
 * return createSuccessResponse({ id: '123', name: 'test' });
 * return createSuccessResponse({ created: true }, 201);
 * ```
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return Response.json(data, { status });
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Check if a value is a valid PDF file
 * @param file - File to validate
 * @returns True if valid PDF
 */
export function isValidPdf(file: File): boolean {
  return file.type === 'application/pdf';
}

/**
 * Check if a value is a valid image file
 * @param file - File to validate
 * @returns True if valid image (PNG or JPEG)
 */
export function isValidImage(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/jpg'].includes(file.type);
}

/**
 * Check if a string is a valid hex color
 * @param color - Color string to validate
 * @returns True if valid hex color
 * 
 * @example
 * ```typescript
 * isValidHexColor('#FF0000') // true
 * isValidHexColor('#fff') // false (must be 6 characters)
 * isValidHexColor('red') // false
 * ```
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Parse hex color to RGB values (0-1 range for PDF-lib)
 * @param hex - Hex color string (e.g., "#FF0000")
 * @returns RGB object with values 0-1
 * 
 * @example
 * ```typescript
 * hexToRgb('#FF0000') // { r: 1, g: 0, b: 0 }
 * hexToRgb('#000000') // { r: 0, g: 0, b: 0 }
 * ```
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const color = hex.replace('#', '');
  return {
    r: parseInt(color.slice(0, 2), 16) / 255,
    g: parseInt(color.slice(2, 4), 16) / 255,
    b: parseInt(color.slice(4, 6), 16) / 255,
  };
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * Delay execution for specified milliseconds
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch array into chunks
 * @param array - Array to batch
 * @param size - Chunk size
 * @returns Array of chunks
 * 
 * @example
 * ```typescript
 * batch([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 * ```
 */
export function batch<T>(array: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * Truncate string to specified length with ellipsis
 * @param str - String to truncate
 * @param length - Maximum length
 * @returns Truncated string
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}

/**
 * Capitalize first letter of string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
