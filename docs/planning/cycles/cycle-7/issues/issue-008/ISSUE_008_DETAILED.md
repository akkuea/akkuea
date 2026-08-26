# C7-008: Wire Pilot Whitelist Operator Actions into the Existing Audit Trail

## Issue Metadata

| Attribute       | Value                                            |
| --------------- | ------------------------------------------------ |
| Issue ID        | C7-008                                           |
| Area            | API                                              |
| Difficulty      | Medium                                           |
| Labels          | api, backend, medium                             |
| Dependencies    | C6-008                                           |
| Estimated Lines | 100-200 (controller/service wiring, tests, docs) |

**Description**

Connect `WhitelistController`'s approve/reject actions to this project's already-existing audit-log infrastructure (`AuditService`, `AuditLogRepository`, `db/schema/auditLog.ts`), and document the extension point for future pilot operator actions.

**Requirements and context**

- This is intentionally scoped smaller than the other Cycle 7 issues: the audit infrastructure already exists and is proven elsewhere in this API. The work here is tracing where it's actually wired in today (check `KYCController.ts` and `OperationalPropertyController.ts`, both of which reference audit-related modules per a prior repository search, even though a direct `AuditService.<method>()` call was not found in a first-pass grep of controllers - the real hook may be a service-layer call, a middleware, or a decorator; find it before writing new code) and reusing exactly that mechanism for `WhitelistController`.
- Do not introduce a second audit-logging code path. If the existing mechanism turns out to be awkward to reuse for the whitelist flow, that friction is itself worth noting in the PR description rather than worked around with a parallel implementation.

**Suggested execution**

1. `git checkout -b feature/pilot-whitelist-audit-trail`
2. Read `AuditService.ts`, `AuditLogRepository.ts`, `db/schema/auditLog.ts`, and trace their real call sites in `KYCController.ts` / `OperationalPropertyController.ts` / `routes/admin.ts`.
3. Add the equivalent call(s) to `WhitelistController`'s approve and reject handlers (or to `WhitelistService`, matching whichever layer the traced pattern actually lives in).
4. Add a short doc comment or a note in `docs/operations/` describing how a future pilot operator action (evidence approval, distribution trigger) should hook into the same trail.

**Test and commit**

- [ ] Approving a whitelist request writes an audit-log entry, verified by a test asserting its fields
- [ ] Rejecting a whitelist request writes an audit-log entry including the reason, verified by a test
- [ ] No second/parallel audit-logging mechanism is introduced
- [ ] All five required CI workflows pass

Example commit:
`git commit -m "feat(api): wire pilot whitelist approve/reject into the existing audit trail"`

**Guidelines**

- Trace before you write. The point of this issue is reuse, not a new abstraction.
