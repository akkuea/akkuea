#!/bin/bash

# Deployment script for Stellar contracts using Stellar CLI
#
# NOTE: this helper predates docs/deployment/deploy-contracts.md, which is the
# authoritative, command-by-command guide for deploying the defi-rwa contract
# set. Verify this script still matches that guide (current stellar CLI
# invocation format included) before relying on it for a real deployment.

set -e

NETWORK=${1:-testnet}
CONTRACT_NAME=${2:-all}

echo "Deploying to $NETWORK network..."

# Function to deploy real estate token contract
deploy_real_estate_token() {
    echo "Deploying Real Estate Token contract..."
    cd apps/contracts
    
    # Build the contract using cargo (Rust build system)
    cargo build --target wasm32-unknown-unknown --release
    
    CONTRACT_ID="$(stellar contract deploy \
        --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
        --source-account "$(stellar keys address)" \
        --network "$NETWORK")"
    
    echo "Real Estate Token Contract ID: $CONTRACT_ID"
    
    # Initialize contract
    stellar contract invoke \
        --contract-id "$CONTRACT_ID" \
        --source-account "$(stellar keys address)" \
        --network "$NETWORK" \
        --function initialize \
        --arg "$(stellar keys address)"
    
    cd ../..
}

# Function to deploy DeFi lending contract
deploy_defi_lending() {
    echo "Deploying DeFi Lending contract..."
    cd apps/contracts
    
    # Build the contract using cargo (Rust build system)
    cargo build --target wasm32-unknown-unknown --release
    
    CONTRACT_ID="$(stellar contract deploy \
        --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
        --source-account "$(stellar keys address)" \
        --network "$NETWORK")"
    
    echo "DeFi Lending Contract ID: $CONTRACT_ID"
    
    # Initialize contract
    stellar contract invoke \
        --contract-id "$CONTRACT_ID" \
        --source-account "$(stellar keys address)" \
        --network "$NETWORK" \
        --function initialize \
        --arg "$(stellar keys address)"
    
    cd ../..
}

# Network gate. RPC URL and network passphrase are resolved by the stellar
# CLI from the --network alias, so this block only rejects networks the
# script does not support.
case "$NETWORK" in
    testnet|mainnet) ;;
    *)
        echo "Unsupported network: $NETWORK"
        exit 1
        ;;
esac

# Deploy contracts based on selection
case $CONTRACT_NAME in
    "real-estate-token")
        deploy_real_estate_token
        ;;
    "defi-lending")
        deploy_defi_lending
        ;;
    "all")
        deploy_real_estate_token
        deploy_defi_lending
        ;;
    *)
        echo "Unknown contract: $CONTRACT_NAME"
        echo "Available contracts: real-estate-token, defi-lending, all"
        exit 1
        ;;
esac

echo "Deployment completed successfully!"