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

### Rate Limiting

Rate-limited routes (`apps/api/src/middleware/rateLimit.ts`) key each client by the address it connected from, so a client cannot choose its own identity by sending an address header. `TRUSTED_PROXY_HOPS` is the only configuration that changes that, and it must match the number of reverse proxies actually in front of the API.

The limiter counts an in-memory sliding window per client unless `REDIS_URL` is set, in which case the same window is counted in Redis so every instance shares it. In-memory counters are bounded: expired clients are dropped on access and by a periodic sweep, and a hard cap evicts the clients nearest expiry when the store is full.

| Variable             | Example Value | Required          | Description                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRUSTED_PROXY_HOPS` | `1`           | No (default: `0`) | Number of reverse proxies in front of the API that are trusted to append to `x-forwarded-for`. `0` (the default) means no proxy is trusted and the client address is read from the socket only. With `N`, the address is taken `N` entries from the right of the `x-forwarded-for` chain; a shorter chain falls back to the socket address. `x-real-ip` is never trusted |

> **Deploying behind a proxy:** leaving `TRUSTED_PROXY_HOPS` at `0` means every request is keyed by the proxy's own address, so all clients share one bucket. Set it to the exact number of proxies you operate (load balancer, ingress, sidecar) and no more: every hop counted is a hop a client could otherwise spoof through.

### CORS

The API answers cross-origin browser requests only from the origins listed in `CORS_ALLOWED_ORIGINS` (`apps/api/src/middleware/cors.ts`). An allowed origin is echoed back in `Access-Control-Allow-Origin` with `Access-Control-Allow-Credentials: true`; any other origin receives no `Access-Control-Allow-Origin` header, so the browser blocks the response. The API never reflects arbitrary origins.

| Variable               | Example Value                                    | Required                                       | Description                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | `https://app.akkuea.com,https://land.akkuea.com` | Yes (production, when a browser calls the API) | Comma-separated list of exact origins allowed to call the API from a browser. Entries are trimmed and empty entries dropped. Each entry must be an `http` or `https` origin written exactly as a browser sends it: scheme, lower-case host, and an optional non-default port, with no path, trailing slash, query, credentials, or wildcard. An invalid entry fails startup validation |

Behavior when `CORS_ALLOWED_ORIGINS` is unset or empty:

