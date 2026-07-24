# Smoke tests runner

Automates the post-deploy checks described in [`docs/testing/smoke-tests.md`](../../docs/testing/smoke-tests.md): confirm the app boots, dependencies (DB) respond, and a public happy-path endpoint works.

## Quick start (local / dev)

```bash
# From repo root — API must already be running (default port 3001)
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

| Variable | Default | Purpose |
|---|---|---|
| `API_BASE_URL` | `http://localhost:3001` | Base URL of the API under test |
| `WEBAPP_BASE_URL` | _(unset = skip)_ | If set, also `GET /` on the webapp |
| `SMOKE_TIMEOUT_SECS` | `10` | curl connect/max time per request |

## What it checks

1. **`GET /health`** — HTTP 200, `status === "healthy"`, DB healthy
2. **`GET /swagger`** — docs surface reachable
3. **`GET /properties?limit=5`** — public list happy path (JSON body)
4. **`GET $WEBAPP_BASE_URL/`** — only when `WEBAPP_BASE_URL` is set

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

- `bash`, `curl`, `python3` (stdlib only — used to parse JSON)
- No secrets, funded wallet, or monorepo install required for the smoke runner itself
