#!/bin/bash
#
# Tests for mainnet-preflight.sh --env-only mode.
#
# Verifies that each documented failure case produces a non-zero exit and a
# precise error message, and that a correct configuration passes.
#
# Usage:
#   ./scripts/test-mainnet-preflight.sh
#
# Runs entirely offline - no network access, no Stellar CLI required.

set -uo pipefail

SCRIPT="$(dirname "${BASH_SOURCE[0]}")/mainnet-preflight.sh"
PASS=0
FAIL=0

# Base environment that satisfies every env check.
# Individual tests override one variable at a time to trigger a specific failure.
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

run() {
  local desc="$1"
  shift
  env -i "${BASE_ENV[@]}" "$@" bash "$SCRIPT" --env-only 2>&1
}

assert_fails() {
  local desc="$1"
  local expected_fragment="$2"
  shift 2
  output="$(run "$desc" "$@")"
  exit_code=$?
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
  output="$(run "$desc" "$@")"
  exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo "FAIL [$desc]: expected exit 0, got $exit_code"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  else
    echo "PASS [$desc]"
    PASS=$((PASS + 1))
  fi
}

echo "=== Running preflight unit tests ==="
echo ""

# --- Failure cases ---

assert_fails \
  "testnet passphrase rejected" \
  "not the mainnet passphrase" \
  STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

assert_fails \
  "testnet Horizon URL rejected" \
  "does not look like mainnet" \
  STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"

assert_fails \
  "testnet RPC URL rejected" \
  "does not look like mainnet" \
  STELLAR_RPC_URL="https://soroban-testnet.stellar.org"

assert_fails \
  "DATABASE_SSL=false rejected" \
  "DATABASE_SSL is 'false'" \
  DATABASE_SSL="false"

assert_fails \
  "DATABASE_SSL unset rejected" \
  "DATABASE_SSL is ''" \
  DATABASE_SSL=""

assert_fails \
  "NODE_ENV=development rejected" \
  "NODE_ENV is 'development'" \
  NODE_ENV="development"

assert_fails \
  "JWT_SECRET unset rejected" \
  "JWT_SECRET is not set" \
  JWT_SECRET=""

assert_fails \
  "JWT_SECRET too short rejected" \
  "JWT_SECRET is too short" \
  JWT_SECRET="tooshort"

assert_fails \
  "JWT_SECRET placeholder rejected" \
  "JWT_SECRET looks like a placeholder" \
  JWT_SECRET="generate-a-long-random-secret-here"

assert_fails \
  "OPERATIONS_BACKEND_CREDENTIAL placeholder rejected" \
  "looks like the example placeholder" \
  OPERATIONS_BACKEND_CREDENTIAL="generate-a-long-random-secret"

assert_fails \
  "OPERATIONS_ALLOWED_WALLETS unset rejected" \
  "OPERATIONS_ALLOWED_WALLETS is not set" \
  OPERATIONS_ALLOWED_WALLETS=""

assert_fails \
  "OPERATIONS_ALLOWED_WALLETS placeholder rejected" \
  "contains placeholder addresses" \
  OPERATIONS_ALLOWED_WALLETS="GXXX...,GYYY..."

assert_fails \
  "STELLAR_ADMIN_SECRET wrong length rejected" \
  "does not look like a Stellar secret key" \
  STELLAR_ADMIN_SECRET="STOOOSHORT"

assert_fails \
  "STELLAR_ADMIN_SECRET not starting with S rejected" \
  "does not look like a Stellar secret key" \
  STELLAR_ADMIN_SECRET="XCZANGBA5IXFX5QOPEQV5M3Q6JCDIZQKQWVKJ7VG3PWJVS4RWCF6ZABC"

# --- Passing case ---

assert_passes "correct configuration passes"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
