# Domain & API Key Management System

This document explains the domain registration and API key authentication system for the PDF Module.

## Overview

The PDF Module uses a domain-based API key system that allows external applications to securely access the APIs. Each registered domain receives a unique API key that grants access to all PDF operations.

## How It Works

### Authentication Flow

1. **Domain Registration**: Register a domain to receive an API key
2. **API Key Usage**: Include the API key in requests via:
   - Query parameter: `?api_key=your_api_key`
   - Request body: `{ "api_key": "your_api_key", ...other_data }`
3. **Validation**: The system validates the API key against registered domains

### Internal Requests

Requests from the same origin (the PDF Module's own frontend) are automatically authenticated without requiring an API key.

## API Endpoints

### Register a Domain

```http
POST /api/domains/register
Content-Type: application/json

{
  "domain": "example.com",
  "webhook": "https://example.com/webhook",  // Optional
  "master_key": "your-master-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "domain": "example.com",
    "apiKey": "pdf_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "webhook": "https://example.com/webhook",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Domain registered successfully. Use the API key to access all PDF APIs."
}
```

### List All Domains

```http
GET /api/domains/register?api_key=your-master-api-key
```

### Get Domain Details

```http
GET /api/domains/{id}?api_key=your-master-api-key
```

### Update Domain

```http
PATCH /api/domains/{id}
Content-Type: application/json

{
  "webhook": "https://new-webhook.example.com",
  "isActive": false,
  "master_key": "your-master-api-key"
}
```

### Regenerate API Key

```http
POST /api/domains/{id}/regenerate
Content-Type: application/json

{
  "master_key": "your-master-api-key"
}
```

### Delete Domain

```http
DELETE /api/domains/{id}?api_key=your-master-api-key
```

## Using the API Key

Once you have an API key, include it in your requests:

### Query Parameter (Recommended for GET requests)

```http
GET /api/pdf/upload?api_key=pdf_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Request Body (Recommended for POST requests)

```http
POST /api/pdf/fill
Content-Type: application/json

{
  "api_key": "pdf_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "pdfFileId": "uuid",
  "values": {
    "field_name": "value"
  }
}
```

## Security Best Practices

1. **Keep API keys secret**: Never expose API keys in client-side code
2. **Use HTTPS**: Always use HTTPS in production
3. **Rotate keys regularly**: Use the regenerate endpoint to rotate keys
4. **Deactivate unused keys**: Set `isActive: false` for domains that should no longer access the API
5. **Monitor usage**: Implement logging and monitoring for API key usage

## Master API Key

The master API key (set in `API_KEY` environment variable) is used for:

1. Registering new domains
2. Managing existing domain registrations
3. Backward compatibility with internal API calls

**Important**: The master API key should be kept extremely secure as it has full access to domain management.

## Database Seeding

Run the seed script to add a default localhost domain:

```bash
npm run prisma:seed
```

This creates a domain entry for `localhost` with the API key from your environment, enabling local development without additional setup.

## Migration

If upgrading from the previous header-based authentication (`x-api-key` header):

1. Run the new migration to add `isActive` and `updatedAt` fields
2. Register your domains using the new `/api/domains/register` endpoint
3. Update your client code to use `?api_key=xxx` query parameters instead of headers
4. The master API key continues to work for backward compatibility
