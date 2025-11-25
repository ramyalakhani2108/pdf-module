# PDF Editor Module

A production-ready, full-stack PDF editor built with Next.js 15+, Prisma, and Tailwind CSS. Features drag-and-drop field placement, multi-type data entry, and precise PDF generation.

## Features

- **PDF Management**: Secure upload and storage of PDF files.
- **Visual Editor**: Drag & drop interface to place input fields (Text, Checkbox, Signature, etc.).
- **Field Properties**: Customize size, labels, and validation types.
- **Form Filling**: Public-facing page to fill and sign documents.
- **PDF Generation**: Pixel-perfect overlay of data onto original PDFs.
- **Security**: API key protection, file validation, and secure storage.

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: MySQL with Prisma ORM
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand
- **PDF Handling**: `pdf-lib` (generation), `react-pdf` (rendering)
- **Drag & Drop**: `@dnd-kit/core`

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL Database

### Installation

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env` and update credentials:
   ```bash
   cp .env.example .env
   ```
   
   Update `DATABASE_URL` with your MySQL connection string.

3. **Database Setup**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to start.

## Usage

1. **Upload PDF**: Drag & drop a PDF file on the home screen.
2. **Add Fields**: Use the sidebar to add fields like Text, Date, Signature.
3. **Position**: Drag fields to desired locations on the PDF.
4. **Save**: Click "Save" to persist field configurations.
5. **Preview/Fill**: Click "Preview Form" to open the fillable version.
6. **Download**: Fill the form and click "Download Filled PDF".

## API Documentation

See `docs/testing.md` for testing procedures.

### Endpoints

- `POST /api/pdf/upload`: Upload PDF
- `POST /api/inputs/save`: Save field configurations
- `GET /api/inputs/[pdfId]`: Get fields for a PDF
- `POST /api/pdf/fill`: Generate filled PDF
- `POST /api/signature/upload`: Upload signature images

## License

MIT
