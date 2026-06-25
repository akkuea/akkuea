# Add Error Boundaries and Graceful Offline Degradation

## Context

The webapp currently has no error boundaries. When a React component throws during rendering, the entire page unmounts and shows a blank screen. When the API is unavailable, pages that depend on live data show error strings inline but have no consistent fallback state. Users have no way to continue navigating the app when one section fails.

This issue adds React error boundaries at the page level and improves the degraded-state experience for pages that depend on API data, so the app remains usable when the backend is unavailable or a component encounters an unexpected error.

## What Needs to Be Done

Create a reusable `ErrorBoundary` component and wrap each major page section with it. Implement consistent empty and error states for the marketplace, dashboard, lending, and KYC pages that inform the user clearly without exposing technical error details. Ensure the app remains navigable when one section fails: a broken dashboard should not prevent the user from visiting the marketplace.

## Acceptance Criteria

- An `ErrorBoundary` component exists and wraps each page's primary content area.
- When a component throws, the error boundary catches it and renders a user-facing fallback instead of a blank page.
- Pages with data dependencies show a consistent, branded error state when the API is unreachable.
- Navigation remains functional when any single page encounters an error.
- All existing tests pass.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create `apps/webapp/src/components/ui/ErrorBoundary.tsx`. Modify each page file under `apps/webapp/src/app/` to wrap primary content areas. Optionally create shared empty-state components for reuse across pages.

## Quality Standard

Error states must be professional and informative without exposing stack traces or internal error messages to the user. The fallback UI must match the app's visual design. Do not swallow errors silently; use `console.error` in the boundary's `componentDidCatch` so errors remain visible in development. All CI workflows must pass.
