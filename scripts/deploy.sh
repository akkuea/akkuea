#!/bin/bash

# Deployment script for Stellar contracts using Stellar CLI

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
    
    CONTRACT_ID=$(stellar contract deploy \
        --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
        --source-account $(stellar keys address) \
        --network $NETWORK)
    
    echo "Real Estate Token Contract ID: $CONTRACT_ID"
    
    # Initialize contract
    stellar contract invoke \
        --contract-id $CONTRACT_ID \
        --source-account $(stellar keys address) \
        --network $NETWORK \
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
    
    CONTRACT_ID=$(stellar contract deploy \
        --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
        --source-account $(stellar keys address) \
        --network $NETWORK)
    
    echo "DeFi Lending Contract ID: $CONTRACT_ID"
    
    # Initialize contract
    stellar contract invoke \
        --contract-id $CONTRACT_ID \
        --source-account $(stellar keys address) \
        --network $NETWORK \
        --function initialize \
        --arg "$(stellar keys address)"
    
    cd ../..
}

# Set RPC URL based on network
if [ "$NETWORK" = "testnet" ]; then
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
elif [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://rpc.mainnet.stellar.org"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
else
    echo "Unsupported network: $NETWORK"
    exit 1
fi

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