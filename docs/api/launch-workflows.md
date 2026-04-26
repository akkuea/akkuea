# API Launch Workflows

End-to-end HTTP sequences for the three critical launch-day operations. Each workflow includes complete request headers, bodies, and expected responses. Run these in order during smoke testing.

**Base URL (development):** `http://localhost:3001`
**Base URL (production):** Update with your deployed API URL

---

## Workflow A: Investor KYC Onboarding

Goal: take an investor from zero to `kycStatus: approved` so they are compliance-cleared to purchase shares.

### A1 — Upload identity document

```http
POST /kyc/upload
Content-Type: multipart/form-data

Fields:
  userId       = "550e8400-e29b-41d4-a716-446655440001"
  documentType = "passport"
  file         = <binary PDF or JPEG, max size enforced by StorageService>
```

```bash
curl -X POST http://localhost:3001/kyc/upload \
  -F "userId=550e8400-e29b-41d4-a716-446655440001" \
  -F "documentType=passport" \
  -F "file=@/path/to/passport.pdf"
```

**Response 200:**
```json
{
  "documentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "submissionId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Response 400 (wrong file type):**
```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "File type not allowed"
}
```

Accepted `documentType` values: `passport`, `id_card`, `national_id`, `drivers_license`, `proof_of_address`, `bank_statement`, `tax_document`, `other`.

---

### A2 — Upload proof of address

Repeat A1 with a second document type. Each document type is stored independently.

```bash
curl -X POST http://localhost:3001/kyc/upload \
  -F "userId=550e8400-e29b-41d4-a716-446655440001" \
  -F "documentType=proof_of_address" \
  -F "file=@/path/to/utility-bill.pdf"
```

**Response 200:**
```json
{
  "documentId": "a87ff679-42d4-41de-b44b-f07ac1f90be8",
  "submissionId": "550e8400-e29b-41d4-a716-446655440001"
}
```

---

### A3 — Declare submission ready for review

```http
POST /kyc/submit
Content-Type: application/json
```

```bash
curl -X POST http://localhost:3001/kyc/submit \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "documents": [
      { "type": "passport",          "documentUrl": "/kyc/file/7c9e6679-7425-40de-944b-e07fc1f90ae7" },
      { "type": "proof_of_address",  "documentUrl": "/kyc/file/a87ff679-42d4-41de-b44b-f07ac1f90be8" }
    ]
  }'
```

**Response 200:**
```json
{
  "submissionId": "550e8400-e29b-41d4-a716-446655440001"
}
```

This sets `users.kycStatus = 'pending'`. It is a soft signal — no documents are verified by this call.

---

### A4 — Admin: retrieve documents for review

```bash
curl http://localhost:3001/kyc/documents/550e8400-e29b-41d4-a716-446655440001
```

**Response 200:**
```json
[
  {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "type": "passport",
    "fileName": "7c9e6679_passport.pdf",
    "fileUrl": "/kyc/file/7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "pending",
    "rejectionReason": null,
    "uploadedAt": "2026-03-28T10:00:00.000Z",
    "reviewedAt": null,
    "documentUrl": "/kyc/file/7c9e6679-7425-40de-944b-e07fc1f90ae7"
  },
  {
    "id": "a87ff679-42d4-41de-b44b-f07ac1f90be8",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "type": "proof_of_address",
    "fileName": "a87ff679_proof_of_address.pdf",
    "fileUrl": "/kyc/file/a87ff679-42d4-41de-b44b-f07ac1f90be8",
    "status": "pending",
    "rejectionReason": null,
    "uploadedAt": "2026-03-28T10:05:00.000Z",
    "reviewedAt": null,
    "documentUrl": "/kyc/file/a87ff679-42d4-41de-b44b-f07ac1f90be8"
  }
]
```

---

### A5 — Admin: approve each document

> **Security gap (known):** This endpoint currently has no authentication middleware. See `docs/api/kyc-workflow.md` — Known gaps. Protect before production.

```bash
# Approve passport
curl -X POST http://localhost:3001/kyc/verify/7c9e6679-7425-40de-944b-e07fc1f90ae7 \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'

# Approve proof of address
curl -X POST http://localhost:3001/kyc/verify/a87ff679-42d4-41de-b44b-f07ac1f90be8 \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'
```

**Response 200 (each call):**
```json
{ "success": true }
```

**To reject a document with reason:**
```bash
curl -X POST http://localhost:3001/kyc/verify/7c9e6679-7425-40de-944b-e07fc1f90ae7 \
  -H "Content-Type: application/json" \
  -d '{"verified": false, "notes": "Passport image is blurry. Please resubmit a clearer scan."}'
