/**
 * @fileoverview Zod validation schemas for API requests and data models
 * @description Provides type-safe validation schemas for all data structures
 * used throughout the PDF module application.
 */

import { z } from 'zod';
import { FONT_CONFIG } from './constants';

// =============================================================================
// BASE SCHEMAS
// =============================================================================

/**
 * Input type enum schema - matches Prisma InputType enum
 */
export const InputTypeSchema = z.enum([
  'TEXT',
  'DATE',
  'NUMBER',
  'EMAIL',
  'CHECKBOX',
  'RADIO',
  'CHECK',
  'CROSS',
  'SIGNATURE',
  'IMAGE',
]);

/**
 * Font weight schema
 */
export const FontWeightSchema = z.enum(['normal', 'bold']);

/**
 * Font style schema
 */
export const FontStyleSchema = z.enum(['normal', 'italic']);

/**
 * Text alignment schema
 */
export const TextAlignSchema = z.enum(['left', 'center', 'right']);

/**
 * Hex color schema with validation
 */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format');

// =============================================================================
// PDF FILE SCHEMAS
// =============================================================================

/**
 * PDF file schema
 */
export const PdfFileSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  pageCount: z.number().int().positive(),
  fileSize: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * PDF file creation schema (without auto-generated fields)
 */
export const CreatePdfFileSchema = PdfFileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =============================================================================
// PDF INPUT SCHEMAS
// =============================================================================

/**
 * PDF input field schema
 */
export const PdfInputSchema = z.object({
  id: z.string().uuid(),
  pdfFileId: z.string().uuid(),
  slug: z.string().min(1),
  label: z.string().min(1),
  inputType: InputTypeSchema,
  pageNumber: z.number().int().positive(),
  xCoord: z.number().nonnegative(),
  yCoord: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  fontSize: z.number().int().positive().default(12),
  fontFamily: z.string().optional().default(FONT_CONFIG.DEFAULT_FAMILY),
  fontWeight: FontWeightSchema.optional().default(FONT_CONFIG.DEFAULT_WEIGHT),
  fontStyle: FontStyleSchema.optional().default(FONT_CONFIG.DEFAULT_STYLE),
  textAlign: TextAlignSchema.optional().default(FONT_CONFIG.DEFAULT_ALIGN),
  textColor: HexColorSchema.optional().default(FONT_CONFIG.DEFAULT_COLOR),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * PDF input creation schema (without auto-generated fields)
 */
export const CreatePdfInputSchema = PdfInputSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * PDF input update schema (all fields optional except id)
 */
export const UpdatePdfInputSchema = PdfInputSchema.partial().required({ id: true });

// =============================================================================
// API REQUEST SCHEMAS
// =============================================================================

/**
 * PDF upload response schema
 */
export const UploadResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.string().uuid(),
      fileName: z.string(),
      pageCount: z.number().int().positive(),
      fileSize: z.number().int().positive(),
      filePath: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

/**
 * Fill PDF request schema
 */
export const FillPdfRequestSchema = z.object({
  pdfFileId: z.string().uuid(),
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  adjustedPositions: z
    .record(
      z.string(),
      z.object({
        x: z.number(),
        y: z.number(),
      })
    )
    .optional(),
});

/**
 * Fill PDF response schema
 */
export const FillPdfResponseSchema = z.object({
  success: z.boolean(),
  pdfBase64: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Save inputs request schema
 */
export const SaveInputsRequestSchema = z.object({
  pdfFileId: z.string().uuid(),
  inputs: z.array(CreatePdfInputSchema),
});

/**
 * Save inputs response schema
 */
export const SaveInputsResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      count: z.number().int().nonnegative(),
    })
    .optional(),
  error: z.string().optional(),
});

// =============================================================================
// SIGNATURE SCHEMAS
// =============================================================================

/**
 * Signature image schema
 */
export const SignatureImageSchema = z.object({
  id: z.string().uuid(),
  filePath: z.string().min(1),
  uploadedBy: z.string().nullable(),
  createdAt: z.date(),
});

/**
 * Signature upload response schema
 */
export const SignatureUploadResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.string().uuid(),
      filePath: z.string(),
      base64: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

// =============================================================================
// COORDINATE SCHEMAS
// =============================================================================

/**
 * Position schema for field coordinates
 */
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * Dimensions schema for field size
 */
export const DimensionsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

/**
 * Bounds schema (position + dimensions)
 */
export const BoundsSchema = PositionSchema.merge(DimensionsSchema);

/**
 * Field position schema for rendering
 */
export const FieldPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  textX: z.number(),
  textY: z.number(),
  scale: z.number().positive(),
});

// =============================================================================
// FIELD OVERLAY SCHEMA (for UI state)
// =============================================================================

/**
 * Field overlay schema for UI components
 */
export const FieldOverlaySchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  inputType: InputTypeSchema,
  pageNumber: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  fontSize: z.number().int().positive(),
});

// =============================================================================
// TYPE EXPORTS (inferred from schemas)
// =============================================================================

export type InputType = z.infer<typeof InputTypeSchema>;
export type FontWeight = z.infer<typeof FontWeightSchema>;
export type FontStyle = z.infer<typeof FontStyleSchema>;
export type TextAlign = z.infer<typeof TextAlignSchema>;

export type PdfFile = z.infer<typeof PdfFileSchema>;
export type CreatePdfFile = z.infer<typeof CreatePdfFileSchema>;

export type PdfInput = z.infer<typeof PdfInputSchema>;
export type CreatePdfInput = z.infer<typeof CreatePdfInputSchema>;
export type UpdatePdfInput = z.infer<typeof UpdatePdfInputSchema>;

export type UploadResponse = z.infer<typeof UploadResponseSchema>;
export type FillPdfRequest = z.infer<typeof FillPdfRequestSchema>;
export type FillPdfResponse = z.infer<typeof FillPdfResponseSchema>;
export type SaveInputsRequest = z.infer<typeof SaveInputsRequestSchema>;
export type SaveInputsResponse = z.infer<typeof SaveInputsResponseSchema>;

export type SignatureImage = z.infer<typeof SignatureImageSchema>;
export type SignatureUploadResponse = z.infer<typeof SignatureUploadResponseSchema>;

export type Position = z.infer<typeof PositionSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type FieldPosition = z.infer<typeof FieldPositionSchema>;
export type FieldOverlay = z.infer<typeof FieldOverlaySchema>;
