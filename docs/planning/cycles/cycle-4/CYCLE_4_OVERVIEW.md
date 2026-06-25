# Cycle 4: Security, Foundation, and Immersive Experience

## Overview

| Attribute     | Value                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Cycle Number  | 4                                                                                               |
| Total Issues  | 17                                                                                              |
| Focus Areas   | Security hardening, dependency cleanup, developer experience, wallet architecture, immersive UX |
| Prerequisites | Cycle 3 completion                                                                              |

## Objective

This cycle addresses three parallel tracks. The first is security and technical debt: open CVEs in Next.js and drizzle-orm, a KYC module without authentication, deprecated dependencies causing bundle bloat, and missing CI coverage. The second is developer experience: a mock data layer that enables Vercel preview deployments and local development without a backend, and type safety throughout the API route layer. The third is product differentiation: a modular wallet architecture that supports smart accounts and embedded wallets, a governance integration, typed Soroban contract clients, and a 3D property viewer using Gaussian Splatting.

## Issue Distribution by Area

| Area   | Count | Issues                                                         |
| ------ | ----- | -------------------------------------------------------------- |
| API    | 4     | C4-001, C4-003, C4-006, C4-009                                 |
| WEBAPP | 8     | C4-002, C4-005, C4-010, C4-011, C4-012, C4-013, C4-014, C4-017 |
| SHARED | 2     | C4-004, C4-015, C4-016                                         |
| REPO   | 3     | C4-007, C4-008                                                 |

## Issue Distribution by Difficulty

| Difficulty | Count | Issues                                                 |
| ---------- | ----- | ------------------------------------------------------ |
| Trivial    | 6     | C4-002, C4-003, C4-004, C4-006, C4-008                 |
| Medium     | 4     | C4-005, C4-007, C4-011, C4-014, C4-016                 |
| High       | 7     | C4-001, C4-009, C4-010, C4-012, C4-013, C4-015, C4-017 |

## Issues Summary

| ID     | Title                                                         | Area   | Difficulty | Dependencies |
| ------ | ------------------------------------------------------------- | ------ | ---------- | ------------ |
| C4-001 | Secure KYC endpoints with authentication guards               | API    | High       | None         |
| C4-002 | Upgrade Next.js to resolve security vulnerabilities           | WEBAPP | Trivial    | None         |
| C4-003 | Upgrade drizzle-orm to resolve SQL injection vulnerability    | API    | Trivial    | None         |
| C4-004 | Remove soroban-client and standardize on @stellar/stellar-sdk | SHARED | Trivial    | None         |
| C4-005 | Enable webapp unit tests in CI                                | WEBAPP | Medium     | None         |
| C4-006 | Mount missing notifications route                             | API    | Trivial    | None         |
| C4-007 | Add PR template, issue templates, and changelog automation    | REPO   | Medium     | None         |
| C4-008 | Remove test snapshots and exclude from git                    | REPO   | Trivial    | None         |
| C4-009 | Replace Elysia route handler any casts with typed context     | API    | High       | None         |
| C4-010 | Add mock data layer and configure Vercel preview deployment   | WEBAPP | High       | None         |
| C4-011 | Add error boundaries and graceful offline degradation         | WEBAPP | Medium     | None         |
| C4-012 | Integrate smart-account-kit as a modular wallet provider      | WEBAPP | High       | None         |
| C4-013 | Integrate Privy for embedded Stellar wallet login             | WEBAPP | High       | C4-012       |
| C4-014 | Integrate Pollar as a modular wallet and governance provider  | WEBAPP | Medium     | C4-012       |
| C4-015 | Integrate Quasar for typed Soroban contract invocations       | SHARED | High       | None         |
| C4-016 | Migrate CONTRACT_IDS to JSON and document testnet deployment  | SHARED | Medium     | None         |
| C4-017 | Integrate 3D Gaussian Splatting viewer for property previews  | WEBAPP | High       | None         |

## Acceptance Criteria for Cycle Completion

| Criteria                    | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| All CVEs resolved           | Next.js and drizzle-orm are upgraded to patched versions              |
| KYC endpoints secured       | All six KYC endpoints enforce authentication and ownership checks     |
| SDK standardized            | soroban-client removed and all packages use @stellar/stellar-sdk      |
| CI passing                  | Webapp unit tests run in CI with 60% coverage gate                    |
| Preview deployments active  | Vercel preview URLs are generated for pull requests targeting develop |
| Wallet architecture modular | smart-account-kit and Privy are integrated as swappable providers     |
| Contract clients typed      | Quasar typed clients replace raw XDR construction in StellarService   |
| 3D viewer functional        | PropertyViewer3D renders .splat files with graceful degradation       |

## Parallel Workstreams

Issues within this cycle have no internal dependencies except C4-013 and C4-014, which depend on C4-012. All other issues can be worked in parallel.

| Developer Focus          | Recommended Issues             |
| ------------------------ | ------------------------------ |
| Backend / Security       | C4-001, C4-003, C4-006, C4-009 |
| Frontend / Developer Exp | C4-002, C4-005, C4-010, C4-011 |
| Wallet Architecture      | C4-012, C4-013, C4-014         |
| Blockchain / Shared      | C4-004, C4-015, C4-016         |
| 3D / Product Diff        | C4-017                         |
| Repo / Operations        | C4-007, C4-008                 |

## Notes

- Trivial issues in this cycle are genuine security patches and should not be deferred.
- C4-012 must be completed before C4-013 and C4-014 are assigned.
- C4-017 is the highest-effort frontend issue and should be assigned to a contributor with WebGL or Three.js experience.
- The wallet provider architecture introduced in C4-012 is designed to accommodate future providers without interface changes.