- **Development** (`NODE_ENV=development`, or `NODE_ENV` unset): the local frontends are allowed, `http://localhost:3000` (webapp) and `http://localhost:3002` (Akkuea Land, which `next dev` moves to 3002 under `bun run dev` because the webapp holds 3000 and the API 3001). If you start the frontends on other ports, set the variable explicitly.
- **Production**: no cross-origin requests are allowed, and the API logs a warning at startup. Server-to-server callers (such as the webapp's operations proxy) do not send an `Origin` header and are not affected.
- **Test**: no cross-origin requests are allowed.

A configured list is used as-is in every environment; the development defaults are not added to it.

### Internal Security

| Variable                                   | Example Value                   | Required                          | Description                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBHOOK_SECRET`                           | `your_webhook_secret_here`      | Yes                               | Secret used to sign and verify incoming webhook payloads. Must be a random string of at least 32 characters                                                                               |
| `WEBHOOK_TIMESTAMP_TOLERANCE_MS`           | `300000`                        | No (default: `300000`, 5 minutes) | Maximum age or future offset accepted for a signed webhook timestamp. The boundary is inclusive. When a payload includes `timestamp`, it must parse as a date and fall within this window |
| `OPERATIONS_BACKEND_CREDENTIAL`            | `generate-a-long-random-secret` | Yes                               | Shared secret between the API server and the Next.js operations dashboard proxy. Both sides must have the same value. Generate with: `openssl rand -hex 32`                               |
| `OPERATIONS_ALLOWED_WALLETS`               | `GXXX...,GYYY...`               | Yes (production)                  | Comma-separated list of Stellar public keys permitted to call admin operations endpoints. Acts as a server-side allowlist                                                                 |
| `OPERATIONS_ALLOW_WILDCARD_IN_DEVELOPMENT` | `false`                         | No                                | Set to `true` only for local development to allow `OPERATIONS_ALLOWED_WALLETS=*`. This has no effect when `NODE_ENV=production`.                                                          |

Transaction webhooks are signed as the lowercase or uppercase 64-character hexadecimal HMAC-SHA256 digest of the exact raw HTTP request body bytes, using `WEBHOOK_SECRET` as the key. Send that hex string in `X-Webhook-Signature`; do not parse or re-serialize the JSON before signing. If `timestamp` is present, deliveries more than five minutes old or more than five minutes in the future are rejected by default. The exact cutoff is accepted, and `WEBHOOK_TIMESTAMP_TOLERANCE_MS` configures the window. For compatibility, an omitted timestamp is not freshness-checked.

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
| `KYC_EXPIRY_REMINDER_WINDOW_MS` | `2592000000`  | No (default: 30d)    | How far in advance to send the expiry reminder notification, in milliseconds. Default is `2592000000` (30 days). Sent once per user per expiry date |

### Pilot Ally Reporting Escalation Job

The escalation job proactively watches `pilot-payout-split`'s on-chain evidence history and notifies an operator when the pilot ally has missed two (configurable) or more consecutive expected reporting cycles, instead of leaving this as a passive dashboard-only signal. See `apps/api/src/workers/pilotEscalationJob.ts`.

The reporting cadence, breach threshold, and re-notification cadence are all configurable because they are properties of a specific ally's agreement, which does not exist yet for the pilot. `PILOT_ESCALATION_AGREEMENT_START` and `PILOT_ESCALATION_OPERATOR_USER_ID` are required for the job to actually run; without them it logs a warning each tick and does nothing (it does not crash).

Every variable in this section, in [Pilot Review Turnaround SLA](#pilot-review-turnaround-sla), and in [Pilot Contract Overrides](#pilot-contract-overrides) is validated at startup by `apiEnvSchema` (`apps/shared/src/env/schemas.ts`). A value that is set but malformed stops the API from starting, with a message naming the variable; it is never silently replaced by the default. An unset or empty optional variable uses the listed default. "Set by" names who supplies the value: the Akkuea operator who runs the API, or the signed ally agreement, whose terms the operator copies in.

| Variable                                | Example Value                          | Required             | Set by          | Description                                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------- | -------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PILOT_ESCALATION_JOB_ENABLED`          | `true`                                 | No (default: `true`) | Akkuea operator | `true` or `false` (case-insensitive). Set to `false` to disable the escalation background job entirely (e.g. in test environments)                                                                                |
| `PILOT_ESCALATION_AGREEMENT_START`      | `2026-01-15T00:00:00.000Z`             | Yes (to run)         | Ally agreement  | Date the ally's reporting agreement began: an ISO 8601 date (`2026-01-15`) or a date-time with `Z` or an offset. Must be a real calendar date. No default: without it the job skips every tick                    |
| `PILOT_ESCALATION_OPERATOR_USER_ID`     | `3f2b8c1e-5d4a-4c7b-9e1f-0a2b3c4d5e6f` | Yes (to run)         | Akkuea operator | `users.id` UUID of the operator to notify through the existing notification pipeline. No default: without it the job skips every tick                                                                             |
| `PILOT_ESCALATION_CADENCE_DAYS`         | `30`                                   | No (default: `30`)   | Ally agreement  | Expected evidence-reporting cadence, in days (a positive number)                                                                                                                                                  |
| `PILOT_ESCALATION_THRESHOLD_CYCLES`     | `2`                                    | No (default: `2`)    | Ally agreement  | Consecutive missed cycles that constitutes a breach (a positive whole number)                                                                                                                                     |
| `PILOT_ESCALATION_POLL_INTERVAL_MS`     | `21600000`                             | No (default: 6h)     | Akkuea operator | How often the job runs, in milliseconds: a whole number from `1` to `2147483647` (about 24.8 days, the longest interval a timer supports). Default is `21600000`                                                  |
| `PILOT_ESCALATION_RENOTIFY_INTERVAL_MS` | `604800000`                            | No (default: 7d)     | Akkuea operator | While the same breach persists unresolved, how often to re-send the notification rather than staying silent forever, in milliseconds (a positive whole number). Not re-sent on every poll. Default is `604800000` |

The job reads `pilot-payout-split` at the contract ID resolved for the configured network; see [Pilot Contract Overrides](#pilot-contract-overrides) to point it at a different deployment.

### Idempotency Cleanup Job

The idempotency cleanup job periodically deletes expired rows from `idempotency_keys`. Without it, expired keys are only ever reclaimed if the same `Idempotency-Key` header value is reused (see `apps/api/src/middleware/idempotency.ts`); a key that is never reused would otherwise stay in the table forever. See `apps/api/src/workers/idempotencyCleanupJob.ts`.

| Variable                               | Example Value | Required             | Description                                                                               |
| -------------------------------------- | ------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| `IDEMPOTENCY_CLEANUP_JOB_ENABLED`      | `true`        | No (default: `true`) | Set to `false` to disable the idempotency cleanup background job entirely (e.g. in tests) |
| `IDEMPOTENCY_CLEANUP_POLL_INTERVAL_MS` | `3600000`     | No (default: 1h)     | How often the job runs, in milliseconds. Default is `3600000` (1 hour)                    |

### Pilot Review Turnaround SLA

Whitelist-review and evidence-review turnaround against the documented SLA (see `docs/operations/pilot-review-sla.md`). Exposed at `GET /pilot/whitelist/metrics` (operator key required). The targets are calendar hours so they can change with a signed ally's expectations without a code change.

Each value must be a positive number (decimals allowed). Like the escalation job variables above, they are validated at startup: a malformed value stops the API from starting with a message naming the variable, and an unset value uses the listed default.

| Variable                           | Example Value | Required           | Set by                                                | Description                                                                                          |
| ---------------------------------- | ------------- | ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PILOT_WHITELIST_REVIEW_SLA_HOURS` | `48`          | No (default: `48`) | Akkuea operator (from the ally agreement once signed) | Hours from whitelist request submission (`createdAt`) to operator review (`reviewedAt`)              |
| `PILOT_EVIDENCE_REVIEW_SLA_HOURS`  | `48`          | No (default: `48`) | Akkuea operator (from the ally agreement once signed) | Hours from a reporting cycle's due date to on-chain `record_evidence` (`recorded_at`)                |
| `PILOT_REVIEW_METRICS_WINDOW_DAYS` | `30`          | No (default: `30`) | Akkuea operator                                       | Default lookback, in days, for `GET /pilot/whitelist/metrics` when `from` / `windowDays` are omitted |

### Pilot Contract Overrides

The API resolves the pilot contract IDs from the committed deployment artifacts in `apps/shared/src/contracts.<network>.json`, which is the normal case (see `apps/api/src/config/contracts.ts` and `docs/deployment/deploy-pilot-contracts.md`). Set these only to point the API at a custom deployment. Each must be a valid Soroban contract ID; like the other pilot variables, a malformed value stops the API from starting with a message naming the variable.

| Variable                         | Example Value                         | Required                               | Set by                     | Description                                                                                                                                            |
| -------------------------------- | ------------------------------------- | -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PILOT_PAYOUT_SPLIT_CONTRACT_ID` | `CXXX...` (56 chars, starts with `C`) | No (falls back to deployment artifact) | Akkuea operator (deployer) | Overrides the `pilot-payout-split` contract ID for this network. Read by the escalation job and the review-turnaround metrics                          |
| `WHITELIST_CONTRACT_ID`          | `CXXX...` (56 chars, starts with `C`) | No (falls back to deployment artifact) | Akkuea operator (deployer) | Overrides the `pilot-whitelist` contract ID for this network. Used when an operator approves a whitelist request. Note the name has no `PILOT_` prefix |

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

### Webapp - Pilot Dashboard

Read by `apps/webapp` in the browser, so every variable here is public by
design. None of them is a secret, and none should ever hold one. All of them
are set by the Akkuea operator who deploys the dashboard; the ones marked
"Ally agreement" are terms of the signed ally agreement that the operator
copies in.

Contract IDs are optional overrides: with all three empty, the dashboard reads
the committed deployment artifacts in `apps/shared/src/contracts.<network>.json`,
which is the normal case. Set them only to point a local dashboard at a custom
deployment. See `docs/deployment/deploy-pilot-contracts.md`.

Every `NEXT_PUBLIC_PILOT_*` variable is validated by `webappEnvSchema`
(`apps/shared/src/env/schemas.ts`) when the webapp builds or its dev server
starts. A value that is set but malformed fails the build with a message naming
the variable; it is never silently replaced by the default. An unset or empty
optional variable uses the listed default. Because these values are inlined
into the browser bundle, changing one requires a rebuild.

| Variable                                     | Example Value                         | Required                    | Set by                     | Description                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------- | --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`                | `testnet`                             | No                          | Akkuea operator            | Network the pilot dashboard reads from. `testnet` (default) or `mainnet`                                                                                                                                                                                                                    |
| `NEXT_PUBLIC_SOROBAN_RPC_URL`                | `https://soroban-testnet.stellar.org` | No                          | Akkuea operator            | Soroban RPC override. Defaults to the public endpoint for the selected network                                                                                                                                                                                                              |
| `NEXT_PUBLIC_PILOT_ALLY_ADDRESS`             | `GXXX...` (56 chars, starts with `G`) | Yes (for co-signed actions) | Ally agreement             | The ally's Stellar public key, with a valid checksum. `pilot-payout-split` stores it with no public getter, so the dashboard reads it from here. No default: without it every co-signed action (`execute_distribution`, `record_evidence`, `exit`) fails with `PilotAllyNotConfiguredError` |
| `NEXT_PUBLIC_PILOT_PAYOUT_SPLIT_CONTRACT_ID` | `CXXX...` (56 chars, starts with `C`) | No                          | Akkuea operator (deployer) | Overrides the payout-split contract ID from the deployment artifact. Must be a valid Soroban contract ID                                                                                                                                                                                    |
| `NEXT_PUBLIC_PILOT_INCOME_TOKEN_CONTRACT_ID` | `CXXX...` (56 chars, starts with `C`) | No                          | Akkuea operator (deployer) | Overrides the income token contract ID from the deployment artifact. Must be a valid Soroban contract ID                                                                                                                                                                                    |
| `NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID`    | `CXXX...` (56 chars, starts with `C`) | No                          | Akkuea operator (deployer) | Overrides the whitelist contract ID from the deployment artifact. Must be a valid Soroban contract ID                                                                                                                                                                                       |
| `NEXT_PUBLIC_PILOT_START_CYCLE`              | `2026-01`                             | No (default: `2026-01`)     | Ally agreement             | First income cycle the dashboard reports on, as `YYYY-MM` (month `01` to `12`). Cycles are enumerated from here to the current month                                                                                                                                                        |
| `NEXT_PUBLIC_PILOT_PAYMENT_DAY`              | `5`                                   | No (default: `5`)           | Ally agreement             | Day of the month, in the month after the cycle, that the ally's income is due. A whole number from `1` to `28`. A term of the ally's agreement, not a software constant                                                                                                                     |
| `NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL`       | `https://example.org/property.splat`  | No                          | Akkuea operator            | Gaussian splat capture of the ally's property (an `https` URL), shown in the investor view. Absent renders a documented empty state                                                                                                                                                         |
| `NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS`      | `24`                                  | No (default: `24`)          | Akkuea operator            | How long, in hours, the ally's signature on a prepared co-signed action stays valid. A positive number (decimals allowed)                                                                                                                                                                   |
| `NEXT_PUBLIC_PILOT_EURC_SLIPPAGE_BPS`        | `100`                                 | No (default: `100`, 1%)     | Akkuea operator            | Slippage tolerance, in basis points, applied to the live quote when preparing an `execute_distribution` with any holder paid in EURC. A whole number from `0` to `9999`                                                                                                                     |

---

### Webapp - Property Images

Read by `apps/webapp/next.config.ts` to build the `next/image`
`images.remotePatterns` allowlist. The API accepts any image URL for a
property, but `next/image` refuses to load from a host that is not on this
list, so every host that serves property images in a given deployment must be
listed here. Each entry becomes an `https`-only pattern; `http` image URLs are
never allowed.

Format: a comma-separated list of bare hostnames. Whitespace around entries is
trimmed and empty entries are dropped. An entry must not include a protocol,
port, path, or inner spaces, so `cdn.example.com` is valid while
`https://cdn.example.com`, `cdn.example.com:8443`, and `cdn.example.com/img` are
rejected. The list is validated at boot by `webappEnvSchema`
(`apps/shared/src/env/schemas.ts`), which fails startup with the offending
entries named. When the variable is unset or empty, the default applies.

A property with no images, or whose image fails to load, shows the bundled
placeholder at `apps/webapp/public/images/property-placeholder.svg`, which is
served locally and needs no entry here.

| Variable                           | Example Value                            | Required                            | Description                                                                                   |
| ---------------------------------- | ---------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PROPERTY_IMAGE_HOSTS` | `images.unsplash.com,res.cloudinary.com` | No (default: `images.unsplash.com`) | Hosts `next/image` may load property images from over `https`. Changing it requires a rebuild |

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
- [ ] `TRUSTED_PROXY_HOPS` matches the number of proxies in front of the API (`0` if the API is reached directly)
- [ ] `REDIS_URL` is set if the API runs more than one instance, so rate limits are shared
- [ ] `.env` file is in `.gitignore` (verify with `git check-ignore -v apps/api/.env`)
