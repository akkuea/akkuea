# Pilot TTL policy

Soroban entries expire unless their TTL (time to live, counted in ledgers) is
extended. An expired entry is archived and must be restored, for a fee, before
it can be used. Restoring in the middle of a distribution is the failure this
policy is designed to avoid.

At about 5 seconds per ledger there are 17,280 ledgers per day.

## One policy per contract

Each crate keeps its constants and helpers in a single module, `src/ttl.rs`, and
every caller imports `extend_instance` / `extend_persistent` from it. There is no
second copy of the numbers anywhere in the crate.

| Contract | Threshold | Extend to |
| --- | --- | --- |
| `pilot-income-token` | 30 days (518,400 ledgers) | 180 days (3,110,400 ledgers) |
| `pilot-payout-split` | 30 days (518,400 ledgers) | 180 days (3,110,400 ledgers) |
| `pilot-whitelist` | 30 days (518,400 ledgers) | 180 days (3,110,400 ledgers) |

## What extends what

- **The contract instance** (admin, configuration, supply, holder list, pause
  flag) is extended by `extend_instance` at the start of every state-changing
  entry point.
- **Persistent entries** (balances, whitelist approvals, cycle evidence,
  currency preferences, withheld balances) are extended when they are written,
  and on the read paths that clients use between writes. Reads only extend
  entries that already exist, because `extend_ttl` on a missing key fails; the
  helper checks `has` first.

## Do operators need a periodic bump?

**Not while the pilot is running its monthly cycle.** Every state-changing call
refreshes the instance, and every cycle write refreshes the persistent entries it
touches, so an entry that is used once per reporting period is extended to 180
days - six reporting periods - on every use.

The exception is a contract that is left untouched for longer than 180 days. At
that point entries are archived and must be restored before the next
distribution; a bump transaction does not help because the entry itself is gone.
If a long pause is expected, submit one state-changing call (for example
`pause`/`unpause`) before the window closes to refresh the instance.

Bump an instance manually with the Stellar CLI (confirm the exact flags with
`stellar contract extend --help`):

```
stellar contract extend --id <CONTRACT_ID> --ledgers-to-extend 3110400 --source <KEY> --network <NETWORK>
```

## Tests

Each crate has a test that moves the ledger forward by 3,000,000 ledgers (leaving
the entries live but below the threshold), calls a normal state-changing entry
point, and asserts that the TTL of the touched persistent entry and of the
contract instance is back at `TTL_EXTEND_TO`:

- `pilot-income-token`: `state_changing_entry_points_extend_ttls`
- `pilot-payout-split`: `state_changing_entry_points_extend_ttls`
- `pilot-whitelist`: `state_changing_entry_points_extend_ttls`
