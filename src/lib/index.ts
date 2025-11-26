/**
 * @fileoverview Library barrel export
 * @description Centralized export for all library modules
 * 
 * Note: types.ts is the primary source for type definitions used throughout the app.
 * schemas.ts provides Zod validation schemas that derive types from the schemas.
 */

// Configuration and constants
export * from './constants';

// Environment configuration
export * from './env';

// Type definitions (primary source of truth for app types)
export * from './types';

// Validation schemas (use these for runtime validation)
// Re-export only non-conflicting items from schemas
export {
  // Zod schema objects (for validation)
  InputTypeSchema,
  FontWeightSchema,
  FontStyleSchema,
  TextAlignSchema,
  HexColorSchema,
  PdfFileSchema,
  CreatePdfFileSchema,
  PdfInputSchema,
  CreatePdfInputSchema,
  UpdatePdfInputSchema,
  UploadResponseSchema,
  FillPdfRequestSchema,
  FillPdfResponseSchema,
  SaveInputsRequestSchema,
  SaveInputsResponseSchema,
  SignatureImageSchema,
  SignatureUploadResponseSchema,
  PositionSchema,
  DimensionsSchema,
  BoundsSchema,
  FieldPositionSchema,
  FieldOverlaySchema,
  // Schema-derived types (use type prefix to avoid conflicts)
  type CreatePdfFile,
  type CreatePdfInput,
  type UpdatePdfInput,
  type SaveInputsRequest,
  type SaveInputsResponse,
  type SignatureUploadResponse,
  type Position,
  type Dimensions,
  type Bounds,
  type FieldPosition as PreciseFieldPosition,
} from './schemas';

// Utility functions
export * from './utils';

// API client
export * from './api-client';

// Store
export * from './store';

// Prisma client
export { prisma, default as db } from './prisma';
