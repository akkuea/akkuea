# Game Contracts Deployment Guide (Akkuea Land)

This guide deploys the three Akkuea Land game contracts to Stellar **testnet** and wires the resulting contract IDs into the `apps/akkuea-land` frontend so the dashboard's "Claim All" button signs and submits real `claim_rental` transactions.

**Contract sources:**

| Contract     | Source                                       | WASM output              |
| ------------ | -------------------------------------------- | ------------------------ |
| Property NFT | `apps/contracts/contracts/game-property-nft` | `game_property_nft.wasm` |
| LAND token   | `apps/contracts/contracts/game-land-token`   | `game_land_token.wasm`   |
| Game engine  | `apps/contracts/contracts/game-engine`       | `game_engine.wasm`       |

Unlike the defi-rwa contract (which uses `__constructor`), each game contract is deployed **and then explicitly initialized** with a separate `initialize` invocation. The script below does both.

---

## Prerequisites

```bash
# 1. Rust toolchain + wasm target (WASM 1.0 target used by `stellar contract build`)
rustup target add wasm32v1-none

# 2. Stellar CLI (v21+; verified with 26.0.0)
cargo install --locked stellar-cli --features opt
stellar --version
```

No pre-existing funded account is needed — the script generates a `game-deployer` identity and funds it via friendbot.

---

## Step 1 — Run the deploy script

From the repo root:

```bash
./scripts/deploy-game-contracts.sh testnet game-deployer
```

The script:

1. Generates + funds the `game-deployer` identity if it doesn't exist (testnet friendbot).
2. Builds all contracts with `stellar contract build` (targets `wasm32v1-none`; a raw `cargo build --target wasm32-unknown-unknown` on modern rustc emits reference-types the Soroban VM rejects at upload).
3. Deploys the three WASMs and captures their contract IDs.
4. Initializes them in dependency order:
   - `game_property_nft.initialize(treasury, game_engine)` — after this, the **treasury logically owns all 400 tiles**; no minting or seeding is needed.
   - `game_land_token.initialize(treasury, engine, is_testnet=true)`
   - `game_engine.initialize(nft_contract, token_contract, treasury)`
5. Prints a ready-to-paste `.env.local` block.

By default the deployer identity **is** the treasury, so the same key that deployed can claim rental income in the browser. To use a different treasury: `./scripts/deploy-game-contracts.sh testnet game-deployer G...TREASURY`.

---

## Step 2 — Import the deployer key into Freighter

The browser wallet must sign as the treasury (the on-chain owner of the tiles):

```bash
stellar keys show game-deployer   # prints the S... secret key
```

In Freighter: **Settings → Import a Stellar secret key**, paste the `S...` key, and switch Freighter's network to **Testnet**.

> ⚠️ This is a throwaway **testnet-only** key. Never reuse it on mainnet and never commit it to the repository.

---

## Step 3 — Configure the frontend

Create `apps/akkuea-land/.env.local` (gitignored) from the script's output:

```bash
# apps/akkuea-land/.env.local
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_DEFAULT_VIEWER_ADDRESS=G...   # deployer/treasury public key
NEXT_PUBLIC_TREASURY_ADDRESS=G...         # same as above by default
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=C...  # from script output — MANDATORY
NEXT_PUBLIC_PROPERTY_NFT_CONTRACT_ID=C...
NEXT_PUBLIC_LAND_TOKEN_CONTRACT_ID=C...
```

`NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID` is mandatory: without it, `soroban-tx.ts` falls back to the DeFi lending contract ID and every `claim_rental` simulation fails against the wrong contract.

---

## Step 4 — Verify with the CLI (no browser needed)

Income accrues once per epoch (**100 ledgers, ~9 minutes on testnet**). Wait one epoch after initialization, then:

```bash
IDENTITY=game-deployer
TREASURY=$(stellar keys address $IDENTITY)
ENGINE_ID=C...   # from script output
TOKEN_ID=C...

# 1. Accrued income should be > 0 after one epoch
stellar contract invoke --id $ENGINE_ID --source-account $IDENTITY --network testnet \
  -- get_accrued_income --property_id 1

# 2. Claim it
stellar contract invoke --id $ENGINE_ID --source-account $IDENTITY --network testnet \
  -- claim_rental --caller $TREASURY --property_id 1

# 3. LAND balance should have grown
stellar contract invoke --id $TOKEN_ID --source-account $IDENTITY --network testnet \
  -- balance --id $TREASURY
```

---

## Step 5 — Verify in the browser

```bash
bun run dev   # from repo root, akkuea-land on its dev port
```

Open the Akkuea Land dashboard (`/dashboard`), connect Freighter with the imported key, and press **Claim All**. Each claimable property triggers a real Freighter signing prompt; the transaction is submitted to the Soroban RPC and polled until confirmed. Rejecting a prompt records that property in the "Failed" list and the loop continues with the next one.

---

## Troubleshooting

| Symptom                                           | Cause                                                                                 | Fix                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Error(Contract, #2)` (NotOwner)                  | Signing wallet is not the on-chain tile owner                                         | Sign with the treasury key, or transfer the tile: `stellar contract invoke --id $NFT_ID ... -- transfer --from $TREASURY --to $WALLET --property_id N` |
| `Error(Contract, #4)` (NothingToClaim)            | Less than one epoch (100 ledgers) since init / last claim                             | Wait ~9 minutes and retry                                                                                                                              |
| `Error(Contract, #5)` (InsufficientBalance)       | Engine-side balance check failed                                                      | Check the LAND token init used the correct engine address                                                                                              |
| Simulation fails with an unrelated contract error | `NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID` unset — frontend fell back to the DeFi contract | Set the env var in `.env.local` and restart the dev server                                                                                             |
| `Transaction submission rejected by node`         | Source account can't cover the fee                                                    | Fund the account: `stellar keys fund $IDENTITY --network testnet`                                                                                      |
| Contract IDs stop working                         | Stellar testnet is periodically reset                                                 | Re-run the deploy script and update `.env.local`                                                                                                       |
