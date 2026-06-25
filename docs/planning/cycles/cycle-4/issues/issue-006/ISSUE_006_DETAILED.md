# C4-006: Mount Missing Notifications Route

## Issue Metadata

| Attribute       | Value                 |
| --------------- | --------------------- |
| Issue ID        | C4-006                |
| Area            | API                   |
| Difficulty      | Trivial               |
| Labels          | backend, bug, trivial |
| Dependencies    | None                  |
| Estimated Lines | 2-10                  |

## Overview

`apps/api/src/index.ts` mounts routes for properties, lending, users, KYC, oracle, and risk monitoring. Notifications is the only route module that is fully implemented but never registered.

## The Fix

Open `apps/api/src/index.ts`. At the top of the file, add the import alongside the other route imports:

```typescript
import { notificationsRoutes } from "./routes/notifications";
```

Then add the route to the application chain. Following the existing pattern:

```typescript
app
  .use(swagger({ ... }))
  .use(errorHandler)
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)
  .use(oracleRoutes)
  .use(riskMonitoringRoutes)
  .use(notificationsRoutes)  // add this line
  .get('/health', ...)
```

## Verification

Start the API locally and send a request to a notifications endpoint:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/notifications
```

Before the fix, this returns 404. After the fix, it returns 200 or 401 depending on the token. Either response confirms the route is registered.

## Smoke Test

Add a test to confirm the route is reachable. In `apps/api/src/tests/` or alongside the existing route tests, add:

```typescript
it("GET /notifications returns 401 without auth", async () => {
  const response = await app.handle(
    new Request("http://localhost/notifications"),
  );
  expect(response.status).toBe(401);
});
```

A 401 confirms the route is mounted and the auth guard is active. A 404 means the route is still missing.

## Definition of Done

- `notificationsRoutes` is imported and mounted in `apps/api/src/index.ts`.
- `GET /notifications` no longer returns 404.
- A smoke test verifies the route is reachable.
- All existing tests pass.
- All CI workflows pass on the pull request.
