# C4-010: Add Mock Data Layer and Configure Vercel Preview Deployment

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C4-010         |
| Area            | WEBAPP         |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | None           |
| Estimated Lines | 300-500        |

## Overview

This issue has two deliverables: a browser-side mock data layer using MSW, and a Vercel deployment configuration. They are related because the Vercel preview will use the mock layer to show a fully functional app without a backend.

## Part 1: MSW Mock Data Layer

### Install MSW

```bash
cd apps/webapp
bun add msw --dev
```

Initialize the service worker file:

```bash
bunx msw init public/ --save
```

This creates `apps/webapp/public/mockServiceWorker.js`. Commit this file.

### Create the mock structure

```
apps/webapp/src/mocks/
  handlers/
    properties.ts
    lending.ts
    users.ts
    transactions.ts
    kyc.ts
  fixtures/
    properties.ts
    lending.ts
    users.ts
    transactions.ts
  browser.ts
  index.ts
```

### browser.ts

```typescript
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

### handlers/properties.ts (example)

Use the `HttpResponse` and `http` imports from MSW v2:

```typescript
import { http, HttpResponse } from "msw";
import { mockProperties } from "../fixtures/properties";

export const propertyHandlers = [
  http.get("*/properties", () => {
    return HttpResponse.json({
      data: mockProperties,
      total: mockProperties.length,
    });
  }),

  http.get("*/properties/:id", ({ params }) => {
    const property = mockProperties.find((p) => p.id === params.id);
    if (!property) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(property);
  }),
];
```

### Fixtures

Fixtures must be realistic. Use real-looking Stellar addresses, real asset codes (USDC, XLM), and plausible financial values. For properties, include at least four entries with different property types, locations, funding states, and price points.

Example property fixture shape (based on the `PropertyInfo` type in `@akkuea/shared`):

```typescript
export const mockProperties: PropertyInfo[] = [
  {
    id: "prop-001",
    name: "Residencias Escazú Tower A",
    propertyType: "residential",
    location: { city: "San José", country: "Costa Rica" },
    totalValue: 850000,
    totalShares: 10000,
    availableShares: 6500,
    pricePerShare: 85,
    // ...remaining fields
  },
  // add at least three more
];
```

### Conditionally initialize in Providers.tsx

In `apps/webapp/src/components/Providers.tsx`, add the MSW initialization:

```typescript
async function initMocks() {
  if (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_MOCK === "true"
  ) {
    const { worker } = await import("@/mocks/browser");
    await worker.start({
      onUnhandledRequest: "warn",
    });
  }
}
```

Call `initMocks()` before rendering the app. Use a `useEffect` with a state gate to ensure the app does not render before MSW is ready, preventing race conditions on first load.

### Environment variable

Add to `apps/webapp/.env.example`:

```
# Enable mock data layer for local development and Vercel preview
# Set to true to use MSW instead of the real API
NEXT_PUBLIC_USE_MOCK=false
```

## Part 2: Vercel Configuration

### vercel.json

Create `apps/webapp/vercel.json`:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".next",
  "installCommand": "bun install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_USE_MOCK": "true",
    "NEXT_PUBLIC_API_URL": "https://api.akkuea.com"
  }
}
```

The `NEXT_PUBLIC_USE_MOCK=true` in the Vercel environment ensures previews use mock data.

### GitHub Actions workflow for Vercel preview

Create `.github/workflows/vercel-preview.yml`:

```yaml
name: Vercel Preview Deployment

on:
  pull_request:
    branches: [develop]
    paths:
      - "apps/webapp/**"

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/webapp
          github-comment: true
```

Document the required secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) in `docs/deployment/environment-variables.md`.

## Verification

Before submitting the pull request, verify:

1. `NEXT_PUBLIC_USE_MOCK=true bun run dev` starts the app and all pages are navigable.
2. The marketplace shows mock properties.
3. The dashboard shows mock portfolio data.
4. The lending page shows mock pools.
5. No network requests reach a real backend (check the browser Network tab).
6. `bun run build` succeeds with the mock layer included.

## Definition of Done

- MSW is installed and `public/mockServiceWorker.js` is committed.
- Handlers exist for all API modules used by the webapp.
- Fixtures contain at least four realistic entries per data type.
- `NEXT_PUBLIC_USE_MOCK=true` produces a fully navigable app.
- `vercel.json` is configured and documented.
- The Vercel preview workflow deploys on pull requests to `develop`.
- All existing tests pass.
- All CI workflows pass on the pull request.
