# Pilot Threat Model and Trust Assumptions

This document describes what each actor in the pilot system can and cannot do,
and which protections are contract-enforced versus human-mediated. It is the
first document an auditor or an ally's legal counsel should read.

The pilot consists of three Soroban contracts (`pilot-whitelist`,
`pilot-income-token`, `pilot-payout-split`), the Akkuea API
(`apps/api`), and the read-only investor dashboard (`apps/webapp`).

---

## Actors and their authority

### Admin

The Stellar key set as `admin` during `pilot-whitelist.initialize()` and
`pilot-payout-split.initialize()`. In the pilot this is the same key as
`STELLAR_ADMIN_SECRET` in the API environment.

**Can do (contract-enforced):**
- Approve and remove investors from the whitelist (`whitelist.approve`,
  `whitelist.revoke`).
- Pause and unpause the payout-split contract (`payout.pause`,
  `payout.unpause`).
- Flag a cycle as `Disputed` (`payout.flag_dispute`).
- Transfer the admin role via two-step transfer
  (`payout.transfer_admin_start` / `payout.transfer_admin_accept`).
- Mark the income token as wound down (`income_token.mark_wound_down`) -
  irreversible.
- Invoke the exit state on payout-split - irreversible
  (`payout.trigger_exit`).

**Cannot do:**
- Execute a distribution without an `Approved` cycle (contract-enforced).
- Submit or approve evidence without the ally co-signing (operator+ally
  multi-sig is required for `record_evidence`).
- Withdraw funds held in the payout contract directly - there is no admin
  withdrawal function; all funds leave via `execute_distribution` or remain
  as dust.

**Trust level:** Single key. If the admin key is compromised, an attacker can
pause the contract, flag disputes, and revoke investor whitelist entries.
They cannot trigger a distribution to an arbitrary address because
`execute_distribution` distributes pro-rata to current token holders only.

**Mitigation:** Load `STELLAR_ADMIN_SECRET` from a secrets manager at runtime.
Do not commit it to version control. Rotate if there is any sign of
compromise.

---

### Operator

The Stellar key set as `operator` during `payout.initialize()`. This is
Akkuea's operational key used for day-to-day evidence review.

**Can do (contract-enforced):**
- Open a submitted evidence cycle for review (`payout.start_review`).
- Approve or reject a cycle (`payout.review_evidence`).
- Co-sign `record_evidence` with the ally for the fast-path (both signers
  in one invocation).
- Flag a cycle as `Disputed` (`payout.flag_dispute`).

**Cannot do:**
- Execute a distribution alone - `execute_distribution` does not require the
  operator key; it is callable by anyone once a cycle is `Approved`. The
  contract enforces that the cycle is `Approved` before distributing.
- Approve a cycle without the ally's co-signature on the fast-path
  (`record_evidence` requires both).
- Change admin, operator, or ally addresses.
- Mint or burn income tokens.

**Trust level:** This key is used frequently (every reporting cycle). It is
not the admin key and cannot escalate its own privileges.

---

### Ally

The Stellar key set as `ally` during `payout.initialize()`. This is the
allied agency's key.

**Can do (contract-enforced):**
- Submit a cycle's evidence hash and link (`payout.submit_evidence`).
- Re-submit after a rejection.
- Co-sign `record_evidence` with the operator for the fast-path.

**Cannot do:**
- Self-approve evidence - the operator must call `review_evidence`.
- Execute a distribution.
- Whitelist or remove investors.
- Access or move funds in the payout contract.

**Trust level:** The ally is a required co-signer for evidence recording but
has no unilateral authority over fund movement or investor access. The
contract enforces this.

---

### Whitelisted investor / token holder

A Stellar account that has been approved in `pilot-whitelist` and holds a
non-zero balance of the income participation token.

**Can do:**
- Hold the income token (non-transferable in this phase).
- Receive pro-rata distributions when `execute_distribution` is called for
  an `Approved` cycle.
- Set a currency preference (USDC or EURC) for their distributions.
- View their holdings and distribution history via the read-only dashboard.

**Cannot do:**
- Transfer the income token.
- Execute a distribution themselves (anyone can call `execute_distribution`
  once a cycle is `Approved`, but the function only distributes to token
  holders - there is no benefit to a non-holder calling it).
- Approve themselves onto the whitelist.
- Vote, govern, or influence contract parameters.

**Trust level:** Investors trust that: (1) Akkuea reviews evidence honestly
before approving, (2) the admin does not revoke their whitelist entry
arbitrarily, and (3) the ally reports income accurately. None of these are
contract-enforced - they are human-mediated with on-chain audit trails.

