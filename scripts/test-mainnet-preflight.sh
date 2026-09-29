#!/bin/bash
#
# Tests for scripts/mainnet-preflight.sh.
#
# Part A: env-only checks (15 cases, fully offline).
# Part B: on-chain checks with a stubbed stellar CLI (5 cases, offline).
#
# Usage:
#   ./scripts/test-mainnet-preflight.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/mainnet-preflight.sh"
PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

assert_fails() {
  local desc="$1"
  local expected_fragment="$2"
  shift 2
  local output exit_code
  output="$("$@" 2>&1)" && exit_code=0 || exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    echo "FAIL [$desc]: expected non-zero exit, got 0"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  elif [[ "$output" != *"$expected_fragment"* ]]; then
    echo "FAIL [$desc]: expected '$expected_fragment' in output"
    echo "  Got: $output"
    FAIL=$((FAIL + 1))
  else
    echo "PASS [$desc]"
    PASS=$((PASS + 1))
  fi
}

assert_passes() {
  local desc="$1"
  shift
  local output exit_code
  output="$("$@" 2>&1)" && exit_code=0 || exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo "FAIL [$desc]: expected exit 0, got $exit_code"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  else
    echo "PASS [$desc]"
    PASS=$((PASS + 1))
  fi
}

GOOD_ADMIN="GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY"

BASE_ENV=(
  STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
  STELLAR_HORIZON_URL="https://horizon.stellar.org"
  STELLAR_RPC_URL="https://soroban.stellar.org"
  DATABASE_SSL="true"
  NODE_ENV="production"
  JWT_SECRET="a-valid-random-secret-of-at-least-32-characters"
  OPERATIONS_BACKEND_CREDENTIAL="a-real-credential-value-not-a-placeholder"
  OPERATIONS_ALLOWED_WALLETS="GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBWN9YKTNFGNQ45UCXJ5CA"
  STELLAR_ADMIN_SECRET="SCZANGBA5IXFX5QOPEQV5M3Q6JCDIZQKQWVKJ7VG3PWJVS4RWCF6ZABC"
)

# ---------------------------------------------------------------------------
# Part A: Environment checks
# ---------------------------------------------------------------------------
echo "=== Part A: Environment checks ==="
echo ""

assert_fails "testnet passphrase rejected" "not the mainnet passphrase" \
  env -i "${BASE_ENV[@]}" \
    STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
    bash "$SCRIPT" --env-only

assert_fails "testnet Horizon URL rejected" "does not look like mainnet" \
  env -i "${BASE_ENV[@]}" \
    STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org" \
    bash "$SCRIPT" --env-only

assert_fails "testnet RPC URL rejected" "does not look like mainnet" \
  env -i "${BASE_ENV[@]}" \
    STELLAR_RPC_URL="https://soroban-testnet.stellar.org" \
    bash "$SCRIPT" --env-only

assert_fails "DATABASE_SSL=false rejected" "DATABASE_SSL is 'false'" \
  env -i "${BASE_ENV[@]}" DATABASE_SSL="false" bash "$SCRIPT" --env-only

assert_fails "DATABASE_SSL unset rejected" "DATABASE_SSL is ''" \
  env -i "${BASE_ENV[@]}" DATABASE_SSL="" bash "$SCRIPT" --env-only

assert_fails "NODE_ENV=development rejected" "NODE_ENV is 'development'" \
  env -i "${BASE_ENV[@]}" NODE_ENV="development" bash "$SCRIPT" --env-only

assert_fails "JWT_SECRET unset rejected" "JWT_SECRET is not set" \
  env -i "${BASE_ENV[@]}" JWT_SECRET="" bash "$SCRIPT" --env-only

assert_fails "JWT_SECRET too short rejected" "JWT_SECRET is too short" \
  env -i "${BASE_ENV[@]}" JWT_SECRET="tooshort" bash "$SCRIPT" --env-only

assert_fails "JWT_SECRET placeholder rejected" "JWT_SECRET looks like a placeholder" \
  env -i "${BASE_ENV[@]}" JWT_SECRET="generate-a-long-random-secret-here" bash "$SCRIPT" --env-only

assert_fails "OPERATIONS_BACKEND_CREDENTIAL placeholder rejected" "looks like the example placeholder" \
  env -i "${BASE_ENV[@]}" OPERATIONS_BACKEND_CREDENTIAL="generate-a-long-random-secret" \
    bash "$SCRIPT" --env-only

assert_fails "OPERATIONS_ALLOWED_WALLETS unset rejected" "OPERATIONS_ALLOWED_WALLETS is not set" \
  env -i "${BASE_ENV[@]}" OPERATIONS_ALLOWED_WALLETS="" bash "$SCRIPT" --env-only

