/**
 * Input field types for PDF forms
 * @description All available input types that can be placed on a PDF
 */
export type InputType =
    | 'TEXT'
    | 'DATE'
    | 'NUMBER'
    | 'EMAIL'
    | 'ICON'
    | 'SIGNATURE'
    | 'IMAGE'
    | 'FILLABLE';

/**
 * Icon variants available for the ICON input type
 * @description All available icon styles that can be rendered
 */
export type IconVariant =
    | 'CHECK'
    | 'CROSS'
    | 'CIRCLE'
    | 'CIRCLE_FILLED'
    | 'CIRCLE_CHECK'
    | 'CIRCLE_CROSS'
    | 'SQUARE'
    | 'SQUARE_FILLED'
    | 'SQUARE_CHECK'
    | 'STAR'
    | 'STAR_FILLED'
    | 'HEART'
    | 'HEART_FILLED'
    | 'ARROW_RIGHT'
    | 'ARROW_LEFT'
    | 'ARROW_UP'
    | 'ARROW_DOWN'
    | 'THUMBS_UP'
    | 'THUMBS_DOWN'
    | 'FLAG'
    | 'PIN'
    | 'BOOKMARK'
    | 'INFO'
    | 'WARNING'
    | 'MINUS'
    | 'PLUS';

export interface PdfFile {
    id: string;
    fileName: string;
    filePath: string;
    pageCount: number;
    fileSize: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface PdfInput {
    id: string;
    pdfFileId: string;
    slug: string;
    label: string;
    inputType: InputType;
    pageNumber: number;
    xCoord: number;
    yCoord: number;
    width: number;
    height: number;
    fontSize: number;
    /** Font family (Prisma stores as string) */
    fontFamily?: string | null;
    /** Font weight - 'normal' | 'bold' (Prisma stores as string) */
    fontWeight?: string | null;
    /** Font style - 'normal' | 'italic' (Prisma stores as string) */
    fontStyle?: string | null;
    /** Text alignment - 'left' | 'center' | 'right' (Prisma stores as string) */
    textAlign?: string | null;
    /** Hex color code for text */
    textColor?: string | null;
    /** Icon variant for ICON input type */
    iconVariant?: IconVariant | null;
    /** Icon color for ICON input type */
    iconColor?: string | null;
    /** Default visibility for ICON input type - controls if icon shows by default in filled PDF */
    defaultVisible?: boolean | null;
    /** Field visibility in editor - controls if field is hidden/shown in the canvas */
    isVisible?: boolean;
    /** Z-index for stacking order (higher = on top) */
    zIndex?: number;
    /** Border radius in pixels (0 = square corners) */
    borderRadius?: number;
    /** Whether border is enabled */
    borderEnabled?: boolean;
    /** Border width in pixels */
    borderWidth?: number;
    /** Border style: solid, dashed, dotted */
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    /** Border color (hex) */
    borderColor?: string;
    /** Image fit mode: 'contain' | 'cover' | 'fill' | 'none' */
    imageFit?: 'contain' | 'cover' | 'fill' | 'none';
    /** Placeholder text for FILLABLE input type */
    placeholder?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface SignatureImage {
    id: string;
    filePath: string;
    uploadedBy: string | null;
    createdAt: Date;
}

export interface FieldOverlay {
    id: string;
    slug: string;
    label: string;
    inputType: InputType;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
}

export interface FillValue {
    slug: string;
    value: string | boolean | File;
}

export interface UploadResponse {
    success: boolean;
    data?: {
        id: string;
        fileName: string;
        pageCount: number;
        fileSize: number;
    };
    error?: string;
}

export interface FillPdfRequest {
    pdfFileId: string;
    values: Record<string, string | boolean>;
}

export interface FillPdfResponse {
    success: boolean;
    pdfBase64?: string;
    error?: string;
}
