# C8-006: Pilot Production Reliability: Soroban RPC Resilience, Error Tracking, and Database Recovery

## Issue Metadata

| Attribute       | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Issue ID        | C8-006                                                                             |
| Area            | API                                                                                |
| Difficulty      | High                                                                               |
| Labels          | backend, frontend, shared, stellar, logging, performance, high                     |
| Dependencies    | C6-002, C7-004, C7-007                                                             |
| Estimated Lines | 3,500-4,500 (shared RPC layer, integrations in two apps, scripts, tests, runbooks) |

**Description**

Make the pilot survive routine RPC failures without lying about what it knows, make failures visible to operators, and give the database a rehearsed recovery path. The full context is in `ISSUE_006.md`.

**Requirements and context**

- `apps/shared/src/contracts/clientConfig.ts:17-28`: `resolveSorobanRpcUrl(networkPassphrase, rpcUrl?)` returns one URL, consumed by `buildContractClientOptions` at line 58. Extend it to an ordered list, keeping backward compatibility for existing callers that pass a single URL.
- The generated contract clients take one `rpcUrl`. Resilience for reads is easiest at the read-helper layer: wrap each read in a policy that retries transient failures and rotates endpoints by rebuilding the client options.
- Callers to wire:
  - `apps/webapp/src/services/pilot/reads.ts` (`fetchPilotCycles` at 147, `fetchPilotCycle` at 164, `fetchPayoutPaused` at 172, `fetchPilotHoldings` at 188)
  - `apps/api/src/services/PilotPayoutEvidenceReader.ts` (`hasEvidence` at 67, one `simulateTransaction` at 79)
  - `apps/api/src/workers/pilotEscalationJob.ts` (C7-007), which must treat an RPC failure as unknown
- Dashboard: `apps/webapp/src/hooks/useAsyncState.ts:93` (`retry: execute`) and `hooks/usePilotContract.ts`. Keep the last successful value and render `FreshnessIndicator` (design system) with its age.
- Error tracking integration points:
  - API: `apps/api/src/middleware/errorHandler` (mounted in `app.ts:25`), the workers in `apps/api/src/workers/`, and process-level handlers in `index.ts`
  - Webapp: `components/ui/ErrorBoundary.tsx`, `PageErrorFallback.tsx`, `SectionErrorFallback.tsx`, and `app/[locale]/error.tsx`
  - Scrub wallet addresses where the policy says so, whitelist PII fields, and any transaction or auth-entry XDR.
- Database: tables include `pilotWhitelist`, `auditLog`, `notifications`, `notificationDlq`, `pilotEscalation`, and `idempotency` (see `apps/api/src/db/schema/`).

Example: read policy:

```ts
export async function withRpcPolicy<T>(
  endpoints: string[],
  read: (rpcUrl: string) => Promise<T>,
  { attempts = 3, baseDelayMs = 250, timeoutMs = 8_000 } = {},
): Promise<T> {
  let lastError: unknown;
  for (const url of endpoints) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await withTimeout(read(url), timeoutMs);
      } catch (error) {
        if (!isTransientRpcError(error)) throw error; // contract errors are facts, never retried
        lastError = error;
        await sleep(baseDelayMs * 2 ** i + jitter());
      }
    }
  }
  throw new RpcUnavailableError(lastError);
}
```

**Suggested execution**

1. `git checkout -b feature/pilot-production-reliability`
2. Add `withRpcPolicy`, `isTransientRpcError`, and `RpcUnavailableError` to `@akkuea/shared` with unit tests (fake timers, simulated 429, 5xx, timeout, and contract errors).
3. Extend configuration for multiple endpoints (`NEXT_PUBLIC_*` for the webapp and server variables for the API), documented and validated.
4. Wire the webapp reads, then the evidence reader and the escalation job, including the unknown state and an alert after N consecutive unknowns.
5. Add last-known-good and `FreshnessIndicator` rendering to the pilot dashboards.
6. Record the error-tracking provider choice in `docs/strategy/decision-log.md`, then integrate it in the API and webapp behind configuration, with scrubbing and tests.
7. Add `scripts/db/backup.sh` and `scripts/db/restore.sh` (or TypeScript equivalents), rehearse a restore into a scratch database, and write `docs/operations/runbook-database-recovery.md` and `docs/operations/runbook-incident-response.md`.

**Test and commit**

- [ ] Shared policy unit tests for every error class, fallback order, and timeout
- [ ] Webapp: stale-data rendering test and a fallback-endpoint read test
- [ ] API: evidence reader fallback test, and an escalation-job test proving RPC failure does not escalate the ally
- [ ] Error-tracking tests: events captured with scrubbing, and a no-op when unconfigured
- [ ] Restore rehearsal steps and output in the PR
- [ ] All five CI workflows green

Example commit:
`git commit -m "feat(shared): add soroban rpc fallback and retry policy for pilot reads"`

**Guidelines**

- Never retry transaction submission. Reads only.
- Stale data must always be labeled with its age.
- The error-tracking integration must never receive PII, signing payloads, or secrets.
- Follow `docs/design-system/` for the staleness UI.
