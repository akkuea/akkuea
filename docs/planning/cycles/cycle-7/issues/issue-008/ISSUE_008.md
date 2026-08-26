# Wire Pilot Whitelist Operator Actions into the Existing Audit Trail

## Context

This API already maintains an audit trail for operator/admin actions elsewhere in the product - `AuditService`, `AuditLogRepository`, and the `auditLog` database schema all exist and are exercised by prior work (see the "[API] Persist audit trail for admin/KYC actions" issues already merged into this repository's history). `WhitelistController`, however, has no reference to `AuditService` anywhere: approving or rejecting a pilot whitelist request - the operator action that gates who is legally allowed to hold the income-participation token - leaves no record in the one place this project already keeps operator accountability.

## What Needs to Be Done

- Find the actual, currently-working integration point other controllers use to write audit entries (it may not be a direct `AuditService.log(...)` call from inside the controller - trace the real mechanism, whatever it is, rather than assuming and duplicating a different pattern).
- Call that same mechanism from `WhitelistController`'s approve and reject actions, recording at minimum: the operator's identity, the action taken, the target wallet address, the prior and new status, and the rejection reason where applicable.
- Document the extension point clearly enough that the future evidence-approval and distribution-trigger operator actions (part of the in-progress dashboard, #1061 / C6-002) can be wired into the same audit trail when they're built, without this issue needing to build those actions itself.

## Acceptance Criteria

- Approving a whitelist request creates a corresponding audit-log entry with operator identity, target wallet, and the approved status, verified by a test.
- Rejecting a whitelist request creates a corresponding audit-log entry including the rejection reason, verified by a test.
- The integration reuses the project's existing, already-proven audit mechanism - no second, parallel audit-logging implementation is introduced.
- The extension point for future pilot operator actions (evidence approval, distribution trigger) is documented in code comments or a short note in `docs/operations/`.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is a small, surgical fix to a real accountability gap, not a rewrite. The bar is that it uses the pattern this codebase has already established and proven elsewhere, correctly, rather than inventing a second way to do the same job.
