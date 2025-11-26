/**
 * @fileoverview Application-wide constants and configuration values
 * @description Centralized location for all magic numbers, configuration defaults,
 * and constant values used throughout the PDF module application.
 * 
 * @organization
 * - API_CONFIG: API-related configuration (timeouts, sizes)
 * - PDF_CONFIG: PDF processing configuration
 * - FIELD_DEFAULTS: Default values for PDF input fields
 * - UI_CONFIG: User interface configuration
 * - CALIBRATION_CONFIG: Coordinate calibration values
 * - FILE_CONFIG: File handling configuration
 */

// =============================================================================
// API CONFIGURATION
// =============================================================================

/**
 * API request configuration values
 */
export const API_CONFIG = {
  /** Maximum duration for API routes in seconds (for large PDF processing) */
  MAX_DURATION: 60,
  /** Default API key header name */
  API_KEY_HEADER: 'x-api-key',
  /** Development API key (should be overridden in production) */
  DEV_API_KEY: process.env.API_KEY,
} as const;

// =============================================================================
// PDF CONFIGURATION
// =============================================================================

/**
 * PDF processing configuration
 */
export const PDF_CONFIG = {
  /** Maximum file size for PDF uploads in bytes (100MB) */
  MAX_FILE_SIZE: 104857600,
  /** Allowed MIME type for PDF files */
  MIME_TYPE: 'application/pdf',
  /** Batch size for processing large numbers of inputs */
  BATCH_SIZE: 500,
  /** PDF.js worker source URL template */
  WORKER_URL_TEMPLATE: '//unpkg.com/pdfjs-dist@{version}/build/pdf.worker.min.mjs',
  /** CMap URL template for PDF.js */
  CMAP_URL_TEMPLATE: '//unpkg.com/pdfjs-dist@{version}/cmaps/',
  /** Standard fonts URL template for PDF.js */
  FONTS_URL_TEMPLATE: '//unpkg.com/pdfjs-dist@{version}/standard_fonts/',
} as const;

/**
 * PDF.js rendering options optimized for large PDFs (100MB+, 1000+ pages)
 */
export const PDF_RENDER_OPTIONS = {
  cMapPacked: true,
  enableXfa: true,
  disableTextLayer: false,
  disableAnnotationLayer: true,
  disableStream: false,
  disableAutoFetch: false,
} as const;

// =============================================================================
// FIELD CONFIGURATION
// =============================================================================

/**
 * Default field dimensions by input type
 */
export const FIELD_DEFAULTS = {
  /** Default dimensions for text input fields */
  TEXT: { width: 250, height: 35, fontSize: 14 },
  /** Default dimensions for email input fields */
  EMAIL: { width: 250, height: 35, fontSize: 14 },
  /** Default dimensions for number input fields */
  NUMBER: { width: 120, height: 35, fontSize: 14 },
  /** Default dimensions for date input fields */
  DATE: { width: 150, height: 35, fontSize: 14 },
  /** Default dimensions for icon fields */
  ICON: { width: 30, height: 30, fontSize: 12 },
  /** Default dimensions for signature fields */
  SIGNATURE: { width: 300, height: 80, fontSize: 12 },
  /** Default dimensions for image fields */
  IMAGE: { width: 200, height: 150, fontSize: 12 },
  /** Default dimensions for native PDF fillable fields */
  FILLABLE: { width: 200, height: 30, fontSize: 12 },
} as const;

/**
 * Font configuration for PDF text rendering
 */
export const FONT_CONFIG = {
  /** Default font family */
  DEFAULT_FAMILY: 'Arial, sans-serif',
  /** Default font weight */
  DEFAULT_WEIGHT: 'normal' as const,
  /** Default font style */
  DEFAULT_STYLE: 'normal' as const,
  /** Default text alignment */
  DEFAULT_ALIGN: 'left' as const,
  /** Default text color (hex) */
  DEFAULT_COLOR: '#000000',
  /** Minimum font size in pixels */
  MIN_FONT_SIZE: 4.5,
  /** Font scale factor for tiny fields */
  TINY_FIELD_SCALE: 0.65,
} as const;

/**
 * Available font families for PDF text
 */
