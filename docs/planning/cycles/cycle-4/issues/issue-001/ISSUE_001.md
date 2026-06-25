# Secure KYC Endpoints with Authentication Guards

## Context

The KYC route module exposes six endpoints with no authentication or authorization controls. Any unauthenticated caller can read another user's KYC status, retrieve identity document files, submit KYC on behalf of an arbitrary user, and mark any document as verified. This is an open security vulnerability in the most sensitive module in the platform.

Every other route module in the API already applies `authPlugin`, which issues JWTs after Stellar wallet signature verification. Properties, lending, users, and notifications are protected. KYC is not. This issue closes that gap.

## What Needs to Be Done

The fix requires applying authentication and ownership checks to the KYC routes in `apps/api/src/routes/kyc.ts`. Not all routes share the same requirements, so the work must be applied thoughtfully:

**User-scoped routes** (`GET /kyc/status/:userId`, `GET /kyc/documents/:userId`, `POST /kyc/submit`) require a valid JWT and an ownership check. A user may only access or submit their own KYC data. A valid token for a different user must be rejected with `403`.

**Unauthenticated routes** (`GET /kyc/file/:documentId`, `POST /kyc/upload`) require a valid JWT but no ownership check, since the document ID alone scopes the request.

**Internal-only routes** (`POST /kyc/verify/:documentId`) must never be callable by regular users. This endpoint must be protected by an `INTERNAL_API_KEY` header check, not by a user JWT. Requests that present a user token must be rejected.

## Acceptance Criteria

- All six endpoints return `401` when no valid token or key is present.
- Ownership-scoped endpoints return `403` when a valid token is presented for a different user.
- The verify endpoint rejects user JWTs and only accepts the internal API key.
- All existing KYC tests continue to pass without modification.
- No `any` type casts are introduced in new or modified code.
- All CI workflows pass on the submitted pull request.

## Files Involved

The primary change is in `apps/api/src/routes/kyc.ts`. Review `apps/api/src/middleware/auth.ts` to confirm the shape of `getAuthenticatedUser` before implementing the ownership checks. The existing test file at `apps/api/src/__tests__/kyc.test.ts` must be extended to cover unauthorized and forbidden scenarios. The `apps/api/.env.example` file must document the new `INTERNAL_API_KEY` variable.

## Test Scenarios

Each of the following scenarios must be covered by an automated test:

- `GET /kyc/status/:userId` with no token returns `401`
- `GET /kyc/status/:userId` with a valid token for a different user returns `403`
- `GET /kyc/status/:userId` with the correct owner token returns `200`
- `POST /kyc/verify/:documentId` with a user JWT returns `401`
- `POST /kyc/verify/:documentId` with a valid internal API key returns `200`
- `POST /kyc/submit` with a token belonging to a different user returns `403`

## Quality Standard

This issue involves authentication and authorization logic in the module that handles identity documents. We expect complete, production-quality work with no shortcuts. New code must not introduce `any` casts, must not disable linting rules, and must not skip edge cases in tests. All CI workflows must pass before requesting a review. Partial implementations will not be merged.
