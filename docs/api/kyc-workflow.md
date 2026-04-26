# KYC Workflow: Off-Chain Compliance

Akkuea's compliance layer is entirely off-chain. There are no whitelist addresses on the Soroban contract — investor eligibility is controlled through a state machine stored in PostgreSQL and enforced (or intended to be enforced) at the API layer.

**Key files:**
- `apps/api/src/controllers/KYCController.ts` — all KYC business logic
- `apps/api/src/repositories/KYCRepository.ts` — database operations
- `apps/api/src/routes/kyc.ts` — HTTP endpoints
- `apps/api/src/db/schema/users.ts` — `users.kycStatus` column
- `apps/api/src/db/schema/kyc.ts` — `kycDocuments` table

---

## The 'Admin as Oracle' pattern

KYC in this system works like a manual oracle: an off-chain human operator (the admin) observes uploaded documents and decides whether to approve or reject them. The system has no automated identity verification provider — the admin IS the compliance decision-maker.

```
  Investor (user)          Platform Admin              Database
        |                        |                         |
        | Upload documents       |                         |
        |----------------------------------------------->  |
        |                        |    kycDocuments.status  |
        |                        |    = 'pending'          |
        |                        |                         |
        |                        | Review docs manually    |
        |                        |                         |
        |                        | POST /kyc/verify/:id    |
        |                        | { verified: true }      |
        |                        |-----------------------> |
        |                        |   doc.status='approved' |
        |                        |   users.kycStatus=...   |
        |                        |<----------------------- |
        |  Notification sent     |                         |
        |<-----------------------------------------------|
```

The admin acts as the oracle for compliance truth. There is no third-party KYC provider integration in the current codebase.

---

## KYC status state machine

The `users.kycStatus` column (`KYCRepository.ts:78-86`) holds the user-level compliance verdict. It is separate from per-document status.

```
                  ┌─────────────┐
                  │ not_started │  (default on user creation)
                  └──────┬──────┘
                         │ uploadDocument() called
                         ▼
                  ┌─────────────┐
                  │   pending   │◄──────────────────────────────┐
                  └──────┬──────┘                               │
                         │ verifyDocument() called              │
                         ▼                                      │
              ┌──────────────────────┐                          │
              │  anyRejected?        │                          │
              ├──────────────────────┤                          │
              │ YES → rejected       │                          │
              │ NO + allApproved     │                          │
              │     → approved       │  uploadDocument() again  │
              └──────────────────────┘  (re-upload resets doc   │
                         │              to pending, may trigger │
                         │              re-review loop)─────────┘
                         ▼
                  ┌─────────────┐
                  │  approved   │  ← compliance gate satisfied
                  └─────────────┘

                  ┌─────────────┐
                  │   expired   │  ← set manually or by future
                  └─────────────┘    expiry job (not implemented)
```

**Rules governing state transitions** (source: `KYCController.ts:191-209`):

| Condition after a `verifyDocument()` call | `users.kycStatus` result |
|---|---|
| Any document in `rejected` state | `rejected` |
| ALL documents in `approved` state | `approved` |
| Some `approved`, none `rejected`, others `pending` | unchanged (still `pending`) |

A user with a single rejected document blocks approval even if all other documents pass. Every document must reach `approved` for the user-level status to flip.

---

## Per-document status vs. user-level status

These are two separate concepts stored in two separate tables:

| Level | Table | Column | Values |
|---|---|---|---|
| Document | `kycDocuments` | `status` | `pending`, `approved`, `rejected` |
| User | `users` | `kycStatus` | `not_started`, `pending`, `approved`, `rejected`, `expired` |

The user-level status is the compliance gate. Per-document statuses are intermediate signals used to compute it.

---

## HTTP endpoint reference

Base path: `/kyc`

### Upload a document

```http
POST /kyc/upload
Content-Type: multipart/form-data

Fields:
  userId       string   User UUID
  documentType string   One of: passport, id_card, national_id, drivers_license,
                                 proof_of_address, bank_statement, tax_document, other
  file         File     PDF, PNG, or JPEG (size limit enforced by StorageService)
```

Behavior:
- If a document of the same `documentType` already exists for this user, it is replaced (old file deleted, new file stored).
- Sets the document's `status` to `pending`.
- Sets `users.kycStatus` to `pending` regardless of previous value.

Response (200):
```json
{ "documentId": "<uuid>", "submissionId": "<userId>" }
```

### Submit KYC (declare readiness for review)

```http
POST /kyc/submit
Content-Type: application/json

{
  "userId": "<uuid>",
  "documents": [
    { "type": "passport", "documentUrl": "<url>" }
  ]
}
```

This endpoint sets `users.kycStatus` to `pending` if any documents exist. It is a soft signal to the admin that the user considers their submission complete. It does not perform any verification.

### Get KYC status (user-facing)

```http
GET /kyc/status/:userId
```

Response:
```json
{
  "status": "pending" | "verified" | "rejected",
  "documents": [...]
}
```

Note: the public-facing status vocabulary differs from the DB vocabulary:

| `users.kycStatus` (DB) | `status` returned by API |
|---|---|
| `not_started` | `pending` |
| `pending` | `pending` |
| `approved` | `verified` |
| `rejected` | `rejected` |
| `expired` | `rejected` |

### Get all documents for a user

```http
GET /kyc/documents/:userId
```

Returns all documents with pre-signed file access URLs (`/kyc/file/:documentId`).

### Serve document file

```http
GET /kyc/file/:documentId
```

Returns the raw file buffer with correct `Content-Type` (`application/pdf`, `image/png`, `image/jpeg`).

### Verify a document (admin action)

