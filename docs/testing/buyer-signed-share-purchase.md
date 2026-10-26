# Buyer-signed share purchase: testnet verification

This runbook covers the end-to-end acceptance check for issue #1229. A manual run on 2026-10-23, covering the contract, the HTTP API, and the database, is recorded below with the real transaction hashes and observed values; the steps remain the procedure for repeating it against the deployed testnet contracts.

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

Manual end-to-end verification on Stellar Testnet, run on 2026-10-23 against a fresh deployment of the contract built from commit `da17a2c` (`stellar contract build`, 52 KB WASM, protocol 29) and a test TUSDC asset. The API ran from branch commit `0ab6542` against a local PostgreSQL 18 database with all migrations applied. Addresses and hashes below are public testnet data; no secret key is recorded.

### Deployment and accounts

| Item                | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| `defi-rwa` contract | `CAPSXSXFLHGMUN66QE7CFD6R2B3FUQC72VD4O4ZUMQPEG744QZNMXGPC`                   |
| Payment token (SAC) | `CAEMSWSATEIUO5KTDR5NVF5NYBFJH76BNVKD7456NZTOWDJASZEEA6CK`                   |
| Payment asset       | `TUSDC:GBFE5Y5CJSFVRHN5MXGJWQWVSVQKQE5COR7C5NQ4SBXVWSYSOYYE4HDR`, 7 decimals |
| Admin account       | `GDDAJMZZVD46UI27YFN6C3F32WL7P2VT5NI5QWRPIBHSBVPP6K3JBOQ3`                   |
| Property owner      | `GCQUVMBEQKX4AYY6RCZYJTTYSTHK5QIG4ZCM6O3Q5O5GWO6GXSQJ5VQS`                   |
| Buyer account       | `GDDN3PAPDHQVGMEXM4FTAI3S5XTCRGTLGLMADZ6LBZO6PJ6HNDUVQZZS`                   |
| Soroban property ID | `1231`                                                                       |
| API property ID     | `00d9e6fb-5825-4627-98be-108c3df661bb`                                       |

