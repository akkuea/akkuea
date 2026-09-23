# C8-001: Build the Two-Party Co-Signing Flow for Distribution, Co-Signed Evidence, and Exit

## Issue Metadata

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Issue ID        | C8-001                                                             |
| Area            | WEBAPP                                                             |
| Difficulty      | High                                                               |
| Labels          | frontend, backend, api, wallet, stellar, high                      |
| Dependencies    | C6-001, C6-002, C7-001, C7-002, C7-004                             |
| Estimated Lines | 4,500-5,500 (API relay, webapp flows, wallet support, tests, docs) |

**Description**

Give the operator and the ally a way to jointly authorize the three `pilot-payout-split` entry points that require both signatures (`execute_distribution`, `record_evidence`, `exit`), from the webapp, on separate machines, without either party signing opaque XDR. Add the missing operator dispute action. The full context is in `ISSUE_001.md`.

**Requirements and context**

- The two-signer rule is on-chain and must not change. `execute_distribution` (`apps/contracts/contracts/pilot-payout-split/src/lib.rs:492-505`) calls `operator.require_auth()` and `ally.require_auth()`, then `require_operator`, `require_ally`, `require_not_exited`, and `require_not_paused`. `record_evidence` (`lib.rs:273-285`) and `exit` (`lib.rs:858`) follow the same pattern.
- `apps/webapp/src/services/pilot/writes.ts:157-175` already wraps `execute_distribution`, but it builds the client with one `publicKey` and one `signTransaction`, so it can only ever produce the invoker's signature. `flagDispute` (`writes.ts:126-138`) has no caller.
- Soroban non-invoker auth: simulate the invocation, take the returned `SorobanAuthorizationEntry` list, have each address sign its own entry (`authorizeEntry` in `@stellar/stellar-sdk`, or the wallet's `signAuthEntry`), then re-simulate or assemble and submit. The generated client's `AssembledTransaction` exposes `needsNonInvokerSigningBy()` and `signAuthEntries()` for this purpose.
- Wallet layer: `useWallet.hook.ts:194-215` exposes only `signTransaction`. Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit` 2.6.0 in `apps/webapp/package.json`) supports `signAuthEntry` for Freighter and compatible wallets. `PrivyWrapper.tsx:153` and `PollarWrapper.tsx` must be checked, and should report unsupported where they cannot sign auth entries.
- EURC price floor: `DEFAULT_MIN_EURC_PER_USDC = BigInt(0)` (`writes.ts:146`). The contract only skips the floor when no holder prefers EURC. Quote the router configured in contract storage (`eurc_swap_path_status()`, `lib.rs:894`) with `router_get_amounts_out` from the chosen quote path, then apply a configurable tolerance.
- Operator authorization on any API relay must reuse the existing internal-operations check (`apps/api/src/utils/internalOperationsAuth.ts`, used by `routes/whitelist.ts:7,22-36`). The ally's access must be tied to a signature from the configured ally address, such as a SEP-10-style challenge or a signed nonce, not a shared secret.

Example: collecting a non-invoker signature with the generated client:

```ts
// Operator side: build and simulate, then sign the operator's own entry.
const tx = await client.execute_distribution({
  operator,
  ally,
  cycle_id: cycleId,
  min_eurc_per_usdc: floor,
});
const missing = tx.needsNonInvokerSigningBy(); // expect [ally] when operator invokes
await tx.signAuthEntries({
  address: operator,
  signAuthEntry: operatorWallet.signAuthEntry,
});
const handoff = tx.toJSON(); // serialized invocation plus collected auth entries, no key material

// Ally side: rehydrate, decode, show the summary, sign, submit.
const restored = client.fromJSON.execute_distribution(handoff);
renderSummary(decodeInvocation(restored)); // values decoded from the invocation itself
await restored.signAuthEntries({
  address: ally,
  signAuthEntry: allyWallet.signAuthEntry,
});
const sent = await restored.signAndSend({ force: true });
```

**Suggested execution**

1. `git checkout -b feature/pilot-two-party-signing`
2. Prototype the full two-signer path on testnet in a script first (operator plus ally keypairs, `execute_distribution` on an approved cycle) to confirm the SDK version's auth-entry APIs and the signature expiration ledger behavior. Paste the transaction hash in the PR.
3. Decide the transport (API relay or relay-less link or QR) and write the `docs/strategy/decision-log.md` entry before building UI.
4. Extend `useWallet` with `signAuthEntry` and a `canSignAuthEntries` capability flag.
5. Add a `services/pilot/cosign.ts` module: prepare, serialize, decode for display, add signature, validate freshness (cycle status, paused, exited, expiration ledger), submit.
6. If relaying: add a `pilot_cosign_requests` table and migration (invocation JSON, function, cycle, status, expires_at, created_by), routes under `/pilot/cosign`, a cleanup job, and tests.
7. Build UI: an operator "Prepare distribution" action on approved cycles in `OperatorDashboard`, an ally "Pending signatures" panel in `AllyDashboard`, a shared `CosignSummary` confirmation component, and exit and co-signed evidence entry points.
8. Add a "Flag dispute" action with a required reason to `EvidenceReviewQueue`.
9. Update `docs/deployment/deploy-pilot-contracts.md` (section near line 230) so the webapp flow is the production path.

**Test and commit**

- [ ] Unit tests for `cosign.ts`: serialization round-trip, decoding, freshness rejection for expired, stale, paused, and exited requests, and refusal of a zero EURC floor when a holder prefers EURC
- [ ] Component tests and stories for `CosignSummary`, the operator prepare action, the ally pending panel, and the dispute action (loading, error, empty, disconnected, unsupported-wallet states)
- [ ] API tests for the relay if built: signer-only access, expiry, cleanup, no key material stored
- [ ] A testnet run of each of the three entry points, with transaction hashes in the PR
- [ ] English and Spanish message keys added with parity kept
- [ ] All five CI workflows green

Example commit:
`git commit -m "feat(webapp): add two-party co-signing flow for pilot distributions"`

**Guidelines**

- Never display any value to a signer that was not decoded from the invocation being authorized.
- Never store or transmit secret keys. Auth entries are signatures over a specific invocation, nonce, and expiration. Treat them as sensitive anyway and expire them.
- Keep the contract as the source of truth. The UI may hide actions that will fail, but it must not be the thing that enforces approval, pause, or exit.
- Follow `docs/design-system/` for every new component.
