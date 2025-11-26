/**
 * @fileoverview Swagger/OpenAPI Spec Endpoint
 * @description Serves the OpenAPI specification for the PDF Module API
 */

import { NextResponse } from 'next/server';

/**
 * Complete OpenAPI 3.0 Specification for PDF Module API
 */
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'PDF Module API',
    version: '1.0.0',
    description: `
# PDF Module API Documentation

A comprehensive REST API for PDF form management, including:
- **PDF Upload & Management** - Upload, store, and retrieve PDF files
- **Input Field Configuration** - Define form fields with precise positioning
- **PDF Form Filling** - Fill PDFs with text, icons, signatures, and images
- **Signature Upload** - Upload and manage signature images

## Authentication
All endpoints require an API key passed in the \`x-api-key\` header.

## Base URL
\`\`\`
http://localhost:3000/api
\`\`\`

## Rate Limits
- Standard endpoints: 100 requests/minute
- Upload endpoints: 10 requests/minute

## File Size Limits
- PDF files: 100MB maximum
- Image/Signature files: 5MB maximum
    `,
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'PDF',
      description: 'PDF file upload and management operations',
    },
    {
      name: 'Inputs',
      description: 'PDF input field configuration operations',
    },
    {
      name: 'Fill',
      description: 'PDF form filling operations',
    },
    {
      name: 'Signature',
      description: 'Signature and image upload operations',
    },
  ],
  paths: {
    '/api/pdf/upload': {
      post: {
        tags: ['PDF'],
        summary: 'Upload a PDF file',
        description: 'Upload a PDF file for form field configuration. The file is stored on the server and metadata is saved to the database. Supports large PDFs up to 100MB with 1000+ pages.',
        operationId: 'uploadPdf',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF file to upload (max 100MB)',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'PDF uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
                        fileName: { type: 'string', example: 'document.pdf' },
                        pageCount: { type: 'integer', example: 10 },
                        fileSize: { type: 'integer', example: 1048576 },
                        filePath: { type: 'string', example: '/uploads/123e4567-e89b-12d3-a456-426614174000.pdf' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid file type or no file provided',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  noFile: { value: { success: false, error: 'No file provided' } },
                  invalidType: { value: { success: false, error: 'Only PDF files are allowed' } },
                  tooLarge: { value: { success: false, error: 'File size exceeds maximum allowed size' } },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API key',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { success: false, error: 'Unauthorized' },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      get: {
        tags: ['PDF'],
        summary: 'List all uploaded PDFs',
        description: 'Retrieve a list of all uploaded PDF files with their metadata, ordered by creation date (newest first).',
        operationId: 'listPdfs',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'List of PDF files',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PdfFile' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/inputs/{pdfId}': {
      get: {
        tags: ['Inputs'],
        summary: 'Get input fields for a PDF',
        description: 'Retrieve all input field definitions for a specific PDF file. Fields are ordered by page number and creation date.',
        operationId: 'getInputs',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'pdfId',
            in: 'path',
            required: true,
            description: 'UUID of the PDF file',
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of input fields',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PdfInput' },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - PDF ID is required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/inputs/save': {
      post: {
        tags: ['Inputs'],
        summary: 'Save input fields for a PDF',
        description: 'Save or update input field definitions for a PDF. This replaces all existing inputs for the specified PDF. Supports batch processing for large PDFs with many fields.',
        operationId: 'saveInputs',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pdfFileId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'UUID of the PDF file',
                  },
                  inputs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        slug: { type: 'string', example: 'first_name' },
                        label: { type: 'string', example: 'First Name' },
                        inputType: { type: 'string', enum: ['TEXT', 'DATE', 'NUMBER', 'EMAIL', 'ICON', 'SIGNATURE', 'IMAGE'] },
                        pageNumber: { type: 'integer', minimum: 1, example: 1 },
                        xCoord: { type: 'number', example: 100.5 },
                        yCoord: { type: 'number', example: 200.5 },
                        width: { type: 'number', example: 200 },
                        height: { type: 'number', example: 35 },
                        fontSize: { type: 'number', example: 14 },
                        fontFamily: { type: 'string', example: 'Arial, sans-serif' },
                        fontWeight: { type: 'string', enum: ['normal', 'bold'] },
                        fontStyle: { type: 'string', enum: ['normal', 'italic'] },
                        textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
                        textColor: { type: 'string', example: '#000000' },
                        iconVariant: { type: 'string', example: 'CHECK' },
                        iconColor: { type: 'string', example: '#16A34A' },
                      },
                      required: ['slug', 'label', 'inputType', 'pageNumber', 'xCoord', 'yCoord', 'width', 'height'],
                    },
                  },
                },
                required: ['pdfFileId', 'inputs'],
              },
              example: {
                pdfFileId: '123e4567-e89b-12d3-a456-426614174000',
                inputs: [
                  {
                    slug: 'first_name',
                    label: 'First Name',
                    inputType: 'TEXT',
                    pageNumber: 1,
                    xCoord: 100,
                    yCoord: 200,
                    width: 200,
                    height: 35,
                    fontSize: 14,
                    textColor: '#000000',
                  },
                  {
                    slug: 'signature',
                    label: 'Signature',
                    inputType: 'SIGNATURE',
                    pageNumber: 1,
                    xCoord: 100,
                    yCoord: 500,
                    width: 300,
                    height: 80,
                  },
                  {
                    slug: 'approved_check',
                    label: 'Approved',
                    inputType: 'ICON',
                    pageNumber: 1,
                    xCoord: 50,
                    yCoord: 600,
                    width: 30,
                    height: 30,
                    iconVariant: 'CHECK',
                    iconColor: '#16A34A',
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Inputs saved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        count: { type: 'integer', example: 15, description: 'Number of inputs saved' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid request body',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'PDF file not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { success: false, error: 'PDF file not found' },
              },
            },
          },
        },
      },
    },
    '/api/pdf/fill': {
      post: {
        tags: ['Fill'],
        summary: 'Fill a PDF with values',
        description: `Fill a PDF form with provided values and return the filled PDF as base64.

## Supported Field Types

| Type | Value Format | Description |
|------|--------------|-------------|
| TEXT | string | Plain text value |
| EMAIL | string | Email address |
| NUMBER | string | Numeric value |
| DATE | string | Date value |
| ICON | boolean | true = show icon, false = hide |
| SIGNATURE | base64 string | Data URL (data:image/png;base64,...) |
| IMAGE | base64 string | Data URL (data:image/png;base64,...) |

## Coordinate System
- X/Y coordinates use PDF points (72 points = 1 inch)
- Origin is at top-left of the page
- Text is rendered with proper font styling and alignment
`,
        operationId: 'fillPdf',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pdfFileId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'UUID of the PDF file to fill',
                  },
                  values: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Object with field slugs as keys and values to fill. For ICON fields, use boolean. For SIGNATURE/IMAGE, use base64 data URL.',
                  },
                  adjustedPositions: {
                    type: 'object',
                    description: 'Optional position adjustments keyed by field ID',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                      },
                    },
                  },
                },
                required: ['pdfFileId', 'values'],
              },
              example: {
                pdfFileId: '123e4567-e89b-12d3-a456-426614174000',
                values: {
                  first_name: 'John',
                  last_name: 'Doe',
                  email: 'john.doe@example.com',
                  date_of_birth: '1990-01-15',
                  amount: '1500.00',
                  approved_check: true,
                  rejected_check: false,
                  signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'PDF filled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    pdfBase64: {
                      type: 'string',
                      description: 'Base64-encoded filled PDF. Decode and save as .pdf file.',
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'PDF file not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Failed to fill PDF',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/signature/upload': {
      post: {
        tags: ['Signature'],
        summary: 'Upload a signature or image',
        description: 'Upload a signature or image file for use in PDF forms. Returns both the stored file path and base64 data URL for immediate use. Supports PNG and JPEG formats up to 5MB.',
        operationId: 'uploadSignature',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image file (PNG or JPEG, max 5MB)',
                  },
                  uploadedBy: {
                    type: 'string',
                    description: 'Optional identifier for who uploaded the signature',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Signature uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        filePath: { type: 'string', example: '/uploads/signatures/abc123.png' },
                        base64: { type: 'string', description: 'Data URL for immediate use', example: 'data:image/png;base64,...' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request - Invalid file type or no file provided',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  noFile: { value: { success: false, error: 'No file provided' } },
                  invalidType: { value: { success: false, error: 'Only PNG and JPEG images are allowed' } },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for authentication. Use `your-secure-api-key-here-change-in-production` for development.',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error message' },
        },
      },
      PdfFile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fileName: { type: 'string' },
          filePath: { type: 'string' },
          pageCount: { type: 'integer' },
          fileSize: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PdfInput: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          pdfFileId: { type: 'string', format: 'uuid' },
          slug: { type: 'string' },
          label: { type: 'string' },
          inputType: { type: 'string', enum: ['TEXT', 'DATE', 'NUMBER', 'EMAIL', 'ICON', 'SIGNATURE', 'IMAGE'] },
          pageNumber: { type: 'integer' },
          xCoord: { type: 'number' },
          yCoord: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          fontSize: { type: 'number' },
          fontFamily: { type: 'string' },
          fontWeight: { type: 'string' },
          fontStyle: { type: 'string' },
          textAlign: { type: 'string' },
          textColor: { type: 'string' },
          iconVariant: { type: 'string' },
          iconColor: { type: 'string' },
          defaultVisible: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

/**
 * GET /api/docs
 * @description Returns the OpenAPI specification for the PDF Module API
 */
export async function GET() {
  return NextResponse.json(swaggerSpec);
}
