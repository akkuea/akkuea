# Implement LandToken Fungible Token Contract

## Context

LAND is the in-game currency of Akkuea Land. Players use it to buy properties, pay for improvements, and receive rental income. The token must be a standard Stellar SEP-41 compatible fungible token so that wallet integrations and future exchange listings work without custom code.

## What Needs to Be Done

Implement the `game-land-token` Soroban contract as a SEP-41 compatible fungible token. The entry points are the standard token interface: `initialize`, `mint`, `burn`, `transfer`, `transfer_from`, `approve`, `allowance`, `balance`, `decimals`, `name`, and `symbol`.

In addition, implement a `faucet` function that mints a fixed starter allocation (1,000 LAND tokens) to the caller. The faucet must be callable only once per address and only on testnet. Track which addresses have already used the faucet in instance storage.

Use Cougr's `Ownable` standard to restrict `mint` to the game treasury and GameEngine contract addresses. The `faucet` does not require admin access but does require the contract to be in testnet mode (a flag set during `initialize`).

## Acceptance Criteria

- All SEP-41 token interface functions are implemented.
- The `faucet` function mints 1,000 LAND to the caller once per address.
- `mint` is restricted to authorized callers.
- `cargo test` passes with at least one test per entry point.
- All CI workflows pass on the submitted pull request.

## Quality Standard

The token contract is critical infrastructure. No shortcuts on the SEP-41 interface: all functions must match the spec exactly. The faucet must be airtight: one claim per address enforced on-chain, not by convention. No `.unwrap()` in non-test code.
