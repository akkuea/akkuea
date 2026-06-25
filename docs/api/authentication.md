# Authentication Flow - Stellar Wallet Challenge-Response

## Overview

The Akkuea API uses a **challenge-response authentication flow** that leverages Stellar Ed25519 key pairs to cryptographically verify wallet ownership. This replaces the insecure `x-user-address` header pattern that previously allowed trivial impersonation.

### Security Model

- Users prove they own a Stellar wallet by signing a server-issued nonce
- The server verifies the Ed25519 signature using the Stellar public key
- A short-lived JWT is issued upon successful verification
- All protected routes validate the JWT - no raw headers are trusted

---

## Authentication Endpoints

### POST `/auth/challenge`

Request a cryptographic nonce (challenge) for a given Stellar address. The nonce is stored server-side with a **5-minute** expiration window.

**Request:**

```json
{
  "stellarAddress": "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON"
}
```

**Validation Rules:**

| Field            | Type   | Constraints                                 |
| ---------------- | ------ | ------------------------------------------- |
| `stellarAddress` | string | Exactly 56 chars, matches `^G[A-Z2-7]{55}$` |

**Response (200):**

```json
{
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresAt": 1714006800000
}
```

**Errors:**

| Status | Code              | Cause                       |
| ------ | ----------------- | --------------------------- |
| 400    | `INVALID_ADDRESS` | Malformed Stellar address   |
| 429    | `RATE_LIMITED`    | Too many challenge requests |

---

### POST `/auth/session`

Submit the signed nonce to verify wallet ownership and receive a JWT.

**Request:**

```json
{
  "stellarAddress": "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON",
  "signature": "base64-encoded-ed25519-signature"
}
```

**Validation Rules:**

| Field            | Type   | Constraints                                 |
| ---------------- | ------ | ------------------------------------------- |
| `stellarAddress` | string | Exactly 56 chars, matches `^G[A-Z2-7]{55}$` |
| `signature`      | string | Non-empty, base64-encoded Ed25519 signature |

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-of-user",
    "walletAddress": "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON",
    "displayName": "User Display Name"
  }
}
```

**Errors:**

| Status | Code                  | Cause                                                  |
| ------ | --------------------- | ------------------------------------------------------ |
| 400    | `INVALID_ADDRESS`     | Malformed Stellar address                              |
| 400    | `MISSING_SIGNATURE`   | Signature field is empty                               |
| 401    | `CHALLENGE_NOT_FOUND` | No active challenge for this address (or already used) |
| 401    | `CHALLENGE_EXPIRED`   | Challenge nonce has expired (>5 minutes)               |
| 401    | `INVALID_SIGNATURE`   | Ed25519 verification failed                            |
| 429    | `RATE_LIMITED`        | Too many session requests                              |

---

## Client Integration

### JavaScript / TypeScript (using `stellar-sdk`)

```typescript
import { Keypair } from "stellar-sdk";

const API_BASE = "https://api.akkuea.com";

async function authenticate(secretKey: string): Promise<string> {
  const keypair = Keypair.fromSecret(secretKey);
  const stellarAddress = keypair.publicKey();

  // Step 1: Request challenge
  const challengeRes = await fetch(`${API_BASE}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stellarAddress }),
  });
  const { nonce } = await challengeRes.json();

  // Step 2: Sign the nonce with the private key
  const signatureBuffer = keypair.sign(Buffer.from(nonce));
  const signature = signatureBuffer.toString("base64");

  // Step 3: Submit signature to obtain JWT
  const sessionRes = await fetch(`${API_BASE}/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stellarAddress, signature }),
  });
  const { token } = await sessionRes.json();

  return token; // Use this in subsequent requests
}
```

### Using the Token

Include the JWT in the `Authorization` header of all protected requests:

```typescript
const response = await fetch(`${API_BASE}/lending/pools`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    /* pool data */
  }),
});
```

---

## JWT Token Details

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Algorithm      | HS256                                    |
| Lifetime       | 24 hours                                 |
| Payload fields | `id` (user UUID), `walletAddress`, `exp` |
| Header name    | `Authorization: Bearer <token>`          |

### Token Payload Example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "walletAddress": "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON",
  "exp": 1714093200
}
```

---

## Protected Routes

All the following routes require a valid JWT in the `Authorization` header:

### Lending

| Method | Route                         | Description         |
| ------ | ----------------------------- | ------------------- |
| POST   | `/lending/pools`              | Create lending pool |
| POST   | `/lending/pools/:id/deposit`  | Deposit into pool   |
| POST   | `/lending/pools/:id/withdraw` | Withdraw from pool  |
| POST   | `/lending/pools/:id/borrow`   | Borrow from pool    |
| POST   | `/lending/pools/:id/repay`    | Repay loan          |

### Properties

| Method | Route                        | Description         |
| ------ | ---------------------------- | ------------------- |
| POST   | `/properties`                | Create property     |
| PUT    | `/properties/:id`            | Update property     |
| DELETE | `/properties/:id`            | Delete property     |
| POST   | `/properties/:id/tokenize`   | Tokenize property   |
| POST   | `/properties/:id/buy-shares` | Buy property shares |

### Notifications

| Method | Route                          | Description               |
| ------ | ------------------------------ | ------------------------- |
| GET    | `/notifications`               | Get user notifications    |
| GET    | `/notifications/unread-count`  | Get unread count          |
| GET    | `/notifications/:id`           | Get specific notification |
| PATCH  | `/notifications/:id/read`      | Mark as read              |
| POST   | `/notifications/read-multiple` | Mark multiple as read     |
| POST   | `/notifications/read-all`      | Mark all as read          |
| DELETE | `/notifications/:id`           | Delete notification       |

---

## Security Considerations

### Nonce Lifecycle

- Each nonce is **single-use** - it is deleted from the store after successful verification
- Nonces expire after **5 minutes** - expired nonces are rejected and cleaned up
- A new challenge for the same address **overwrites** the previous one

### Signature Verification

- The server uses `Keypair.fromPublicKey()` to reconstruct the Ed25519 public key
- The nonce bytes are verified against the base64-decoded signature using `keypair.verify()`
- The private key never leaves the client

### Rate Limiting

- Both `/auth/challenge` and `/auth/session` are rate-limited
- Default: **10 requests per 60 seconds** per IP address
- Rate limit headers are included in all responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### Recommendations for Production

1. **Set `JWT_SECRET`** - The default development secret must be replaced with a cryptographically strong random value via the `JWT_SECRET` environment variable
2. **Use HTTPS** - JWTs are bearer tokens; transmit them only over TLS
3. **Token rotation** - Consider implementing refresh tokens for long-lived sessions
4. **Challenge store** - The current in-memory store does not survive restarts. For multi-instance deployments, use Redis or a similar shared store

---

## Environment Variables

| Variable     | Default                            | Description                                                     |
| ------------ | ---------------------------------- | --------------------------------------------------------------- |
| `JWT_SECRET` | `super-secret-default-key-for-dev` | Secret key for signing JWTs. **Must** be changed in production. |
