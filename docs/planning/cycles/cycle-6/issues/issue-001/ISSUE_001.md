# Implement the Pilot's Income Token, Whitelist, and Payout-Split Contracts

## Context

`docs/strategy/product-brief.md` defines Akkuea's actual near-term product: a single allied real estate agency issues a non-transferable token representing a share of one property's rental income, investors buy in, and a payout-split contract distributes 90% of each monthly, human-reviewed, hashed income cycle to holders pro-rata while retaining a 10% platform fee. None of that exists in code yet. The `defi-rwa` contract in this repository implements a different product (fractional equity shares plus a collateralized DeFi lending protocol) and is explicitly not reused for the pilot, per the separation decision recorded in the product brief.

This issue builds the three contracts the pilot actually needs, as an independent system inside `apps/contracts`.

## What Needs to Be Done

Implement three Soroban contracts:

1. **Income-participation token** (SEP-41-style, non-transferable): mints a fixed supply of participation units to the pilot ally's approved holder set, with `transfer` disabled (or reduced to admin-only, for the extraordinary correction case) rather than open. No holder-snapshot logic is needed since the holder set is fixed after mint.
2. **Whitelist contract**: a simple approved/not-approved mapping per Stellar address, admin-gated writes, a public read for "is this address approved." This is the on-chain half of the minimum-defensible KYC decision in the product brief; the off-chain review process is out of this issue's scope (see C6-008).
3. **Payout-split contract**: accepts a reference to a monthly income-evidence record (a link plus a cryptographic hash, both stored on-chain, never the underlying file), an admin-approved distribution amount, deducts a 10% platform fee, and distributes the remaining 90% pro-rata across the token contract's current holder set in USDC (SEP-41 token transfer), with an EURC-via-swap path stubbed for a fast-follow rather than built now. Distribution approval uses Soroban's native multi-sig auth for a two-signer check (operator plus ally), not a single admin key, closing Known Risk #7 in the product brief from day one rather than retrofitting it later.

## Acceptance Criteria

- All three contracts compile with `stellar contract build` and deploy successfully to testnet.
- The payout-split contract correctly computes the 10% fee and pro-rata distribution across a holder set of at least 5 test addresses with uneven balances, verified by test assertions on exact output amounts, not just "it doesn't panic."
- The whitelist contract rejects distribution to any address not marked approved.
- The token contract rejects any transfer attempt from a non-admin caller.
- Two-signer approval on the payout-split contract is enforced: a distribution cannot execute with only one of the two required signatures.
- Unit tests cover every documented failure mode: unapproved recipient, insufficient evidence hash, single-signer attempt, zero-amount distribution, double-distribution for the same cycle.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass with zero warnings.
- Contract IDs and deployment record are added to `apps/shared/src/contracts.testnet.json` following the existing pattern, and `docs/deployment/` gains a deployment guide for this contract set, matching the structure of `docs/deployment/deploy-contracts.md`.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is the contract real investor money will move through. Every arithmetic operation must use checked math (no silent overflow/underflow, following the existing `defi-rwa` pattern). Every state-changing function must emit an event. No `unwrap()` on any value that can plausibly be `None` or `Err` in production; use the project's typed error pattern (see `docs/operations/runbook-oracle-failure.md` for the typed-error precedent already established in `defi-rwa`). This is the highest-stakes code in the repository; treat it accordingly.
