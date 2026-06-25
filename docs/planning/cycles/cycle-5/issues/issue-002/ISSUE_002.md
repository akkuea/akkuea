# Bootstrap Game Contracts Cargo Workspace

## Context

The existing Soroban contracts live in `apps/contracts/contracts/defi-rwa`. The game requires four new contracts: PropertyNFT, LandToken, GameMarketplace, and GameEngine. These need to be added to the Cargo workspace before any contract implementation can begin.

## What Needs to Be Done

Add four new contract directories under `apps/contracts/contracts/`. Register them in the workspace `Cargo.toml` at `apps/contracts/Cargo.toml`. Each directory should contain a minimal `Cargo.toml` and a stub `src/lib.rs` that compiles without errors. The stub does not need to implement any game logic; it just needs to verify the workspace is wired correctly.

Confirm that `cargo build --target wasm32v1-none --release` and `cargo test` pass for all four new crates.

## Acceptance Criteria

- Four directories exist: `game-property-nft`, `game-land-token`, `game-marketplace`, `game-engine`.
- All four are registered in `apps/contracts/Cargo.toml`.
- `cargo build` and `cargo test` pass across the workspace.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Stub contracts should be minimal: a single `#![no_std]` lib with a `#[contract]` struct and one placeholder `#[contractimpl]` function. The goal is a buildable starting point, not a complete implementation.
