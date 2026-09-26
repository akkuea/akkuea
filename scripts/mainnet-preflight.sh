#!/bin/bash
#
# Mainnet preflight check for the pilot contract set.
#
# Runs two independent checks and exits non-zero with a precise report if
# anything is wrong. Nothing is modified; this script is read-only.
#
# Usage:
#   ./scripts/mainnet-preflight.sh                  # full check (requires stellar CLI + network)
#   ./scripts/mainnet-preflight.sh --env-only       # environment check only (CI dry-run mode)
#
# Required env vars for the on-chain check:
#   PILOT_WHITELIST_ID       deployed whitelist contract ID
#   PILOT_INCOME_TOKEN_ID    deployed income token contract ID
#   PILOT_PAYOUT_SPLIT_ID    deployed payout-split contract ID
#   MANIFEST_ADMIN           expected admin public key
#   MANIFEST_OPERATOR        expected operator public key
#   MANIFEST_ALLY            expected ally public key
#   MANIFEST_FEE_RECIPIENT   expected fee recipient public key
#   MANIFEST_USDC_TOKEN      expected USDC token contract ID
#   MANIFEST_EURC_TOKEN      expected EURC token contract ID
#   MANIFEST_SWAP_ROUTER     expected Soroswap router contract ID
#   MANIFEST_WASM_WHITELIST  sha256 of the audited pilot_whitelist.wasm
#   MANIFEST_WASM_TOKEN      sha256 of the audited pilot_income_token.wasm
#   MANIFEST_WASM_PAYOUT     sha256 of the audited pilot_payout_split.wasm
#
# In CI, set PREFLIGHT_ENV_ONLY=true or pass --env-only to skip the on-chain part.

set -uo pipefail

ENV_ONLY=false
if [[ "${1:-}" == "--env-only" ]] || [[ "${PREFLIGHT_ENV_ONLY:-}" == "true" ]]; then
  ENV_ONLY=true
fi

MAINNET_PASSPHRASE="Public Global Stellar Network ; September 2015"
MAINNET_HORIZON="https://horizon.stellar.org"
MAINNET_RPC="https://soroban.stellar.org"

ERRORS=()

fail() {
  ERRORS+=("FAIL: $1")
}

# ---------------------------------------------------------------------------
# Part 1: Environment
# ---------------------------------------------------------------------------
echo "=== Part 1: Environment ==="