export const AVAILABLE_FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: "'Comic Sans MS', cursive", label: 'Comic Sans MS' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Lucida Console', monospace", label: 'Lucida Console' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
] as const;

// =============================================================================
// UI CONFIGURATION
// =============================================================================

/**
 * User interface configuration values
 */
export const UI_CONFIG = {
  /** Grid size for snap-to-grid functionality in pixels */
  GRID_SIZE: 1,
  /** Threshold for alignment snapping in pixels */
  SNAP_THRESHOLD: 10,
  /** Threshold for tiny field detection in pixels */
  TINY_FIELD_THRESHOLD: 30,
  /** Default zoom level */
  DEFAULT_ZOOM: 1,
  /** Minimum zoom level */
  MIN_ZOOM: 0.3,
  /** Maximum zoom level */
  MAX_ZOOM: 3,
  /** Zoom step for zoom in/out operations */
  ZOOM_STEP: 0.1,
  /** Auto-zoom level for tiny fields */
  TINY_FIELD_ZOOM: 3,
} as const;

/**
 * View modes for PDF display
 */
export const VIEW_MODES = {
  FIT_WIDTH: 'fit-width',
  FIT_PAGE: 'fit-page',
  ACTUAL_SIZE: 'actual-size',
  CUSTOM: 'custom',
} as const;

// =============================================================================
// CALIBRATION CONFIGURATION
// =============================================================================

/**
 * Coordinate calibration values for aligning preview and PDF output
 * 
 * @description These values correct for rendering differences between:
 * - Browser sub-pixel rendering (preview mode)
 * - PDF coordinate system (PDF mode)
 * 
 * Adjust these values based on empirical measurements if alignment issues occur.
 */
export const CALIBRATION_CONFIG = {
  /** Preview mode Y-axis calibration offset (negative = move up) */
  PREVIEW_Y_OFFSET: -1.5,
  /** Preview mode X-axis calibration offset */
  PREVIEW_X_OFFSET: 0,
  /** PDF mode Y-axis calibration offset (positive = move down) */
  PDF_Y_OFFSET: 3.5,
  /** PDF mode X-axis calibration offset */
  PDF_X_OFFSET: 0,
  /** Maximum calibration records to store */
  MAX_CALIBRATION_RECORDS: 50,
  /** Bottom margin offset applied to all input fields during PDF download (in pixels) - adds space below fields to prevent overlap */
  PDF_BOTTOM_MARGIN_OFFSET: 1,
} as const;

/**
 * Precision configuration for coordinate calculations
 */
export const PRECISION_CONFIG = {
  /** Number of decimal places for IEEE 754 double precision */
  DECIMAL_PLACES: 15,
  /** Precision factor (10^15) for normalization */
  FACTOR: Math.pow(10, 15),
  /** Tolerance threshold for coordinate validation in pixels */
  TOLERANCE: 0.01,
} as const;

// =============================================================================
// FILE CONFIGURATION
// =============================================================================

/**
 * File handling configuration
 */
export const FILE_CONFIG = {
  /** Default upload directory path */
  UPLOAD_DIR: './public/uploads',
  /** Signature/image upload subdirectory */
  SIGNATURE_DIR: 'signatures',
  /** Maximum file size for signature/image uploads (5MB) */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  /** Allowed image MIME types */
  ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/jpg'] as const,
} as const;

// =============================================================================
// STORAGE KEYS
// =============================================================================

/**
 * LocalStorage/SessionStorage keys
 */
export const STORAGE_KEYS = {
  /** Editor state persistence key */
  EDITOR_STATE: 'pdf-editor-storage',
  /** Calibration data persistence key */
  CALIBRATION_DATA: 'calibrationData',
} as const;

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * All available input types for PDF fields
 */
export const INPUT_TYPES = [
  'TEXT',
  'DATE',
  'NUMBER',
  'EMAIL',
  'ICON',
  'SIGNATURE',
  'IMAGE',
  'FILLABLE',
] as const;

/**
 * Input types that support text styling
 */
export const TEXT_INPUT_TYPES = ['TEXT', 'EMAIL', 'NUMBER', 'DATE'] as const;

/**
 * Icon variants available for ICON input type
 */
