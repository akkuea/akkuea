# Define Game Economy, Property Schema, and Shared Types

## Context

Akkuea Land requires a shared contract between the Soroban contracts and the web frontend: the data structures, economic rules, and vocabulary that all components agree on. Without this foundation, contract contributors and frontend contributors will make incompatible assumptions about property states, token amounts, and improvement levels.

This issue establishes that foundation. It produces a TypeScript type package in `apps/shared` and a written specification of the game economy that all other Cycle 5 issues can reference.

## What Needs to Be Done

Define the TypeScript types for all game entities in `apps/shared/src/types/game.ts`. These types represent the on-chain state as it will be returned by the Quasar typed clients and consumed by React components.

The core types are: `Property` (coordinates, owner, building level, rental rate multiplier, last claimed ledger), `Player` (wallet address, LAND token balance), `Listing` (property id, seller, price, created ledger), `Improvement` (the four building levels as a discriminated union), and `GameEvent` (union of on-chain events: PropertyBought, PropertyListed, PropertyImproved, RentalClaimed).

Write the token economics specification as a comment block at the top of the types file or in a separate `docs/game/ECONOMY.md`. The specification must answer: how many LAND tokens does a player start with, what is the base rental income per epoch, what is the epoch length in ledgers, how much does each improvement level cost, and how much does each improvement level multiply the base rate.

## Acceptance Criteria

- `apps/shared/src/types/game.ts` exports all game types with no `any` and no disabled lint rules.
- A written economy specification documents the numeric constants used by the contracts.
- `bun run type-check` passes in `apps/shared`.
- All CI workflows pass on the submitted pull request.

## Quality Standard

This file is the contract between all contributors on this cycle. Precision matters more than brevity. Types should be specific: `ImprovementLevel` is a string literal union, not a plain string. Coordinates are typed as `{ x: number; y: number }`, not as a flat array. Ledger numbers are `number`, not `string`. No shortcuts.