```http
POST /kyc/verify/:documentId
Content-Type: application/json

{
  "verified": true | false,
  "notes": "optional rejection reason or approval note"
}
```

This is the admin's oracle action. Calling it:
1. Sets `kycDocuments.status` to `approved` or `rejected`.
2. Sets `kycDocuments.rejectionReason` (if rejected, uses `notes` value).
3. Sets `kycDocuments.reviewedAt` to current timestamp.
4. Re-evaluates ALL documents for the user to compute the new `users.kycStatus`.
5. Sends an in-app notification to the user.

Response (200):
```json
{ "success": true }
```

---

## Notification side-effects of verifyDocument

Source: `KYCController.ts:196-210`

| Outcome | Notification sent |
|---|---|
| Any doc rejected | `notificationService.notifyVerificationRejected(userId, notes, 'IN_APP')` |
| All docs approved | `notificationService.notifyVerificationApproved(userId, 'IN_APP')` |
| Partially approved (no rejections yet) | No notification |

---

## Known gaps (current codebase state)

### Gap 1: verifyDocument has no authentication

`POST /kyc/verify/:documentId` in `routes/kyc.ts:130-139` has **no authentication middleware**. Any HTTP client that knows a `documentId` can call this endpoint and approve or reject a document without credentials.

This endpoint must be protected before production. The recommended approach is to check `OPERATIONS_BACKEND_CREDENTIAL` (already defined in `.env.example`) or require the `x-user-address` header to match `OPERATIONS_ALLOWED_WALLETS`.

### Gap 2: buyShares does not enforce KYC status

`POST /properties/:id/buy-shares` (`routes/properties.ts:156-183`) does not check `users.kycStatus` before allowing a share purchase. A user with `kycStatus = 'not_started'` can buy shares today.

The `users.kycStatus = 'approved'` field exists in the schema and is correctly maintained by the KYC flow. The enforcement gate is the missing piece. The controller comment marks this feature as "planned for Cycle 2" (`PropertyController.ts:496`).

**Intended integration (not yet implemented):**

```typescript
// Pseudocode for the intended guard in buyShares
const kycStatus = await kycRepository.getUserKycStatus(buyer.id);
if (kycStatus !== 'approved') {
  throw new AuthorizationError('KYC verification required to purchase shares');
}
```

Until this guard is implemented, KYC approval is advisory, not enforced.

---

## Audit & Compliance Logging

> **Stability Note — Issue #725:** Structured audit logging, tamper-evident event trails, and compliance export utilities for KYC actions are currently under design and development in [Issue #725 — Audit Log Models & Compliance Export](https://github.com/akkuea/akkuea/issues/725). The section below documents the **current** logging state. This section will be expanded significantly once Issue #725 is merged.

### Current logging state

Admin actions on the KYC flow currently produce structured application-level logs via the `logger` service. These are present in the controllers but are **not** persisted to a dedicated audit table.

Events that currently emit log entries:

| Action | Log level | Fields logged |
|---|---|---|
| Document uploaded | `info` (implicit via `uploadDocument`) | `userId`, `documentType`, `documentId` |
| Document verified (approved/rejected) | `info` / `error` not explicitly logged in `verifyDocument` | *(no explicit audit log call — see gap below)* |
| KYC status updated | via `updateUserKycStatus` DB write | timestamp recorded in `users.updatedAt` |

**Current gap:** `KYCController.verifyDocument()` (`KYCController.ts:178-217`) does not emit an explicit audit log entry recording *who* made the verification decision, *when*, and *what notes were provided*. Only the DB columns `kycDocuments.reviewedAt` and `kycDocuments.rejectionReason` capture partial state.

### What Issue #725 will add

Once closed, Issue #725 is expected to deliver:

- A dedicated `auditLogs` table recording every state transition with: actor identity, timestamp, previous state, new state, and reason.
- Structured log entries on all admin actions (`verifyDocument`, `updateUserKycStatus`, manual status overrides).
- A compliance export endpoint (format TBD) for regulatory reporting — list of approved/rejected investors with timestamps and document references.
- Retention policy configuration for KYC documents and audit records.

**When Issue #725 is merged:** Replace this placeholder section with the actual audit log schema, the new export endpoint reference, and the updated `verifyDocument` flow that includes the actor-identity log call.

---

## Admin workflow: approving an investor

Step-by-step procedure for the compliance operator:

```bash
# 1. List pending documents for a user
curl http://localhost:3001/kyc/documents/<userId>

# 2. View each document file
curl http://localhost:3001/kyc/file/<documentId> -o document.pdf

# 3a. Approve a document
curl -X POST http://localhost:3001/kyc/verify/<documentId> \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'

# 3b. Reject a document with a reason
curl -X POST http://localhost:3001/kyc/verify/<documentId> \
  -H "Content-Type: application/json" \
  -d '{"verified": false, "notes": "Passport image is blurry. Please resubmit."}'

# 4. Confirm user-level status after all documents processed
curl http://localhost:3001/kyc/status/<userId>
# status should be "verified" if all documents approved
```

Repeat Step 3a for every document the user uploaded. The user-level status only flips to `approved` when **every** document is in `approved` state.

---

## See also

- `docs/api/minting-workflow.md` — how `property.verified` (separate from user KYC) gates tokenization
- `docs/deployment/environment-variables.md` — `OPERATIONS_BACKEND_CREDENTIAL` and `OPERATIONS_ALLOWED_WALLETS`
- Issue #725 — Audit Log Models & Compliance Export (pending — will expand the Audit & Compliance Logging section above)
- Issue #722 — Dividend & Cashflow Distribution (pending — adds new investor payout workflows; see `docs/operations/runbook-dividends-placeholder.md`)
