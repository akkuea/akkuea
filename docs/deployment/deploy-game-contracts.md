# Game Contracts Deployment Guide (Akkuea Land)

This guide deploys the four Akkuea Land game contracts to Stellar **testnet** and wires the resulting contract IDs into the `apps/akkuea-land` frontend so the full flow - claim a starter property and LAND, view the dashboard, claim rental income, list/buy on the marketplace - signs and submits real transactions end to end. No part of the flow talks to mocked data or the unrelated defi-rwa contracts.

**Contract sources:**

| Contract     | Source                                       | WASM output              |
| ------------ | -------------------------------------------- | ------------------------ |
| Property NFT | `apps/contracts/contracts/game-property-nft` | `game_property_nft.wasm` |
| LAND token   | `apps/contracts/contracts/game-land-token`   | `game_land_token.wasm`   |
| Game engine  | `apps/contracts/contracts/game-engine`       | `game_engine.wasm`       |
| Marketplace  | `apps/contracts/contracts/game-marketplace`  | `game_marketplace.wasm`  |

Unlike the defi-rwa contract (which uses `__constructor`), each game contract is deployed **and then explicitly initialized** with a separate `initialize` invocation. The script below does both.

> This repo already carries a deployed instance at `apps/shared/src/contracts/game-contracts.testnet.json` (all four contracts, deployed 2026-06-24). Steps 1–2 below are only needed if you want to deploy your **own** instance instead of reusing that one - the frontend falls back to the checked-in IDs automatically when the `NEXT_PUBLIC_*_CONTRACT_ID` env vars are unset (see Step 3).

---

## Prerequisites

```bash
# 1. Rust toolchain + wasm target (WASM 1.0 target used by `stellar contract build`)
rustup target add wasm32v1-none

# 2. Stellar CLI (v21+; verified with 26.0.0)
cargo install --locked stellar-cli --features opt
stellar --version
```

No pre-existing funded account is needed - the script generates a `game-deployer` identity and funds it via friendbot.

---

## Step 1 - Run the deploy script

From the repo root:

```bash
./scripts/deploy-game-contracts.sh testnet game-deployer
```

The script:

1. Generates + funds the `game-deployer` identity if it doesn't exist (testnet friendbot).
2. Builds all contracts with `stellar contract build` (targets `wasm32v1-none`; a raw `cargo build --target wasm32-unknown-unknown` on modern rustc emits reference-types the Soroban VM rejects at upload).
3. Deploys the four WASMs and captures their contract IDs.
4. Initializes them in dependency order:
   - `game_property_nft.initialize(treasury, game_engine)` - after this, the **treasury logically owns all 400 tiles**; no minting or seeding is needed.
   - `game_land_token.initialize(treasury, engine, is_testnet=true)`
   - `game_engine.initialize(nft_contract, token_contract, treasury)`
   - `game_marketplace.initialize(nft_contract, land_token)`
5. Prints a ready-to-paste `.env.local` block.

By default the deployer identity **is** the treasury, so the same key that deployed can claim rental income in the browser. To use a different treasury: `./scripts/deploy-game-contracts.sh testnet game-deployer G...TREASURY`.

---

## Step 2 - Import the deployer key into Freighter

The browser wallet must sign as the treasury (the on-chain owner of the tiles):

```bash
stellar keys show game-deployer   # prints the S... secret key
```

In Freighter: **Settings → Import a Stellar secret key**, paste the `S...` key, and switch Freighter's network to **Testnet**.

> ⚠️ This is a throwaway **testnet-only** key. Never reuse it on mainnet and never commit it to the repository.

---

## Step 3 - Configure the frontend

Create `apps/akkuea-land/.env.local` (gitignored) from the script's output:

```bash
# apps/akkuea-land/.env.local
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_DEFAULT_VIEWER_ADDRESS=G...   # deployer/treasury public key
NEXT_PUBLIC_TREASURY_ADDRESS=G...         # same as above by default
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=C...  # from script output
NEXT_PUBLIC_PROPERTY_NFT_CONTRACT_ID=C...
NEXT_PUBLIC_LAND_TOKEN_CONTRACT_ID=C...
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID=C...
```

