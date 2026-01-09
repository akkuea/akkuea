# API Overview

The Real Estate DeFi Platform API is built with Elysia framework running on Bun, providing a fast and type-safe backend service for the frontend applications.

## Base URL

- **Development**: `http://localhost:3001`
- **Staging**: `https://staging-api.realestate-defi.com`
- **Production**: `https://api.realestate-defi.com`

## API Architecture

### Framework & Runtime

- **Framework**: Elysia (TypeScript-first web framework)
- **Runtime**: Bun (High-performance JavaScript runtime)
- **Type Safety**: Full TypeScript coverage from frontend to backend
- **Documentation**: Auto-generated Swagger/OpenAPI specifications

### Key Features

- **Type-safe request/response** handling
- **Automatic validation** with TypeScript types
- **Structured error handling** with consistent format
- **Built-in CORS** for frontend integration
- **Rate limiting** for abuse prevention
- **Health checks** for monitoring

## API Structure

```
/api/
├── /properties          # Real estate property operations
├── /lending            # DeFi lending operations
├── /users              # User management
├── /kyc                # KYC verification
└── /health             # Service health checks
```

## Authentication

The API uses wallet-based authentication:

1. Users connect their Stellar wallet
2. Sign a challenge message with their private key
3. API verifies the signature
4. Session token is issued for subsequent requests

## Request/Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    /* Response data */
  },
  "timestamp": "2026-01-06T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid input parameters",
  "timestamp": "2026-01-06T10:30:00.000Z"
}
```

## Rate Limiting

- **Default Rate**: 100 requests per minute per IP
- **Authenticated Users**: 500 requests per minute
- **Burst Rate**: Up to 10 requests per second
- **Headers**: Rate limit info included in response headers

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (Validation error)
- `401` - Unauthorized (Authentication required)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (Rate limited)
- `500` - Internal Server Error

### Error Types

1. **Validation Errors** - Invalid input parameters
2. **Authentication Errors** - Invalid credentials or signatures
3. **Authorization Errors** - Insufficient permissions
4. **Blockchain Errors** - Stellar transaction failures
5. **Business Logic Errors** - Invalid operations (insufficient funds, etc.)

## CORS Configuration

```
Allowed Origins: http://localhost:3000, https://yourdomain.com
Allowed Methods: GET, POST, PUT, DELETE, OPTIONS
Allowed Headers: Content-Type, Authorization, X-Requested-With
Max Age: 86400 seconds (24 hours)
```

## Monitoring & Logging

### Health Check Endpoint

```http
GET /health
```

Returns service status, version, and timestamp.

### Logging

- **Structured JSON logging** for all requests
- **Error tracking** with stack traces
- **Performance metrics** for response times
- **Security events** for authentication attempts

## Security Features

### Input Validation

- **Type-safe validation** using TypeScript
- **SQL injection prevention** with parameterized queries
- **XSS protection** with input sanitization
- **File upload security** with type and size limits

### Authentication Security

- **Signature verification** for wallet authentication
- **Nonce validation** to prevent replay attacks
- **Session expiration** with configurable timeouts
- **Rate limiting** to prevent brute force attacks

## Integration Examples

### Frontend Integration (TypeScript)

```typescript
import { PropertyInfo } from "@real-estate-defi/shared";

// Type-safe API calls
const properties = await fetch("/api/properties")
  .then((res) => res.json())
  .then((data: PropertyInfo[]) => data);

// With error handling
try {
  const property = await fetch(`/api/properties/${id}`).then((res) => {
    if (!res.ok) throw new Error("Property not found");
    return res.json();
  });
} catch (error) {
  console.error("Failed to fetch property:", error);
}
```

### Webhook Support

The API supports webhooks for real-time updates:

- **Transaction confirmations**
- **KYC status changes**
- **Property listings updates**
- **Lending pool events**

## SDK & Tools

### TypeScript SDK

A TypeScript SDK is provided in the `@real-estate-defi/shared` package:

```typescript
import { RealEstateAPI } from "@real-estate-defi/shared/api";

const api = new RealEstateAPI("http://localhost:3001");
const properties = await api.properties.getAll();
```

### Postman Collection

Pre-configured Postman collection available for API testing and documentation.

## Environment Configuration

### Required Environment Variables

```bash
# API Configuration
API_PORT=3001
API_HOST=localhost

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Security
JWT_SECRET=your_jwt_secret_here
CORS_ORIGIN=http://localhost:3000

# External Services
KYC_PROVIDER_API_KEY=your_kyc_api_key
WEBHOOK_SECRET=your_webhook_secret
```

This API provides a robust, type-safe foundation for the Real Estate DeFi platform's backend operations.
