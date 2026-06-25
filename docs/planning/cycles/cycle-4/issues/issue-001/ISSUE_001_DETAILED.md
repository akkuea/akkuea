# C4-001: Secure KYC Endpoints with Authentication Guards

## Issue Metadata

| Attribute       | Value                   |
| --------------- | ----------------------- |
| Issue ID        | C4-001                  |
| Area            | API                     |
| Difficulty      | High                    |
| Labels          | backend, security, high |
| Dependencies    | None                    |
| Estimated Lines | 120-180                 |

## Overview

The KYC module at `apps/api/src/routes/kyc.ts` has no authentication or authorization on any of its six endpoints. The `authPlugin` used across the rest of the API provides JWT-based authentication after Stellar wallet signature verification. This issue applies that plugin to KYC routes and adds ownership enforcement where the resource is user-scoped.

The implementation follows the same pattern already established in `apps/api/src/routes/properties.ts` and `apps/api/src/routes/lending.ts`. Reading those files before starting is recommended.

## Prerequisites

Before writing code, read the following files to understand the existing patterns:

- `apps/api/src/middleware/auth.ts` - defines `authPlugin` and the `getAuthenticatedUser` function
- `apps/api/src/routes/properties.ts` - example of ownership check using `getAuthenticatedUser`
- `apps/api/src/routes/lending.ts` - another example of protected routes
- `apps/api/src/routes/kyc.ts` - the file to be modified

## Understanding the Auth System

The `authPlugin` is an Elysia plugin that derives a `getAuthenticatedUser` function into the request context. Calling it either returns the authenticated user or throws a `401 ApiError`. The returned object has this shape:

```typescript
{
  id: string;
  walletAddress: string;
}
```

To protect a route, add `.use(authPlugin)` before the handler and call `getAuthenticatedUser()` inside the handler. For ownership checks, compare the returned `id` or `walletAddress` against the route parameter.

## Implementation Steps

### Step 1: Understand the current route structure

Open `apps/api/src/routes/kyc.ts`. There are six routes:

- `GET /kyc/status/:userId`
- `GET /kyc/documents/:userId`
- `GET /kyc/file/:documentId`
- `POST /kyc/upload`
- `POST /kyc/submit`
- `POST /kyc/verify/:documentId`

Each has a different protection requirement. Do not apply the same guard to all of them without reading what each one does.

### Step 2: Apply user JWT protection

For `GET /kyc/status/:userId`, `GET /kyc/documents/:userId`, `GET /kyc/file/:documentId`, `POST /kyc/upload`, and `POST /kyc/submit`, apply `authPlugin` and call `getAuthenticatedUser()` at the start of the handler.

For the routes that accept a `:userId` parameter, compare the authenticated user's `id` against the parameter. If they do not match, throw a `403 ApiError`. The error codes to use are `UNAUTHORIZED` for missing tokens and `FORBIDDEN` for ownership mismatches. Check `apps/api/src/errors/ApiError.ts` for the correct constructor signature.

Example pattern from `properties.ts`:

```typescript
.use(authPlugin)
.get('/status/:userId', async ({ params: { userId }, set, getAuthenticatedUser }: any) => {
  try {
    const user = await getAuthenticatedUser();
    if (user.id !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied');
    }
    return await KYCController.getKYCStatus(userId);
  } catch (error) {
    return handleKycError(error, set);
  }
})
```

### Step 3: Protect the verify endpoint with an internal API key

`POST /kyc/verify/:documentId` is an admin-only action and must not be reachable by regular users. The correct pattern is to check for an `x-internal-api-key` header and compare it against an environment variable.

Create a small middleware or inline check:

```typescript
.post('/verify/:documentId', async ({ params: { documentId }, body, set, headers }: any) => {
  try {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey || headers['x-internal-api-key'] !== internalKey) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Internal API key required');
    }
    return await KYCController.verifyDocument(
      documentId,
      body as { verified: boolean; notes?: string },
    );
  } catch (error) {
    return handleKycError(error, set);
  }
})
```

Add `INTERNAL_API_KEY` to `apps/api/.env.example` with a description of its purpose.

### Step 4: Resolve the typing

The existing route handlers use `any` casts on the context parameter. Do not introduce new `any` casts. When you apply `authPlugin`, Elysia's type inference provides `getAuthenticatedUser` in the context. If the existing `any` casts are already present on unchanged handlers, leave them as-is - do not expand their scope. New handlers you write must be typed correctly. If you run into Elysia inference issues, document the blocker in a comment rather than casting to `any`.

### Step 5: Write the tests

Extend `apps/api/src/__tests__/kyc.test.ts` to cover the following scenarios. Use the existing test patterns in that file for mocking and setup.

Tests to add:

- No token on `GET /kyc/status/:userId` returns `401`
- Valid token for a different user on `GET /kyc/status/:userId` returns `403`
- Owner token on `GET /kyc/status/:userId` returns `200`
- No token on `GET /kyc/documents/:userId` returns `401`
- Cross-user token on `GET /kyc/documents/:userId` returns `403`
- User JWT on `POST /kyc/verify/:documentId` returns `401`
- Missing `x-internal-api-key` on `POST /kyc/verify/:documentId` returns `401`
- Correct internal key on `POST /kyc/verify/:documentId` returns `200`
- Cross-user token on `POST /kyc/submit` returns `403`

## What Not to Do

Do not apply `authPlugin` globally to the entire `kycRoutes` instance and then try to exempt individual routes. Elysia's plugin model means the cleanest approach is to apply the plugin per route or per group of routes that share the same protection. Look at how `properties.ts` groups protected routes to understand the recommended pattern.

Do not use `any` on new code. Do not disable ESLint rules. Do not submit with failing tests.

## Validation

Before opening a pull request, verify locally:

1. `bun run type-check` passes in `apps/api`
2. `bun run lint` passes in `apps/api`
3. `bun test` passes in `apps/api`
4. A manual curl with no token to `/kyc/status/:userId` returns `401`
5. A manual curl with a valid token for a different user returns `403`

All GitHub Actions workflows must pass on the pull request before requesting a review.

## Definition of Done

- All six KYC endpoints enforce the correct access control.
- All new test scenarios pass.
- All existing tests pass without modification.
- `INTERNAL_API_KEY` is documented in `.env.example`.
- No new `any` casts or linting suppressions are introduced.
- All CI workflows pass on the pull request.
