# Integrate the Phase 1a Treasury Track (DeFindex + EtherFuse)

## Context

`docs/strategy/roadmap.md` defines Phase 1a as a fast, parallel track independent of the core pilot: deposit the accumulated platform fee into DeFindex's already-audited Blend strategy and/or EtherFuse's Stablebonds, generating real, verifiable on-chain activity almost immediately, using only contracts that are already deployed and already audited. `docs/strategy/integration-decisions.md` and `docs/strategy/recommendations.md` are explicit that this is not framed as "generating metrics" for its own sake; it is honest treasury management that happens to produce checkable on-chain history, and that honest framing must carry through to how it's built and surfaced, not just how it's described in a strategy document.

## What Needs to Be Done

- Build a `TreasuryService` in `apps/api/src/services/` that can deposit a specified amount into DeFindex's Blend strategy vault and into EtherFuse Stablebonds, and read back current position value from both.
- Add API endpoints exposing treasury position and history (read-only; deposit/withdraw remain admin-triggered, following the same admin-key pattern already used for `defi-rwa` operations).
- Build a small treasury panel in `apps/webapp` (or the pilot dashboard from C6-002, if that work has landed first) showing current treasury value, a link to the DeFindex/EtherFuse position on stellar.expert, and a short, honest description of what the treasury track is and why it exists, matching the framing in `docs/strategy/roadmap.md`.
- Verify both integrations against DeFindex's and EtherFuse's actual testnet-deployed contracts (or mainnet, if that's where the real platform fee balance will live); do not build against a mocked or assumed interface.

## Acceptance Criteria

- A deposit into DeFindex's Blend strategy and a deposit into EtherFuse Stablebonds both execute successfully against real, already-deployed contracts and are independently verifiable on stellar.expert.
- The API correctly reads back current treasury position value from both integrations.
- The treasury panel displays real position data, not placeholder numbers, and links out to the on-chain record.
- Integration tests exist against both DeFindex and EtherFuse, exercising the actual contract call paths (not mocks), consistent with this project's standing rule to verify third-party integrations via primary sources rather than assumptions.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is the first piece of the pilot to touch real third-party DeFi contracts with real funds. Every external call must handle the failure modes those contracts can actually produce (insufficient liquidity, paused vault, stale price feed if applicable), not just the happy path. The honest framing established in `docs/strategy/roadmap.md` (treasury management that happens to be checkable, not metrics-farming) must be reflected in the actual UI copy, not softened into something more promotional.
