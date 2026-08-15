# Build the Pilot's Read-Only Dashboard for Allies and Investors

## Context

`docs/strategy/product-brief.md` is explicit about the dashboard's shape: read-only, driven entirely by on-chain events and RPC, no investor accounts, no separate database. It must show each income cycle's status (on-time, late, disputed, not received) against an explicit expected date, not just a final balance, because the pilot's entire credibility argument rests on investors seeing a pattern of reliability rather than an isolated number. The same read-only model must surface the ally's evidence-submission state (submitted, in review, approved or rejected with a reason) and an explicit escalation state if the ally goes two cycles without reporting. None of this exists yet; today the only way to interact with anything KYC- or evidence-related is a raw `curl` command from documentation.

## What Needs to Be Done

Build a new pilot surface inside `apps/webapp` (new routes under `app/[locale]/pilot/`, new components under `components/pilot/`):

- **Ally view**: submit monthly income evidence (a link plus the evidence file, hashed client-side or server-side before the hash is written on-chain), see the review status of past submissions.
- **Operator/reviewer view**: a review queue for pending evidence, approve or reject with a reason, trigger a distribution once evidence is approved and the second signature (ally's) is available.
- **Investor view**: token holdings, a per-cycle timeline (using the `Stepper` component from the design system, not a plain list) showing on-time/late/disputed/not-received status against the expected date, and total distributions received to date. Reuse `PropertyViewer3D` (`apps/webapp/src/components/property/PropertyViewer3D.tsx`) as a second, independent evidence channel on the ally's property, letting an investor see the actual property alongside the hashed income statement.
- All three views read exclusively from Soroban RPC and contract events emitted by the C6-001 contracts; there is no new database table and no new investor-accounts concept.

## Acceptance Criteria

- An ally can submit evidence for a cycle and see it move through submitted, in review, and approved/rejected states, reflecting real on-chain state from the C6-001 payout-split contract.
- An investor can see their holdings and a cycle-by-cycle status timeline that correctly reflects on-time, late, disputed, and not-received states, computed from on-chain data plus the expected monthly date.
- The dashboard shows an explicit "ally has not reported in two cycles" escalation state when that condition is met on-chain.
- No new database table is introduced for this feature; all state is derived from Soroban RPC calls and event subscriptions.
- Every interactive element handles loading, error, empty, and disconnected-wallet states, matching the existing frontend template's acceptance bar.
- All new components have Storybook stories and use the design-system tokens and components documented in `docs/design-system/`, not one-off styling.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is the product's actual trust surface. Every status shown must be traceable to a specific on-chain fact, never inferred or approximated client-side without a clear fallback/freshness indicator (`FreshnessIndicator` exists in the design system precisely for this). No mock data may ship in the merged version; if the C6-001 contracts aren't deployed to testnet yet when this work starts, build against a documented contract interface and swap in the real testnet deployment before merge, not after.