export const ICON_VARIANTS = [
  { value: 'CHECK', label: 'Check Mark', icon: 'Check' },
  { value: 'CROSS', label: 'Cross / X', icon: 'X' },
  { value: 'CIRCLE', label: 'Circle (Outline)', icon: 'Circle' },
  { value: 'CIRCLE_FILLED', label: 'Circle (Filled)', icon: 'CircleDot' },
  { value: 'CIRCLE_CHECK', label: 'Circle Check', icon: 'CheckCircle' },
  { value: 'CIRCLE_CROSS', label: 'Circle Cross', icon: 'XCircle' },
  { value: 'SQUARE', label: 'Square (Outline)', icon: 'Square' },
  { value: 'SQUARE_FILLED', label: 'Square (Filled)', icon: 'SquareIcon' },
  { value: 'SQUARE_CHECK', label: 'Square Check', icon: 'CheckSquare' },
  { value: 'STAR', label: 'Star (Outline)', icon: 'Star' },
  { value: 'STAR_FILLED', label: 'Star (Filled)', icon: 'StarIcon' },
  { value: 'HEART', label: 'Heart (Outline)', icon: 'Heart' },
  { value: 'HEART_FILLED', label: 'Heart (Filled)', icon: 'HeartIcon' },
  { value: 'ARROW_RIGHT', label: 'Arrow Right', icon: 'ArrowRight' },
  { value: 'ARROW_LEFT', label: 'Arrow Left', icon: 'ArrowLeft' },
  { value: 'ARROW_UP', label: 'Arrow Up', icon: 'ArrowUp' },
  { value: 'ARROW_DOWN', label: 'Arrow Down', icon: 'ArrowDown' },
  { value: 'THUMBS_UP', label: 'Thumbs Up', icon: 'ThumbsUp' },
  { value: 'THUMBS_DOWN', label: 'Thumbs Down', icon: 'ThumbsDown' },
  { value: 'FLAG', label: 'Flag', icon: 'Flag' },
  { value: 'PIN', label: 'Pin / Location', icon: 'MapPin' },
  { value: 'BOOKMARK', label: 'Bookmark', icon: 'Bookmark' },
  { value: 'INFO', label: 'Info', icon: 'Info' },
  { value: 'WARNING', label: 'Warning', icon: 'AlertTriangle' },
  { value: 'MINUS', label: 'Minus', icon: 'Minus' },
  { value: 'PLUS', label: 'Plus', icon: 'Plus' },
] as const;

/**
 * Predefined icon colors
 */
export const ICON_COLORS = [
  { value: '#000000', label: 'Black' },
  { value: '#DC2626', label: 'Red' },
  { value: '#16A34A', label: 'Green' },
  { value: '#2563EB', label: 'Blue' },
  { value: '#9333EA', label: 'Purple' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#0891B2', label: 'Cyan' },
  { value: '#4B5563', label: 'Gray' },
] as const;

/**
 * Input types that support file uploads
 */
export const FILE_INPUT_TYPES = ['SIGNATURE', 'IMAGE'] as const;

// =============================================================================
// ERROR MESSAGES
// =============================================================================

/**
 * Standardized error messages
 */
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  INVALID_FILE_TYPE: 'Only PDF files are allowed',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed size',
  INVALID_PDF: 'Invalid PDF file',
  PDF_NOT_FOUND: 'PDF file not found',
  UPLOAD_FAILED: 'Failed to upload file',
  SAVE_FAILED: 'Failed to save inputs',
  FILL_FAILED: 'Failed to fill PDF',
  INVALID_REQUEST: 'Invalid request body',
  NO_FILE_PROVIDED: 'No file provided',
} as const;

// =============================================================================
// SUCCESS MESSAGES
// =============================================================================

/**
 * Standardized success messages
 */
export const SUCCESS_MESSAGES = {
  UPLOAD_SUCCESS: 'File uploaded successfully',
  SAVE_SUCCESS: 'Inputs saved successfully',
  FILL_SUCCESS: 'PDF filled successfully',
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/** Input type union derived from constants */
export type InputTypeValue = (typeof INPUT_TYPES)[number];

/** View mode type */
export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

/** Font family option type */
export type FontFamilyOption = (typeof AVAILABLE_FONTS)[number];