```

---

### A6 — Verify investor is compliance-cleared

```bash
curl http://localhost:3001/kyc/status/550e8400-e29b-41d4-a716-446655440001
```

**Response 200 (all documents approved):**
```json
{
  "status": "verified",
  "documents": [
    { "id": "7c9e6679...", "type": "passport",         "status": "approved", "reviewedAt": "2026-03-28T10:15:00.000Z" },
    { "id": "a87ff679...", "type": "proof_of_address", "status": "approved", "reviewedAt": "2026-03-28T10:16:00.000Z" }
  ]
}
```

`status: "verified"` maps to `users.kycStatus = 'approved'` in the database. The investor is compliance-cleared.

**Smoke test pass criteria:** `status` field equals `"verified"`.

---

## Workflow B: Property Creation and Tokenization

Goal: take a property from creation to on-chain tokenization. The property owner's wallet acts as the caller.

### B1 — Create a property listing

```http
POST /properties
Content-Type: application/json
x-user-address: GXXX...owner-stellar-address...
```

```bash
curl -X POST http://localhost:3001/properties \
  -H "Content-Type: application/json" \
  -H "x-user-address: GOWNER_STELLAR_ADDRESS_56_CHARS_LONG_XXXXXXXXXX" \
  -d '{
    "name": "Marina Tower Unit 4B",
    "description": "Luxury residential unit in the Marina district. 85sqm, sea view, fully furnished. Rental yield 6.2% annually.",
    "propertyType": "residential",
    "location": {
      "address": "Paseo Marítimo 42, 4B",
      "city": "Barcelona",
      "country": "Spain",
      "postalCode": "08003"
    },
    "totalValue": "450000.00",
    "totalShares": 1000,
    "pricePerShare": "450.00",
    "images": ["https://cdn.example.com/properties/marina-4b/main.jpg"]
  }'
```

**Response 201:**
```json
{
  "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "name": "Marina Tower Unit 4B",
  "verified": false,
  "reviewStatus": "pending",
  "totalShares": 1000,
  "availableShares": 1000,
  "pricePerShare": "450.00",
  "tokenAddress": null,
  "sorobanPropertyId": null,
  "createdAt": "2026-03-28T11:00:00.000Z"
}
```

`verified: false` and `tokenAddress: null` — the property is in the review queue.

---

### B2 — Admin: review the property (internal operations endpoint)

> This endpoint requires the `OPERATIONS_BACKEND_CREDENTIAL` secret in the `Authorization` header (`apps/api/src/utils/internalOperationsAuth.ts`).

```bash
# List properties in the pending review queue
curl http://localhost:3001/internal/operations/properties?queue=pending \
  -H "Authorization: Bearer <OPERATIONS_BACKEND_CREDENTIAL>"
```

**Response 200:**
```json
{
  "success": true,
  "properties": [
    {
      "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "name": "Marina Tower Unit 4B",
      "verified": false,
      "reviewStatus": "pending",
      "owner": { "walletAddress": "GOWNER...", "kycStatus": "approved" }
    }
  ]
}
```

```bash
# Approve the property (sets verified=true in the database)
curl -X POST http://localhost:3001/internal/operations/properties/d290f1ee-6c54-4b01-90e6-d701748f0851/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATIONS_BACKEND_CREDENTIAL>" \
  -d '{
    "action": "approve",
    "note": "Title deed and valuation report verified. Property cleared for tokenization.",
    "actorWallet": "GADMIN_OPERATOR_STELLAR_ADDRESS_56_CHARS_XXX"
  }'
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "verified": true,
    "reviewStatus": "approved",
    "lastReviewNote": "Title deed and valuation report verified. Property cleared for tokenization.",
    "lastReviewedAt": "2026-03-28T11:30:00.000Z"
  }
}
```

Valid `action` values: `"approve"`, `"reject"`, `"request_changes"`, `"hold"`.

---

### B3 — Owner tokenizes the property on-chain

```http
POST /properties/:id/tokenize
x-user-address: GXXX...caller must be owner or admin...
```

```bash
curl -X POST http://localhost:3001/properties/d290f1ee-6c54-4b01-90e6-d701748f0851/tokenize \
  -H "x-user-address: GOWNER_STELLAR_ADDRESS_56_CHARS_LONG_XXXXXXXXXX"
