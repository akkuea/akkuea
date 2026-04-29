# Deployment Environment Variables

All environment-specific values — including deployed contract IDs — are managed
through environment variables. **Never hardcode contract addresses in source files.**

Copy `.env.example` to `.env.local` and fill in the values for your target environment.

---

## Variable Reference

### Stellar network

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | `testnet` or `mainnet` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Yes | Horizon REST API endpoint |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Yes | Soroban RPC endpoint |

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

### Contract IDs

Contract IDs are 56-character base32 strings beginning with `C`. They are
printed by `stellar contract deploy` at deploy time. Record every address in
`docs/contracts/deployment.md` before adding it here.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_REAL_ESTATE_TOKEN_TESTNET` | Yes (testnet) | Deployed `real_estate_token` on Testnet |
| `NEXT_PUBLIC_CONTRACT_DEFI_LENDING_TESTNET` | Yes (testnet) | Deployed `defi_lending` on Testnet |
| `NEXT_PUBLIC_CONTRACT_REAL_ESTATE_TOKEN_MAINNET` | Yes (mainnet) | Deployed `real_estate_token` on Mainnet |
| `NEXT_PUBLIC_CONTRACT_DEFI_LENDING_MAINNET` | Yes (mainnet) | Deployed `defi_lending` on Mainnet |

These variables are consumed by `apps/shared/src/constants/index.ts`.
If a required variable is missing at runtime, `getContractId()` throws a
descriptive error naming the exact variable that needs to be set.

### Database and caching (API)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Enables response caching. `GET /properties` cached 30 s, `GET /lending/pools` cached 10 s. Falls back to direct PostgreSQL when unset. |

### Auth and signing

| Variable | Required | Description |
|---|---|---|
| `STELLAR_SERVER_SECRET_KEY` | Yes (API) | Signs server-side Stellar transactions. Generate with `stellar keys generate`. |
| `JWT_SECRET` | Yes (API) | Signs user session tokens. Use a long random string. |

---

## Testnet values

Fill in after running `stellar contract deploy` on Testnet and verifying
each address on [Stellar Expert (Testnet)](https://stellar.expert/explorer/testnet).

```env
# Populated after deployment — see docs/contracts/deployment.md
NEXT_PUBLIC_CONTRACT_REAL_ESTATE_TOKEN_TESTNET=
NEXT_PUBLIC_CONTRACT_DEFI_LENDING_TESTNET=
```

## Mainnet values

Not yet deployed. See `docs/contracts/deployment.md` for Mainnet deployment
requirements (audit sign-off, multisig deployer, two-engineer PR approval).

```env
NEXT_PUBLIC_CONTRACT_REAL_ESTATE_TOKEN_MAINNET=
NEXT_PUBLIC_CONTRACT_DEFI_LENDING_MAINNET=
```

---

## How contract IDs flow through the codebase

```
stellar contract deploy
  └─► prints C... address
        └─► recorded in docs/contracts/deployment.md
              └─► added to .env.local / hosting secrets
                    └─► read by apps/shared/src/constants/index.ts
                          └─► consumed via getContractId() by webapp and API
```