# Mount Missing Notifications Route

## Context

The notifications system has a complete implementation: a route file at `apps/api/src/routes/notifications.ts`, a controller, a service, a worker, and a database migration. However, the route is never registered in the production entry point at `apps/api/src/index.ts`. Every request to any `/notifications/**` endpoint returns 404 in production.

This is the same class of omission that affected the oracle route in a prior cycle. The fix is a two-line change.

## What Needs to Be Done

Import `notificationsRoutes` in `apps/api/src/index.ts` and add it to the Elysia application chain, following the same pattern used for `oracleRoutes` and `riskMonitoringRoutes`. Add a smoke test that confirms the route responds.

## Acceptance Criteria

- `GET /notifications` returns a non-404 response for authenticated requests.
- `notificationsRoutes` is imported and mounted in `apps/api/src/index.ts`.
- A smoke test confirms the route is reachable.
- All existing tests continue to pass.
- All CI workflows pass on the submitted pull request.

## Files to Modify

The only required change is in `apps/api/src/index.ts`. Add the import and the `.use(notificationsRoutes)` call. Optionally extend `apps/api/src/tests/` with a smoke test for the notifications endpoint.

## Quality Standard

This is a one-line fix. Keep the pull request focused. Do not refactor surrounding code, do not change the notifications implementation, and do not add unrelated changes. All CI workflows must pass.
