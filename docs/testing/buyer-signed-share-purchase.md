# Buyer-signed share purchase: testnet verification

This runbook covers the end-to-end acceptance check for issue #1229. A manual run on 2026-10-23 is recorded below with the real transaction hashes and observed balances; the steps remain the procedure for repeating it against the deployed testnet contracts.

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

Manual end-to-end verification on Stellar Testnet, run on 2026-10-23 against a fresh deployment of the contract built from commit `da17a2c` (`stellar contract build`, 52 KB WASM, protocol 29) and a test TUSDC asset. Addresses and hashes below are public testnet data; no secret key is recorded.

### Deployment and accounts

| Item                   | Value                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| `defi-rwa` contract    | `CDNQZYEBVU5DBFWNOGYGT6GOHCFDMSQV3P2BOJVZ35FK5JC5ESSJVKXH`                   |
| Payment token (SAC)    | `CDI2SW7WZCG5N6IG4PJWAQ7WFQURNPZLNTEVV3KND747DJX64RJBUIKE`                   |
| Payment asset          | `TUSDC:GATCB5NOXVD3ITSDWOEBAEWVL4U2VPCLG5KKMYJE5PDOZGLS6MUVKJCE`, 7 decimals |
| Admin account          | `GDKCB4UB2I3BRZS3T2CZN4PE6IZFSN76YGYDPA6EMEZFZRLVBGBXCRY5`                   |
| Property owner account | `GB3J2HCJSCTYJR4QDMNXY5EMCNUILCU7FLG4EGYIAJIW3M2Y2PFBQJXR`                   |
| Buyer account          | `GDRBPRHZ7BHWPXGQRQBVI7SQ5T6IOJMDO6YNR435RVK65UKAQ5HCWVYS`                   |
| Soroban property ID    | `1229`                                                                       |

Deployment transaction: [`48a65094...`](https://stellar.expert/explorer/testnet/tx/48a6509411dbda785140352848a0413d87a9ecb95f61a096bfbe6050354fca04), ledger 5348776.

### 1. Tokenize and list

Admin-signed `list_property(admin, 1229, owner, 10000000, 100, CDI2...UIKE)`.

- Transaction: [`461ffbf5...`](https://stellar.expert/explorer/testnet/tx/461ffbf5d7b7cd02ad820afa24010a64cb1ad7012bab8b44cddedaef181a28f0), ledger 5348798.
- Event: `PropertyRegistered`, `property_id: "1229"`, `total_shares: "100"`, `price_per_share: "10000000"`.
- Read back before the purchase: available shares 100, total share supply 0, buyer share balance 0, price per share 10,000,000 units (1.0000000 TUSDC).

### 2. Prepare

`StellarService.preparePurchaseShares`, the code behind `POST /properties/:id/buy-shares/prepare`, built a simulated, unsigned `purchase_shares` transaction for 5 shares with the buyer as source and the listing's payment token as the token argument. The API did not sign it.

Note: the first attempt failed inside the service because the payment token was validated as an account address (`G...`) instead of a contract address (`C...`). The validation now checks the payment token as a contract ID, and the prepare above ran after that fix.

### 3. Sign and submit

The unsigned XDR was signed with the buyer testnet keypair, standing in for the connected wallet, and submitted to Soroban RPC.

- Transaction: [`d65d68b7...`](https://stellar.expert/explorer/testnet/tx/d65d68b72d86f6bf28b2d41c13b8a626c9cde2c22d06dfc5f15c4ec3d98658f7)
- Source account: buyer. Status: `SUCCESS`. Ledger 5348856, 2026-10-23 15:04:27 UTC.
- Invocation: `purchase_shares(buyer, 1229u64, 5u64, CDI2...UIKE)`.

### 4. Confirm

`StellarService.verifyPurchaseTransaction`, the verification used by `POST /properties/:id/buy-shares/confirm`, returned:

- `sourceAccount`: buyer.
- `call`: buyer, property `1229`, amount `5`, payment token `CDI2...UIKE`.
- `sharePurchase`: property `1229`, buyer, shares `5`, total cost `50000000`.

### 5. State and payment

| Value               | Before                         | After                       |
| ------------------- | ------------------------------ | --------------------------- |
| Available shares    | 100                            | 95                          |
| Total share supply  | 0                              | 5                           |
| Buyer share balance | 0                              | 5                           |
| Buyer TUSDC balance | 10,000,000,000 (1,000.0000000) | 9,950,000,000 (995.0000000) |
| Owner TUSDC balance | 0                              | 50,000,000 (5.0000000)      |

The purchase transferred 50,000,000 units (5.0000000 TUSDC) from the buyer to the owner. Horizon effects for the transaction: [`account_debited` buyer, 5.0000000 TUSDC](https://horizon-testnet.stellar.org/transactions/d65d68b72d86f6bf28b2d41c13b8a626c9cde2c22d06dfc5f15c4ec3d98658f7/effects) and `account_credited` owner, 5.0000000 TUSDC.

Stellar Expert event view for the payment token: [transfer event, buyer to owner, 50000000](https://stellar.expert/explorer/testnet/contract/CDI2SW7WZCG5N6IG4PJWAQ7WFQURNPZLNTEVV3KND747DJX64RJBUIKE?filter=events).

### 6. Rejection paths

Each attempt was simulated and rejected before submission; none changed contract or token state.

| Attempt                                                               | Result                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `list_property` signed by the buyer (non-admin), property 1230        | Contract error 1 (`NotAdmin`)                                   |
| `purchase_shares` with the native XLM SAC instead of the listed token | Contract error 29 (`PaymentTokenMismatch`)                      |
| `purchase_shares` for 101 shares when 95 were available               | Rejected by the `Insufficient shares available` guard (VM trap) |

### 7. Not covered by this run

- The HTTP layer and database writes. This environment had no PostgreSQL or Docker, so prepare and confirm were exercised through `StellarService` directly rather than over HTTP. The `transactions` row, the unique hash guard for a repeated confirmation, the database inventory decrement, and the rejection of a transaction signed by another wallet still need a run against the API with its database.
- The webapp checks in step 8: wallet connection, displayed total, and refresh after confirmation.
- The delisted property case, which needs `set_property_active`.

## Evidence and safety

Attach the real explorer link, screenshots or redacted logs showing the confirmed transaction, and before/after reads to the PR or issue. Public addresses and transaction hashes are public chain data; never attach secret keys, seed phrases, access tokens, or unredacted environment files. A passing unit test is not a substitute for this testnet evidence.
