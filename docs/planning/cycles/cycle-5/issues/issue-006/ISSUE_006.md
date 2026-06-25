# Implement GameEngine Contract with Cougr ECS

## Context

The GameEngine is the core rules enforcer for Akkuea Land. It handles property improvements (upgrading buildings from Vacant to Residential to Commercial to Skyscraper), rental income calculation, and the claim flow. It is also the only contract authorized to update improvement levels and last-claimed-ledger values on the PropertyNFT contract.

This is the most complex contract in the cycle because it uses Cougr's full ECS runtime with staged systems.

## What Needs to Be Done

Implement the `game-engine` Soroban contract using Cougr's `GameApp` and `SimpleWorld`. The game logic runs as ECS systems organized into stages.

The contract exposes three player-facing entry points: `improve` (upgrade a property to the next improvement level, charging the improvement cost in LAND), `claim_rental` (claim accrued rental income for a property the caller owns, calculating based on ledgers elapsed since last claim), and `get_accrued_income` (read-only computation of how much LAND a property has earned since the last claim).

Define the economic constants from the specification in C5-001 as Rust constants in a `constants.rs` module. The rental income calculation must use integer arithmetic only; no floating point. The multiplier is applied as an integer ratio (residential = 3/2, commercial = 3/1, skyscraper = 6/1).

The `improve` function must call `set_improvement_level` on the PropertyNFT contract to update the stored level. The `claim_rental` function must call `mint` on the LandToken contract to deposit income into the owner's balance, and call `set_last_claimed_ledger` on the PropertyNFT contract to reset the clock.

## Acceptance Criteria

- `improve` correctly deducts the improvement cost and upgrades the building level.
- `claim_rental` calculates the correct income based on level and ledgers elapsed.
- Income cannot be claimed for a property the caller does not own.
- `cargo test` covers all improvement levels and the rental calculation.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Use Cougr ECS systems properly: define each game rule as a named system, place it in the correct stage, and run via `GameApp`. No raw world manipulation outside of systems. Integer arithmetic only for economic calculations. Verify that rounding in the rental formula is documented and consistent.