---

### Applicant (not yet whitelisted)

A Stellar account that has submitted a whitelist request via the API but has
not been approved on-chain.

**Can do:**
- Submit a whitelist application through `POST /pilot/whitelist/requests`.
- View their application status.

**Cannot do:**
- Interact with the income token or payout-split contract at all until
  approved.

---

### API operator (the Akkuea server process)

The running instance of `apps/api` holding `STELLAR_ADMIN_SECRET` and
`OPERATIONS_BACKEND_CREDENTIAL`.

**Can do:**
- All admin key actions listed above, executed via the API's Stellar service.
- Read and write the PostgreSQL database (whitelist requests, KYC records,
  notifications).
- Deliver notifications to the configured webhook.

**Cannot do:**
- Anything beyond what the admin key can do on-chain - the API is a wrapper
  around the same Stellar transactions.

**Trust level:** The API process is trusted by the admin key. A compromise of
the API host is equivalent to a compromise of the admin key at runtime. See
mitigation under Admin above.

---

## Contract-enforced protections

These are enforced by the Soroban contracts and cannot be bypassed by any
actor, including the admin:

| Property | Enforced by |
|---|---|
| Income token is non-transferable | `pilot-income-token`: `transfer` is unimplemented / panics |
| Distribution only goes to token holders | `payout.execute_distribution`: iterates `income_token.holders()` |
| Cycle cannot be distributed twice | `payout`: `CycleAlreadyDistributed` guard |
| Evidence must be `Approved` before distribution | `payout`: `EvidenceNotApproved` guard |
| Operator and ally must be distinct | `payout.initialize()`: `SignerCollision` check |
| Platform fee is exactly 10%, taken first | `payout.execute_distribution`: fee split is hardcoded |
| `record_evidence` requires both operator + ally | Soroban multi-sig auth: both auth entries required |
| Exit and wind-down states are irreversible | No reverse function exists in either contract |
| Whitelist-revoked holder is skipped at payout | `payout.execute_distribution`: checks `whitelist.is_approved()` per holder |

---

## Human-mediated controls (not contract-enforced)

These depend on Akkuea operating honestly. They are disclosed here because
honesty about the trust boundary is the product's stated differentiator.

| Control | How it works | What an attacker controlling Akkuea could do |
|---|---|---|
| Evidence review | Operator manually checks income documents before calling `review_evidence` | Approve fabricated evidence and trigger a distribution based on reported income that did not occur |
| Investor identity check | Manual review of identity documents before calling `whitelist.approve` | Approve a fabricated identity, or deny a legitimate one |
| Admin key custody | Loaded from a secrets manager at runtime | If the key is stolen, attacker can pause the contract, flag disputes, and revoke whitelist entries |
| Ally reporting accuracy | Ally submits bank statement or property management export | Ally could submit a false figure; evidence is hashed on-chain but not verified by the contract |

The evidence hash stored on-chain proves the ally submitted a specific
document, and that the document was not altered after submission. It does not
prove the document reflects reality. That check is Akkuea's human-review step.

---

## Known risks and open questions

1. **Single admin key.** There is no multisig on admin operations. If the
   key is compromised, damage is limited (cannot steal funds directly) but
   can disrupt operations. Mitigation: secrets manager, short-lived credentials.

2. **No fund recovery path.** If the admin triggers `trigger_exit` or the
   contract is paused indefinitely, funds already deposited in the payout
   contract have no recovery path. This is Known Risk #5 in the product brief.

3. **EURC swap dependency.** EURC distribution goes through an on-chain router.
   If the router is compromised or returns a bad rate, a holder's payout could
   be zero or minimal. The defensive `zero min_out` guard in
   `run_eurc_swap_leg` blocks the swap rather than accepting a zero-output
   trade, but the swap leg is then skipped. The holder receives nothing for
   that cycle's EURC portion.

4. **Dust.** Integer pro-rata math leaves dust in the payout contract after
   each distribution. The `DistributionSummary` reports it. There is no
   mechanism to recover dust.

5. **API process trust.** The API server holds the admin private key at
   runtime. A host-level compromise is effectively a key compromise. The
   blast radius is limited to what the admin key can do (see above), but
   investors have no way to verify that the API operator is not colluding with
   the ally on evidence approval.

---

## See also

- `docs/deployment/deploy-pilot-contracts.md` - role addresses set at deploy time
- `docs/deployment/post-deploy-pilot-checklist.md` - Day-0 gate before investor onboarding
- `docs/deployment/environment-variables.md` - secret management guidance
- `docs/strategy/product-brief.md` - why the trust model is disclosed rather than hidden
