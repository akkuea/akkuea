# C6-008: Build the Self-Serve Whitelist and Investor Onboarding Flow

## Issue Metadata

| Attribute       | Value                          |
| --------------- | ------------------------------- |
| Issue ID        | C6-008                          |
| Area            | WEBAPP                          |
| Difficulty      | High                             |
| Labels          | frontend, backend, high          |
| Dependencies    | C6-001                           |
| Estimated Lines | 4000-5500 (onboarding UI, review queue UI, supporting API routes, tests, stories) |

**Description**

Build the investor-facing whitelist request flow and the operator-facing review queue, wired to the C6-001 whitelist contract.

**Requirements and context**

- New routes: `app/[locale]/pilot/onboarding/page.tsx` (investor), `app/[locale]/pilot/review/whitelist/page.tsx` (operator; if C6-002 already established a `review` route for evidence, this may live alongside it as a tab rather than a fully separate page).
- Minimum-defensible submission requirements: before building the form, confirm the exact fields against `docs/strategy/product-brief.md` and `docs/strategy/decision-log.md`. If genuinely unspecified, the smallest defensible default (consistent with the project's own "minimum-defensible, not a compliance product" language) is: full name, a government-ID type and reference (not necessarily the document itself, unless a decision is made that it must be), and the Stellar wallet address being whitelisted. Do not silently copy the existing platform's full multi-document KYC upload flow; that's explicitly a heavier standard than the pilot calls for.
- Backend: new routes in `apps/api/src/routes/` for submitting a whitelist request and for the operator's approve/reject action, the latter admin-gated the same way `/internal/operations/properties/:id/review` is. The approve action must actually call the C6-001 whitelist contract's `approve` function via a service similar to `StellarService.ts`'s existing transaction-building pattern.
- Off-chain storage of the submitted information (name, ID reference) requires a decision: either a minimal new database table (if this project decides that information needs to persist somewhere reviewable), or an entirely on-chain-referenced approach consistent with the "evidence as link + hash" pattern from C6-001. Make this decision explicitly in the PR description with reasoning, don't default silently to the heavier option.
- UI: `Stepper` for the investor's submission flow, `EmptyState` for "no request yet" and "already approved" states, `PageErrorFallback` around both new pages.

**Suggested execution**

1. `git checkout -b feature/pilot-whitelist-onboarding-flow`
2. Resolve the minimum-defensible field-requirement question first; this blocks meaningful form design.
3. Resolve the off-chain-storage-or-not question second; this blocks meaningful backend design.
4. Build the backend routes and the whitelist-contract-invoking service.
5. Build the investor submission flow using `Stepper`.
6. Build the operator review queue.
7. Wire both to the C6-001 whitelist contract; verify against a real testnet deployment before merge.

**Test and commit**

- [ ] An end-to-end test (or a thoroughly manual-verified flow, documented with screenshots) covers: connect wallet, submit request, operator approves, `is_approved` reads true on-chain
- [ ] A rejection path shows a clear reason to the investor
- [ ] Duplicate submission from an already-approved wallet is prevented with a clear message
- [ ] All interactive elements handle loading/error/disconnected-wallet states
- [ ] New API routes have OpenAPI documentation and are admin-gated correctly for the operator actions

Example commit:
`git commit -m "feat(webapp): add self-serve whitelist request and review flow for the pilot"`

**Guidelines**

- Do not silently reuse the existing platform's heavier KYC document-upload flow; the pilot's whitelist is explicitly minimum-defensible, not a compliance product, per `docs/strategy/product-brief.md`.
- Coordinate the whitelist contract's exact function signature with whoever implements C6-001; don't guess at it.
- PR must include before/after screenshots of both the investor and operator flows.
