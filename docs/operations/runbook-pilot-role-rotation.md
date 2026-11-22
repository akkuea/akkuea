# Runbook: Pilot Payout Role Rotation

**Audience:** Platform admin and the incoming role holder  
**Contract:** `pilot-payout-split`  
**Required keys:** the current admin key and the replacement role key

This runbook rotates the operator, ally, or platform fee recipient without
redeploying the pilot. Each change is two-step. The current admin starts it and
the named replacement accepts it. The admin can cancel while it is pending.

## Set the variables

```bash
export CONTRACT_ID="<PILOT_PAYOUT_SPLIT_CONTRACT_ID>"
export ADMIN_ADDRESS="<CURRENT_ADMIN_PUBLIC_KEY>"
export NETWORK="testnet" # use mainnet only after the change is rehearsed
```

Confirm that the contract is not exited before starting. Rotation is available
while paused, but every rotation entry point rejects after `exit`.

## Rotate the operator

```bash
export NEW_OPERATOR_ADDRESS="<NEW_OPERATOR_PUBLIC_KEY>"

stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$ADMIN_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_operator_start \
  -- \
  --admin "$ADMIN_ADDRESS" \
  --new_operator "$NEW_OPERATOR_ADDRESS"
```

The incoming operator accepts with the incoming key:

```bash
stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$NEW_OPERATOR_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_operator_accept \
  -- \
  --new_operator "$NEW_OPERATOR_ADDRESS"
```

The old operator stops authorizing evidence recording, review, distribution,
and exit as soon as acceptance succeeds.

## Rotate the ally

```bash
export NEW_ALLY_ADDRESS="<NEW_ALLY_PUBLIC_KEY>"

stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$ADMIN_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_ally_start \
  -- \
  --admin "$ADMIN_ADDRESS" \
  --new_ally "$NEW_ALLY_ADDRESS"

stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$NEW_ALLY_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_ally_accept \
  -- \
  --new_ally "$NEW_ALLY_ADDRESS"
```

The old ally cannot co-sign new evidence or distributions after acceptance.
The new ally must be different from the current operator.

## Rotate the fee recipient

```bash
export NEW_FEE_RECIPIENT_ADDRESS="<NEW_FEE_RECIPIENT_PUBLIC_KEY>"

stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$ADMIN_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_fee_recipient_start \
  -- \
  --admin "$ADMIN_ADDRESS" \
  --new_recipient "$NEW_FEE_RECIPIENT_ADDRESS"

stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$NEW_FEE_RECIPIENT_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_fee_recipient_accept \
  -- \
  --new_recipient "$NEW_FEE_RECIPIENT_ADDRESS"
```

The next successful distribution sends the platform fee to the new recipient.
Previously completed distributions are not rewritten.

## Inspect pending rotations

```bash
stellar contract invoke --contract-id "$CONTRACT_ID" --network "$NETWORK" \
  --function pending_operator --

stellar contract invoke --contract-id "$CONTRACT_ID" --network "$NETWORK" \
  --function pending_ally --

stellar contract invoke --contract-id "$CONTRACT_ID" --network "$NETWORK" \
  --function pending_fee_recipient --
```

An empty result means no replacement is pending for that role.

## Cancel a pending rotation

Use the current admin key before the replacement accepts:

```bash
stellar contract invoke \
  --contract-id "$CONTRACT_ID" \
  --source-account "$ADMIN_ADDRESS" \
  --network "$NETWORK" \
  --function rotate_operator_cancel \
  -- \
  --admin "$ADMIN_ADDRESS"
```

Use `rotate_ally_cancel` or `rotate_fee_recipient_cancel` for the other roles.
After cancellation, the previous pending address cannot accept.

## Verification checklist

- Confirm the start and accept transactions emit role-rotation events.
- Confirm the pending read returns empty after acceptance or cancellation.
- Run one testnet evidence and review cycle with the new operator and ally.
- Confirm the old operator and ally receive authorization failures.
- Confirm the next distribution credits the new fee recipient exactly.
- Record the transaction hashes in the deployment change log.
