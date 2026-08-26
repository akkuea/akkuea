# Environment Variables Reference

**Source of truth:** `apps/api/.env.example`

This document lists every environment variable required to run the Akkuea platform. All variables come directly from the `.env.example` file. Any variable not listed here does not exist in the codebase and should not be referenced.

> **Note on previous documentation:** `docs/api/overview.md` referenced `JWT_SECRET`, `KYC_PROVIDER_API_KEY`, `API_HOST`, and `API_PORT`. None of these exist in `.env.example` or the codebase. Ignore them.

---

## How to set up

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env and fill in every value marked as required
```

---

## Variables

### Database

| Variable            | Example Value                                           | Required              | Description                                               |
| ------------------- | ------------------------------------------------------- | --------------------- | --------------------------------------------------------- |
| `DATABASE_URL`      | `postgresql://user:password@localhost:5432/akkuea_defi` | Yes                   | Full PostgreSQL connection string                         |
| `DATABASE_POOL_MAX` | `10`                                                    | No (default: `10`)    | Max connections in the pool                               |
| `DATABASE_SSL`      | `false`                                                 | No (default: `false`) | Enable SSL for DB connection. Set to `true` in production |

### API Server

| Variable    | Example Value | Required             | Description                                                |
| ----------- | ------------- | -------------------- | ---------------------------------------------------------- |
| `PORT`      | `3001`        | No (default: `3001`) | Port the Elysia/Bun API listens on                         |
| `NODE_ENV`  | `development` | Yes                  | Runtime environment. Use `production` for live deployments |
| `LOG_LEVEL` | `info`        | No                   | Logging verbosity (`debug`, `info`, `warn`, `error`)       |

### Internal Security

| Variable                        | Example Value                   | Required         | Description                                                                                                                                                 |
| ------------------------------- | ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBHOOK_SECRET`                | `your_webhook_secret_here`      | Yes              | Secret used to sign and verify incoming webhook payloads. Must be a random string of at least 32 characters                                                 |
| `OPERATIONS_BACKEND_CREDENTIAL` | `generate-a-long-random-secret` | Yes              | Shared secret between the API server and the Next.js operations dashboard proxy. Both sides must have the same value. Generate with: `openssl rand -hex 32` |
| `OPERATIONS_ALLOWED_WALLETS`    | `GXXX...,GYYY...`               | Yes (production) | Comma-separated list of Stellar public keys permitted to call admin operations endpoints. Acts as a server-side allowlist                                   |

### KYC / Document Storage

| Variable         | Example Value             | Required | Description                                                                                                                    |
| ---------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `KYC_UPLOAD_DIR` | `/var/akkuea/kyc-uploads` | Yes      | Absolute path on the server where KYC document files are stored. The API process must have read/write access to this directory |

### KYC Expiry Job

The KYC expiry job runs in the background to mark expired KYC records and send re-verification reminders. All three variables are optional - the defaults are suitable for production.

| Variable                        | Example Value | Required             | Description                                                                                                                                         |
| ------------------------------- | ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KYC_EXPIRY_JOB_ENABLED`        | `true`        | No (default: `true`) | Set to `false` to disable the KYC expiry background job entirely (e.g. in test environments)                                                        |
| `KYC_EXPIRY_POLL_INTERVAL_MS`   | `86400000`    | No (default: 24h)    | How often the job runs, in milliseconds. Default is `86400000` (24 hours). Set lower in staging to test expiry behaviour without waiting a full day |
| `KYC_EXPIRY_REMINDER_WINDOW_MS` | `2592000000`  | No (default: 30d)    | How far in advance to send the expiry reminder notification, in milliseconds. Default is `2592000000` (30 days)                                     |

### Pilot Ally Reporting Escalation Job

The escalation job proactively watches `pilot-payout-split`'s on-chain evidence history and notifies an operator when the pilot ally has missed two (configurable) or more consecutive expected reporting cycles, instead of leaving this as a passive dashboard-only signal. See `apps/api/src/workers/pilotEscalationJob.ts`.

The reporting cadence, breach threshold, and re-notification cadence are all configurable because they are properties of a specific ally's agreement, which does not exist yet for the pilot. `PILOT_ESCALATION_AGREEMENT_START` and `PILOT_ESCALATION_OPERATOR_USER_ID` are required for the job to actually run; without them it logs a warning each tick and does nothing (it does not crash).