None of these are strictly mandatory: every contract ID in `soroban-tx.ts` (`PROPERTY_NFT_CONTRACT_ID`, `GAME_ENGINE_CONTRACT_ID`, `MARKETPLACE_CONTRACT_ID`, `LAND_TOKEN_CONTRACT_ID`) and `TREASURY_ADDRESS` fall back to the checked-in `game-contracts.testnet.json` deploy when the env var is unset. Set them only when pointing the app at your **own** deploy from Step 1 - otherwise the app already talks to the shared testnet instance recorded in that file.
(Historically `NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID` was the one exception - an unset value silently fell back to the unrelated DeFi lending contract ID. That fallback bug is fixed: every ID now falls back to the correct game contract.)

---

## Step 4 - Verify with the CLI (no browser needed)

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

Marketplace round-trip (list → buy), using a second funded identity as the buyer:

```bash
MARKETPLACE_ID=C...   # from script output
NFT_ID=C...

# 1. Treasury approves the marketplace as spender for tile 5, then lists it
stellar contract invoke --id $NFT_ID --source-account $IDENTITY --network testnet \
  -- approve --owner $TREASURY --spender $MARKETPLACE_ID --property_id 5
stellar contract invoke --id $MARKETPLACE_ID --source-account $IDENTITY --network testnet \
  -- list --seller $TREASURY --property_id 5 --price 1000000000

# 2. A second identity ("buyer") with a LAND balance buys it
stellar contract invoke --id $MARKETPLACE_ID --source-account buyer --network testnet \
  -- buy --buyer $(stellar keys address buyer) --property_id 5

# 3. Owner should now be the buyer
stellar contract invoke --id $NFT_ID --source-account $IDENTITY --network testnet \
  -- get_owner --property_id 5
```

---

## Step 5 - Verify in the browser

```bash
bun run dev   # from repo root, akkuea-land on its dev port
```

The full flow now goes through real contract calls, no mocked data or hardcoded XDR:

- **Onboarding** (`/onboarding`): "Claim your starter LAND" builds a real `GameLandToken.faucet` transaction for the connected wallet; "Claim your first property" builds a real `GamePropertyNft.transfer` (treasury → viewer) for the selected tile. Both open a real Freighter signing prompt.
- **Dashboard** (`/dashboard`): **Claim All** builds a real `claim_rental` transaction per claimable property, sequentially, sign-submit-confirm.
- **City map** (`/`): selecting a treasury tile and clicking **Buy from Treasury** builds a real treasury transfer; selecting an owned tile and clicking **Improve** or **List for Sale** builds a real `improve` / `approve` + `list` pair; selecting a listed tile and clicking **Buy Land Tile** builds a real marketplace `buy`.

On first wallet action a wallet-picker modal opens - choose Freighter (with the imported key selected and Freighter on Testnet). Each action then triggers a real Freighter signing prompt; the transaction is submitted to the Soroban RPC and polled until confirmed. For **Claim All**, rejecting a prompt records that property in the "Failed" list and the loop continues with the next one; closing the wallet picker aborts without claiming.

---

## Troubleshooting

| Symptom                                                | Cause                                                                       | Fix                                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Error(Contract, #2)` (NotOwner)                       | Signing wallet is not the on-chain tile owner                               | Sign with the treasury key, or transfer the tile: `stellar contract invoke --id $NFT_ID ... -- transfer --from $TREASURY --to $WALLET --property_id N` |
| `Error(Contract, #4)` (NothingToClaim, game_engine)    | Less than one epoch (100 ledgers) since init / last claim                   | Wait ~9 minutes and retry                                                                                                                              |
| `Error(Contract, #4)` (NotListed, game_marketplace)    | Listing was already bought/cancelled, or `list` was never called            | Re-list the tile before calling `buy`                                                                                                                  |
| `Error(Contract, #3)` (NotApproved, game_property_nft) | `approve(owner, marketplace, property_id)` was skipped before `list`        | The frontend now does this automatically in `usePropertyActions.listForSale`; via CLI, call `approve` before `list`                                    |
| `Error(Contract, #5)` (InsufficientBalance)            | Engine-side balance check failed, or buyer lacks enough LAND on marketplace | Check the LAND token init used the correct engine address / fund the buyer via `faucet`                                                                |
| Simulation fails with an unrelated contract error      | A `NEXT_PUBLIC_*_CONTRACT_ID` override points at the wrong contract         | Unset the override to fall back to `game-contracts.testnet.json`, or double-check the ID against your own deploy output                                |
| `Transaction submission rejected by node`              | Source account can't cover the fee                                          | Fund the account: `stellar keys fund $IDENTITY --network testnet`                                                                                      |
| Contract IDs stop working                              | Stellar testnet is periodically reset                                       | Re-run the deploy script and update `.env.local`                                                                                                       |