```

**Response 200:**
```json
{
  "txHash": "a3f9c2d1e8b4f7a6c3e9d2b5f8a1c4e7b0d3f6a9c2e5b8d1f4a7c0e3b6d9f2a5",
  "contractId": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  "sorobanPropertyId": "42",
  "tokenAddress": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  "totalShares": 1000,
  "owner": "GOWNER_STELLAR_ADDRESS_56_CHARS_LONG_XXXXXXXXXX"
}
```

**Response 400 (property not verified):**
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Property must be verified before tokenization"
}
```

**Response 409 (already tokenized):**
```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Property has already been tokenized"
}
```

**Smoke test pass criteria:** `txHash` is a 64-character hex string and `tokenAddress` is a 56-character string starting with `C`.

---

### B4 — Verify the tokenized state

```bash
curl http://localhost:3001/properties/d290f1ee-6c54-4b01-90e6-d701748f0851
```

**Response 200:**
```json
{
  "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "name": "Marina Tower Unit 4B",
  "verified": true,
  "tokenAddress": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  "sorobanPropertyId": 42,
  "totalShares": 1000,
  "availableShares": 1000
}
```

`tokenAddress` no longer `null` = tokenization confirmed.

---

## Workflow C: Share Purchase

Goal: investor buys shares in a tokenized property. This is a database-level operation — it does not invoke the Soroban contract. See `docs/api/minting-workflow.md` for the architectural distinction.

### C1 — Buy shares

```http
POST /properties/:id/buy-shares
Content-Type: application/json
x-user-address: GXXX...buyer must match body.buyer...
```

```bash
curl -X POST http://localhost:3001/properties/d290f1ee-6c54-4b01-90e6-d701748f0851/buy-shares \
  -H "Content-Type: application/json" \
  -H "x-user-address: GINVESTOR_STELLAR_ADDRESS_56_CHARS_LONG_XXXXX" \
  -d '{
    "buyer": "GINVESTOR_STELLAR_ADDRESS_56_CHARS_LONG_XXXXX",
    "shares": 10
  }'
```

**Response 200:**
```json
{
  "transactionHash": "tx_d290f1ee6c544b0190e6d701748f0851a3f9c2d1",
  "newBalance": 10
}
```

**Response 400 (insufficient shares):**
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Not enough shares available",
  "details": [{ "field": "shares", "message": "Requested shares exceed available inventory" }]
}
```

**Response 401 (missing address header):**
```json
{ "error": "UNAUTHORIZED", "message": "User address is required for authentication" }
```

**Response 403 (address mismatch):**
```json
{ "statusCode": 403, "code": "FORBIDDEN", "message": "Authenticated wallet does not match buyer address" }
```

**Smoke test pass criteria:** `newBalance` equals the number of shares requested.

---

### C2 — Verify share ownership

```bash
curl http://localhost:3001/properties/d290f1ee-6c54-4b01-90e6-d701748f0851/shares/GINVESTOR_STELLAR_ADDRESS_56_CHARS_LONG_XXXXX
```

**Response 200:**
```json
{
  "propertyId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "owner": "GINVESTOR_STELLAR_ADDRESS_56_CHARS_LONG_XXXXX",
  "shares": 10,
  "purchasePrice": "4500.00"
}
```

---

## Smoke test checklist

Run this sequence against a freshly deployed environment to confirm all three workflows function end-to-end.

```
[ ] A6: GET /kyc/status/:userId returns { "status": "verified" }
[ ] B3: POST /properties/:id/tokenize returns txHash (64-char hex) and tokenAddress (C + 55 chars)
[ ] B4: GET /properties/:id returns tokenAddress != null
[ ] C1: POST /properties/:id/buy-shares returns newBalance > 0
[ ] C2: GET /properties/:id/shares/:owner returns shares matching purchase amount
```

All five checks passing = launch workflows are operational.

---

## Error reference

| HTTP status | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid input — check request body against schema |
| `400` | `BAD_REQUEST` | Constraint violation (e.g., file type, zero shares) |
| `401` | `UNAUTHORIZED` | `x-user-address` header missing |
| `403` | `FORBIDDEN` | Caller address does not match required identity |
| `404` | `NOT_FOUND` | Resource (property, user, document) not found |
| `409` | `CONFLICT` | Operation already performed (property already tokenized) |
| `429` | *(rate limit)* | Too many requests — back off and retry |
| `500` | `INTERNAL_ERROR` | On-chain transaction failed or DB write failed post-mint |

---

## See also

- `docs/api/minting-workflow.md` — deep dive on the tokenization on-chain path
- `docs/api/kyc-workflow.md` — full KYC state machine and admin procedure
- `docs/deployment/post-deploy-checklist.md` — Day 0 smoke test checklist
