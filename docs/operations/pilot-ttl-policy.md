# Pilot TTL policy

Soroban entries expire unless their TTL (time to live, counted in ledgers)
is extended. An expired entry is archived and must be restored, for a fee,
before it can be used. Restoring in the middle of a distribution is the
failure this policy is designed to avoid.

At about 5 seconds per ledger there are 17,280 ledgers per day.

## Values per contract

Each crate keeps its constants and helpers in one module, `src/ttl.rs`.
Every caller uses `extend_instance` and `extend_persistent` from that module.

| Contract | Threshold | Extend to |
| --- | --- | --- |
| `pilot-income-token` | 30 days (518,400 ledgers) | 90 days (1,555,200 ledgers) |
| `pilot-payout-split` | 30 days (518,400 ledgers) | 180 days (3,110,400 ledgers) |
| `pilot-whitelist` | see `pilot-whitelist/src/ttl.rs` | see `pilot-whitelist/src/ttl.rs` |

When an entry is written or read on a critical path and its remaining TTL is
below the threshold, it is extended to the "extend to" value.

## What extends what

- **Persistent entries** (balances, whitelist approvals, cycle evidence,
  currency preferences, withheld balances) are extended whenever they are
  written, and on the critical read paths. Reads only extend entries that
  exist, because extending a missing key fails.
- **The contract instance** (admin, configuration, supply, holder list, flags)
  is extended by the entry points that call `extend_instance`. Reads and some
  state-changing calls do not extend it, so it can expire even while the
  persistent entries stay fresh.

## Do operators need a periodic bump?

**Yes, for the contract instances.** Until every entry point extends the
instance, an operator should submit a bump transaction for each of the three
contracts at least once every 60 days. Persistent entries do not need a
separate bump while the pilot runs a monthly cycle, because each cycle touches
them.

Bump an instance with the Stellar CLI (confirm the exact flags with
`stellar contract extend --help`):

```
stellar contract extend --id <CONTRACT_ID> --ledgers-to-extend 3110400 --source <KEY> --network <NETWORK>
```

If the contract has been idle for longer than its "extend to" window, entries
may already be archived and must be restored before the next distribution.

## Tests

Each crate has a test that moves the ledger forward, calls a state-changing
entry point, and asserts that the TTL of the touched entry is at or above the
threshold.