# Network passphrase must be mainnet
passphrase="${STELLAR_NETWORK_PASSPHRASE:-}"
if [[ -z "$passphrase" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not set"
elif [[ "$passphrase" != "$MAINNET_PASSPHRASE" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not the mainnet passphrase. Got: '$passphrase'"
else
  echo "  OK  STELLAR_NETWORK_PASSPHRASE = mainnet"
fi

# Horizon URL must point to mainnet
horizon="${STELLAR_HORIZON_URL:-}"
if [[ -z "$horizon" ]]; then
  fail "STELLAR_HORIZON_URL is not set"
elif [[ "$horizon" != "$MAINNET_HORIZON" ]]; then
  fail "STELLAR_HORIZON_URL does not look like mainnet. Got: '$horizon' (expected $MAINNET_HORIZON)"
else
  echo "  OK  STELLAR_HORIZON_URL = mainnet"
fi

# RPC URL must point to mainnet
rpc="${STELLAR_RPC_URL:-}"
if [[ -z "$rpc" ]]; then
  fail "STELLAR_RPC_URL is not set"
elif [[ "$rpc" != "$MAINNET_RPC" ]]; then
  fail "STELLAR_RPC_URL does not look like mainnet. Got: '$rpc' (expected $MAINNET_RPC)"
else
  echo "  OK  STELLAR_RPC_URL = mainnet"
fi

# DATABASE_SSL must be true
db_ssl="${DATABASE_SSL:-}"
if [[ "$db_ssl" != "true" ]]; then
  fail "DATABASE_SSL is '$db_ssl' - must be 'true' for production"
else
  echo "  OK  DATABASE_SSL = true"
fi

# NODE_ENV must be production
node_env="${NODE_ENV:-}"
if [[ "$node_env" != "production" ]]; then
  fail "NODE_ENV is '$node_env' - must be 'production'"
else
  echo "  OK  NODE_ENV = production"
fi

# JWT_SECRET must be set and not a placeholder
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

# OPERATIONS_BACKEND_CREDENTIAL must not be a placeholder
ops_cred="${OPERATIONS_BACKEND_CREDENTIAL:-}"
if [[ -z "$ops_cred" ]]; then
  fail "OPERATIONS_BACKEND_CREDENTIAL is not set"
elif [[ "$ops_cred" == *"generate-a-long"* ]] || [[ "$ops_cred" == "change-me" ]]; then
  fail "OPERATIONS_BACKEND_CREDENTIAL looks like the example placeholder - set a real value"
else
  echo "  OK  OPERATIONS_BACKEND_CREDENTIAL is set"
fi

# OPERATIONS_ALLOWED_WALLETS must be set and not contain placeholder keys
ops_wallets="${OPERATIONS_ALLOWED_WALLETS:-}"
if [[ -z "$ops_wallets" ]]; then
  fail "OPERATIONS_ALLOWED_WALLETS is not set - no production admin addresses configured"
elif [[ "$ops_wallets" == *"GXXX"* ]] || [[ "$ops_wallets" == *"GYYY"* ]]; then
  fail "OPERATIONS_ALLOWED_WALLETS contains placeholder addresses (GXXX/GYYY)"
else
  echo "  OK  OPERATIONS_ALLOWED_WALLETS is set"
fi

# STELLAR_ADMIN_SECRET must start with S and be 56 chars
admin_secret="${STELLAR_ADMIN_SECRET:-}"
if [[ -z "$admin_secret" ]]; then
  fail "STELLAR_ADMIN_SECRET is not set"
elif [[ "${admin_secret:0:1}" != "S" ]] || [[ "${#admin_secret}" -ne 56 ]]; then
  fail "STELLAR_ADMIN_SECRET does not look like a Stellar secret key (must start with S, 56 chars)"
elif [[ "$admin_secret" == "SXXX"* ]]; then
  fail "STELLAR_ADMIN_SECRET is the example placeholder - set a real secret key"
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
    fail "stellar CLI not found - install it to run the on-chain check"
  else
    whitelist_id="${PILOT_WHITELIST_ID:-}"
    token_id="${PILOT_INCOME_TOKEN_ID:-}"
    payout_id="${PILOT_PAYOUT_SPLIT_ID:-}"
    manifest_admin="${MANIFEST_ADMIN:-}"
    manifest_operator="${MANIFEST_OPERATOR:-}"
    manifest_ally="${MANIFEST_ALLY:-}"
    manifest_fee="${MANIFEST_FEE_RECIPIENT:-}"
    manifest_usdc="${MANIFEST_USDC_TOKEN:-}"
    manifest_eurc="${MANIFEST_EURC_TOKEN:-}"
    manifest_router="${MANIFEST_SWAP_ROUTER:-}"
    manifest_wasm_whitelist="${MANIFEST_WASM_WHITELIST:-}"
    manifest_wasm_token="${MANIFEST_WASM_TOKEN:-}"
    manifest_wasm_payout="${MANIFEST_WASM_PAYOUT:-}"

    for var in whitelist_id token_id payout_id manifest_admin manifest_operator manifest_ally manifest_fee; do
      if [[ -z "${!var}" ]]; then
        fail "${var^^} manifest variable is not set"
      fi
    done

    # operator and ally must be distinct
    if [[ -n "$manifest_operator" ]] && [[ -n "$manifest_ally" ]]; then
      if [[ "$manifest_operator" == "$manifest_ally" ]]; then
        fail "MANIFEST_OPERATOR and MANIFEST_ALLY are the same address - they must be distinct production keys"
      else
        echo "  OK  operator != ally"
      fi
    fi

    invoke() {
      local id="$1"
      shift
      stellar contract invoke \
        --id "$id" \
        --source-account "$manifest_admin" \
        --network mainnet \
        -- "$@" 2>&1 || echo "__invoke_error__"
    }

    # Whitelist admin
    if [[ -n "$whitelist_id" ]] && [[ -n "$manifest_admin" ]]; then
      result="$(invoke "$whitelist_id" admin)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "whitelist.admin() call failed - contract may not be initialized"
      elif [[ "$result" != *"$manifest_admin"* ]]; then
        fail "whitelist.admin() returned '$result', expected '$manifest_admin'"
      else
        echo "  OK  whitelist admin = $manifest_admin"
      fi
    fi

    # Payout operator
    if [[ -n "$payout_id" ]] && [[ -n "$manifest_operator" ]]; then
      result="$(invoke "$payout_id" operator)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "payout.operator() call failed"
      elif [[ "$result" != *"$manifest_operator"* ]]; then
        fail "payout.operator() returned '$result', expected '$manifest_operator'"
      else
        echo "  OK  payout operator = $manifest_operator"
      fi
    fi

    # Payout ally
    if [[ -n "$payout_id" ]] && [[ -n "$manifest_ally" ]]; then
      result="$(invoke "$payout_id" ally)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "payout.ally() call failed"
      elif [[ "$result" != *"$manifest_ally"* ]]; then
        fail "payout.ally() returned '$result', expected '$manifest_ally'"
      else
        echo "  OK  payout ally = $manifest_ally"
      fi
    fi

    # Payout not paused
    if [[ -n "$payout_id" ]]; then
      result="$(invoke "$payout_id" is_paused)"
      if [[ "$result" == "true" ]]; then
        fail "payout contract is_paused = true - unpause before going live"
      elif [[ "$result" != "__invoke_error__" ]]; then
        echo "  OK  payout is_paused = false"
      fi
    fi

    # Wiring check: eurc_swap_path_status() returns the router, USDC, and EURC
    # token addresses stored inside the payout contract at initialization.
    # This confirms the contract was wired to the intended token contracts and
    # router, not a test or placeholder deployment.
    if [[ -n "$payout_id" ]]; then
      wiring="$(invoke "$payout_id" eurc_swap_path_status)"
      if [[ "$wiring" == "__invoke_error__" ]]; then
        fail "payout.eurc_swap_path_status() call failed"
      else
        echo "  INFO payout wiring: $wiring"

        if [[ -n "$manifest_usdc" ]]; then
          if [[ "$wiring" != *"$manifest_usdc"* ]]; then
            fail "payout USDC token mismatch. Expected $manifest_usdc in wiring output: $wiring"
          else
            echo "  OK  payout usdc_token = $manifest_usdc"
          fi
        fi

        if [[ -n "$manifest_eurc" ]]; then
          if [[ "$wiring" != *"$manifest_eurc"* ]]; then
            fail "payout EURC token mismatch. Expected $manifest_eurc in wiring output: $wiring"
          else
            echo "  OK  payout eurc_token = $manifest_eurc"
          fi
        fi

        if [[ -n "$manifest_router" ]]; then
          if [[ "$wiring" != *"$manifest_router"* ]]; then
            fail "payout swap_router mismatch. Expected $manifest_router in wiring output: $wiring"
          else
            echo "  OK  payout swap_router = $manifest_router"
          fi
        fi
      fi
    fi

    # WASM hash checks (if manifest values provided)
    check_wasm_hash() {
      local label="$1"
      local wasm_file="$2"
      local expected="$3"
      if [[ -z "$expected" ]]; then
        echo "  --  $label WASM hash not in manifest (skipping)"
        return
      fi
      if [[ ! -f "$wasm_file" ]]; then
        fail "$label WASM not found at $wasm_file - run: cd apps/contracts && stellar contract build"
        return
      fi
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
# Report
# ---------------------------------------------------------------------------
echo ""
if [[ ${#ERRORS[@]} -eq 0 ]]; then
  echo "=== PREFLIGHT PASSED - all checks clean ==="
  exit 0
else
  echo "=== PREFLIGHT FAILED ==="
  for err in "${ERRORS[@]}"; do
    echo "  $err"
  done
  exit 1
fi
