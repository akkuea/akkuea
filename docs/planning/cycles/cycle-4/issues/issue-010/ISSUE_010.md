# Add Mock Data Layer and Configure Vercel Preview Deployment

## Context

Every page in the webapp that displays data makes live HTTP calls to the backend API. If the API is not running, all pages show error states. This makes it impossible to review frontend pull requests visually, prevents contributors from working on UI without a full local stack, and blocks Vercel preview deployments since Vercel has no access to a local backend.

The fix is a mock data layer that intercepts API calls in the browser when an environment variable is set, combined with a Vercel deployment configuration that enables fully functional preview deployments for every pull request.

## What Needs to Be Done

Integrate Mock Service Worker (MSW) into the webapp. Create realistic mock data fixtures that cover all data shapes returned by the API: properties, lending pools, user positions, portfolio data, and transactions. Add a `NEXT_PUBLIC_USE_MOCK=true` environment variable that enables the mock layer. Configure `vercel.json` and a GitHub Actions workflow that deploys previews to Vercel on pull requests targeting `develop`.

When the mock layer is active, the app must be fully navigable: the marketplace shows properties, the dashboard shows portfolio data, the lending page shows pools, and the KYC flow progresses through its steps. The wallet connection can remain simulated.

## Acceptance Criteria

- MSW is installed and initialized correctly for the Next.js App Router.
- All API endpoints used by the webapp have corresponding mock handlers.
- Setting `NEXT_PUBLIC_USE_MOCK=true` enables the mock layer with no other changes.
- The app is fully navigable with the mock layer active.
- `vercel.json` is configured and the webapp deploys successfully to Vercel.
- A GitHub Actions workflow deploys preview URLs for pull requests targeting `develop`.
- All existing tests continue to pass.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create the MSW setup file at `apps/webapp/src/mocks/`, including the service worker registration, handlers for each API module, and fixture data files. Create `apps/webapp/vercel.json`. Create `.github/workflows/vercel-preview.yml`. Modify `apps/webapp/src/components/Providers.tsx` to conditionally initialize MSW when the environment variable is set.

## Quality Standard

Mock data must be realistic and representative of actual API responses. Do not use empty arrays or null values as fixtures because that hides UI edge cases. The Vercel deployment configuration must be tested and verified to produce a working preview URL. This issue significantly improves the contributor experience and must be done well. All CI workflows must pass.
