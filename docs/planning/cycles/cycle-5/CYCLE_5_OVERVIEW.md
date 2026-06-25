# Cycle 5: Akkuea Land: Real Estate Game on Stellar

## Overview

| Attribute     | Value                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| Cycle Number  | 5                                                                          |
| Total Issues  | 17                                                                         |
| Focus Areas   | Soroban game contracts, Cougr ECS engine, standalone game app, Pollar auth |
| Prerequisites | Cycle 4 C4-012 (modular wallet architecture), C4-015 (Quasar integration)  |

## Objective

This cycle delivers Akkuea Land, a real estate investment game built on Stellar. Players authenticate via Pollar (social login or external wallet), buy virtual property tiles using LAND tokens, earn rental income as ledger epochs advance, list properties on a peer-to-peer marketplace, and improve buildings to increase rental yields.

The game lives in `apps/akkuea-land/`, a completely independent Next.js application that shares nothing with `apps/webapp` or `apps/api` except the types and generated contract clients in `apps/shared`. It has its own package.json, its own Vercel deployment, its own environment variables, and its own API routes for event indexing. The only runtime dependencies outside of `apps/akkuea-land/` are the four Soroban game contracts deployed on Stellar testnet.

The four contracts are written in Rust using Cougr ECS (`cougr-core = "1.0.0"`). The frontend uses CSS Grid, Tailwind, and standard React. No WebGL, no canvas game engines, no heavy animation libraries.

## Game Concept

A 20x20 grid of 400 virtual property tiles represents the city. Each tile is a Soroban NFT identified by its grid coordinates. Players use LAND tokens to buy vacant properties from the game treasury or from other players. Rental income accrues every 100 ledgers. Buildings can be improved across four levels: Vacant, Residential, Commercial, Skyscraper, each multiplying the base rental rate. Properties can be listed and sold on the open marketplace.

New players connect with Google, GitHub, or email via Pollar, which provisions a Stellar wallet automatically and sponsors transaction fees so players never handle XLM directly.

## Application Structure

```
apps/
  akkuea-land/                    ← standalone Next.js app (this cycle)
    package.json                  ← own dependencies (@pollar/react, etc.)
    src/app/
      api/game/events/            ← SSE event indexer (Next.js route handler)
      (auth)/login/               ← Pollar login page
      map/                        ← city map
      marketplace/                ← listings
      dashboard/                  ← player portfolio
  contracts/contracts/
    game-property-nft/            ← Soroban NFT contract
    game-land-token/              ← Soroban token contract
    game-marketplace/             ← Soroban marketplace contract
    game-engine/                  ← Soroban game engine (Cougr ECS)
  shared/src/
    types/game.ts                 ← shared types (only coupling point)
    contracts/game/               ← Quasar-generated typed clients
```

## Issue Distribution by Area

| Area      | Count | Issues                                                         |
| --------- | ----- | -------------------------------------------------------------- |
| CONTRACTS | 6     | C5-002, C5-003, C5-004, C5-005, C5-006, C5-015                 |
| GAME      | 8     | C5-007, C5-008, C5-009, C5-010, C5-011, C5-012, C5-014, C5-016 |
| SHARED    | 3     | C5-001, C5-013, C5-017                                         |

## Issue Distribution by Difficulty

| Difficulty | Count | Issues                                                                 |
| ---------- | ----- | ---------------------------------------------------------------------- |
| Trivial    | 3     | C5-002, C5-013, C5-017                                                 |
| Medium     | 5     | C5-001, C5-004, C5-007, C5-012, C5-015                                 |
| High       | 9     | C5-003, C5-005, C5-006, C5-008, C5-009, C5-010, C5-011, C5-014, C5-016 |

## Issues Summary

