# Whitelist request failures return a generic 500, and any 56-character string passes as a wallet address

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-008  |
| Area            | API     |
| Difficulty      | Medium  |
| Dependencies    | C6-008  |
| Estimated Lines | 150-280 |

## Context

`WhitelistController.request` and `WhitelistService` in `apps/api/src` signal every expected failure with a plain `new Error(...)`: a request already pending, an address already whitelisted, a request not found, a missing rejection reason, an invalid action. `handleError` in `apps/api/src/utils/errors.ts` maps a plain `Error` to a 500 with "An unexpected error occurred". So an investor who submits the form twice gets a server error instead of "already pending".

The request schema in `apps/api/src/routes/whitelist.ts` checks `walletAddress` only with `maxLength: 56`. Any string passes, and it is stored and later sent to the contract on approval.

A new request after a rejection also deletes the rejected row, so the earlier rejection and its reason are lost.

## What Needs to Be Done

- Replace the plain errors with the typed errors that already exist in `utils/errors.ts`: 409 for already pending and already whitelisted, 404 for not found, 400 for a missing reason or invalid action.
- Validate `walletAddress` as a Stellar public key (`G...`, valid checksum) in the request route and in the status route.
- Stop deleting the rejected row on a new request. Keep the history in a way that still allows one active request per wallet.
- Remove the two `any` contexts in `WhitelistController` by typing them.

## Scope

In scope: whitelist controller, service, routes, tests, a migration if the uniqueness rule changes.

Out of scope: PII encryption (C8-004), rate limiting (C7-005), revoke (C9-007).

## Acceptance Criteria

- [ ] A second request for a pending wallet returns 409 with a message the form can show.
- [ ] A request for an approved wallet returns 409.
- [ ] `not-a-key`, a 56-character string with a bad checksum, and a contract address (`C...`) are each rejected with 400.
- [ ] After a rejection and a new request, the rejected record still exists.
- [ ] Reviewing an unknown id returns 404.
- [ ] No `eslint-disable` for `no-explicit-any` remains in `WhitelistController.ts`.

## How to Verify

```bash
cd apps/api
bun test src/routes/whitelist.test.ts
bun run lint && bun run type-check
```

## Files and Locations

| File                                                 | What is there today                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/controllers/WhitelistController.ts:21` | `request(ctx: any)`; plain errors at 31 and 34                   |
| `apps/api/src/controllers/WhitelistController.ts:76` | `review(ctx: any)`; plain errors at 85 and 90                    |
| `apps/api/src/services/WhitelistService.ts:17`       | Plain errors at 17, 21, 57 and 61                                |
| `apps/api/src/routes/whitelist.ts:10`                | `walletAddress: t.String({ maxLength: 56 })`; status param at 81 |
| `apps/api/src/utils/errors.ts`                       | `BadRequestError`, `NotFoundError` and the 500 fallback          |

## Implementation Steps

1. Add a `ConflictError` (409) to `utils/errors.ts` if none exists, next to the other typed errors.
2. Replace each plain `Error` with the matching typed error.
3. Validate the address with `StrKey.isValidEd25519PublicKey` from `@stellar/stellar-sdk`.
4. Replace the delete-then-insert with a rule that keeps rejected rows.
5. Type the two contexts and remove the lint suppressions.

## Code Example

```typescript
import { StrKey } from "@stellar/stellar-sdk";

if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
  throw new BadRequestError("walletAddress must be a valid Stellar public key");
}
if (existing?.status === "pending") {
  throw new ConflictError(
    "A whitelist request is already pending for this address",
  );
}
```

## Testing Guidance

- Assert status codes and the `error` code field, not only the message.
- Cover a second request after a rejection and check both rows exist.
