# API Overview

> This document describes the API for the **existing platform build** (fractional property shares + DeFi lending) - see [`docs/strategy/product-brief.md`](../strategy/product-brief.md#relationship-to-the-existing-platform-build) for how that relates to the current pilot. The pilot's own API surface (evidence submission, whitelist review, payout-split triggers) does not exist yet.

The Akkuea API is built with the [Elysia](https://elysiajs.com) framework running on [Bun](https://bun.sh), providing a fast, type-safe backend for `apps/webapp` and `apps/akkuea-land`.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: configured per deployment - see [`docs/deployment/environment-variables.md`](../deployment/environment-variables.md)

## API Architecture

### Framework & Runtime

- **Framework**: Elysia (TypeScript-first web framework)
- **Runtime**: Bun
- **Type Safety**: Full TypeScript coverage from frontend to backend, shared via `@akkuea/shared`
- **Documentation**: Auto-generated Swagger/OpenAPI, served at `/swagger`

### Key Features

- Type-safe request/response handling
- Structured error handling with a consistent response shape
- Built-in CORS for frontend integration
- Rate limiting
- Health checks for monitoring

## API Structure

```
/
├── /auth               # Stellar wallet challenge-response authentication
├── /properties         # Real estate property CRUD, tokenization, share purchase
├── /lending            # DeFi lending pools: deposit, withdraw, borrow, repay
├── /kyc                # KYC document upload and verification workflow
├── /notifications       # User notification feed
├── /internal/operations # Admin-only property review queue (OPERATIONS_BACKEND_CREDENTIAL)
└── /health              # Service health check
```

For endpoint-level detail, see:

- [`authentication.md`](authentication.md) - the full challenge-response flow, JWT details, protected routes
- [`launch-workflows.md`](launch-workflows.md) - end-to-end HTTP sequences for KYC onboarding, tokenization, and share purchase
- [`minting-workflow.md`](minting-workflow.md) - the on-chain tokenization path in detail
- [`kyc-workflow.md`](kyc-workflow.md) - the KYC state machine and admin review procedure

## Authentication

The API uses Stellar wallet-based authentication (see [`authentication.md`](authentication.md) for the full flow):

1. Client requests a nonce via `POST /auth/challenge`
2. User signs the nonce with their Stellar wallet
3. Client submits the signature via `POST /auth/session`
4. API verifies the Ed25519 signature and issues a JWT
5. JWT is sent as `Authorization: Bearer <token>` on subsequent protected requests

Some endpoints (e.g. property creation, tokenization) instead check an `x-user-address` header directly against the resource owner - see [`launch-workflows.md`](launch-workflows.md) for which pattern applies where.

## Request/Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    /* Response data */
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required or invalid)
- `403` - Forbidden (insufficient permissions / address mismatch)
- `404` - Not Found
- `409` - Conflict (e.g. property already tokenized)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Error Categories

1. **Validation errors** - invalid input parameters
2. **Authentication errors** - invalid credentials or signatures
3. **Authorization errors** - insufficient permissions
4. **Blockchain errors** - Stellar/Soroban transaction failures
5. **Business logic errors** - invalid operations (insufficient shares, already tokenized, etc.)

## Rate Limiting

Both `/auth/challenge` and `/auth/session` are explicitly rate-limited (10 requests / 60 seconds per IP, see [`authentication.md`](authentication.md)). Rate limit headers are included on responses:

```
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

## Security Features

- **Signature verification** for wallet authentication (Ed25519, single-use nonces)
- **Input validation** via TypeScript-checked request schemas
- **File upload security** for KYC documents (type and size limits enforced by `StorageService`)
- **Rate limiting** to reduce brute-force and abuse risk
- **Structured logging** for requests and security-relevant events

> **Known gap:** `POST /kyc/verify/:documentId` currently has no authentication middleware - see [`kyc-workflow.md`](kyc-workflow.md#known-gaps-current-codebase-state). Do not treat every endpoint listed here as production-hardened by default; check the workflow docs for known gaps before relying on a specific guarantee.

## SDK

Shared types, validation schemas, and Stellar utilities live in the `@akkuea/shared` package (`apps/shared`), imported the same way across `apps/webapp`, `apps/akkuea-land`, and `apps/api`:

```typescript
import type { PropertyInfo } from "@akkuea/shared";
```

## Environment Configuration

Full reference: [`docs/deployment/environment-variables.md`](../deployment/environment-variables.md). Key categories: database (`DATABASE_URL`), server (`PORT`, `NODE_ENV`, `LOG_LEVEL`), internal security (`WEBHOOK_SECRET`, `OPERATIONS_BACKEND_CREDENTIAL`, `OPERATIONS_ALLOWED_WALLETS`), KYC (`KYC_UPLOAD_DIR`), and Stellar/Soroban (network URLs, passphrase, admin keys, contract IDs).
