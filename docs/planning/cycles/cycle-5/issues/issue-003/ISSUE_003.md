# Implement PropertyNFT Soroban Contract with Cougr

## Context

PropertyNFT is the ownership layer of Akkuea Land. Each of the 400 property tiles in the city is a non-fungible token identified by its grid coordinates. The contract must track ownership, enforce transfer rules, store building metadata, and emit events that the frontend and indexer consume.

This is the most foundational game contract. The GameMarketplace and GameEngine both depend on it for ownership verification and state updates.

## What Needs to Be Done

Implement the `game-property-nft` Soroban contract using Cougr's `SimpleWorld` ECS backend and standards layer. The contract stores each property as an ECS entity with components for coordinates, owner address, improvement level, and the ledger number of the last rental claim.

The contract exposes the following entry points: `initialize` (mints all 400 tiles to the game treasury address), `transfer` (moves ownership from sender to recipient, enforces caller is current owner), `approve` and `transfer_from` (for marketplace escrow patterns), `get_property` (returns full property state), `get_owner` (returns current owner address), and `list_by_owner` (returns all property IDs owned by a given address).

Cougr's `Ownable` standard should protect the `initialize` function so it can only be called once by the deploying account. Use the `Pausable` standard to allow emergency halting of transfers.

All entry points must emit Soroban contract events. The frontend and the API indexer both depend on these events for real-time updates.

## Acceptance Criteria

- All 400 properties are mintable via `initialize`.
- Ownership transfers enforce that `caller == current_owner`.
- `approve` and `transfer_from` work correctly for the marketplace escrow pattern.
- Events are emitted for every state change.
- `cargo test` passes with at least one test per entry point.
- All CI workflows pass on the submitted pull request.

## Quality Standard

No `any` types. No disabled clippy rules. Every transfer path must be covered by a test. The contract must be deployable with `stellar contract build`. Write production-quality Rust: no `.unwrap()` in non-test code, handle errors with `panic_with_error!` and a typed `GameError` enum.
