/**
 * @fileoverview Swagger/OpenAPI Configuration
 * @description Configuration for API documentation using Swagger/OpenAPI 3.0
 */

import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
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
        {
          url: 'https://your-production-domain.com',
          description: 'Production server',
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
          // Error Response
          ErrorResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: false,
              },
              error: {
                type: 'string',
                example: 'Error message describing what went wrong',
              },
            },
            required: ['success', 'error'],
          },
          
          // PDF File Schema
          PdfFile: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                example: '123e4567-e89b-12d3-a456-426614174000',
                description: 'Unique identifier for the PDF file',
              },
              fileName: {
                type: 'string',
                example: 'document.pdf',
                description: 'Original file name',
              },
              filePath: {
                type: 'string',
                example: '/uploads/123e4567-e89b-12d3-a456-426614174000.pdf',
                description: 'Server path to the stored PDF',
              },
              pageCount: {
                type: 'integer',
                example: 10,
                description: 'Total number of pages in the PDF',
              },
              fileSize: {
                type: 'integer',
                example: 1048576,
                description: 'File size in bytes',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp when the file was uploaded',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp when the file was last updated',
              },
            },
          },
          
          // Input Type Enum
          InputType: {
            type: 'string',
            enum: ['TEXT', 'DATE', 'NUMBER', 'EMAIL', 'ICON', 'SIGNATURE', 'IMAGE'],
            description: 'Type of input field',
          },
          
          // Icon Variant Enum
          IconVariant: {
            type: 'string',
            enum: [
              'CHECK', 'CROSS', 'CIRCLE', 'CIRCLE_CHECK', 'CIRCLE_CROSS',
              'SQUARE', 'SQUARE_CHECK', 'STAR', 'HEART',
              'ARROW_RIGHT', 'ARROW_LEFT', 'ARROW_UP', 'ARROW_DOWN'
            ],
            description: 'Icon style for ICON input type',
          },
          
          // PDF Input Schema
          PdfInput: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the input field',
              },
              pdfFileId: {
                type: 'string',
                format: 'uuid',
                description: 'Reference to the parent PDF file',
              },
              slug: {
                type: 'string',
                example: 'first_name',
                description: 'Unique slug identifier for the field (used as key in fill values)',
              },
              label: {
                type: 'string',
                example: 'First Name',
                description: 'Human-readable label for the field',
              },
              inputType: {
                $ref: '#/components/schemas/InputType',
              },
              pageNumber: {
                type: 'integer',
                minimum: 1,
                example: 1,
                description: 'Page number where the field is located (1-indexed)',
              },
              xCoord: {
                type: 'number',
                format: 'float',
                example: 100.5,
                description: 'X coordinate in PDF points (from left edge)',
              },
              yCoord: {
                type: 'number',
                format: 'float',
                example: 200.5,
                description: 'Y coordinate in PDF points (from top edge)',
              },
              width: {
                type: 'number',
                format: 'float',
                example: 200,
                description: 'Field width in PDF points',
              },
              height: {
                type: 'number',
                format: 'float',
                example: 35,
                description: 'Field height in PDF points',
              },
              fontSize: {
                type: 'number',
                format: 'float',
                default: 12,
                example: 14,
                description: 'Font size in points',
              },
              fontFamily: {
                type: 'string',
                default: 'Arial, sans-serif',
                example: 'Arial, sans-serif',
                description: 'CSS font family string',
              },
              fontWeight: {
                type: 'string',
                enum: ['normal', 'bold'],
                default: 'normal',
                description: 'Font weight',
              },
              fontStyle: {
                type: 'string',
                enum: ['normal', 'italic'],
                default: 'normal',
                description: 'Font style',
              },
              textAlign: {
                type: 'string',
                enum: ['left', 'center', 'right'],
                default: 'left',
                description: 'Text alignment within the field',
              },
              textColor: {
                type: 'string',
                pattern: '^#[0-9A-Fa-f]{6}$',
                default: '#000000',
                example: '#000000',
                description: 'Text color as hex code',
              },
              iconVariant: {
                $ref: '#/components/schemas/IconVariant',
              },
              iconColor: {
                type: 'string',
                pattern: '^#[0-9A-Fa-f]{6}$',
                default: '#000000',
                example: '#16A34A',
                description: 'Icon color as hex code (for ICON type)',
              },
              defaultVisible: {
                type: 'boolean',
                default: true,
                description: 'Default visibility for ICON fields in filled PDF',
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
            required: ['slug', 'label', 'inputType', 'pageNumber', 'xCoord', 'yCoord', 'width', 'height'],
          },
          
          // Save Inputs Request
          SaveInputsRequest: {
            type: 'object',
            properties: {
              pdfFileId: {
                type: 'string',
                format: 'uuid',
                description: 'ID of the PDF file to save inputs for',
              },
              inputs: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/PdfInput',
                },
                description: 'Array of input field definitions',
              },
            },
            required: ['pdfFileId', 'inputs'],
          },
          
          // Fill PDF Request
          FillPdfRequest: {
            type: 'object',
            properties: {
              pdfFileId: {
                type: 'string',
                format: 'uuid',
                description: 'ID of the PDF file to fill',
              },
              values: {
                type: 'object',
                additionalProperties: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'boolean' },
                  ],
                },
                example: {
                  first_name: 'John',
                  last_name: 'Doe',
                  email: 'john@example.com',
                  signature_field: 'data:image/png;base64,...',
                  checkbox_1: true,
                },
                description: 'Object with field slugs as keys and values to fill',
              },
              adjustedPositions: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                  },
                },
                description: 'Optional position adjustments for fields (by field ID)',
              },
            },
            required: ['pdfFileId', 'values'],
          },
          
          // Fill PDF Response
          FillPdfResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              pdfBase64: {
                type: 'string',
                description: 'Base64-encoded filled PDF file',
              },
            },
          },
          
          // Signature Image Schema
          SignatureImage: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
              },
              filePath: {
                type: 'string',
                example: '/uploads/signatures/abc123.png',
              },
              base64: {
                type: 'string',
                description: 'Base64 data URL of the uploaded image',
              },
            },
          },
        },
      },
      security: [
        {
          ApiKeyAuth: [],
        },
      ],
      paths: {
        '/api/pdf/import': {
          post: {
            summary: 'Import PDF from URL',
            description: 'Downloads a PDF from a remote URL and saves it to the system. This allows bypassing manual file upload by providing a URL.',
            tags: ['PDF'],
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['url'],
                    properties: {
                      url: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL of the PDF file to download',
                        example: 'https://example.com/document.pdf',
                      },
                      fileName: {
                        type: 'string',
                        description: 'Optional custom filename (defaults to extracted from URL)',
                        example: 'my-document.pdf',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'PDF imported successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        data: { $ref: '#/components/schemas/PdfFile' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid URL or not a PDF file',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              },
              '401': {
                description: 'Unauthorized - Invalid API key',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              },
            },
          },
          get: {
            summary: 'Import PDF from URL (via query param)',
            description: 'Downloads a PDF from a remote URL provided as query parameter. Convenience endpoint for direct linking.',
            tags: ['PDF'],
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                in: 'query',
                name: 'url',
                required: true,
                schema: { type: 'string', format: 'uri' },
                description: 'URL of the PDF file to download',
                example: 'https://example.com/document.pdf',
              },
              {
                in: 'query',
                name: 'fileName',
                required: false,
                schema: { type: 'string' },
                description: 'Optional custom filename',
              },
            ],
            responses: {
              '201': {
                description: 'PDF imported successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        data: { $ref: '#/components/schemas/PdfFile' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid URL or not a PDF file',
              },
            },
          },
        },
        '/api/pdf/upload': {
          post: {
            summary: 'Upload PDF file',
            description: 'Upload a PDF file from your local system. Supports files up to 100MB.',
            tags: ['PDF'],
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['file'],
                    properties: {
                      file: {
                        type: 'string',
                        format: 'binary',
                        description: 'PDF file to upload',
                      },
                    },
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
                        data: { $ref: '#/components/schemas/PdfFile' },
                      },
                    },
                  },
                },
              },
              '400': {
                description: 'Invalid file or file type',
              },
              '401': {
                description: 'Unauthorized',
              },
            },
          },
          get: {
            summary: 'List all uploaded PDFs',
            description: 'Retrieve a list of all uploaded PDF files with metadata.',
            tags: ['PDF'],
            security: [{ ApiKeyAuth: [] }],
            responses: {
              '200': {
                description: 'List of PDFs',
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
            },
          },
        },
        '/api/inputs/{pdfId}': {
          get: {
            summary: 'Get inputs for a PDF',
            description: 'Retrieve all input field definitions for a specific PDF file.',
            tags: ['Inputs'],
            security: [{ ApiKeyAuth: [] }],
            parameters: [
              {
                in: 'path',
                name: 'pdfId',
                required: true,
                schema: { type: 'string', format: 'uuid' },
                description: 'PDF file ID',
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
                        success: { type: 'boolean' },
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/PdfInput' },
                        },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'PDF not found',
              },
            },
          },
        },
        '/api/inputs/save': {
          post: {
            summary: 'Save input fields',
            description: 'Save or update input field definitions for a PDF. This will replace all existing fields.',
            tags: ['Inputs'],
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SaveInputsRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Inputs saved successfully',
              },
              '400': {
                description: 'Invalid request body',
              },
            },
          },
        },
        '/api/pdf/fill': {
          post: {
            summary: 'Fill PDF with values',
            description: 'Generate a filled PDF with the provided values. Returns a base64-encoded PDF.',
            tags: ['Fill'],
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/FillPdfRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Filled PDF generated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/FillPdfResponse' },
                  },
                },
              },
            },
          },
        },
        '/api/signature/upload': {
          post: {
            summary: 'Upload signature or image',
            description: 'Upload a signature or image file. Returns base64 data URL for embedding in PDF.',
            tags: ['Signature'],
            security: [{ ApiKeyAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['file'],
                    properties: {
                      file: {
                        type: 'string',
                        format: 'binary',
                        description: 'Image file (PNG, JPG, etc.)',
                      },
                    },
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
                        success: { type: 'boolean' },
                        data: { $ref: '#/components/schemas/SignatureImage' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return spec;
};
