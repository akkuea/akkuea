#!/bin/bash

# Deploy the defi-rwa contract following docs/deployment/deploy-contracts.md,
# which is the authoritative, command-by-command procedure for this contract
# set. The order of steps matches that guide: build, deploy with constructor
# arguments, set the oracle, configure the oracle guardrails, and optionally
# grant the emergency role before going live.
#
# Usage:
#   ./scripts/deploy.sh [network] [oracle_address] [identity] [grant-emergency-to]
#
#   network             Stellar network to deploy to (default: testnet)
#   oracle_address      SEP-40 oracle contract ID, required before any borrow()
#                       call can succeed (required)
#   identity            stellar CLI identity used as deployer/admin. For testnet
#                       it is generated and funded if it does not exist
#                       (default: defi-rwa-deployer)
#   grant-emergency-to  Optional address to grant the EmergencyGuard role to in
#                       the same run (guide Step 5). Pass as argument 4.
#
# Environment:
#   ORACLE_MAX_AGE   Optional oracle staleness threshold in seconds
#                    (0 keeps the contract default of 3600)
#   ORACLE_MIN_PRICE Optional normalized minimum price floor (0 disables it)

set -euo pipefail

NETWORK="${1:-testnet}"
ORACLE_ADDRESS="${2:-}"
IDENTITY="${3:-defi-rwa-deployer}"
EMERGENCY_TARGET="${4:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/apps/contracts"
WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/rwa_defi_contract.wasm"

# Extra CLI arguments carrying the RPC endpoint. Testnet works with the
# default public RPC; mainnet requires a provider, passed via STELLAR_RPC_URL.
RPC_ARGS=()
if [ "$NETWORK" = "mainnet" ]; then
    if [ -z "${STELLAR_RPC_URL:-}" ]; then
        echo "Mainnet deployment requires an RPC provider URL. There is no" >&2
        echo "free public mainnet RPC. Export STELLAR_RPC_URL first, for example:" >&2
        echo "  export STELLAR_RPC_URL=https://your-provider.example/rpc" >&2
        exit 1
    fi
    RPC_ARGS=(--rpc-url "$STELLAR_RPC_URL")
fi

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
    echo "Unsupported network: $NETWORK (use testnet or mainnet)" >&2
    exit 1
fi

if [ -z "$ORACLE_ADDRESS" ]; then
    echo "Oracle contract ID is required as argument 2. Every borrow() call" >&2
    echo "panics until set_oracle runs, so this script refuses to deploy" >&2
    echo "without one." >&2
    exit 1
fi

if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
    if [ "$NETWORK" = "testnet" ]; then
        echo "Identity '$IDENTITY' not found - generating and funding it on $NETWORK..."
        stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
    else
        echo "Identity '$IDENTITY' not found. For mainnet, add the funded key" >&2
        echo "first (the CLI prompts for the secret key):" >&2
        echo "  stellar keys add $IDENTITY --secret-key" >&2
        exit 1
    fi
fi

ADMIN="$(stellar keys address "$IDENTITY")"

echo "Network:              $NETWORK"
echo "Admin:                $ADMIN (identity: $IDENTITY)"
echo "Oracle:               $ORACLE_ADDRESS"
if [ -n "$EMERGENCY_TARGET" ]; then
    echo "EmergencyGuard grant: $EMERGENCY_TARGET"
fi

echo "Building contracts (stellar contract build)..."
(cd "$CONTRACTS_DIR" && stellar contract build)

if [ ! -f "$WASM" ]; then
    echo "Missing $WASM after build." >&2
    exit 1
fi

echo "Deploying with constructor arguments..."
CONTRACT_ID="$(stellar contract deploy \
    --wasm "$WASM" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    "${RPC_ARGS[@]}" \
    -- \
    --admin "$ADMIN")"
echo "  -> $CONTRACT_ID"

echo "Setting the price oracle (mandatory before any borrow)..."
stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    "${RPC_ARGS[@]}" \
    -- \
    set_oracle \
    --oracle_address "$ORACLE_ADDRESS" \
    --caller "$ADMIN"

ORACLE_MAX_AGE="${ORACLE_MAX_AGE:-0}"
ORACLE_MIN_PRICE="${ORACLE_MIN_PRICE:-0}"

echo "Configuring oracle guardrails (max_age=$ORACLE_MAX_AGE, min_price=$ORACLE_MIN_PRICE)..."
stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    "${RPC_ARGS[@]}" \
    -- \
    set_oracle_config \
    --caller "$ADMIN" \
    --max_age "$ORACLE_MAX_AGE" \
    --min_price "$ORACLE_MIN_PRICE"

if [ -n "$EMERGENCY_TARGET" ]; then
    echo "Granting the EmergencyGuard role to $EMERGENCY_TARGET..."
    stellar contract invoke \
        --id "$CONTRACT_ID" \
        --source-account "$IDENTITY" \
        --network "$NETWORK" \
        "${RPC_ARGS[@]}" \
        -- \
        grant_emergency_role \
        --admin "$ADMIN" \
        --target "$EMERGENCY_TARGET"
fi

echo "Verifying the deployment is responsive..."
stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    --send=no \
    "${RPC_ARGS[@]}" \
    -- \
    get_oracle_config

cat <<EOF

defi-rwa deployment complete.

  CONTRACT_ID:   $CONTRACT_ID
  admin:         $ADMIN
  oracle:        $ORACLE_ADDRESS
  oracle config: max_age=$ORACLE_MAX_AGE min_price=$ORACLE_MIN_PRICE

Next steps from docs/deployment/deploy-contracts.md:

  1. Create lending pools with create_pool (Step 4, one per asset).
  2. Record the contract ID in apps/api/.env as
     REAL_ESTATE_TOKEN_CONTRACT_ID and restart the API (Step 6).

Without a pool the contract is deployed and healthy but no lending can
happen; without the oracle set above every borrow would have panicked.
EOF
