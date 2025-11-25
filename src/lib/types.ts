export type InputType =
    | 'TEXT'
    | 'DATE'
    | 'NUMBER'
    | 'EMAIL'
    | 'SIGNATURE'
    | 'IMAGE'
    | 'CHECK'
    | 'CROSS';

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
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'left' | 'center' | 'right';
    textColor?: string;
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
