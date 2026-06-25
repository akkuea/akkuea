# C5-015: Deploy Game Contracts to Stellar Testnet

## Issue Metadata

| Attribute       | Value                          |
| --------------- | ------------------------------ |
| Issue ID        | C5-015                         |
| Area            | CONTRACTS                      |
| Difficulty      | Medium                         |
| Labels          | contracts, medium              |
| Dependencies    | C5-003, C5-004, C5-005, C5-006 |
| Estimated Lines | 40-70 (JSON + docs update)     |

## Prerequisites

- A Stellar testnet account with sufficient XLM for deployment fees. Use the Stellar friendbot to fund: `https://friendbot.stellar.org?addr=<your_address>`.
- The Stellar CLI installed and configured for testnet.
- All four contracts passing `cargo test` and `stellar contract build`.

## Build

From `apps/contracts/`:

```bash
stellar contract build
```

This produces WASM files under `target/wasm32v1-none/release/`.

## Deployment Order

Deploy in this order because of the initialization dependencies:

1. PropertyNFT
2. LandToken
3. GameMarketplace (needs PropertyNFT and LandToken addresses)
4. GameEngine (needs PropertyNFT and LandToken addresses)

### 1. Deploy PropertyNFT

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/game_property_nft.wasm \
  --network testnet \
  --source <your_account>
# → Returns: CXXX... (NFT_CONTRACT_ID)

stellar contract invoke \
  --id $NFT_CONTRACT_ID \
  --network testnet \
  --source <your_account> \
  -- initialize \
  --treasury <your_account> \
  --game_engine <placeholder> # Update after GameEngine is deployed
```

Note: `initialize` on PropertyNFT takes the GameEngine address. If deploying all at once, use a two-phase approach: deploy all four contracts first (calling `version` to verify they are live), then call `initialize` on each with the real addresses.

### 2. Deploy LandToken

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/game_land_token.wasm \
  --network testnet \
  --source <your_account>
# → Returns: CXXX... (TOKEN_CONTRACT_ID)

stellar contract invoke \
  --id $TOKEN_CONTRACT_ID \
  --network testnet \
  --source <your_account> \
  -- initialize \
  --admin <your_account> \
  --testnet_mode true
```

### 3. Deploy GameMarketplace

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/game_marketplace.wasm \
  --network testnet \
  --source <your_account>
# → Returns: CXXX... (MARKETPLACE_CONTRACT_ID)

stellar contract invoke \
  --id $MARKETPLACE_CONTRACT_ID \
  --network testnet \
  --source <your_account> \
  -- initialize \
  --nft_contract $NFT_CONTRACT_ID \
  --token_contract $TOKEN_CONTRACT_ID
```

### 4. Deploy GameEngine

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/game_engine.wasm \
  --network testnet \
  --source <your_account>
# → Returns: CXXX... (ENGINE_CONTRACT_ID)

stellar contract invoke \
  --id $ENGINE_CONTRACT_ID \
  --network testnet \
  --source <your_account> \
  -- initialize \
  --nft_contract $NFT_CONTRACT_ID \
  --token_contract $TOKEN_CONTRACT_ID \
  --treasury <your_account>
```

Then update PropertyNFT's game_engine reference if needed.

## Verification

Call a read-only function on each contract:

```bash
stellar contract invoke --id $NFT_CONTRACT_ID --network testnet -- get_owner --property_id 0
stellar contract invoke --id $TOKEN_CONTRACT_ID --network testnet -- name
stellar contract invoke --id $MARKETPLACE_CONTRACT_ID --network testnet -- get_all_listings --offset 0 --limit 1
stellar contract invoke --id $ENGINE_CONTRACT_ID --network testnet -- get_accrued_income --property_id 0
```

All must return without errors.

## JSON File

Create `apps/shared/src/contracts/game-contracts.testnet.json`:

```json
{
  "network": "testnet",
  "deployedAt": "2026-05-XX",
  "contracts": {
    "GAME_PROPERTY_NFT": {
      "contractId": "CXXX...",
      "txHash": "xxx...",
      "deployedBy": "GXXX..."
    },
    "GAME_LAND_TOKEN": {
      "contractId": "CXXX...",
      "txHash": "xxx...",
      "deployedBy": "GXXX..."
    },
    "GAME_MARKETPLACE": {
      "contractId": "CXXX...",
      "txHash": "xxx...",
      "deployedBy": "GXXX..."
    },
    "GAME_ENGINE": {
      "contractId": "CXXX...",
      "txHash": "xxx...",
      "deployedBy": "GXXX..."
    }
  }
}
```

Replace all placeholders with real values before committing.

## Definition of Done

- All four contracts are deployed, initialized, and verified on testnet.
- `game-contracts.testnet.json` is committed with real contract IDs.
- `docs/contracts/deployment.md` has a new log entry with a table of all four contracts.
- All CI workflows pass on the pull request.