| Variable                             | Example Value                         | Required                   | Description                                                                                                                                          |
| ------------------------------------- | -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PILOT_ESCALATION_JOB_ENABLED`        | `true`                                  | No (default: `true`)        | Set to `false` to disable the escalation background job entirely (e.g. in test environments)                                                          |
| `PILOT_ESCALATION_AGREEMENT_START`    | `2026-01-15T00:00:00.000Z`              | Yes (to run)                | ISO date the ally's reporting agreement began. Without this the job skips every tick                                                                  |
| `PILOT_ESCALATION_OPERATOR_USER_ID`   | `b3f1...` (a user UUID)                 | Yes (to run)                | User ID of the operator to notify through the existing notification pipeline. Without this the job skips every tick                                   |
| `PILOT_ESCALATION_CADENCE_DAYS`       | `30`                                    | No (default: `30`)          | Expected evidence-reporting cadence, in days, per the ally's agreement                                                                                 |
| `PILOT_ESCALATION_THRESHOLD_CYCLES`   | `2`                                     | No (default: `2`)           | Consecutive missed cycles that constitutes a breach                                                                                                    |
| `PILOT_ESCALATION_POLL_INTERVAL_MS`   | `21600000`                              | No (default: 6h)            | How often the job runs, in milliseconds                                                                                                                |
| `PILOT_ESCALATION_RENOTIFY_INTERVAL_MS` | `604800000`                           | No (default: 7d)            | While the same breach persists unresolved, how often to re-send the notification rather than staying silent forever. Not re-sent on every poll         |
| `PILOT_PAYOUT_SPLIT_CONTRACT_ID`      | `CXXX...` (56 chars, starts with `C`)   | No (falls back to deployment artifact) | Overrides the resolved `pilot-payout-split` contract ID for this network                                                                    |

### Stellar / Soroban - Network

| Variable                     | Example Value                         | Required | Description                                                                                                                                                              |
| ---------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STELLAR_HORIZON_URL`        | `https://horizon-testnet.stellar.org` | Yes      | Horizon REST API endpoint. Use `https://horizon.stellar.org` for mainnet                                                                                                 |
| `STELLAR_RPC_URL`            | `https://soroban-testnet.stellar.org` | Yes      | Soroban RPC endpoint for contract invocations. Use `https://soroban.stellar.org` for mainnet                                                                             |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015`   | Yes      | Network identifier embedded in every transaction signature. **Wrong passphrase = invalid transactions.** Mainnet value: `Public Global Stellar Network ; September 2015` |

### Stellar / Soroban - Admin Identity

> **SECURITY WARNING - `STELLAR_ADMIN_SECRET`**
>
> This is the private key of the account that controls the entire protocol. It has the authority to:
>
> - Mint and burn shares (`mint_shares`, `burn_shares`)
> - Create and configure lending pools (`create_pool`)
> - Set the price oracle address (`set_oracle`)
> - Grant and revoke all roles (`grant_emergency_role`, etc.)
> - Transfer the admin role to another account
>
> **Treat this value as a root credential. Never commit it to version control, never log it, never transmit it over unencrypted channels.**
>
> In production, this key should be stored in a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) and loaded at runtime. Consider using a hardware wallet or multisig scheme for on-chain operations.

| Variable                   | Example Value                         | Required | Description                                                                                                    |
| -------------------------- | ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `STELLAR_ADMIN_PUBLIC_KEY` | `GXXX...` (56 chars, starts with `G`) | Yes      | The public key of the admin account. Safe to expose; used to verify identity                                   |
| `STELLAR_ADMIN_SECRET`     | `SXXX...` (56 chars, starts with `S`) | Yes      | **The admin private key.** See security warning above. Used by `StellarService` to sign all admin transactions |

### Stellar / Soroban - Contracts

| Variable                        | Example Value                         | Required | Description                                                                                                                                                                          |
| ------------------------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REAL_ESTATE_TOKEN_CONTRACT_ID` | `CXXX...` (56 chars, starts with `C`) | Yes      | The Soroban contract ID produced after deploying `real_estate_defi_contracts.wasm`. Obtained from the output of `stellar contract deploy`. See `docs/deployment/deploy-contracts.md` |

---

## Network Passphrase Reference

| Network            | `STELLAR_NETWORK_PASSPHRASE`                     |
| ------------------ | ------------------------------------------------ |
| Testnet            | `Test SDF Network ; September 2015`              |
| Mainnet            | `Public Global Stellar Network ; September 2015` |
| Local (Quickstart) | `Standalone Network ; February 2017`             |

Note the space before the semicolons - the passphrase must match exactly.

---

## Production checklist

Before going live, verify:

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_SSL=true`
- [ ] `STELLAR_HORIZON_URL` and `STELLAR_RPC_URL` point to mainnet endpoints
- [ ] `STELLAR_NETWORK_PASSPHRASE` is the mainnet passphrase (verify character-by-character)
- [ ] `STELLAR_ADMIN_SECRET` is loaded from a secrets manager, not hardcoded in the file
- [ ] `OPERATIONS_BACKEND_CREDENTIAL` is a fresh random value (not the example placeholder)
- [ ] `OPERATIONS_ALLOWED_WALLETS` contains only authorized production admin addresses
- [ ] `KYC_UPLOAD_DIR` exists on the server and is not publicly accessible
- [ ] `.env` file is in `.gitignore` (verify with `git check-ignore -v apps/api/.env`)
