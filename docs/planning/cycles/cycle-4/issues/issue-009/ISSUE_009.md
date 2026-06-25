# Replace Elysia Route Handler any Casts with Typed Context

## Context

Every route handler across the API route files casts the Elysia context parameter to `any`. There are over 200 occurrences, each suppressed with an `eslint-disable-next-line` comment. This is not a style concern: it means the type system provides no safety on request parameters, body shapes, or injected dependencies like `getAuthenticatedUser`. Bugs in these handlers cannot be caught by the compiler.

The root cause is not careless code but a missing configuration step. Elysia provides a type inference system that, when properly set up, derives the context type from the plugin chain. Routes using `authPlugin`, `validate`, and other middleware can have their context typed without any manual annotation.

## What Needs to Be Done

Configure Elysia's type inference so that route handlers across all route files receive properly typed contexts instead of `any`. Remove all `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments and `any` casts from route handlers. The implementation must not break any existing behavior and must not reduce type safety by introducing alternative workarounds.

This is a cross-cutting refactor that touches every route file. The approach must be systematic and verifiable, not piecemeal.

## Acceptance Criteria

- No `any` casts remain on Elysia context parameters in route handler files.
- No `eslint-disable` comments exist to suppress `no-explicit-any` on context parameters.
- `bun run type-check` passes in `apps/api` with no errors introduced by this change.
- All existing tests pass without modification.
- All CI workflows pass on the submitted pull request.

## Files to Modify

All files under `apps/api/src/routes/` require changes. The middleware files in `apps/api/src/middleware/` may also need updates to expose proper types from plugins.

## Quality Standard

This issue requires understanding how Elysia's type inference works before writing code. Read the Elysia documentation on context typing and derived types before starting. Do not replace `any` with another escape hatch like `unknown` casts or `@ts-ignore`. The result must be genuine type safety. All CI workflows must pass, and `bun run type-check` must be clean.