assert_fails "OPERATIONS_ALLOWED_WALLETS placeholder rejected" "contains placeholder addresses" \
  env -i "${BASE_ENV[@]}" OPERATIONS_ALLOWED_WALLETS="GXXX...,GYYY..." bash "$SCRIPT" --env-only

assert_fails "STELLAR_ADMIN_SECRET wrong length rejected" "does not look like a Stellar secret key" \
  env -i "${BASE_ENV[@]}" STELLAR_ADMIN_SECRET="STOOOSHORT" bash "$SCRIPT" --env-only

assert_fails "STELLAR_ADMIN_SECRET not starting with S rejected" "does not look like a Stellar secret key" \
  env -i "${BASE_ENV[@]}" \
    STELLAR_ADMIN_SECRET="XCZANGBA5IXFX5QOPEQV5M3Q6JCDIZQKQWVKJ7VG3PWJVS4RWCF6ZABC" \
    bash "$SCRIPT" --env-only

assert_passes "correct env configuration passes" \
  env -i "${BASE_ENV[@]}" bash "$SCRIPT" --env-only

# ---------------------------------------------------------------------------
# Part B: On-chain checks with stubbed curl + stellar xdr tools
#
# The preflight reads contract storage via:
#   1. stellar xdr encode (build LedgerKey)
#   2. curl (getLedgerEntries RPC)
#   3. stellar xdr decode (parse response)
#
# We stub curl to return controlled JSON and let the real stellar xdr
# encode/decode run (they are pure local tools, no network needed).
# For the storage content, we pre-build valid XDR using the real tools.
# ---------------------------------------------------------------------------
echo ""
echo "=== Part B: On-chain checks (stubbed curl + real stellar xdr) ==="
echo ""

STUB_DIR="$(mktemp -d)"
WASM_DIR="$REPO_ROOT/apps/contracts/target/wasm32v1-none/release"
mkdir -p "$WASM_DIR"
trap 'rm -rf "$STUB_DIR"; rm -f "$WASM_DIR/pilot_whitelist.wasm"' EXIT

# Include the real stellar binary location so xdr encode/decode work in tests
STELLAR_BIN="$(dirname "$(command -v stellar 2>/dev/null || echo /opt/homebrew/bin/stellar)")"
BASE_PATH="$STUB_DIR:$STELLAR_BIN:/usr/local/bin:/usr/bin:/bin"

WHITELIST_ID="CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4"
TOKEN_ID="CDQYJRBYP62Y2BSMDEUBJYM2I4V3JE2RL7TCR3JPTW42NRLUXWKUS3MZ"
PAYOUT_ID="CBGDO2GUWYSDU4SK3SNJJHYX6HRADUNXCU7TKJFFGLRWA4FSRZNLAJ4J"
OPERATOR_ADDR="GOPERATOR0000000000000000000000000000000000000000000000000"
ALLY_ADDR="GALLY000000000000000000000000000000000000000000000000000000"
FEE_ADDR="$GOOD_ADMIN"
USDC_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

# Build the storage XDR for a contract that has given key=address entries.
build_storage_xdr() {
  local contract_id="$1"
  local entries_json="$2"
  # wasm field requires exactly 32 bytes = 64 hex chars
  printf '{"contract_data":{"ext":"v0","contract":"%s","key":"ledger_key_contract_instance","durability":"persistent","val":{"contract_instance":{"executable":{"wasm":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"storage":%s}}}}' \
    "$contract_id" "$entries_json" \
    | stellar xdr encode --type LedgerEntryData 2>/dev/null || echo ""
}

# Build the storage for whitelist: Admin only
WL_ENTRIES='[{"key":{"vec":[{"symbol":"Admin"}]},"val":{"address":"'"$GOOD_ADMIN"'"}}]'
WL_XDR=$(build_storage_xdr "$WHITELIST_ID" "$WL_ENTRIES")

# Build storage for income token
TOK_ENTRIES='[{"key":{"vec":[{"symbol":"Admin"}]},"val":{"address":"'"$GOOD_ADMIN"'"}},{"key":{"vec":[{"symbol":"Whitelist"}]},"val":{"address":"'"$WHITELIST_ID"'"}}]'
TOK_XDR=$(build_storage_xdr "$TOKEN_ID" "$TOK_ENTRIES")

