#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq &> /dev/null; then
  echo "This script requires 'jq' to edit JSON files. Install it and re-run." >&2
  exit 1
fi

usage() {
  cat <<EOF
Usage: $0 --network <testnet|mainnet> [--real-estate-id C...] [--defi-id C...] [--admin-public G...] [--admin-secret S...]

This script updates the repo artifacts that contain deployed contract IDs or placeholders.
It updates: apps/shared/src/contracts.<network>.json and uncomment / set values in apps/api/.env.example.
It does NOT fabricate values; provide real contract IDs when running.
EOF
}

NETWORK="testnet"
REAL_ID=""
DEFI_ID=""
ADMIN_PUB=""
ADMIN_SEC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift 2;;
    --real-estate-id) REAL_ID="$2"; shift 2;;
    --defi-id) DEFI_ID="$2"; shift 2;;
    --admin-public) ADMIN_PUB="$2"; shift 2;;
    --admin-secret) ADMIN_SEC="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

BASE="apps/shared/src"
CONTRACTS_JSON="$BASE/contracts.${NETWORK}.json"

if [ ! -f "$CONTRACTS_JSON" ]; then
  echo "Contracts file not found: $CONTRACTS_JSON" >&2
  exit 1
fi

TMP=$(mktemp)

cp "$CONTRACTS_JSON" "$CONTRACTS_JSON.bak"
cat "$CONTRACTS_JSON" > "$TMP"

if [ -n "$REAL_ID" ]; then
  jq --arg id "$REAL_ID" '.contracts.REAL_ESTATE_TOKEN = $id' "$TMP" > "$TMP".1 && mv "$TMP".1 "$TMP"
  echo "Set REAL_ESTATE_TOKEN -> $REAL_ID in $CONTRACTS_JSON"
fi

if [ -n "$DEFI_ID" ]; then
  jq --arg id "$DEFI_ID" '.contracts.DEFI_LENDING = $id' "$TMP" > "$TMP".1 && mv "$TMP".1 "$TMP"
  echo "Set DEFI_LENDING -> $DEFI_ID in $CONTRACTS_JSON"
fi

if [ -s "$TMP" ]; then
  mv "$TMP" "$CONTRACTS_JSON"
  echo "Updated $CONTRACTS_JSON (backup at $CONTRACTS_JSON.bak)"
else
  rm -f "$TMP"
  echo "No changes made to $CONTRACTS_JSON"
fi

# Update apps/api/.env.example - uncomment and set contract IDs if provided
ENV_FILE="apps/api/.env.example"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.bak"
  if [ -n "$REAL_ID" ]; then
    sed -E "s/^#\s*REAL_ESTATE_TOKEN_CONTRACT_ID=.*/REAL_ESTATE_TOKEN_CONTRACT_ID=${REAL_ID}/" "$ENV_FILE.bak" > "$ENV_FILE"
    echo "Updated REAL_ESTATE_TOKEN_CONTRACT_ID in $ENV_FILE"
    mv "$ENV_FILE" "$ENV_FILE"
  fi
  if [ -n "$DEFI_ID" ]; then
    sed -E "s/^#\s*DEFI_RWA_CONTRACT_ID=.*/DEFI_RWA_CONTRACT_ID=${DEFI_ID}/" "$ENV_FILE" > "$ENV_FILE".tmp || true
    if [ -f "$ENV_FILE".tmp ]; then mv "$ENV_FILE".tmp "$ENV_FILE"; fi
    echo "Updated DEFI_RWA_CONTRACT_ID in $ENV_FILE"
  fi
  if [ -n "$ADMIN_PUB" ]; then
    sed -E "s/^STELLAR_ADMIN_PUBLIC_KEY=.*/STELLAR_ADMIN_PUBLIC_KEY=${ADMIN_PUB//\//\/}/" "$ENV_FILE" > "$ENV_FILE".tmp || true
    if [ -f "$ENV_FILE".tmp ]; then mv "$ENV_FILE".tmp "$ENV_FILE"; fi
    echo "Updated STELLAR_ADMIN_PUBLIC_KEY in $ENV_FILE"
  fi
  if [ -n "$ADMIN_SEC" ]; then
    sed -E "s/^STELLAR_ADMIN_SECRET=.*/STELLAR_ADMIN_SECRET=${ADMIN_SEC//\//\/}/" "$ENV_FILE" > "$ENV_FILE".tmp || true
    if [ -f "$ENV_FILE".tmp ]; then mv "$ENV_FILE".tmp "$ENV_FILE"; fi
    echo "Updated STELLAR_ADMIN_SECRET in $ENV_FILE (backup at $ENV_FILE.bak)"
  fi
else
  echo "No env example found at $ENV_FILE; skipping" >&2
fi

echo "Done. Review changes before committing."
