# Minting Workflow: Property Tokenization

This document describes the complete journey of turning a real estate property into on-chain tokens — from the HTTP request through the API layer to the `mint_shares` invocation on the Soroban contract.

**Key files:**
- `apps/api/src/services/TokenizationService.ts` — orchestrator
- `apps/api/src/services/StellarService.ts` — blockchain transport
- `apps/api/src/controllers/PropertyController.ts:487` — HTTP entry point
- `apps/contracts/contracts/defi-rwa/src/lib.rs:141` — on-chain mint

---

## Two distinct operations: tokenization vs. share purchase

Before reading further, understand that the codebase has two separate share-related flows that are often confused:

| Operation | Function | What it does | Writes on-chain? |
|---|---|---|---|
| **Tokenization** | `POST /properties/:id/tokenize` | Mints the initial supply of shares for a property. One-time, irreversible. | **Yes** — calls `mint_shares` on the contract |
| **Share purchase** | `POST /properties/:id/shares` | Transfers share ownership between buyer and seller within the platform. | **No** — DB-only transaction (`shareOwnerships` table) |

This document covers **tokenization only**. The share purchase flow is a database operation and does not invoke the Stellar contract.

---

## Sequence diagram

```
  Client                 API (Elysia/Bun)              Database         Stellar Network
    |                         |                             |                   |
    |  POST /properties/:id/  |                             |                   |
    |  tokenize               |                             |                   |
    |  x-user-address: GXXX   |                             |                   |
    |------------------------>|                             |                   |
    |                         |                             |                   |
    |                    [1] Validate userAddress present   |                   |
    |                         |                             |                   |
    |                    [2] propertyRepository.findById()  |                   |
    |                         |-------------------------->  |                   |
    |                         |  property record            |                   |
    |                         |<--------------------------  |                   |
    |                         |                             |                   |
    |                    [3] Guard: property.verified === true?                 |
    |                         |  NO --> 400 VALIDATION_ERROR                   |
    |                         |                             |                   |
    |                    [4] Guard: property.tokenAddress is null?              |
    |                         |  NO --> 409 CONFLICT (already tokenized)       |
    |                         |                             |                   |
    |                    [5] userRepository.findById(property.ownerId)         |
    |                         |-------------------------->  |                   |
    |                         |  owner record               |                   |
    |                         |<--------------------------  |                   |
    |                         |                             |                   |
    |                    [6] stellarService.getMintingConfig()                  |
    |                         |  reads: REAL_ESTATE_TOKEN_CONTRACT_ID          |
    |                         |         STELLAR_ADMIN_PUBLIC_KEY               |
    |                         |         STELLAR_ADMIN_SECRET                   |
    |                         |                             |                   |
    |                    [7] Authorization: caller must be owner OR admin       |
    |                         |  NO --> 403 FORBIDDEN                          |
    |                         |                             |                   |
    |                    [8] propertyRepository.allocateSorobanPropertyId()    |
    |                         |-------------------------->  |                   |
    |                         |  sorobanPropertyId (u64)    |                   |
    |                         |<--------------------------  |                   |
    |                         |                             |                   |
    |                    [9] stellarService.mintPropertyShares()                |
    |                         |                             |                   |
    |                         |  [9a] callContract("mint_shares",              |
    |                         |        adminPublicKey,                         |
    |                         |        sorobanPropertyId,                      |
    |                         |        owner.walletAddress,                    |
    |                         |        property.totalShares)                   |
    |                         |        --> builds unsigned XDR tx              |
    |                         |                             |                   |
    |                         |  [9b] transaction.sign(Keypair.fromSecret      |
    |                         |        (adminSecret))                          |
    |                         |        --> signed XDR tx                       |
    |                         |                             |                   |
    |                         |  [9c] server.submitTransaction(signedXdr)      |
    |                         |----------------------------------------------->|
    |                         |                             |   mint_shares()   |
    |                         |                             |   on contract     |
    |                         |                             |   admin.require_auth()
    |                         |                             |   require_admin() |
    |                         |                             |   increase shares |
    |                         |                             |   emit event      |
    |                         |  txHash                     |                   |
    |                         |<-----------------------------------------------|
    |                         |                             |                   |
    |                    [10] DB write ONLY after on-chain success              |
    |                         | propertyRepository.setTokenizationResult()     |
    |                         |  tokenAddress = contractId  |                   |
    |                         |  sorobanPropertyId = id     |                   |
    |                         |-------------------------->  |                   |
    |                         |  updated property           |                   |
    |                         |<--------------------------  |                   |
    |                         |                             |                   |
    |  200 OK                 |                             |                   |
    |  { txHash,              |                             |                   |
    |    contractId,          |                             |                   |
    |    sorobanPropertyId,   |                             |                   |
    |    tokenAddress,        |                             |                   |
    |    totalShares,         |                             |                   |
    |    owner }              |                             |                   |
    |<------------------------|                             |                   |
```

