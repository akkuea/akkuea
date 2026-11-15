# Operators cannot revoke a whitelisted investor: no endpoint, no status and no audit entry

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-007  |
| Area            | API     |
| Difficulty      | High    |
| Dependencies    | C6-008  |
| Estimated Lines | 250-450 |

## Context

`pilot-whitelist` has `revoke`, and the typed client in `apps/shared/src/contracts/pilot/whitelist.ts` exposes it. Nothing in the API calls it. `WhitelistService` has only `approveRequest` and `rejectRequest`, the review route in `apps/api/src/routes/internalOperations.ts` accepts only approve and reject, and `pilot_whitelist_status` in `apps/api/src/db/schema/pilotWhitelist.ts` has only `pending`, `approved` and `rejected`.

If an approval turns out to be wrong, or an investor has to be removed, the operator has to run a CLI transaction by hand, and the database keeps saying `approved`.

## What Needs to Be Done

- Add a `revoked` status with a migration.
- Add an operator-only revoke action next to the existing review route, with a required reason.
- Submit `revoke` on-chain first, then update the row, the same order `approveRequest` uses, and store the reason and the time.
- Write an audit entry through `AuditService`, following the pattern in `apps/api/src/controllers/KYCController.ts`. Approve and reject write no audit entry today: add one for each in the same change, so all three operator actions are recorded.
- Make `GET /pilot/whitelist/status/:walletAddress` return `revoked`, with the reason only for the owner or an operator.
- Let a revoked wallet submit a new request.

## Scope

In scope: schema and migration, service, route, audit, status endpoint, tests.

Out of scope: the review queue UI (later cycle), contract changes, what happens to a revoked holder's token balance (the correction transfer already exists).

## Acceptance Criteria

- [ ] Revoking an approved request calls the contract once and sets the row to `revoked` with reason and timestamp.
- [ ] If the on-chain call fails, the row stays `approved` and the error is returned.
- [ ] Revoking a pending, rejected or already revoked request returns a 4xx error, not a 500.
- [ ] The action is rejected without operator credentials.
- [ ] Approve, reject and revoke each write an audit entry with the action, the wallet and the reason.
- [ ] The migration applies cleanly on a database that already has rows.

## How to Verify

```bash
cd apps/api
bun test
bun run lint && bun run type-check
```

## Files and Locations

| File                                            | What is there today                                        |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `apps/api/src/db/schema/pilotWhitelist.ts:3`    | `pilot_whitelist_status` enum: pending, approved, rejected |
| `apps/api/src/services/WhitelistService.ts:11`  | `approveRequest`: on-chain call, then row update           |
| `apps/api/src/services/StellarService.ts:566`   | `submitWhitelistApprove`, the model for a revoke call      |
| `apps/api/src/routes/internalOperations.ts:145` | `reviewWhitelistSchema` and, at 150, the operator route    |
| `apps/api/src/controllers/KYCController.ts`     | Example of `auditService` usage                            |
| `apps/shared/src/contracts/pilot/whitelist.ts`  | Typed client that already exposes `revoke`                 |

## Implementation Steps

1. Add `revoked` to the enum, plus `revokedAt` and `revocationReason` columns, with a migration.
2. Add `submitWhitelistRevoke` to `StellarService`.
3. Add `revokeRequest(id, reason)` to `WhitelistService`: load, require `approved`, submit, update.
4. Add `POST /pilot/whitelist/:id/revoke` to the operator route with a required reason.
5. Write audit entries for approve, reject and revoke.
6. Update the status endpoint and the re-request rule in `WhitelistController.request`.

## Code Example

```typescript
async revokeRequest(requestId: string, reason: string): Promise<string> {
  const request = await this.findOrThrow(requestId);
  if (request.status !== 'approved') {
    throw new BadRequestError('Only an approved request can be revoked');
  }
  const txHash = await stellarService.submitWhitelistRevoke(/* contract, admin, wallet */);
  await db
    .update(pilotWhitelistRequests)
    .set({ status: 'revoked', revocationReason: reason, revokedAt: new Date() })
    .where(eq(pilotWhitelistRequests.id, requestId));
  return txHash;
}
```

## Testing Guidance

- Extend `apps/api/src/routes/whitelist.test.ts` and `internalOperations.test.ts`.
- Mock the Stellar call to fail and assert the row is still `approved`.
- Run the migration against a database with existing rows.