| ID     | Title                                                    | Area      | Difficulty | Dependencies                   |
| ------ | -------------------------------------------------------- | --------- | ---------- | ------------------------------ |
| C5-001 | Define game economy, property schema, and shared types   | SHARED    | Medium     | None                           |
| C5-002 | Bootstrap game contracts Cargo workspace                 | CONTRACTS | Trivial    | None                           |
| C5-003 | Implement PropertyNFT Soroban contract with Cougr        | CONTRACTS | High       | C5-001, C5-002                 |
| C5-004 | Implement LandToken fungible token contract              | CONTRACTS | Medium     | C5-002                         |
| C5-005 | Implement GameMarketplace Soroban contract               | CONTRACTS | High       | C5-003, C5-004                 |
| C5-006 | Implement GameEngine contract with Cougr ECS             | CONTRACTS | High       | C5-003, C5-004                 |
| C5-007 | Bootstrap akkuea-land Next.js app and design system      | GAME      | Medium     | None                           |
| C5-008 | Integrate Pollar authentication and wallet provider      | GAME      | High       | C5-007                         |
| C5-009 | Build city map with interactive property tiles           | GAME      | High       | C5-007                         |
| C5-010 | Build property detail panel and action flows             | GAME      | High       | C5-007                         |
| C5-011 | Build game marketplace UI                                | GAME      | High       | C5-007, C5-013                 |
| C5-012 | Build player dashboard and income tracker                | GAME      | Medium     | C5-007, C5-013                 |
| C5-013 | Generate typed Soroban clients for game contracts        | SHARED    | Trivial    | C5-003, C5-004, C5-005, C5-006 |
| C5-014 | Add game event indexing and real-time board updates      | GAME      | High       | C5-007                         |
| C5-015 | Deploy game contracts to Stellar testnet                 | CONTRACTS | Medium     | C5-003, C5-004, C5-005, C5-006 |
| C5-016 | Build player onboarding and starter property claim       | GAME      | High       | C5-007, C5-008                 |
| C5-017 | Write game rules guide and developer setup documentation | SHARED    | Trivial    | None                           |

## Acceptance Criteria for Cycle Completion

| Criteria                  | Description                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------- |
| App deploys independently | akkuea-land deploys to Vercel without any dependency on apps/api or apps/webapp        |
| Pollar auth works         | Players can log in with Google or email and receive a Stellar wallet automatically     |
| Contracts deployed        | All four game contracts are live on Stellar testnet and verified                       |
| City map renders          | 20x20 grid renders with live ownership data from Soroban typed clients                 |
| Buy flow works end-to-end | A player can buy a property, sign via Pollar, and see the tile update                  |
| Rental income claimable   | A player can claim accrued LAND tokens from the dashboard                              |
| Marketplace functional    | Properties can be listed, browsed, and purchased                                       |
| Real-time updates active  | City map tile updates when another player buys without a page refresh                  |
| Onboarding complete       | A new player can complete onboarding and own their first property in under two minutes |

## Dependencies Between Issues

| Issue                                          | Depends On                     |
| ---------------------------------------------- | ------------------------------ |
| C5-003, C5-004                                 | C5-002                         |
| C5-005, C5-006                                 | C5-003, C5-004                 |
| C5-013, C5-015                                 | C5-003, C5-004, C5-005, C5-006 |
| C5-008, C5-009, C5-010, C5-011, C5-012, C5-014 | C5-007                         |
| C5-011, C5-012                                 | C5-013                         |
| C5-016                                         | C5-008                         |

## Parallel Workstreams

| Developer Focus        | Recommended Issues                           |
| ---------------------- | -------------------------------------------- |
| Blockchain / Contracts | C5-002, C5-003, C5-004 (then C5-005, C5-006) |
| App scaffold + Auth    | C5-007, C5-008                               |
| Game UI                | C5-009, C5-010 (then C5-011, C5-012, C5-016) |
| Real-time / Backend    | C5-014                                       |
| Shared / Types         | C5-001, C5-013, C5-017                       |

## Notes

- `apps/akkuea-land` must be completley self-contained. No imports from `apps/api` or `apps/webapp`.
- Pollar handles authentication AND transaction signing. `pollar.signAndSubmitTx(xdr)` replaces the custom signing flow.
- Fee sponsorship is handled by Pollar. Players never pay XLM gas directly.
- The event indexer (C5-014) lives inside akkuea-land as a Next.js Route Handler, not in apps/api.
- C5-013 generates typed clients used by C5-011, C5-012, and C5-016. Coordinate timing with the contracts track.
- Use mock data (pattern from C4-010) for all GAME issues until C5-015 is complete.
- CSS Grid for the city map. No canvas. No WebGL. Keep the bundle small.
- UX quality is a first-class requirement: smooth transitions, optimistic UI updates, proper loading skeletons, and actionable empty states on every page.