Deployment transaction: [`1613d7c6...`](https://stellar.expert/explorer/testnet/tx/1613d7c69909055ce7f3e09a6839c8d89967a100adb53b1a80e1a0c1fda97f82), ledger 5349236.

The API database row for this property was seeded to match the on-chain listing: same contract, Soroban property ID, owner, price, and inventory. The buyer and owner user rows were seeded with `kyc_status = approved`, which the prepare endpoint requires.

### 1. Tokenize and list

Admin-signed `list_property(admin, 1231, owner, 10000000, 100, CAEMSW...A6CK)`.

- Transaction: [`465d75fd...`](https://stellar.expert/explorer/testnet/tx/465d75fdccdf0c0ba4c57f51530efe352407558f21f6de7aeb3ece4543f5f614), ledger 5349255.
- Event: `PropertyRegistered`, `property_id: "1231"`, `total_shares: "100"`, `price_per_share: "10000000"`.
- Read back before the purchase: available shares 100, total share supply 0, buyer share balance 0, price per share 10,000,000 units (1.0000000 TUSDC).
- A listing attempt from the buyer account (property 1232) was rejected during simulation with contract error 1 (`NotAdmin`).

### 2. Authenticate the buyer

`POST /auth/challenge` returned a nonce for the buyer address, and `POST /auth/session` accepted the buyer signature over that nonce and returned a JWT for API user `6695ccb4-6b96-4a9d-a893-6166192460a1`. The API was started with `STELLAR_NETWORK=testnet`, the deployed contract ID, and `PAYMENT_TOKEN_CONTRACT_ID` set to the SAC above.

### 3. Prepare over HTTP

`POST /properties/00d9e6fb-5825-4627-98be-108c3df661bb/buy-shares/prepare` with the buyer JWT and `{ "buyer": "GDDN...QZZS", "shares": 5 }` returned `200` with:

- `contractId`: `CAPSXSXFLHGMUN66QE7CFD6R2B3FUQC72VD4O4ZUMQPEG744QZNMXGPC`
- `sorobanPropertyId`: `1231`, `shares`: `5`
- `paymentToken`: `CAEMSWSATEIUO5KTDR5NVF5NYBFJH76BNVKD7456NZTOWDJASZEEA6CK`
- `totalAmount`: `5.0000000`
- `xdr`: 2,184 characters

Decoding the XDR showed one operation, `purchase_shares`, sourced by the buyer. The API did not sign it.

Note: the first run on 2026-10-23 exposed that the payment token was validated as an account address (`G...`), which rejects a valid SAC contract ID (`C...`). The validation now checks the payment token as a contract ID, and this prepare ran after that fix.

### 4. Sign and submit

The buyer signed the prepared XDR with the buyer testnet keypair, standing in for the connected wallet, and submitted it to Soroban RPC.

- Transaction: [`9b7a8ef5...`](https://stellar.expert/explorer/testnet/tx/9b7a8ef517d8eaa54bf6dd15a95f00b0918af917ba9328fbfc0d67900e4f5048)
- Source account: buyer. Status: `SUCCESS`. Ledger 5349322, 2026-10-23 15:43:17 UTC.
- Invocation: `purchase_shares(buyer, 1231u64, 5u64, CAEMSW...A6CK)`.

### 5. Confirm over HTTP and record

`POST /properties/00d9e6fb-5825-4627-98be-108c3df661bb/buy-shares/confirm` with the buyer JWT and `{ "txHash": "9b7a8ef5..." }` verified the transaction on-chain and recorded it:

- One `transactions` row: type `buy_shares`, hash `9b7a8ef5...`, amount `5.0000000`, asset `CAEMSW...A6CK`, status `confirmed`, metadata `{ propertyId, shares: 5 }`.
- `properties.available_shares` moved from 100 to 95.
- One `share_ownerships` row for the buyer: 5 shares, `purchase_price` 5.00.

The controller checked the transaction source and buyer, the property ID, the share count, and that the `SharePurchase` event total cost matched the property price before writing anything.

### 6. Duplicate confirmation and other wallet

- Confirming the same hash twice more with the buyer JWT returned `200` with `{ "transactionHash": "9b7a8ef5...", "newBalance": 5 }` both times.
- After both repeats, the database still had one hashed transaction row, 95 available shares, and a 5 share ownership. Nothing was counted twice.
- Confirming the same hash with the owner JWT returned `403` with `The transaction was not signed by the authenticated buyer`, and did not change the database.

### 7. State and payment

| Value               | Before                         | After                       |
| ------------------- | ------------------------------ | --------------------------- |
| Available shares    | 100                            | 95                          |
| Total share supply  | 0                              | 5                           |
| Buyer share balance | 0                              | 5                           |
| Buyer TUSDC balance | 10,000,000,000 (1,000.0000000) | 9,950,000,000 (995.0000000) |
| Owner TUSDC balance | 0                              | 50,000,000 (5.0000000)      |

The purchase transferred 50,000,000 units (5.0000000 TUSDC) from the buyer to the owner. Horizon effects for the transaction: [`account_debited` buyer, 5.0000000 TUSDC](https://horizon-testnet.stellar.org/transactions/9b7a8ef517d8eaa54bf6dd15a95f00b0918af917ba9328fbfc0d67900e4f5048/effects) and `account_credited` owner, 5.0000000 TUSDC.

Stellar Expert event view for the payment token: [transfer event, buyer to owner, 50000000](https://stellar.expert/explorer/testnet/contract/CAEMSWSATEIUO5KTDR5NVF5NYBFJH76BNVKD7456NZTOWDJASZEEA6CK?filter=events).

### 8. Rejection paths

Each attempt was simulated and rejected before submission; none changed contract or token state.

| Attempt                                                               | Result                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `list_property` signed by the buyer (non-admin), property 1232        | Contract error 1 (`NotAdmin`)                                   |
| `purchase_shares` with the native XLM SAC instead of the listed token | Contract error 29 (`PaymentTokenMismatch`)                      |
| `purchase_shares` for 101 shares when 95 were available               | Rejected by the `Insufficient shares available` guard (VM trap) |

### 9. Not covered by this run

- The webapp checks in step 8: wallet connection through a browser extension, the displayed total, and refresh after confirmation. The HTTP auth, prepare, and confirm calls were exercised directly, and the buyer testnet keypair signed the XDR instead of a browser wallet.
- The delisted property case, which needs `set_property_active`.

## Evidence and safety

Attach the real explorer link, screenshots or redacted logs showing the confirmed transaction, and before/after reads to the PR or issue. Public addresses and transaction hashes are public chain data; never attach secret keys, seed phrases, access tokens, or unredacted environment files. A passing unit test is not a substitute for this testnet evidence.
