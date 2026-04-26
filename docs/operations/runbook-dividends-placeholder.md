# Runbook: Dividend & Cashflow Distribution

**Status: PLACEHOLDER — Pending Issue #722**

> This document is a structural reservation. The Dividend and Cashflow Distribution workflow does not yet exist in the codebase. It will be implemented and merged as part of [Issue #722 — Dividend & Cashflow Distribution](https://github.com/akkuea/akkuea/issues/722).
>
> **When Issue #722 is merged:** delete this notice block and replace the sections below with the actual implementation details, CLI commands, and failure modes. Follow the same format as `runbook-emergency-pause.md`.

---

## Where this fits in the platform

```
Current platform flow:
  Property Tokenization  →  Share Purchase  →  [Dividend Distribution ← Issue #722]
        (lib.rs)              (PropertyController)       (TBD)
```

Dividend distribution is the third pillar of the RWA token lifecycle:

1. A property generates rental income or other cashflow.
2. The platform admin (or an automated job) triggers a distribution event.
3. Each token holder receives a proportional payment based on their share balance at the snapshot block/ledger.

---

## Anticipated components (based on Issue #722 scope)

The following are the expected deliverables of Issue #722. Treat these as forward-looking design notes, not confirmed implementation.

### On-chain (Soroban contract)

| Function (anticipated) | Description |
|---|---|
| `create_distribution(property_id, amount, asset)` | Admin-only. Records a distribution event and total amount. |
| `claim_dividend(property_id, distribution_id, claimant)` | Shareholder calls to claim their proportional payout. |
| `get_unclaimed_dividends(property_id, claimant)` | View: returns unclaimed distribution balance. |

### Off-chain (API layer)

| Endpoint (anticipated) | Description |
|---|---|
| `POST /properties/:id/distributions` | Admin triggers a new distribution round. |
| `POST /properties/:id/distributions/:dist_id/claim` | Shareholder claims their dividend. |
| `GET /properties/:id/distributions` | List all distribution events for a property. |
| `GET /users/:id/dividends` | List all pending and claimed dividends for a user. |

### Database (anticipated new tables)

| Table | Purpose |
|---|---|
| `distributions` | Records each distribution event: property, total amount, asset, snapshot ledger |
| `dividendClaims` | Records per-user claim status: claimed/unclaimed, amount, tx hash |

---

## Integration points with existing documentation

Once Issue #722 lands, these existing docs will require updates:

| File | Required update |
|---|---|
| `docs/api/minting-workflow.md` | Add note: tokenized shares are dividend-eligible |
| `docs/api/kyc-workflow.md` | Confirm: KYC-approved status may be required for dividend claims (TBD in Issue #722) |
| `docs/deployment/deploy-contracts.md` | Add new `create_distribution` to the post-deploy role and pool setup sequence |
| `docs/deployment/post-deploy-checklist.md` | Add Day 0 check: verify distribution contract function is accessible |
| `docs/README.md` | Add this runbook to the Operations section once it is no longer a placeholder |

---

## Operational risks to pre-assess

The following failure modes are anticipated for the dividend workflow. Detail them in this runbook once the implementation is known:

| Risk | Category | Notes |
|---|---|---|
| Snapshot timing attack | On-chain | Malicious flash-acquisition of shares before snapshot ledger to inflate dividend claim |
| Unclaimed dividend accumulation | Operations | Funds locked in contract indefinitely if claimants never call `claim_dividend` |
| Asset mismatch | Integration | Distribution asset differs from the pool asset — payout in wrong token |
| Oracle dependency for USD-denominated distributions | On-chain | If distributions are expressed in USD, oracle price is required — inherits RISK-001 from audit |

---

## References

- [Issue #722 — Dividend & Cashflow Distribution](https://github.com/akkuea/akkuea/issues/722) — implementation tracking
- `docs/operations/runbook-emergency-pause.md` — if a distribution event triggers anomalous behavior, pause procedure applies
- `docs/api/minting-workflow.md` — share ownership context
- `docs/api/kyc-workflow.md` — investor eligibility context
