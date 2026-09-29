#!/bin/bash
#
# Mainnet preflight check for the pilot contract set.
#
# Part 1: environment (passphrase, URLs, SSL, secrets)
# Part 2: on-chain state via Soroban RPC getLedgerEntries
#
# Usage:
#   ./scripts/mainnet-preflight.sh                  # full check
#   ./scripts/mainnet-preflight.sh --env-only       # env check only (CI)
#
# Required env vars for the on-chain check:
#   PILOT_WHITELIST_ID      deployed whitelist contract ID
#   PILOT_INCOME_TOKEN_ID   deployed income token contract ID
#   PILOT_PAYOUT_SPLIT_ID   deployed payout-split contract ID
#   MANIFEST_ADMIN          expected admin public key
#   MANIFEST_OPERATOR       expected operator public key
#   MANIFEST_ALLY           expected ally public key
#   MANIFEST_FEE_RECIPIENT  expected fee recipient public key
#   MANIFEST_USDC_TOKEN     expected USDC token contract ID
#   MANIFEST_INCOME_TOKEN   expected income token contract ID (for cross-check)
#   MANIFEST_WHITELIST      expected whitelist contract ID (for cross-check)
#   MANIFEST_WASM_WHITELIST sha256 of audited pilot_whitelist.wasm (optional)
#   MANIFEST_WASM_TOKEN     sha256 of audited pilot_income_token.wasm (optional)
#   MANIFEST_WASM_PAYOUT    sha256 of audited pilot_payout_split.wasm (optional)
#
# Optional overrides:
#   PREFLIGHT_NETWORK       stellar network name passed to stellar CLI (default: mainnet)
#   PREFLIGHT_SOURCE_ACCOUNT stellar identity for CLI invocations (default: MANIFEST_ADMIN)
#   STELLAR_RPC_URL         used for direct RPC calls in the storage check

set -uo pipefail

ENV_ONLY=false
if [[ "${1:-}" == "--env-only" ]] || [[ "${PREFLIGHT_ENV_ONLY:-}" == "true" ]]; then
  ENV_ONLY=true
fi

MAINNET_PASSPHRASE="Public Global Stellar Network ; September 2015"
MAINNET_HORIZON="https://horizon.stellar.org"
MAINNET_RPC="https://soroban.stellar.org"

ERRORS=()
fail() { ERRORS+=("FAIL: $1"); }

# PREFLIGHT_SKIP_URL_CHECK=true lets a testnet run skip the URL/passphrase
# assertions so the on-chain storage checks can be exercised against testnet.
SKIP_URL_CHECK="${PREFLIGHT_SKIP_URL_CHECK:-false}"

# ---------------------------------------------------------------------------
# Part 1: Environment
# ---------------------------------------------------------------------------
echo "=== Part 1: Environment ==="

passphrase="${STELLAR_NETWORK_PASSPHRASE:-}"
if [[ "$SKIP_URL_CHECK" == "true" ]]; then
  echo "  --  STELLAR_NETWORK_PASSPHRASE check skipped (PREFLIGHT_SKIP_URL_CHECK=true)"
