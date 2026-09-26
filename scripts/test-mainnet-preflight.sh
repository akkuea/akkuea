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
# Part B: On-chain checks with stubbed stellar CLI
#
# A temp dir is prepended to PATH containing a fake 'stellar' binary.
# Each test rewrites the stub to control which responses the script sees.
# ---------------------------------------------------------------------------
echo ""
echo "=== Part B: On-chain checks (stubbed stellar CLI) ==="
echo ""

STUB_DIR="$(mktemp -d)"
WASM_DIR="$REPO_ROOT/apps/contracts/target/wasm32v1-none/release"
mkdir -p "$WASM_DIR"
trap 'rm -rf "$STUB_DIR"; rm -f "$WASM_DIR/pilot_whitelist.wasm" "$WASM_DIR/pilot_income_token.wasm" "$WASM_DIR/pilot_payout_split.wasm"' EXIT

# On-chain env vars (network/source are consumed by the stub, not a real CLI)
ONCHAIN_ENV=(
  "${BASE_ENV[@]}"
  PILOT_WHITELIST_ID="CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4"
  PILOT_INCOME_TOKEN_ID="CDQYJRBYP62Y2BSMDEUBJYM2I4V3JE2RL7TCR3JPTW42NRLUXWKUS3MZ"
  PILOT_PAYOUT_SPLIT_ID="CBGDO2GUWYSDU4SK3SNJJHYX6HRADUNXCU7TKJFFGLRWA4FSRZNLAJ4J"
  MANIFEST_ADMIN="$GOOD_ADMIN"
  PREFLIGHT_NETWORK="testnet"
  PREFLIGHT_SOURCE_ACCOUNT="preflight-reader"
)

# Write the stub: admin returns GOOD_ADMIN, is_paused returns false, eurc status stubbed
write_stub() {
  local admin_response="${1:-$GOOD_ADMIN}"
  local is_paused_response="${2:-false}"
  cat > "$STUB_DIR/stellar" << STUBEOF
#!/bin/bash
args="\$*"
if [[ "\$args" == *"-- admin"* ]]; then
  echo '"$admin_response"'
elif [[ "\$args" == *"-- name"* ]]; then
  echo '"Akkuea Pilot Income Participation"'
elif [[ "\$args" == *"-- is_paused"* ]]; then
  echo "$is_paused_response"
elif [[ "\$args" == *"eurc_swap_path_status"* ]]; then
  echo '"stubbed-fast-follow"'
fi
STUBEOF
  # Substitute the actual values (avoid eval by using sed on the literal placeholders)
  sed -i.bak \
    -e "s|\\\$admin_response|${admin_response}|g" \
    -e "s|\\\$is_paused_response|${is_paused_response}|g" \
    "$STUB_DIR/stellar"
  chmod +x "$STUB_DIR/stellar"
}

# Test 1: admin address mismatch
write_stub "$GOOD_ADMIN" "false"
assert_fails "manifest admin mismatch detected" "whitelist.admin()" \
  env -i PATH="$STUB_DIR:/usr/bin:/bin:/usr/local/bin" \
    "${ONCHAIN_ENV[@]}" \
    MANIFEST_ADMIN="GWRONG00000000000000000000000000000000000000000000000000000" \
    bash "$SCRIPT"

# Test 2: payout contract is paused
write_stub "$GOOD_ADMIN" "true"
assert_fails "paused payout detected" "is_paused() = true" \
  env -i PATH="$STUB_DIR:/usr/bin:/bin:/usr/local/bin" \
    "${ONCHAIN_ENV[@]}" \
    bash "$SCRIPT"

# Test 3: WASM hash mismatch - create a fake wasm at the expected path
write_stub "$GOOD_ADMIN" "false"
echo "fake wasm content for testing" > "$WASM_DIR/pilot_whitelist.wasm"
assert_fails "WASM hash mismatch detected" "WASM hash mismatch" \
  env -i PATH="$STUB_DIR:/usr/bin:/bin:/usr/local/bin" \
    "${ONCHAIN_ENV[@]}" \
    MANIFEST_WASM_WHITELIST="0000000000000000000000000000000000000000000000000000000000000000" \
    bash "$SCRIPT"
rm -f "$WASM_DIR/pilot_whitelist.wasm"

# Test 4: WASM file missing when hash is required
write_stub "$GOOD_ADMIN" "false"
assert_fails "missing WASM file detected" "WASM not found" \
  env -i PATH="$STUB_DIR:/usr/bin:/bin:/usr/local/bin" \
    "${ONCHAIN_ENV[@]}" \
    MANIFEST_WASM_WHITELIST="0000000000000000000000000000000000000000000000000000000000000000" \
    bash "$SCRIPT"

# Test 5: clean on-chain pass (no WASM hashes in manifest, so WASM check is skipped)
write_stub "$GOOD_ADMIN" "false"
assert_passes "correct on-chain configuration passes" \
  env -i PATH="$STUB_DIR:/usr/bin:/bin:/usr/local/bin" \
    "${ONCHAIN_ENV[@]}" \
    bash "$SCRIPT"

# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
