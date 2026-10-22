# Buyer-signed share purchase: testnet verification

This runbook covers the end-to-end acceptance check for issue #1229. It is a procedure, not a claim that a testnet transaction has already been executed. Record the real transaction hash and observed balances below after running it against the deployed testnet contracts.

## Prerequisites

- A testnet deployment of the updated `defi-rwa` contract and the API/webapp built from the PR branch.
- The deployed contract ID, accepted payment-token contract ID, and a test property ID.
- An admin testnet account authorised by the contract, plus a separate buyer account.
- Testnet payment tokens in the buyer account, sufficient for the purchase, and a small XLM balance for fees.
- The API and webapp configured for Stellar **testnet**, not mainnet. Never paste a secret key into the webapp, an issue, or this document.

## Procedure

1. **List the property as admin.** Submit the listing through the supported admin listing flow. Confirm the transaction succeeds and that the contract records the property ID, owner, positive share price, available share count, and accepted payment-token address. Repeat the listing with a non-admin account and confirm it is rejected.
2. **Open the buyer flow.** Connect the separate buyer wallet in the webapp, open the listed property, and choose a quantity within the available inventory. Confirm the displayed total equals `quantity × on-chain price per share`.
3. **Prepare, sign, and submit.** Start the purchase. The API should prepare an unsigned transaction; the connected buyer wallet must show and authorise the transaction. Confirm it is submitted to testnet. The buyer should be the transaction source and the purchase call must use the listing's accepted token.
4. **Verify chain confirmation.** Wait for a successful Soroban transaction result. Open the transaction in [Stellar Expert testnet explorer](https://stellar.expert/explorer/testnet) and record its transaction hash. Check the invocation includes the expected property ID and quantity, and the emitted purchase event matches them.
5. **Verify state and payment.** Read the contract state before and after the purchase. Available shares must decrease by exactly the purchased quantity, the buyer's on-chain share balance and total share supply must increase by that quantity, and the payment-token transfer must debit the buyer and credit the property owner by the expected total.
6. **Verify rejection paths.** Attempt a purchase with a different payment token, a quantity greater than inventory, and a delisted property. Each must fail without changing inventory, share balances, or payment balances.
7. **Verify duplicate confirmation handling.** Submit the same confirmed transaction hash to the API confirmation endpoint twice. The second request must not create another transaction record or decrement inventory a second time. Also attempt to confirm a transaction from another wallet and ensure it is rejected.
8. **Check the UI.** After confirmation, refresh the property and portfolio views. They must reflect the confirmed on-chain state rather than optimistic/unconfirmed values.

## Test record

Fill this section with observed results from an actual testnet run before marking the issue's manual verification criterion complete.

| Field | Observed value |
| --- | --- |
| Network | Pending testnet run |
| Contract ID | Not recorded |
| Property ID | Not recorded |
| Buyer public address | Not recorded |
| Payment token contract ID | Not recorded |
| Share quantity and unit price | Not recorded |
| Transaction hash / explorer link | Not recorded |
| Before/after available inventory | Not recorded |
| Before/after buyer share balance and total supply | Not recorded |
| Before/after buyer/owner payment-token balances | Not recorded |
| Rejection and duplicate-confirmation checks | Not run |

## Evidence and safety

Attach the real explorer link, screenshots or redacted logs showing the confirmed transaction, and before/after reads to the PR or issue. Public addresses and transaction hashes are public chain data; never attach secret keys, seed phrases, access tokens, or unredacted environment files. A passing unit test is not a substitute for this testnet evidence.
