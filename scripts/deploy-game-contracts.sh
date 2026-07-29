#!/bin/bash

# Deploys and initializes the four Akkuea Land game contracts
# (game-property-nft, game-land-token, game-engine, game-marketplace) to a
# Stellar network.
#
# Usage:
#   ./scripts/deploy-game-contracts.sh [network] [identity] [treasury]
#
#   network   Stellar network to deploy to (default: testnet)
#   identity  stellar CLI identity used as deployer; generated + funded
#             via friendbot if it does not exist yet (default: game-deployer)
#   treasury  Treasury address that will own all 400 tiles after init
#             (default: the deployer's own address)
#
# See docs/deployment/deploy-game-contracts.md for the full walkthrough.

set -euo pipefail

NETWORK="${1:-testnet}"
IDENTITY="${2:-game-deployer}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/apps/contracts"
# stellar contract build targets wasm32v1-none (WASM 1.0): raw
# `cargo build --target wasm32-unknown-unknown` on modern rustc emits
# reference-types the Soroban VM rejects at upload ("zero byte expected").
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "futurenet" ]; then
    echo "Refusing to deploy game contracts to '$NETWORK' — testnet/futurenet only." >&2
    exit 1
fi

# ── 1. Deployer identity ──────────────────────────────────────────────────────

if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
    echo "Identity '$IDENTITY' not found — generating and funding it on $NETWORK..."
    stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi

DEPLOYER="$(stellar keys address "$IDENTITY")"
TREASURY="${3:-$DEPLOYER}"

echo "Network:  $NETWORK"
echo "Deployer: $DEPLOYER (identity: $IDENTITY)"
echo "Treasury: $TREASURY"

# ── 2. Build WASMs ────────────────────────────────────────────────────────────

echo "Building contracts..."
(cd "$CONTRACTS_DIR" && stellar contract build)

for wasm in game_property_nft game_land_token game_engine game_marketplace; do
    if [ ! -f "$WASM_DIR/$wasm.wasm" ]; then
        echo "Missing $WASM_DIR/$wasm.wasm after build." >&2
        exit 1
    fi
done

# ── 3. Deploy ─────────────────────────────────────────────────────────────────

deploy() {
    stellar contract deploy \
        --wasm "$WASM_DIR/$1.wasm" \
        --source-account "$IDENTITY" \
        --network "$NETWORK"
}

echo "Deploying game_property_nft..."
NFT_ID="$(deploy game_property_nft)"
echo "  -> $NFT_ID"

echo "Deploying game_land_token..."
TOKEN_ID="$(deploy game_land_token)"
echo "  -> $TOKEN_ID"

echo "Deploying game_engine..."
ENGINE_ID="$(deploy game_engine)"
echo "  -> $ENGINE_ID"

echo "Deploying game_marketplace..."
MARKETPLACE_ID="$(deploy game_marketplace)"
echo "  -> $MARKETPLACE_ID"

# ── 4. Initialize ─────────────────────────────────────────────────────────────
# Arg names match the Rust signatures exactly. The NFT and token contracts
# only need the engine's contract ID, which exists as soon as it is deployed
# (deploy != initialize), so ordering here is safe.

IS_TESTNET=true
if [ "$NETWORK" != "testnet" ]; then IS_TESTNET=false; fi

invoke() {
    local id="$1"
    shift
    stellar contract invoke \
        --id "$id" \
        --source-account "$IDENTITY" \
        --network "$NETWORK" \
        -- "$@"
}

echo "Initializing game_property_nft (treasury owns all 400 tiles)..."
invoke "$NFT_ID" initialize --treasury "$TREASURY" --game_engine "$ENGINE_ID"

echo "Initializing game_land_token..."
invoke "$TOKEN_ID" initialize --treasury "$TREASURY" --engine "$ENGINE_ID" --is_testnet "$IS_TESTNET"

echo "Initializing game_engine..."
invoke "$ENGINE_ID" initialize --nft_contract "$NFT_ID" --token_contract "$TOKEN_ID" --treasury "$TREASURY"

echo "Initializing game_marketplace..."
invoke "$MARKETPLACE_ID" initialize --nft_contract "$NFT_ID" --land_token "$TOKEN_ID"

# ── 5. Summary ────────────────────────────────────────────────────────────────

cat <<EOF

Deployment complete.

  game_property_nft: $NFT_ID
  game_land_token:   $TOKEN_ID
  game_engine:       $ENGINE_ID
  game_marketplace:  $MARKETPLACE_ID
  treasury:          $TREASURY

Paste into apps/akkuea-land/.env.local:

NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_DEFAULT_VIEWER_ADDRESS=$TREASURY
NEXT_PUBLIC_TREASURY_ADDRESS=$TREASURY
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=$ENGINE_ID
NEXT_PUBLIC_PROPERTY_NFT_CONTRACT_ID=$NFT_ID
NEXT_PUBLIC_LAND_TOKEN_CONTRACT_ID=$TOKEN_ID
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID

Income accrues once per epoch (100 ledgers, ~9 min on testnet) — wait one
epoch after init before the first claim_rental can succeed.
EOF