# Build storage for payout split (full set) - must be on one line for printf
PAY_ENTRIES='[{"key":{"vec":[{"symbol":"Admin"}]},"val":{"address":"'"$GOOD_ADMIN"'"}},{"key":{"vec":[{"symbol":"Operator"}]},"val":{"address":"'"$OPERATOR_ADDR"'"}},{"key":{"vec":[{"symbol":"Ally"}]},"val":{"address":"'"$ALLY_ADDR"'"}},{"key":{"vec":[{"symbol":"PlatformFeeRecipient"}]},"val":{"address":"'"$FEE_ADDR"'"}},{"key":{"vec":[{"symbol":"UsdcToken"}]},"val":{"address":"'"$USDC_ID"'"}},{"key":{"vec":[{"symbol":"IncomeToken"}]},"val":{"address":"'"$TOKEN_ID"'"}},{"key":{"vec":[{"symbol":"Whitelist"}]},"val":{"address":"'"$WHITELIST_ID"'"}}]'
PAY_XDR=$(build_storage_xdr "$PAYOUT_ID" "$PAY_ENTRIES")

# Write a curl stub that returns the correct XDR based on which contract is queried.
# The preflight encodes the contract ID into the request body key.
write_curl_stub() {
  local wl_xdr="$1" tok_xdr="$2" pay_xdr="$3"
  cat > "$STUB_DIR/curl" << STUBEOF
#!/bin/bash
# Read the POST body to figure out which contract is being queried.
body=""
while [[ "\$#" -gt 0 ]]; do
  if [[ "\$1" == "-d" ]]; then body="\$2"; fi
  shift
done

WL_KEY=\$(printf '{"contract_data":{"contract":"$WHITELIST_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')
TOK_KEY=\$(printf '{"contract_data":{"contract":"$TOKEN_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')
PAY_KEY=\$(printf '{"contract_data":{"contract":"$PAYOUT_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')

if echo "\$body" | grep -q "\$WL_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[{"xdr":"$wl_xdr"}]}}'
elif echo "\$body" | grep -q "\$TOK_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[{"xdr":"$tok_xdr"}]}}'
elif echo "\$body" | grep -q "\$PAY_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[{"xdr":"$pay_xdr"}]}}'
else
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[]}}'
fi
STUBEOF
  sed -i.bak \
    -e "s|\\\$wl_xdr|${wl_xdr}|g" \
    -e "s|\\\$tok_xdr|${tok_xdr}|g" \
    -e "s|\\\$pay_xdr|${pay_xdr}|g" \
    "$STUB_DIR/curl"
  chmod +x "$STUB_DIR/curl"
}

# Good manifests that match the storage we built
ONCHAIN_ENV=(
  "${BASE_ENV[@]}"
  PREFLIGHT_SKIP_URL_CHECK=true
  STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
  PILOT_WHITELIST_ID="$WHITELIST_ID"
  PILOT_INCOME_TOKEN_ID="$TOKEN_ID"
  PILOT_PAYOUT_SPLIT_ID="$PAYOUT_ID"
  MANIFEST_ADMIN="$GOOD_ADMIN"
  MANIFEST_OPERATOR="$OPERATOR_ADDR"
  MANIFEST_ALLY="$ALLY_ADDR"
  MANIFEST_FEE_RECIPIENT="$FEE_ADDR"
  MANIFEST_USDC_TOKEN="$USDC_ID"
  MANIFEST_INCOME_TOKEN="$TOKEN_ID"
  MANIFEST_WHITELIST="$WHITELIST_ID"
)

# Build XDR only if stellar xdr encode works (skip Part B if tools missing)
if [[ -z "$WL_XDR" ]] || [[ -z "$TOK_XDR" ]] || [[ -z "$PAY_XDR" ]]; then
  echo "SKIP: stellar xdr encode not available - skipping Part B"