---

## Step-by-step breakdown

### Step 1–4: Guards (TokenizationService.ts:36–47)

Before touching the blockchain, the service enforces three hard preconditions:

| Check | Condition | Error if failed |
|---|---|---|
| Property exists | `property !== null` | `404 NOT_FOUND` |
| Property verified | `property.verified === true` | `400 VALIDATION_ERROR` |
| Not already tokenized | `property.tokenAddress === null && property.sorobanPropertyId === null` | `409 CONFLICT` |

The third guard is the idempotency check. Once a property is tokenized, this endpoint becomes a no-op barrier. You cannot re-tokenize.

### Step 6: Environment variable resolution (StellarService.ts:42–57)

`getMintingConfig()` reads three env vars at call time (not at service startup):

```
REAL_ESTATE_TOKEN_CONTRACT_ID  → which contract to invoke
STELLAR_ADMIN_PUBLIC_KEY       → source account for the transaction
STELLAR_ADMIN_SECRET           → signing key
```

If any of the three is missing or malformed (contract ID must match `/^C[A-Z2-7]{55}$/`), the method throws `400 BAD_REQUEST` before any DB or blockchain call is made.

### Step 7: Authorization (TokenizationService.ts:57–59)

The caller (`x-user-address` header) must be one of:
- `owner.walletAddress` — the property owner calls their own tokenization
- `adminPublicKey` (`STELLAR_ADMIN_PUBLIC_KEY`) — the platform admin triggers it on their behalf

Anyone else receives `403 FORBIDDEN`. This check is enforced in the service, not at the contract level.

### Step 8: Soroban property ID allocation (TokenizationService.ts:61–62)

Properties in PostgreSQL have UUIDs. The Soroban contract uses `u64` integers as property identifiers. `allocateSorobanPropertyId()` generates a monotonically increasing numeric ID from the database and reserves it. This number will permanently identify this property on-chain.

### Step 9: On-chain mint (StellarService.ts:129–169)

This is the two-phase Stellar transaction pattern:

**Phase A — Build** (`callContract`, StellarService.ts:96–127):
1. Fetches the admin account's current sequence number from Horizon.
2. Constructs a `TransactionBuilder` pointing at the contract.
3. Adds a `contract.call("mint_shares", ...)` operation with arguments in this exact order:
   - `admin` (adminPublicKey)
   - `property_id` (sorobanPropertyId, u64)
   - `recipient` (owner.walletAddress)
   - `amount` (property.totalShares)
4. Sets timeout to 30 seconds.
5. Returns unsigned XDR.

**Phase B — Sign and submit** (`mintPropertyShares`, StellarService.ts:148–159):
1. Deserializes the XDR back into a `Transaction` object.
2. Signs with `Keypair.fromSecret(adminSecret)`.
3. Submits via `server.submitTransaction()` to Horizon.
4. Returns `txHash` on success.

