# Runbook: Incident Response

**Audience:** On-call operators and platform admins
**Severity levels:** Critical, High, Medium, Low
**Related documentation:** `runbook-emergency-pause.md`, `runbook-oracle-failure.md`

---

## Incident categories

| Category | Examples | Severity |
| --- | --- | --- |
| RPC outage | Soroban RPC endpoints returning errors or timing out | High |
| API outage | Elysia server returning 5xx or becoming unresponsive | Critical |
| Database loss | Postgres data corruption, failed backup restore | Critical |
| Suspected key compromise | Admin key leaked, unauthorized transactions observed | Critical |

---

## Severity definitions

- **Critical:** Platform is down or funds are at risk. Page on-call immediately.
- **High:** Core functionality degraded but funds are safe. Notify on-call within 15 minutes.
- **Medium:** Minor degradation. Log and track in the incident channel.
- **Low:** Cosmetic or informational. Fix in next maintenance window.

---

## RPC outage

### Symptoms

- Dashboard shows "Offline" or "Stale" on the `FreshnessIndicator`
- Escalation job logs `PILOT_ESCALATION_RPC_UNKNOWN` warnings
- `PilotPayoutEvidenceReader.hasEvidence()` throws `RpcAllEndpointsFailedError`
- Escalation job returns `{ status: 'ok', breached: false, unknownCount: N }`

### Response

1. **Check RPC endpoints** - query each endpoint directly:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://soroban-testnet.stellar.org
   curl -s -o /dev/null -w "%{http_code}" https://rpc-mainnet.stellar.org
   ```
2. **If primary is down but fallback works** - the system is already using the fallback. Monitor the `FreshnessIndicator` for recovery.
3. **If all endpoints are down** - do not escalate allies. The escalation job treats this as "unknown", not "missed".
4. **Verify escalation behavior** - check that the job returns `unknownCount > 0` and does not trigger `notifyPilotReportingEscalation`.
5. **Retry when endpoints recover** - the system will automatically resume normal reads on the next poll cycle.

### Do NOT

- Do not treat an RPC outage as an ally failure. The job will not escalate on unknown status.
- Do not manually submit transactions during an RPC outage. Read-only operations are retried; no transactions are re-submitted.

---

## API outage

### Symptoms

- Health check endpoint returns non-200
- Elysia logs show unhandled errors or process crashes
- Webapp shows persistent connection errors

### Response

1. **Check the Elysia process** - `bun run dev` or the production process manager.
2. **Check database connectivity** - `bun run db:studio` or `pg_isready`.
3. **Check Redis** (if configured) - `Bun.redis.ping()`.
4. **Restart the API** - `bun run dev` or the deployment command.
5. **Verify recovery** - check `GET /health` returns 200.
6. **Review structured logs** - the logger writes JSON to stdout/console.error.

### Database recovery procedure

If the database is lost or corrupted:

1. **Verify backup exists** - check `/var/backups/akkuea/` for a recent backup.
2. **Stop the API** to prevent writes to the corrupted database.
3. **Restore** - run `./scripts/restore-db.sh /path/to/backup.sql --drop`.
4. **Run migrations** - `bun run db:migrate`.
5. **Verify** - check that key tables and the pilot data are intact.
6. **Restart the API**.
7. **Document** - record the incident, root cause, and timeline.

### Post-incident

1. Check the last backup was successful.
2. Verify the retention policy is working.
3. Review if the incident could have been prevented.

---

## Suspected key compromise

### Symptoms

- Unexpected transactions signed by the admin key
- Admin key exposed in logs, error messages, or CI output
- Unauthorized contract role changes

### Response

1. **Immediately pause the contract** - follow `runbook-emergency-pause.md`.
2. **Transfer admin role** - use the two-step `transfer_admin_start → transfer_admin_accept` flow with the new key.
3. **Rotate all credentials** - `STELLAR_ADMIN_SECRET`, `WEBHOOK_SECRET`, `OPERATIONS_BACKEND_CREDENTIAL`, `INTERNAL_API_KEY`, `LIQUIDATOR_API_KEY`.
4. **Rotate contract keys** - redeploy affected contracts with new admin keys.
5. **Audit all recent transactions** - check the event stream for unauthorized actions.
6. **Review access logs** - check how the key was exposed.

### Key storage requirements

- `STELLAR_ADMIN_SECRET` must **never** be committed to version control.
- In production, load from a secrets manager (HashiCorp Vault, AWS Secrets Manager, or GCP Secret Manager).
- The `.env` file is in `.gitignore` but never commit sample values that look real.

---

## Cross-reference: existing runbooks

| Incident type | Runbook |
| --- | --- |
| Contract exploit / pause needed | `runbook-emergency-pause.md` |
| Oracle price feed failure | `runbook-oracle-failure.md` |
| Role management | `runbook-role-management.md` |
| RPC outage (this document) | `runbook-incident-response.md` |
| Database loss (this document) | `runbook-incident-response.md` |

---

## Escalation contacts

See the team's on-call schedule and incident channel configuration in the internal wiki. This document describes the technical procedure; the communication procedure is operational.

---

## Maintenance: backup schedule

| Backup type | Frequency | Retention | Location |
| --- | --- | --- | --- |
| Full database | Daily at 02:00 UTC | 30 days | `/var/backups/akkuea/` |
| Database migrations | On every deploy | Indefinite | Version control |
| Contract state snapshots | Weekly | 90 days | `/var/backups/akkuea/contract-snapshots/` |

### Restore rehearsal

The restore procedure must be rehearsed against a scratch database at least quarterly. Steps and output must be recorded in the PR or incident report.

1. Create a scratch database: `createdb akkuea_scratch`
2. Restore the most recent backup: `./scripts/restore-db.sh /var/backups/akkuea/akkuea-db-YYYYMMDD.sql`
3. Run migrations: `bun run db:migrate`
4. Verify key data: check `pilot_escalation_state`, `notifications`, `whitelist_requests`, `audit_log` tables.
5. Document results.
