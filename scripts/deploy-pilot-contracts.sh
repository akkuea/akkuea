#!/bin/bash

# Deploys and initializes the three pilot income contracts:
# pilot-whitelist, pilot-income-token, and pilot-payout-split.
#
# Usage:
#   ./scripts/deploy-pilot-contracts.sh [network] [identity] [operator] [ally] [fee_recipient] [usdc_token]
#
#   network        Stellar network to deploy to (default: testnet)
#   identity       stellar CLI identity used as deployer/admin. For testnet it
#                  is generated and funded if it does not exist (default: pilot-deployer)
#   operator       Akkuea operator address required for evidence approval (required)
#   ally           Allied agency signer address required for evidence approval (required)
#   fee_recipient  Platform fee recipient address (default: deployer address)
#   usdc_token     USDC SAC contract ID for the target network (required)
#
# See docs/deployment/deploy-pilot-contracts.md for the full walkthrough.

set -euo pipefail

NETWORK="${1:-testnet}"
IDENTITY="${2:-pilot-deployer}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/apps/contracts"
WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "futurenet" ]; then
    echo "Refusing to deploy pilot contracts to '$NETWORK' - testnet/futurenet only." >&2
    exit 1
fi

if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
    echo "Identity '$IDENTITY' not found - generating and funding it on $NETWORK..."
    stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
fi

DEPLOYER="$(stellar keys address "$IDENTITY")"
OPERATOR="${3:-}"
ALLY="${4:-}"
FEE_RECIPIENT="${5:-$DEPLOYER}"
USDC_TOKEN="${6:-}"

if [ -z "$OPERATOR" ]; then
    echo "Operator address is required as argument 3." >&2
    exit 1
fi

if [ -z "$ALLY" ]; then
    echo "Ally signer address is required as argument 4." >&2
    exit 1
fi

if [ "$OPERATOR" = "$ALLY" ]; then
    echo "Operator and ally signer addresses must be distinct." >&2
    exit 1
fi

if [ -z "$USDC_TOKEN" ]; then
    echo "USDC token contract ID is required as argument 6." >&2
    exit 1
fi

echo "Network:       $NETWORK"
echo "Admin:         $DEPLOYER (identity: $IDENTITY)"
echo "Operator:      $OPERATOR"
echo "Ally:          $ALLY"
echo "Fee recipient: $FEE_RECIPIENT"
echo "USDC token:    $USDC_TOKEN"

echo "Building contracts..."
(cd "$CONTRACTS_DIR" && stellar contract build)

for wasm in pilot_whitelist pilot_income_token pilot_payout_split; do
    if [ ! -f "$WASM_DIR/$wasm.wasm" ]; then
        echo "Missing $WASM_DIR/$wasm.wasm after build." >&2
        exit 1
    fi
done

deploy() {
    stellar contract deploy \
        --wasm "$WASM_DIR/$1.wasm" \
        --source-account "$IDENTITY" \
        --network "$NETWORK"
}

invoke() {
    local id="$1"
    shift
    stellar contract invoke \
        --id "$id" \
        --source-account "$IDENTITY" \
        --network "$NETWORK" \
        -- "$@"
}

echo "Deploying pilot_whitelist..."
WHITELIST_ID="$(deploy pilot_whitelist)"
echo "  -> $WHITELIST_ID"

echo "Deploying pilot_income_token..."
INCOME_TOKEN_ID="$(deploy pilot_income_token)"
echo "  -> $INCOME_TOKEN_ID"

echo "Deploying pilot_payout_split..."
PAYOUT_SPLIT_ID="$(deploy pilot_payout_split)"
echo "  -> $PAYOUT_SPLIT_ID"

echo "Initializing pilot_whitelist..."
invoke "$WHITELIST_ID" initialize --admin "$DEPLOYER"

echo "Initializing pilot_income_token..."
invoke "$INCOME_TOKEN_ID" initialize \
    --admin "$DEPLOYER" \
    --whitelist "$WHITELIST_ID" \
    --name "Akkuea Pilot Income Participation" \
    --symbol "AKIN" \
    --decimals 7

echo "Initializing pilot_payout_split..."
invoke "$PAYOUT_SPLIT_ID" initialize \
    --admin "$DEPLOYER" \
    --operator "$OPERATOR" \
    --ally "$ALLY" \
    --platform_fee_recipient "$FEE_RECIPIENT" \
    --income_token "$INCOME_TOKEN_ID" \
    --whitelist "$WHITELIST_ID" \
    --usdc_token "$USDC_TOKEN"

cat <<EOF

Pilot contract deployment complete.

  PILOT_WHITELIST:     $WHITELIST_ID
  PILOT_INCOME_TOKEN:  $INCOME_TOKEN_ID
  PILOT_PAYOUT_SPLIT:  $PAYOUT_SPLIT_ID
  USDC_TOKEN:          $USDC_TOKEN
  admin:               $DEPLOYER
  operator:            $OPERATOR
  ally:                $ALLY
  fee_recipient:       $FEE_RECIPIENT

Record these IDs in apps/shared/src/contracts.testnet.json and docs/contracts/deployment.md.
EOF