**On-chain execution** (`lib.rs:141–162`):
```
mint_shares(env, admin, property_id, recipient, amount)
  admin.require_auth()           ← Stellar signature verification
  AdminControl::require_admin()  ← Must match stored admin address
  amount > 0                     ← Panics if 0
  total_shares += amount         ← Overflow protected with checked_add
  balance[recipient] += amount
  emit PropertyEvents::share_transfer
```

### Step 10: DB write after on-chain success (TokenizationService.ts:99–128)

**The DB write happens only after the on-chain transaction succeeds.** This is an intentional design: a failed blockchain submission leaves the property unchanged in the database, making the operation safe to retry.

After `setTokenizationResult()`, the property record gains:
- `tokenAddress` = the contract ID (used as the token's canonical address)
- `sorobanPropertyId` = the u64 numeric identifier

A reconciliation guard (lines 111–128) detects the race condition where the DB write succeeded but the returned values don't match expectations, logging a `tokenization_reconciliation_required` event for manual investigation.

---

## HTTP API reference

### Tokenize a property

```http
POST /properties/:id/tokenize
x-user-address: <caller Stellar public key>
Content-Type: application/json
```

**Path parameter:**
- `id` — UUID of the property in PostgreSQL

**Required header:**
- `x-user-address` — the Stellar public key of the caller. Must match the property owner or the platform admin key. Missing this header returns `401 UNAUTHORIZED`.

**Success response (200):**
```json
{
  "txHash": "a3f9c...64-char hex...",
  "contractId": "CXXX...56-char contract ID...",
  "sorobanPropertyId": "42",
  "tokenAddress": "CXXX...same as contractId...",
  "totalShares": 1000,
  "owner": "GXXX...owner Stellar address..."
}
```

**Error responses:**

| Status | Code | Cause |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Property not verified, or Soroban config env vars missing |
| `401` | `UNAUTHORIZED` | `x-user-address` header missing |
| `403` | `FORBIDDEN` | Caller is neither the property owner nor the admin |
| `404` | `NOT_FOUND` | Property ID does not exist |
| `409` | `CONFLICT` | Property has already been tokenized |
| `500` | `INTERNAL_ERROR` | On-chain submission failed, or DB update failed after successful mint |

---

## Failure modes and recovery

### Soroban submission fails, DB unchanged

The most common safe failure. The on-chain call was rejected (wrong args, insufficient fee, contract paused, etc.). Since the DB write has not happened, the property still has `tokenAddress: null`. The endpoint can be retried after fixing the root cause.

Check: `txHash` error details via `stellar transaction --id <txHash> --network <network>`.

### On-chain succeeds, DB write fails (reconciliation error)

Rare but possible. The contract has already minted shares for `sorobanPropertyId`. The DB still shows `tokenAddress: null`. The logs will contain:

```json
{
  "event": "tokenization_reconciliation_required",
  "txHash": "<hash>",
  "contractId": "<id>",
  "sorobanPropertyId": <number>
}
```

**Manual recovery:** Call `propertyRepository.setTokenizationResult(propertyId, { tokenAddress, sorobanPropertyId })` directly via a database migration or admin script. The on-chain state is authoritative; the DB must be updated to match it. Do not re-run the tokenize endpoint — it will hit the `allocateSorobanPropertyId` step and create a new ID, producing a duplicate on-chain mint.

### Contract is paused

If `emergency_pause` has been called, the `mint_shares` invocation will succeed at the API layer up to Step 9 but will fail on-chain with `"Contract paused"`. The DB is not written. Resume normal operation only after recovery (see `docs/operations/runbook-emergency-pause.md`).

---

## See also

- `docs/operations/runbook-emergency-pause.md` — what happens if the contract is paused during a tokenization
- `docs/deployment/deploy-contracts.md` — contract deployment and role setup
- `docs/deployment/environment-variables.md` — `STELLAR_ADMIN_SECRET` security warning
