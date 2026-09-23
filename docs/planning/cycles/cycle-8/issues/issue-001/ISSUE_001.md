# Build the Two-Party Co-Signing Flow for Distribution, Co-Signed Evidence, and Exit

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Issue ID        | C8-001                                                             |
| Area            | WEBAPP                                                             |
| Difficulty      | High                                                               |
| Labels          | frontend, backend, api, wallet, stellar, high                      |
| Dependencies    | C6-001, C6-002, C7-001, C7-002, C7-004                             |
| Estimated Lines | 4,500-5,500 (API relay, webapp flows, wallet support, tests, docs) |

## Context

The product brief's own sequence diagram has the operator "Approve distribution for this cycle" and the contract then paying holders. On-chain, that step is `pilot-payout-split::execute_distribution`, which calls `operator.require_auth()` and `ally.require_auth()` on the same invocation. The same two-signer rule applies to `record_evidence` (the co-signed fast path) and `exit` (the wind-down marker added in C7-002).

The webapp cannot produce either of those transactions today. `apps/webapp/src/services/pilot/writes.ts` defines `executeDistribution` and `flagDispute`, but no component calls either one, and the doc comment on `executeDistribution` says so directly: "this cannot be driven by one connected wallet alone: the signer has to be able to produce both auth entries." No code in `apps/webapp`, `apps/api`, or `apps/shared` builds or signs Soroban authorization entries (`signAuthEntry`, `authorizeEntry`, and `SorobanAuthorizationEntry` return zero matches). `docs/deployment/deploy-pilot-contracts.md` only says "In production, construct and sign a Soroban transaction with both required signers."

So the one step that actually moves investor money can only run from a hand-assembled CLI transaction. That is the largest gap between the shipped pilot and a pilot a real ally and operator can use.

## What Needs to Be Done

- Design and implement a two-party signing flow: one party (normally the operator) prepares an invocation, both parties sign their own Soroban authorization entry with their own wallet, and the fully authorized transaction is submitted. The operator and ally will usually sign on different machines at different times.
- Decide how the partially authorized transaction travels between the two parties. Options include an API relay that stores only the unsigned invocation and the collected auth entries (never key material), or a shareable link or QR payload with no server involved. `writes.ts` currently states "No key material and no signed payload passes through the API," so either keep that property or record in `docs/strategy/decision-log.md` why it changes and what the relay can and cannot do.
- Support all three two-signer entry points: `execute_distribution`, `record_evidence`, and `exit`.
- Before either party signs, show them exactly what they are authorizing, decoded from the invocation: function, cycle, amounts, holder count, fee, and the EURC price floor. Nobody should sign opaque XDR.
- Protect EURC holders at execution. `DEFAULT_MIN_EURC_PER_USDC` is `0`, and the contract only skips the price guard when no holder has opted into EURC. The execute flow must quote the configured Soroswap router, derive `min_eurc_per_usdc` from a documented, configurable slippage tolerance, and refuse to prepare a zero floor while any holder prefers EURC.
- Handle expiry and staleness: the auth-entry signature expiration ledger, the paused contract, the exited contract, a cycle whose status changed after preparation, and a request the other party never signs.
- Add the missing dispute action: an operator-facing control that calls the existing `flagDispute` write with a required reason.
- Add signing capability detection to `useWallet`: auth-entry signing where the connected provider supports it (Stellar Wallets Kit exposes it for Freighter and compatible wallets), and a clear unsupported-wallet message where it does not, such as the embedded Privy or Pollar providers.
- Update `docs/deployment/deploy-pilot-contracts.md` so the documented production path is this flow, with the CLI path kept as the fallback.

## Acceptance Criteria

- An operator can prepare a distribution for an approved cycle in the webapp, the ally can review and co-sign it from a separate browser session with a separate wallet, and the transaction lands on testnet with the expected `DistributionSummary`. A test covers the flow.
- The same two-party flow works for `record_evidence` and `exit`, each covered by a test.
- Both parties see a human-readable summary decoded from the actual invocation before signing. A test proves the summary comes from the invocation itself and not from separately supplied display data.
- The execute flow refuses to prepare a transaction with a zero EURC floor while any holder prefers EURC. The floor comes from a live router quote plus a configurable tolerance, and a test covers this.
- Expired, stale (cycle status changed), paused, and exited requests are rejected with a clear message before anything is submitted. Each case has a test.
- An operator can flag a cycle as disputed with a mandatory reason from the review surface, and the investor and ally views then show the cycle as disputed.
- Wallets that cannot sign auth entries get an explicit unsupported message and never a silent failure.
- The relay-or-no-relay decision is recorded in `docs/strategy/decision-log.md`. If a relay is built, it stores no key material, has an expiry and cleanup policy, and restricts reads to the two configured signer addresses.
- All new UI follows `docs/design-system/`, has Storybook stories, and ships English and Spanish strings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is the moment real money leaves the contract, so the signer must understand exactly what they are signing. Every value shown on the confirmation screen must be decoded from the invocation that is actually being authorized. The flow must never widen the contract's own guarantees: the contract still enforces approval, pause, exit, and the price floor on-chain, and the UI only helps two people produce a valid, well-protected transaction.
