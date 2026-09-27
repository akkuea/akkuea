#!/bin/bash

# Build script for Soroban contracts using the stellar CLI.

set -e

echo "Building Soroban contracts..."

if ! command -v stellar >/dev/null 2>&1; then
    echo "stellar CLI not found. Install it first: cargo install --locked stellar-cli" >&2
    exit 1
fi

echo "Building every contract in the workspace (defi-rwa, game contracts, pilot contracts)..."
(cd apps/contracts && stellar contract build)

WASM_DIR="apps/contracts/target/wasm32v1-none/release"

echo "Verifying built WASM files..."
ls -la "$WASM_DIR"/*.wasm

echo "Contracts built successfully!"
