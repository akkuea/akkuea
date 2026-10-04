# Smoke tests runner

Automates the post-deploy checks described in [`docs/testing/smoke-tests.md`](../../docs/testing/smoke-tests.md): confirm the app boots, dependencies (DB) respond, and a public happy-path endpoint works.

## Quick start (local / dev)

```bash
# From repo root - API must already be running (default port 3001)
./scripts/smoke/run-smoke-tests.sh
```

Or via the root package script:

```bash
bun run smoke
# equivalent: API_BASE_URL=http://localhost:3001 bun run smoke
```

## Pointing at another environment

Set `API_BASE_URL` (no trailing slash required):

```bash
# Staging
API_BASE_URL=https://api.staging.example.com ./scripts/smoke/run-smoke-tests.sh

# Production
API_BASE_URL=https://api.akkuea.com ./scripts/smoke/run-smoke-tests.sh

# Custom timeout (seconds, default 10)
SMOKE_TIMEOUT_SECS=20 API_BASE_URL=https://api.akkuea.com ./scripts/smoke/run-smoke-tests.sh
```

Optional webapp check:

```bash
API_BASE_URL=https://api.akkuea.com \
WEBAPP_BASE_URL=https://app.akkuea.com \
  ./scripts/smoke/run-smoke-tests.sh
```

| Variable             | Default                 | Purpose                            |
| -------------------- | ----------------------- | ---------------------------------- |
| `API_BASE_URL`       | `http://localhost:3001` | Base URL of the API under test     |
| `WEBAPP_BASE_URL`    | _(unset = skip)_        | If set, also `GET /` on the webapp |
| `SMOKE_TIMEOUT_SECS` | `10`                    | curl connect/max time per request  |

## Pilot E2E Suite

A true end-to-end integration suite for the pilot lifecycle is available to exercise the deployed testnet contracts (`pilot-whitelist` and `pilot-payout-split`).

```bash
bun run smoke:pilot
```

**Required Environment Variables (DO NOT COMMIT REAL SECRETS):**

- `API_BASE_URL`: Base URL of the API under test (e.g. `http://localhost:3001`).
- `OPERATIONS_BACKEND_CREDENTIAL`: The shared secret to access `/internal/operations/*` API routes.
- `PILOT_E2E_OPERATOR_SECRET`: The funded testnet key for the operator role. The API signs the whitelist approval with it, and the suite uses the same keypair as the operator, so this must be the whitelist contract's admin.
- `PILOT_E2E_ALLY_SECRET`: The funded testnet key for the ally role.
- `PILOT_E2E_HOLDER_SECRET`: (Optional) Funded testnet key for a pilot income token holder, if further on-chain assertions are added.

### Running the suite from CI

`.github/workflows/pilot-e2e.yml` is a manual (`workflow_dispatch`) job that reproduces the full local setup on a runner: it starts Postgres 16, runs the API migrations, boots the API on `localhost:3001`, and executes the suite against testnet. Two repository secrets are required:

- `PILOT_E2E_OPERATOR_SECRET`: funded testnet secret key (`S...`), the whitelist contract admin described above.
- `PILOT_E2E_ALLY_SECRET`: funded testnet secret key (`S...`), the ally co-signer for `record_evidence`.

`OPERATIONS_BACKEND_CREDENTIAL` is not a repository secret: the job generates a fresh value per run and passes it to both the API it starts and the suite. After a run, the job summary contains the `set_currency_preference` opt-in tx hash and a stellar.expert link, which is the evidence issue #1126's acceptance criterion 1 asks for.

## What it checks

1. **`GET /health`** - HTTP 200, `status === "healthy"`, DB healthy
2. **`GET /swagger`** - docs surface reachable
3. **`GET /properties?limit=5`** - public list happy path (JSON body)
4. **`GET $WEBAPP_BASE_URL/`** - only when `WEBAPP_BASE_URL` is set

Exit code `0` = all required checks passed; non-zero if any required check failed.

## CI (optional post-deploy)

Workflow: [`.github/workflows/smoke.yml`](../../.github/workflows/smoke.yml)

- Manual: **Actions → Smoke tests → Run workflow** (input: API base URL)
- Or call after your deploy job:

```yaml
- name: Smoke tests
  env:
    API_BASE_URL: ${{ vars.API_BASE_URL }}
  run: ./scripts/smoke/run-smoke-tests.sh
```

## Requirements

- `bash`, `curl`, `python3` (stdlib only - used to parse JSON)
- No secrets, funded wallet, or monorepo install required for the smoke runner itself
