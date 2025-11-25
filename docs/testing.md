# Production Testing Checklist

## 1. Core Functionality
- [ ] **PDF Upload**
  - [ ] Upload a standard PDF (< 10MB)
  - [ ] Verify file size limit (try > 10MB file)
  - [ ] Verify file type validation (try .docx or .jpg)
  - [ ] Confirm page count detection is accurate
  - [ ] Verify secure storage in `/public/uploads`

- [ ] **Field Management**
  - [ ] Add every field type (Text, Date, Number, Email, Checkbox, Radio, Signature, Image)
  - [ ] Drag and drop fields to specific coordinates
  - [ ] Resize fields (width/height) via sidebar properties
  - [ ] Delete fields
  - [ ] Verify "Save" persists data to database (check network tab /api/inputs/save)
  - [ ] Refresh page and confirm fields reload in correct positions

- [ ] **Form Filling**
  - [ ] Navigate to `/fill/[id]`
  - [ ] Enter text in Text/Email/Number fields
  - [ ] Select dates in Date picker
  - [ ] Toggle Checkboxes and Radio buttons
  - [ ] Upload image for Image field
  - [ ] Upload signature/image for Signature field
  - [ ] Submit form and verify PDF download
  - [ ] Open downloaded PDF and verify all data is correctly overlaid

## 2. API & Security
- [ ] **Authentication**
  - [ ] Verify API requests fail without `x-api-key` header (using Postman/curl)
  - [ ] Verify uploads are rejected if API key is invalid

- [ ] **Data Integrity**
  - [ ] Upload multiple PDFs and ensure inputs are associated with correct PDF ID
  - [ ] Verify `slug` uniqueness per PDF (auto-generated slugs)

## 3. UI/UX & Accessibility
- [ ] **Responsiveness**
  - [ ] Test Editor on Desktop (1920x1080)
  - [ ] Test Fill Page on Tablet/Mobile (responsive layout)
  
- [ ] **Visual Feedback**
  - [ ] Loading states during upload/save/generate
  - [ ] Error toasts/messages for failed operations
  - [ ] Hover states on interactive elements

## 4. Performance
- [ ] **Large Files**
  - [ ] Test with multi-page PDF (10+ pages)
  - [ ] Verify pagination works smoothly
  - [ ] Check memory usage during drag & drop

## 5. Deployment Verification
- [ ] **Build**
  - [ ] Run `npm run build` locally to ensure no type errors
  - [ ] Verify `prisma generate` runs during build
- [ ] **Environment**
  - [ ] Check `DATABASE_URL` and `API_KEY` are set in production
