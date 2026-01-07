#!/bin/bash

# Build script for Soroban contracts using Stellar CLI

set -e

echo "Building Soroban contracts..."

# Check if Rust WASM target is installed
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Installing WASM target..."
    rustup target add wasm32-unknown-unknown
fi

# Build contracts
cd apps/contracts

echo "Building Real Estate Token contract..."
cargo build --bin real_estate_token --target wasm32-unknown-unknown --release

echo "Building DeFi Lending contract..."
cargo build --bin defi_lending --target wasm32-unknown-unknown --release

# Verify builds
echo "Verifying built files..."
ls -la target/wasm32-unknown-unknown/release/real_estate_token
ls -la target/wasm32-unknown-unknown/release/defi_lending

echo "Contracts built successfully!"

cd ../..