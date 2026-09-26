# Pilot Payout Transaction Cost Benchmarks

Measured invocation budget and network fee for `execute_distribution` on the
pilot `payout-split` contract (testnet, 2026-09-26).

---

## Testnet on-chain preflight output

Run against the deployed pilot contracts on testnet
(`contracts.testnet.json`) using `scripts/mainnet-preflight.sh`:

```
=== Part 1: Environment ===
  (skipped - testnet run uses --env-only separately)

=== Part 2: On-chain state ===
  OK  whitelist.admin() = GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY
  OK  income_token.admin() = GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY
  OK  income_token.name() = "Akkuea Pilot Income Participation"
  OK  payout.is_paused() = false
  INFO payout.eurc_swap_path_status() = "stubbed-fast-follow"
  --  pilot_whitelist WASM hash not in manifest (skipping)
  --  pilot_income_token WASM hash not in manifest (skipping)
  --  pilot_payout_split WASM hash not in manifest (skipping)

=== PREFLIGHT PASSED - all checks clean ===
```

**Note on address verification:** The operator, ally, fee-recipient,
income-token, whitelist, and USDC addresses set at `initialize()` time have
no public read functions in these deployed contracts. The preflight verifies
`admin` (whitelist and income token) and `is_paused` (payout). All other
wiring must be verified by inspecting the `initialize` transaction in
Stellar Expert using the contract IDs from `contracts.testnet.json`.

---

## Invocation budget (from CI tests)

These figures come from `budget_check_execute_distribution_for_ten_holders`
in `apps/contracts/contracts/pilot-payout-split/src/lib.rs`. The test
resets to unlimited budget before measuring.

| Holders | Mix | CPU cap | Memory cap |
|---------|-----|---------|------------|
| 10 | 5 USDC + 5 EURC | <= 120,000,000 instructions | <= 12,000,000 bytes |

The CI `invocation-budget` job prints `MEASURED cpu=<value> mem=<value>`
on each run. The caps are hard test assertions.

---

## Testnet transaction fee

`execute_distribution` has not yet been executed on testnet - supply has
not been minted and no evidence cycles have been recorded. The fee table
below will be filled when the first distribution is run.

**How to measure once a cycle is ready:**

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  --send=yes \
  -- execute_distribution \
  --cycle_id "2026-08" 2>&1

# Then fetch the fee from Horizon using the transaction hash printed above:
curl "https://horizon-testnet.stellar.org/transactions/$TX_HASH" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
      print('fee_charged:', d['fee_charged'], 'stroops =', int(d['fee_charged'])/1e7, 'XLM')"
```

| Date | Network | Holders | Mix | fee_charged (stroops) | XLM | Transaction hash |
|------|---------|---------|-----|-----------------------|-----|-----------------|
| (pending first cycle) | testnet | 10 | 5 USDC + 5 EURC | - | - | - |

---

## See also

- `apps/contracts/contracts/pilot-payout-split/src/lib.rs` - budget test (~line 2138)
- `.github/workflows/contracts-ci.yml` - `invocation-budget` job
- `docs/deployment/deploy-pilot-contracts.md` - how to run a distribution
