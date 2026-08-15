# Build the Self-Serve Whitelist and Investor Onboarding Flow

## Context

`docs/api/kyc-workflow.md` documents the existing platform's KYC review as an "admin as oracle" pattern operated entirely through `curl` commands. `docs/strategy/product-brief.md` calls for the pilot's own version of this: a minimum-defensible whitelist, manual identity review gating a simple on-chain approved/not-approved contract (built in C6-001). Today there is no self-serve way for a real investor to submit their information for review, or for the pilot ally to be onboarded in the first place. A pilot cannot onboard real investors through a support chat and manual admin commands; it needs an actual flow.

## What Needs to Be Done

- Build an investor-facing onboarding flow: connect a Stellar wallet, submit whatever minimum-defensible identity information the pilot's whitelist review actually requires (this is intentionally lighter than the existing platform's full KYC document upload; confirm the exact minimum-defensible requirement against `docs/strategy/product-brief.md` and `docs/strategy/decision-log.md` before building the form, don't assume it mirrors the existing platform's heavier flow), see their approval status.
- Build an operator-facing review queue: list pending whitelist requests, approve or reject, with the approval calling the C6-001 whitelist contract's `approve` function.
- Use the `Stepper` component from the design system for the investor's multi-step submission flow, consistent with the rest of the pilot surface.
- This flow is distinct from C6-002's ally evidence and investor holdings views; it is specifically the *becoming* a whitelisted investor flow, which happens once, before any of C6-002's ongoing views become relevant to a given investor.

## Acceptance Criteria

- A new investor can connect a wallet, submit the required minimum-defensible information, and see their request enter a pending state, reflected on the C6-001 whitelist contract.
- An operator can review pending requests and approve or reject them, with an approval correctly updating the on-chain whitelist state, verifiable by the C6-001 contract's `is_approved` read.
- A rejected investor sees a clear reason, not just a rejected status.
- The flow correctly handles the case where an investor is already approved (no duplicate submission allowed) and the case where a wallet has no pending or approved request yet (clear starting state, using `EmptyState`).
- All new components use the design-system tokens and components, have Storybook stories, and handle loading/error/empty/disconnected states.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is a real investor's first interaction with the product. It must be as clear and frictionless as the minimum-defensible scope allows, with no dead ends, no unclear error states, and no step that silently fails. If the exact information required for the minimum-defensible whitelist review isn't fully specified anywhere yet, that's a real product decision to surface and resolve before or during this issue, not something to assume silently.