elif [[ -z "$passphrase" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not set"
elif [[ "$passphrase" != "$MAINNET_PASSPHRASE" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not the mainnet passphrase. Got: '$passphrase'"
else
  echo "  OK  STELLAR_NETWORK_PASSPHRASE = mainnet"
fi

horizon="${STELLAR_HORIZON_URL:-}"
if [[ "$SKIP_URL_CHECK" == "true" ]]; then
  echo "  --  STELLAR_HORIZON_URL check skipped (PREFLIGHT_SKIP_URL_CHECK=true)"
elif [[ -z "$horizon" ]]; then
  fail "STELLAR_HORIZON_URL is not set"
elif [[ "$horizon" != "$MAINNET_HORIZON" ]]; then
  fail "STELLAR_HORIZON_URL does not look like mainnet. Got: '$horizon'"
else
  echo "  OK  STELLAR_HORIZON_URL = mainnet"
fi

rpc="${STELLAR_RPC_URL:-}"
if [[ "$SKIP_URL_CHECK" == "true" ]]; then
  echo "  --  STELLAR_RPC_URL check skipped (PREFLIGHT_SKIP_URL_CHECK=true)"
elif [[ -z "$rpc" ]]; then
  fail "STELLAR_RPC_URL is not set"
elif [[ "$rpc" != "$MAINNET_RPC" ]]; then
  fail "STELLAR_RPC_URL does not look like mainnet. Got: '$rpc'"
else
  echo "  OK  STELLAR_RPC_URL = mainnet"
fi

db_ssl="${DATABASE_SSL:-}"
if [[ "$db_ssl" != "true" ]]; then
  fail "DATABASE_SSL is '$db_ssl' - must be 'true' for production"
else
  echo "  OK  DATABASE_SSL = true"
fi

node_env="${NODE_ENV:-}"
if [[ "$node_env" != "production" ]]; then
  fail "NODE_ENV is '$node_env' - must be 'production'"
else
  echo "  OK  NODE_ENV = production"
fi

jwt_secret="${JWT_SECRET:-}"
if [[ -z "$jwt_secret" ]]; then
  fail "JWT_SECRET is not set"
elif [[ "${#jwt_secret}" -lt 32 ]]; then
  fail "JWT_SECRET is too short (${#jwt_secret} chars, minimum 32)"
elif [[ "$jwt_secret" == *"generate-a-long"* ]] || [[ "$jwt_secret" == *"default"* ]] || [[ "$jwt_secret" == *"secret"*"key"* ]]; then
  fail "JWT_SECRET looks like a placeholder - set a real random value"
else
  echo "  OK  JWT_SECRET is set and non-placeholder"
fi

ops_cred="${OPERATIONS_BACKEND_CREDENTIAL:-}"
if [[ -z "$ops_cred" ]]; then
  fail "OPERATIONS_BACKEND_CREDENTIAL is not set"
elif [[ "$ops_cred" == *"generate-a-long"* ]] || [[ "$ops_cred" == "change-me" ]]; then
  fail "OPERATIONS_BACKEND_CREDENTIAL looks like the example placeholder"
else
  echo "  OK  OPERATIONS_BACKEND_CREDENTIAL is set"
fi

ops_wallets="${OPERATIONS_ALLOWED_WALLETS:-}"
if [[ -z "$ops_wallets" ]]; then
  fail "OPERATIONS_ALLOWED_WALLETS is not set"
elif [[ "$ops_wallets" == *"GXXX"* ]] || [[ "$ops_wallets" == *"GYYY"* ]]; then
  fail "OPERATIONS_ALLOWED_WALLETS contains placeholder addresses (GXXX/GYYY)"
else
  echo "  OK  OPERATIONS_ALLOWED_WALLETS is set"
fi

admin_secret="${STELLAR_ADMIN_SECRET:-}"
if [[ -z "$admin_secret" ]]; then
  fail "STELLAR_ADMIN_SECRET is not set"
elif [[ "${admin_secret:0:1}" != "S" ]] || [[ "${#admin_secret}" -ne 56 ]]; then
  fail "STELLAR_ADMIN_SECRET does not look like a Stellar secret key (must start with S, 56 chars)"
elif [[ "$admin_secret" == "SXXX"* ]]; then
  fail "STELLAR_ADMIN_SECRET is the example placeholder"
else
  echo "  OK  STELLAR_ADMIN_SECRET is set (not echoed)"
fi

# ---------------------------------------------------------------------------
# Part 2: On-chain state
# ---------------------------------------------------------------------------
if [[ "$ENV_ONLY" == "true" ]]; then
  echo ""
  echo "=== Part 2: On-chain check SKIPPED (--env-only mode) ==="
else
  echo ""
  echo "=== Part 2: On-chain state ==="

  if ! command -v stellar &>/dev/null; then
    fail "stellar CLI not found"
  elif ! command -v curl &>/dev/null; then
    fail "curl not found"
  else
    whitelist_id="${PILOT_WHITELIST_ID:-}"
    token_id="${PILOT_INCOME_TOKEN_ID:-}"
    payout_id="${PILOT_PAYOUT_SPLIT_ID:-}"
    manifest_admin="${MANIFEST_ADMIN:-}"
    manifest_operator="${MANIFEST_OPERATOR:-}"
    manifest_ally="${MANIFEST_ALLY:-}"
    manifest_fee="${MANIFEST_FEE_RECIPIENT:-}"
    manifest_usdc="${MANIFEST_USDC_TOKEN:-}"
    manifest_income_token="${MANIFEST_INCOME_TOKEN:-}"
    manifest_whitelist="${MANIFEST_WHITELIST:-}"
    manifest_wasm_whitelist="${MANIFEST_WASM_WHITELIST:-}"
    manifest_wasm_token="${MANIFEST_WASM_TOKEN:-}"
    manifest_wasm_payout="${MANIFEST_WASM_PAYOUT:-}"

    for var in whitelist_id token_id payout_id manifest_admin manifest_operator manifest_ally manifest_fee; do
      if [[ -z "${!var}" ]]; then
        fail "${var^^} manifest variable is not set"
      fi
    done

    # operator and ally must be distinct keys
    if [[ -n "$manifest_operator" ]] && [[ -n "$manifest_ally" ]]; then
      if [[ "$manifest_operator" == "$manifest_ally" ]]; then
        fail "MANIFEST_OPERATOR and MANIFEST_ALLY are the same address - they must be distinct keys"
      else
        echo "  OK  operator != ally"
      fi
    fi

    NETWORK="${PREFLIGHT_NETWORK:-mainnet}"
    RPC_URL="${STELLAR_RPC_URL:-$MAINNET_RPC}"

    # Read the full instance storage map for a contract via getLedgerEntries RPC.
    # Returns the decoded JSON of the storage array, or empty string on failure.
    read_storage() {
      local contract_id="$1"
      local key_xdr
      key_xdr=$(printf '{"contract_data":{"contract":"%s","key":"ledger_key_contract_instance","durability":"persistent"}}' \
        "$contract_id" | stellar xdr encode --type LedgerKey 2>/dev/null) || return 1

      local response
      response=$(curl -sf --max-time 15 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getLedgerEntries\",\"params\":{\"keys\":[\"$key_xdr\"]}}" \
        "$RPC_URL" 2>/dev/null) || return 1

      local xdr
      xdr=$(echo "$response" | python3 -c \
        "import sys,json; e=json.load(sys.stdin).get('result',{}).get('entries',[]); print(e[0]['xdr'] if e else '')" \
        2>/dev/null) || return 1

      [[ -z "$xdr" ]] && return 1

      echo "$xdr" | stellar xdr decode --type LedgerEntryData 2>/dev/null
    }

    # Extract a value from the storage JSON by symbol key name.
    # Input is the full LedgerEntryData JSON; output is the raw value string.
    storage_get() {
      local json="$1"
      local key="$2"
      echo "$json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
storage = data.get('contract_data',{}).get('val',{}).get('contract_instance',{}).get('storage') or []
for entry in storage:
    sym = (entry.get('key') or {}).get('vec') or []
    if sym and sym[0].get('symbol') == '$key':
        val = entry.get('val', {})
        # address, string, bool, u32, i128
        for t in ('address','string','bool','u32','i128'):
            if t in val:
                print(val[t])
                sys.exit(0)
" 2>/dev/null
    }

    check_address() {
      local label="$1"
      local actual="$2"
      local expected="$3"
      if [[ -z "$expected" ]]; then
        echo "  --  $label not in manifest (skipping)"
      elif [[ -z "$actual" ]]; then
        fail "$label not found in contract storage"
      elif [[ "$actual" != "$expected" ]]; then
        fail "$label mismatch. Got: $actual  Expected: $expected"
      else
        echo "  OK  $label = $expected"
      fi
    }

    # --- whitelist contract ---
    echo "  Reading whitelist storage..."
    wl_json="$(read_storage "$whitelist_id" 2>/dev/null || true)"
    if [[ -z "$wl_json" ]]; then
      fail "whitelist: getLedgerEntries returned no entry - contract may not be initialized"
    else
      wl_admin="$(storage_get "$wl_json" "Admin")"
      check_address "whitelist.Admin" "$wl_admin" "$manifest_admin"
    fi

    # --- income token contract ---
    echo "  Reading income_token storage..."
    tok_json="$(read_storage "$token_id" 2>/dev/null || true)"
    if [[ -z "$tok_json" ]]; then
      fail "income_token: getLedgerEntries returned no entry - contract may not be initialized"
    else
      tok_admin="$(storage_get "$tok_json" "Admin")"
      tok_whitelist="$(storage_get "$tok_json" "Whitelist")"
      check_address "income_token.Admin" "$tok_admin" "$manifest_admin"
      check_address "income_token.Whitelist" "$tok_whitelist" "$manifest_whitelist"
    fi

    # --- payout-split contract ---
    echo "  Reading payout_split storage..."
    pay_json="$(read_storage "$payout_id" 2>/dev/null || true)"
    if [[ -z "$pay_json" ]]; then
      fail "payout_split: getLedgerEntries returned no entry - contract not initialized"
    else
      pay_admin="$(storage_get "$pay_json" "Admin")"
      pay_operator="$(storage_get "$pay_json" "Operator")"
      pay_ally="$(storage_get "$pay_json" "Ally")"
      pay_fee="$(storage_get "$pay_json" "PlatformFeeRecipient")"
      pay_usdc="$(storage_get "$pay_json" "UsdcToken")"
      pay_income="$(storage_get "$pay_json" "IncomeToken")"
      pay_whitelist="$(storage_get "$pay_json" "Whitelist")"

      check_address "payout.Admin"              "$pay_admin"    "$manifest_admin"
      check_address "payout.Operator"           "$pay_operator" "$manifest_operator"
      check_address "payout.Ally"               "$pay_ally"     "$manifest_ally"
      check_address "payout.PlatformFeeRecipient" "$pay_fee"    "$manifest_fee"
      check_address "payout.UsdcToken"          "$pay_usdc"     "$manifest_usdc"
      check_address "payout.IncomeToken"        "$pay_income"   "$manifest_income_token"
      check_address "payout.Whitelist"          "$pay_whitelist" "$manifest_whitelist"

      # operator and ally must differ in actual storage too
      if [[ -n "$pay_operator" ]] && [[ -n "$pay_ally" ]] && [[ "$pay_operator" == "$pay_ally" ]]; then
        fail "payout.Operator == payout.Ally in contract storage - SignerCollision"
      fi
    fi

    # --- WASM hash checks (optional) ---
    check_wasm_hash() {
      local label="$1" wasm_file="$2" expected="$3"
      [[ -z "$expected" ]] && { echo "  --  $label WASM hash not in manifest (skipping)"; return; }
      if [[ ! -f "$wasm_file" ]]; then
        fail "$label WASM not found at $wasm_file - run: cd apps/contracts && stellar contract build"
        return
      fi
      local actual
      actual="$(sha256sum "$wasm_file" | awk '{print $1}')"
      if [[ "$actual" != "$expected" ]]; then
        fail "$label WASM hash mismatch. Got: $actual  Expected: $expected"
      else
        echo "  OK  $label WASM hash matches manifest"
      fi
    }

    WASM_DIR="apps/contracts/target/wasm32v1-none/release"
    check_wasm_hash "pilot_whitelist"    "$WASM_DIR/pilot_whitelist.wasm"    "$manifest_wasm_whitelist"
    check_wasm_hash "pilot_income_token" "$WASM_DIR/pilot_income_token.wasm" "$manifest_wasm_token"
    check_wasm_hash "pilot_payout_split" "$WASM_DIR/pilot_payout_split.wasm" "$manifest_wasm_payout"
  fi
fi

# ---------------------------------------------------------------------------
echo ""
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "=== PREFLIGHT PASSED ==="
  exit 0
else
  echo "=== PREFLIGHT FAILED ==="
  for err in "${ERRORS[@]}"; do echo "  $err"; done
  exit 1
fi
