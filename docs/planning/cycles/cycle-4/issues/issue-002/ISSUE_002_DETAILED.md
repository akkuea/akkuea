# C4-002: Upgrade Next.js to Resolve Security Vulnerabilities

## Issue Metadata

| Attribute       | Value                       |
| --------------- | --------------------------- |
| Issue ID        | C4-002                      |
| Area            | WEBAPP                      |
| Difficulty      | Trivial                     |
| Labels          | frontend, security, trivial |
| Dependencies    | None                        |
| Estimated Lines | 2-5                         |

## Overview

Thirteen Dependabot alerts are open against Next.js 16.1.7 in this repository. All are resolved by upgrading to 16.2.6. This document covers the upgrade procedure, what to verify, and how to write a complete pull request.

## Vulnerabilities Being Resolved

The following alerts are closed by this upgrade:

- Middleware and proxy bypass via segment-prefetch routes (two separate CVEs, one an incomplete fix of the other)
- Middleware and proxy bypass in Pages Router applications using i18n
- Server-side request forgery via WebSocket upgrade handling
- Denial of service via connection exhaustion in Cache Component applications
- Denial of service with Server Components (two separate CVEs)
- Cross-site scripting in App Router applications using CSP nonces
- Cross-site scripting in `beforeInteractive` scripts with untrusted input
- Cache poisoning in React Server Component responses
- Cache poisoning via React Server Component cache-busting collisions
- Cache poisoning via middleware and proxy redirect collisions
- Denial of service in the Image Optimization API

## Upgrade Steps

### Step 1: Update the version

In `apps/webapp/package.json`, change the `next` entry:

```json
"next": "^16.2.6"
```

### Step 2: Regenerate the lockfile

From the repository root:

```bash
bun install
```

This updates `bun.lock`. Commit the updated lockfile alongside the package.json change.

### Step 3: Verify the build

```bash
cd apps/webapp
bun run build
```

The build must complete without errors. Review any warnings in the output and include them in the pull request description for visibility, but do not fix unrelated issues in this pull request.

### Step 4: Run the full CI check suite locally

```bash
cd apps/webapp
bun run type-check
bun run lint
bun run build
```

All three must pass before opening the pull request.

## What to Check for Regressions

Next.js patch releases do not introduce breaking changes, but verify the following manually or through existing tests:

- The landing page renders correctly.
- The marketplace page loads and displays properties.
- The dashboard page renders for a connected wallet.
- The KYC flow navigates through all steps without errors.
- The admin operations proxy route at `app/api/admin/operations/[[...path]]/route.ts` continues to forward requests correctly.

## Pull Request Description Template

The pull request description should include:

- A one-sentence summary of the change.
- The list of Dependabot alert numbers being resolved (Dependabot alert #122 through #136 where applicable).
- Confirmation that the build passes and no application code was modified.
- Any warnings observed during the build that require future attention.

## Definition of Done

- `next` is pinned to `^16.2.6` or higher in `apps/webapp/package.json`.
- `bun.lock` is updated and committed.
- `bun run build` passes without errors.
- All CI workflows pass on the pull request.
- The pull request description references the resolved Dependabot alerts.
