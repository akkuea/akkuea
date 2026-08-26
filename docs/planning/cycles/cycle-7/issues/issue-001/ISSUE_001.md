# Implement the Real USDC-to-EURC Settlement Path in the Pilot Payout-Split Contract

## Context

`docs/strategy/product-brief.md` states plainly: "Investors may opt into EURC, resolved by an on-chain swap from USDC to EURC at payout time. The USDC-only path ships and gets validated first; EURC support is a fast-follow within the mainnet track, not a v1 blocker." The USDC-only path has now shipped (C6-001, merged). In the code, that fast-follow is still a literal placeholder: `pilot-payout-split/src/lib.rs`'s `eurc_swap_path_status()` returns the hardcoded string `"stubbed-fast-follow"` and nothing else exists. No swap logic, no per-holder currency preference, no price protection.

## What Needs to Be Done

- Add a self-serve, `require_auth`-gated function that lets an approved token holder set or update their settlement-currency preference (USDC by default, EURC opt-in). Store it on-chain in `pilot-payout-split` or `pilot-income-token`, whichever keeps the holder-set read path simplest; no off-chain database is introduced.
- Implement the real swap leg in `execute_distribution`: for any holder whose preference is EURC, convert their pro-rata USDC share to EURC before transfer, using an already-deployed, independently verifiable Stellar AMM rather than a bespoke swap implementation. `docs/strategy/roadmap.md` already establishes that Soroswap is real, audited, and deployed on Stellar (it is listed as one of DeFindex's pre-built strategy targets); it is the natural candidate, consistent with this project's standing rule of verifying before integrating and never building from scratch what already exists and is audited. If a different verified venue is used instead, record why in `docs/strategy/decision-log.md`, following the existing pattern for third-party integration decisions.
- Add a minimum-received / price-guard check on the swap leg. A distribution must never silently accept an arbitrarily bad rate.
- Define and implement what happens when the swap leg fails for one holder (illiquidity, slippage breach): the rest of the cycle's distribution to other holders must not be blocked or corrupted by one holder's failed swap.
- Retire `eurc_swap_path_status()` once the real path replaces it, or repurpose it to report genuine on-chain state if it remains useful for the dashboard.

## Acceptance Criteria

- `eurc_swap_path_status()` (or its replacement) no longer reports a hardcoded stub value; a holder who has opted into EURC actually receives EURC from `execute_distribution`, verified by a test asserting exact received amounts, not just that the call succeeds.
- The currency-preference function is `require_auth`-gated to the holder's own address (a holder cannot set another holder's preference) and rejects preference changes from non-approved (non-whitelisted) addresses.
- The swap integrates with a real, already-deployed, independently verifiable Stellar AMM (Soroswap or a documented, equally-verified alternative) - no bespoke swap math replacing a real venue's pricing.
- A distribution to a mixed holder set (some USDC preference, some EURC preference) is covered by a test asserting exact final balances in both assets after the 10% fee and the swap.
- The price-guard/minimum-received mechanism is covered by a test that forces an unfavorable rate and asserts the swap leg is rejected via the project's typed-error pattern, never a panic.
- A failed swap for one holder does not block or corrupt distribution to the cycle's other holders, verified by a test.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass with zero warnings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This contract moves real investor money once a mainnet ally is signed. The choice of swap venue is a genuine third-party integration decision and must be verified against the venue's actual deployed, audited contract - not assumed from documentation - and recorded in `docs/strategy/decision-log.md` the same way DeFindex and EtherFuse were. The price-guard is non-negotiable: a payout contract that can silently execute an investor's share at an arbitrarily bad rate undermines the entire "verifiable, not trustless, but still fair" positioning this project has staked its credibility on.