else
  write_curl_stub "$WL_XDR" "$TOK_XDR" "$PAY_XDR"

  # Test 1: operator == ally rejected at manifest level (before any RPC call)
  assert_fails "operator=ally rejected at manifest check" \
    "MANIFEST_OPERATOR and MANIFEST_ALLY are the same address" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      MANIFEST_OPERATOR="$GOOD_ADMIN" \
      MANIFEST_ALLY="$GOOD_ADMIN" \
      bash "$SCRIPT"

  # Test 1b: operator == ally caught via on-chain storage read
  # Manifest says they differ, but the contract was initialized with the same
  # key for both — simulate a deployment error that the manifest doesn't catch.
  COLLISION_ADDR="$GOOD_ADMIN"
  PAY_COLLISION_ENTRIES='[{"key":{"vec":[{"symbol":"Admin"}]},"val":{"address":"'"$GOOD_ADMIN"'"}},{"key":{"vec":[{"symbol":"Operator"}]},"val":{"address":"'"$COLLISION_ADDR"'"}},{"key":{"vec":[{"symbol":"Ally"}]},"val":{"address":"'"$COLLISION_ADDR"'"}},{"key":{"vec":[{"symbol":"PlatformFeeRecipient"}]},"val":{"address":"'"$FEE_ADDR"'"}},{"key":{"vec":[{"symbol":"UsdcToken"}]},"val":{"address":"'"$USDC_ID"'"}},{"key":{"vec":[{"symbol":"IncomeToken"}]},"val":{"address":"'"$TOKEN_ID"'"}},{"key":{"vec":[{"symbol":"Whitelist"}]},"val":{"address":"'"$WHITELIST_ID"'"}}]'
  PAY_COLLISION_XDR=$(build_storage_xdr "$PAYOUT_ID" "$PAY_COLLISION_ENTRIES")
  if [[ -n "$PAY_COLLISION_XDR" ]]; then
    write_curl_stub "$WL_XDR" "$TOK_XDR" "$PAY_COLLISION_XDR"
    # Manifest has distinct operator/ally (passes the pre-RPC manifest check),
    # but the contract storage itself has operator == ally.
    assert_fails "operator=ally collision detected in on-chain storage" \
      "payout.Operator == payout.Ally in contract storage - SignerCollision" \
      env -i PATH="$BASE_PATH" \
        "${ONCHAIN_ENV[@]}" \
        MANIFEST_OPERATOR="$OPERATOR_ADDR" \
        MANIFEST_ALLY="$ALLY_ADDR" \
        bash "$SCRIPT"
    write_curl_stub "$WL_XDR" "$TOK_XDR" "$PAY_XDR"
  else
    echo "SKIP [operator=ally collision in storage]: could not build collision XDR"
  fi

  # Test 2: admin mismatch detected via storage read
  assert_fails "admin mismatch detected via storage" \
    "whitelist.Admin mismatch" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      MANIFEST_ADMIN="GWRONG00000000000000000000000000000000000000000000000000000" \
      bash "$SCRIPT"

  # Test 3: uninitialized payout (curl returns no entries)
  # Write a stub where payout returns empty entries
  cat > "$STUB_DIR/curl" << STUB2EOF
#!/bin/bash
body=""
while [[ "\$#" -gt 0 ]]; do
  if [[ "\$1" == "-d" ]]; then body="\$2"; fi
  shift
done
PAY_KEY=\$(printf '{"contract_data":{"contract":"$PAYOUT_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')
WL_KEY=\$(printf '{"contract_data":{"contract":"$WHITELIST_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')
TOK_KEY=\$(printf '{"contract_data":{"contract":"$TOKEN_ID","key":"ledger_key_contract_instance","durability":"persistent"}}' | stellar xdr encode --type LedgerKey 2>/dev/null | tr -d '[:space:]')
if echo "\$body" | grep -q "\$PAY_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[]}}'
elif echo "\$body" | grep -q "\$WL_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[{"xdr":"$WL_XDR"}]}}'
elif echo "\$body" | grep -q "\$TOK_KEY"; then
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[{"xdr":"$TOK_XDR"}]}}'
else
  echo '{"jsonrpc":"2.0","id":1,"result":{"entries":[]}}'
fi
STUB2EOF
  sed -i.bak \
    -e "s|\\\$WL_XDR|${WL_XDR}|g" \
    -e "s|\\\$TOK_XDR|${TOK_XDR}|g" \
    "$STUB_DIR/curl"
  chmod +x "$STUB_DIR/curl"

  assert_fails "uninitialized payout detected" \
    "payout_split: getLedgerEntries returned no entry" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      bash "$SCRIPT"

  # Restore good curl stub
  write_curl_stub "$WL_XDR" "$TOK_XDR" "$PAY_XDR"

  # Test 4: WASM hash mismatch
  echo "fake wasm content" > "$WASM_DIR/pilot_whitelist.wasm"
  assert_fails "WASM hash mismatch detected" "WASM hash mismatch" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      MANIFEST_WASM_WHITELIST="0000000000000000000000000000000000000000000000000000000000000000" \
      bash "$SCRIPT"
  rm -f "$WASM_DIR/pilot_whitelist.wasm"

  # Test 5: missing WASM file
  assert_fails "missing WASM file detected" "WASM not found" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      MANIFEST_WASM_WHITELIST="0000000000000000000000000000000000000000000000000000000000000000" \
      bash "$SCRIPT"

  # Test 6: clean pass
  assert_passes "correct on-chain configuration passes" \
    env -i PATH="$BASE_PATH" \
      "${ONCHAIN_ENV[@]}" \
      bash "$SCRIPT"
fi

# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
