/**
 * @fileoverview Error utilities for user-friendly error messages
 * @description Parses technical errors and returns clean, readable messages
 */

// Common error patterns and their user-friendly messages
const ERROR_PATTERNS: Array<{ pattern: RegExp | string; message: string }> = [
  // Database connection errors
  { pattern: /can't reach database/i, message: 'Unable to connect to database. Please try again later.' },
  { pattern: /database.*localhost/i, message: 'Database connection failed. Please ensure the server is running.' },
  { pattern: /ECONNREFUSED/i, message: 'Server connection refused. Please check if the service is running.' },
  { pattern: /prisma/i, message: 'Database operation failed. Please try again.' },
  
  // Network errors
  { pattern: /failed to fetch/i, message: 'Network error. Please check your internet connection.' },
  { pattern: /network.*error/i, message: 'Network error. Please check your connection and try again.' },
  { pattern: /timeout/i, message: 'Request timed out. Please try again.' },
  { pattern: /ETIMEDOUT/i, message: 'Connection timed out. Please try again.' },
  { pattern: /ENOTFOUND/i, message: 'Server not found. Please check your connection.' },
  
  // Auth errors
  { pattern: /unauthorized/i, message: 'Unauthorized. Please check your credentials.' },
  { pattern: /forbidden/i, message: 'Access denied. You don\'t have permission for this action.' },
  { pattern: /invalid.*token/i, message: 'Invalid authentication. Please refresh and try again.' },
  { pattern: /api.?key/i, message: 'Invalid API key. Please check your configuration.' },
  
  // File errors
  { pattern: /file.*not found/i, message: 'File not found. It may have been moved or deleted.' },
  { pattern: /invalid.*pdf/i, message: 'Invalid PDF file. Please upload a valid PDF.' },
  { pattern: /file.*too large/i, message: 'File is too large. Please try a smaller file.' },
  { pattern: /upload.*failed/i, message: 'Upload failed. Please try again.' },
  
  // Server errors
  { pattern: /internal server error/i, message: 'Server error. Our team has been notified.' },
  { pattern: /500/i, message: 'Server error. Please try again later.' },
  { pattern: /502|503|504/i, message: 'Service temporarily unavailable. Please try again.' },
  
  // Turbopack/Build errors (should never show to users)
  { pattern: /turbopack/i, message: 'A server error occurred. Please refresh the page.' },
  { pattern: /__TURBOPACK/i, message: 'A server error occurred. Please refresh the page.' },
  { pattern: /webpack/i, message: 'A server error occurred. Please refresh the page.' },
  { pattern: /chunks?\//i, message: 'A server error occurred. Please refresh the page.' },
  
  // Validation errors
  { pattern: /validation.*failed/i, message: 'Please check your input and try again.' },
  { pattern: /required.*field/i, message: 'Please fill in all required fields.' },
  { pattern: /invalid.*format/i, message: 'Invalid format. Please check your input.' },
];

// Default fallback messages
const DEFAULT_MESSAGES = {
  generic: 'Something went wrong. Please try again.',
  network: 'Connection error. Please check your network.',
  save: 'Failed to save. Your data is backed up locally.',
  load: 'Failed to load data. Please refresh the page.',
};

/**
 * Parse an error and return a user-friendly message
 * @param error - The error to parse (can be Error, string, or unknown)
 * @param context - Optional context to provide better messages (e.g., 'save', 'load', 'network')
 * @returns A clean, user-friendly error message
 */
export function parseErrorMessage(
  error: unknown, 
  context?: 'save' | 'load' | 'network' | 'generic'
): string {
  // Get the raw error message
  let rawMessage = '';
  
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    rawMessage = String((error as { message: unknown }).message);
  } else {
    rawMessage = String(error);
  }

  // Check against known patterns
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (typeof pattern === 'string') {
      if (rawMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return message;
      }
    } else if (pattern.test(rawMessage)) {
      return message;
    }
  }

  // If the message is very long (likely a technical error), use a default
  if (rawMessage.length > 100) {
    return DEFAULT_MESSAGES[context || 'generic'];
  }

  // If the message contains obvious technical jargon, use a default
  const technicalPatterns = [
    /^[A-Z_]+Error:/,
    /at\s+\w+\s+\(/,
    /node_modules/,
    /\.js:\d+/,
    /\.ts:\d+/,
    /\$[a-zA-Z]+\$/,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(rawMessage)) {
      return DEFAULT_MESSAGES[context || 'generic'];
    }
  }

  // If it's a reasonable message, return it (capitalized)
  if (rawMessage && rawMessage.length > 0 && rawMessage.length <= 100) {
    // Capitalize first letter
    return rawMessage.charAt(0).toUpperCase() + rawMessage.slice(1);
  }

  // Fallback
  return DEFAULT_MESSAGES[context || 'generic'];
}

/**
 * Check if an error is a connection/network error
 */
export function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const connectionPatterns = [
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /failed to fetch/i,
    /network/i,
    /can't reach/i,
    /connection.*refused/i,
    /offline/i,
  ];
  
  return connectionPatterns.some(pattern => pattern.test(message));
}

/**
 * Check if an error is a database error
 */
export function isDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const dbPatterns = [
    /prisma/i,
    /database/i,
    /postgres/i,
    /mysql/i,
    /sqlite/i,
    /mongo/i,
  ];
  
  return dbPatterns.some(pattern => pattern.test(message));
}
