# Pilot Operator Actions — Audit Trail Extension Point

**Relates to**: C7-008, issue #1084  
**Last updated**: 2026-08-26

---

## What exists today

`WhitelistService.approveRequest` and `WhitelistService.rejectRequest` both call
`auditService.logAction(...)` immediately after the database update.  The pattern is identical to
the one already used in `KYCController.verifyDocument` and
`OperationalPropertyController.applyReviewAction` — no second audit-logging mechanism was
introduced.

Audit entries written by these two paths use:

| Field        | approve                   | reject                    |
|--------------|---------------------------|---------------------------|
| `actor`      | operator's Stellar wallet | operator's Stellar wallet |
| `action`     | `whitelist.approve`       | `whitelist.reject`        |
| `entityType` | `pilot_whitelist_request` | `pilot_whitelist_request` |
| `entityId`   | UUID of the row           | UUID of the row           |
| `beforeValue`| `{ status, reviewedAt }`  | `{ status, rejectionReason, reviewedAt }` |
| `afterValue` | `{ status: 'approved', reviewedAt }` | `{ status: 'rejected', rejectionReason, reviewedAt }` |
| `metadata`   | `{ walletAddress, txHash }` | `{ walletAddress, reason }` |

The operator wallet is supplied via the `actorWallet` field in the request body (required,
50–64 characters), enforced by `reviewWhitelistSchema` in `routes/internalOperations.ts`.

---

## How to wire a future pilot operator action into the same trail

The following three-step pattern applies to any new operator action in the pilot (e.g. evidence
approval, distribution trigger — see #1061 / C6-002):

### 1. Add `actorWallet` to the route body schema

In `routes/internalOperations.ts`, add `actorWallet: t.String({ minLength: 50, maxLength: 64 })`
to the Elysia `t.Object` schema for the new route.  This enforces the field at the HTTP layer and
makes it available to the controller via `ctx.body.actorWallet`.

### 2. Receive `actorWallet` in the service method

Add `actorWallet = 'system'` as a parameter to the service method responsible for the DB update.
The `'system'` default exists only for automated/internal calls that have no operator identity;
the review route always provides it explicitly.

### 3. Call `auditService.logAction(...)` after the DB update

```typescript
import { auditService } from './AuditService';

// After updating the database row:
await auditService.logAction({
  actor: actorWallet,
  action: 'pilot.<your_action>',          // namespaced, e.g. pilot.evidence_approve
  entityType: '<your_entity_type>',        // e.g. pilot_distribution_event
  entityId: recordId,                      // UUID of the DB row
  beforeValue: { /* snapshot before */ },
  afterValue:  { /* snapshot after  */ },
  metadata: { /* any extra context   */ },
});
```

Use the same namespace convention as the existing whitelist actions (`whitelist.approve`,
`whitelist.reject`) so audit-log queries can filter by action prefix.

### No new infrastructure needed

`AuditService`, `AuditLogRepository`, and the `audit_log` table are already in place.  Adding a
new action requires only the three steps above — no schema migration, no new service class, no
new repository.

---

## Querying pilot audit entries

```
GET /api/v1/admin/audit-log?action=whitelist.approve
GET /api/v1/admin/audit-log?action=whitelist.reject
GET /api/v1/admin/audit-log?actor=<operator_wallet>
```

Future pilot actions will be queryable via their own `action` value once wired in.
