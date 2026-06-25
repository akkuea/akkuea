# C4-009: Replace Elysia Route Handler any Casts with Typed Context

## Issue Metadata

| Attribute       | Value         |
| --------------- | ------------- |
| Issue ID        | C4-009        |
| Area            | API           |
| Difficulty      | High          |
| Labels          | backend, high |
| Dependencies    | None          |
| Estimated Lines | 200-350       |

## Overview

Elysia infers context types from the plugin chain. When `authPlugin`, `validate`, or other middleware is applied with `.use()`, the resulting context type includes the properties those plugins derive. The issue is that route handlers are currently annotated with `(ctx: any)`, which bypasses this inference entirely. The fix is to remove the annotation and let TypeScript infer the context from the plugin chain.

## Understanding Elysia's Type System

Elysia uses a builder pattern where each `.use()`, `.derive()`, and `.decorate()` call modifies the inferred type of the app. When you write:

```typescript
const route = new Elysia()
  .use(authPlugin)
  .get("/example", ({ getAuthenticatedUser }) => {
    // getAuthenticatedUser is typed here because authPlugin derives it
  });
```

TypeScript infers the full context including `getAuthenticatedUser` without any annotation. The `any` cast overrides this inference and is why the type system is not providing value.

## Implementation Strategy

### Step 1: Start with a single route file

Begin with `apps/api/src/routes/notifications.ts` since it is the smallest and most uniform. Remove the `any` casts from every handler and observe what TypeScript infers.

For a route that uses `authPlugin`:

```typescript
// Before
.get('/', async (ctx: any) => NotificationController.getUserNotifications(ctx))

// After
.get('/', async (ctx) => NotificationController.getUserNotifications(ctx))
```

If the controller expects a specific context shape, you may need to update the controller's parameter type to match what Elysia infers, or extract the needed properties explicitly in the handler.

### Step 2: Understand when explicit types are needed

In some cases, Elysia's inference requires help. For routes that use `validate` middleware, the validated body type is available as `validatedBody` on the context. If TypeScript cannot infer this automatically, you can type the destructured parameter explicitly using Elysia's `Context` type:

```typescript
import type { Context } from 'elysia';

// Extract only what you need
.post('/submit', async ({ body, set }: Pick<Context, 'body' | 'set'>) => {
  // body is typed as unknown here; use Zod parsing in the handler
})
```

Prefer destructuring over full context annotation when possible.

### Step 3: Handle the validate middleware cases

Routes that use `validate({ body: schema })` inject `validatedBody` into the context. This is a derived property added by the `validate` plugin. If TypeScript does not infer it correctly, inspect the `validate` function in `apps/api/src/middleware/validation.ts` to confirm it uses `.derive()` properly. If it does not, add the derive call to expose the typed value.

### Step 4: Handle controllers that expect the full context

Several controllers like `NotificationController.getUserNotifications(ctx)` receive the entire context object. If those controllers type their parameter as `any`, this issue should also fix those types. Prefer to extract only the needed fields in the route handler and pass them explicitly to the controller:

```typescript
.get('/', async ({ getAuthenticatedUser, set }) => {
  return NotificationController.getUserNotifications({ getAuthenticatedUser, set });
})
```

This is cleaner than passing an untyped blob and aligns with how the controller API should work.

### Step 5: Work through each route file

After notifications.ts is clean, apply the same approach to:

1. `users.ts`
2. `lending.ts`
3. `properties.ts`
4. `kyc.ts`
5. `oracle.ts`
6. `riskMonitoring.ts`
7. `webhooks.ts`
8. `internalOperations.ts`

Run `bun run type-check` after each file to catch issues incrementally rather than at the end.

## Common Pitfalls

Do not replace `any` with `unknown` and add a cast inside the function. That is not a fix.

Do not add `// @ts-ignore` to suppress errors. If TypeScript reports an error, understand why and fix the underlying type problem.

If a controller's method signature is `(ctx: any)`, fix that signature as part of this work. The goal is genuine type safety throughout the handler chain.

## Validation

When complete, run:

```bash
cd apps/api
bun run type-check
bun run lint
bun test
```

All three must pass with no new errors and no suppressions.

## Definition of Done

- Zero `(ctx: any)` annotations in route handler files.
- Zero `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments on context parameters.
- `bun run type-check` passes with no errors.
- All existing tests pass without modification.
- All CI workflows pass on the pull request.
