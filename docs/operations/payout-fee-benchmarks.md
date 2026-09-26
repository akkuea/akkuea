# Pilot Payout Transaction Cost Benchmarks

This document records the measured invocation budget and network fee for
`execute_distribution` on the pilot `payout-split` contract.

The product brief requires a "defined gas/fee cost per payout transaction,
measured on testnet" as an engineering acceptance criterion.

---

## Invocation budget (from CI, measured in tests)

These figures come from `budget_check_execute_distribution_for_ten_holders`
in `apps/contracts/contracts/pilot-payout-split/src/lib.rs`.
The test resets to unlimited budget before measuring so the numbers reflect
real consumption, not a capped estimate.

| Holders | Mix | CPU instructions | Memory (bytes) | CI budget cap |
|---------|-----|-----------------|----------------|---------------|
| 10 | 5 USDC + 5 EURC | see CI output | see CI output | CPU ≤ 120,000,000 / Mem ≤ 12,000,000 |

The CI `invocation-budget` job prints the actual measured values with each run:

```
MEASURED cpu=<value> mem=<value>
```

Check the latest CI run for the current figures. The caps above are hard
test assertions - if the contract exceeds them, the build fails.

---

## Testnet transaction fee (to be measured)

The Stellar network fee for a Soroban contract invocation depends on the
resource fees attached to the transaction. Measure it by running a real
`execute_distribution` on testnet and reading the fee from the transaction
result.

**How to measure:**

```bash
# 1. Set up a testnet environment with the pilot contracts deployed
# 2. Fund payout-split with USDC and record evidence for a cycle
# 3. Invoke execute_distribution and capture the transaction hash

TX_HASH=$(stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  -- execute_distribution \
  --cycle_id "2026-08" \
  2>&1 | grep -oE '[0-9a-f]{64}')

# 4. Fetch fee from Horizon
curl "https://horizon-testnet.stellar.org/transactions/$TX_HASH" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('fee_charged:', d['fee_charged'], 'stroops =', int(d['fee_charged'])/1e7, 'XLM')"
```

**Record results here when measured:**

| Date | Network | Holders | Mix | fee_charged (stroops) | XLM equivalent | Transaction hash |
|------|---------|---------|-----|----------------------|----------------|-----------------|
| TBD  | testnet | 10      | 5 USDC + 5 EURC | (not yet measured) | (not yet measured) | (not yet measured) |

Fill this table before mainnet go-live. It is a required acceptance criterion
per `docs/strategy/product-brief.md` (Engineering/output metrics).

---

## Notes

- Soroban fees = base fee + resource fee. Resource fee covers CPU, memory,
  ledger reads/writes, and events. The base fee is typically 100 stroops;
  resource fees scale with invocation complexity.
- EURC-preference holders add a swap leg per holder, increasing CPU and
  ledger access. The benchmark above covers the mixed case (worst-case for
  10 holders).
- For holder counts above 10 (if the pilot cap increases): re-run the
  budget test with a larger holder set before mainnet. The `TooManyHolders`
  guard in `execute_distribution` prevents exceeding the Soroban budget cap
  automatically, but the exact limit should be measured before it is
  hit in production.

---

## See also

- `apps/contracts/contracts/pilot-payout-split/src/lib.rs` -
  `budget_check_execute_distribution_for_ten_holders` test (~line 2138)
- `.github/workflows/contracts-ci.yml` - `invocation-budget` job that runs this test in CI
- `docs/deployment/deploy-pilot-contracts.md` - how to deploy and execute a distribution
