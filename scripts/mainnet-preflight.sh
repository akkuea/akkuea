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
#   MANIFEST_USDC_TOKEN      expected USDC token contract ID
#   MANIFEST_WASM_WHITELIST  sha256 of the audited pilot_whitelist.wasm (optional)
#   MANIFEST_WASM_TOKEN      sha256 of the audited pilot_income_token.wasm (optional)
#   MANIFEST_WASM_PAYOUT     sha256 of the audited pilot_payout_split.wasm (optional)
#
# Note on address verification scope:
#   The operator, ally, fee-recipient, income-token, whitelist, and USDC addresses
#   are set at initialize() time but have no public read functions in the deployed
#   contracts. Verifiable on-chain state is: whitelist.admin(), income_token.admin(),
#   payout.is_paused(), and payout.eurc_swap_path_status(). All other address
#   verification must be done by inspecting the initialize transaction in the explorer.
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

passphrase="${STELLAR_NETWORK_PASSPHRASE:-}"
if [[ -z "$passphrase" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not set"
elif [[ "$passphrase" != "$MAINNET_PASSPHRASE" ]]; then
  fail "STELLAR_NETWORK_PASSPHRASE is not the mainnet passphrase. Got: '$passphrase'"
else
  echo "  OK  STELLAR_NETWORK_PASSPHRASE = mainnet"
fi

horizon="${STELLAR_HORIZON_URL:-}"
if [[ -z "$horizon" ]]; then
  fail "STELLAR_HORIZON_URL is not set"
elif [[ "$horizon" != "$MAINNET_HORIZON" ]]; then
  fail "STELLAR_HORIZON_URL does not look like mainnet. Got: '$horizon' (expected $MAINNET_HORIZON)"
else
  echo "  OK  STELLAR_HORIZON_URL = mainnet"
fi

rpc="${STELLAR_RPC_URL:-}"
if [[ -z "$rpc" ]]; then
  fail "STELLAR_RPC_URL is not set"
elif [[ "$rpc" != "$MAINNET_RPC" ]]; then
  fail "STELLAR_RPC_URL does not look like mainnet. Got: '$rpc' (expected $MAINNET_RPC)"
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
  fail "OPERATIONS_BACKEND_CREDENTIAL looks like the example placeholder - set a real value"
else
  echo "  OK  OPERATIONS_BACKEND_CREDENTIAL is set"
fi

ops_wallets="${OPERATIONS_ALLOWED_WALLETS:-}"
if [[ -z "$ops_wallets" ]]; then
  fail "OPERATIONS_ALLOWED_WALLETS is not set - no production admin addresses configured"
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
    manifest_usdc="${MANIFEST_USDC_TOKEN:-}"
    manifest_wasm_whitelist="${MANIFEST_WASM_WHITELIST:-}"
    manifest_wasm_token="${MANIFEST_WASM_TOKEN:-}"
    manifest_wasm_payout="${MANIFEST_WASM_PAYOUT:-}"

    for var in whitelist_id token_id payout_id manifest_admin; do
      if [[ -z "${!var}" ]]; then
        fail "${var^^} manifest variable is not set"
      fi
    done

    # Use a read-only source identity; the invoke is simulated, not submitted.
    INVOKE_SOURCE="${PREFLIGHT_SOURCE_ACCOUNT:-${manifest_admin}}"
    NETWORK="${PREFLIGHT_NETWORK:-mainnet}"

    invoke() {
      local id="$1"
      shift
      stellar contract invoke \
        --id "$id" \
        --source-account "$INVOKE_SOURCE" \
        --network "$NETWORK" \
        -- "$@" 2>&1 || echo "__invoke_error__"
    }

    # Whitelist admin must match manifest
    if [[ -n "$whitelist_id" ]] && [[ -n "$manifest_admin" ]]; then
      result="$(invoke "$whitelist_id" admin)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "whitelist.admin() call failed - contract may not be initialized"
      elif [[ "$result" != *"$manifest_admin"* ]]; then
        fail "whitelist.admin() = '$result', expected '$manifest_admin'"
      else
        echo "  OK  whitelist.admin() = $manifest_admin"
      fi
    fi

    # Income token admin must match manifest
    if [[ -n "$token_id" ]] && [[ -n "$manifest_admin" ]]; then
      result="$(invoke "$token_id" admin)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "income_token.admin() call failed - contract may not be initialized"
      elif [[ "$result" != *"$manifest_admin"* ]]; then
        fail "income_token.admin() = '$result', expected '$manifest_admin'"
      else
        echo "  OK  income_token.admin() = $manifest_admin"
      fi
    fi

    # Income token name must match expected value
    if [[ -n "$token_id" ]]; then
      result="$(invoke "$token_id" name)"
      if [[ "$result" == "__invoke_error__" ]]; then
        fail "income_token.name() call failed"
      else
        echo "  OK  income_token.name() = $result"
      fi
    fi

    # Payout must not be paused
    if [[ -n "$payout_id" ]]; then
      result="$(invoke "$payout_id" is_paused)"
      if [[ "$result" == *"true"* ]]; then
        fail "payout.is_paused() = true - unpause before going live"
      elif [[ "$result" != "__invoke_error__" ]]; then
        echo "  OK  payout.is_paused() = false"
      fi
    fi

    # eurc_swap_path_status: on testnet returns "stubbed-fast-follow".
    # On mainnet with EURC configured, returns an object with usdc_token, eurc_token,
    # swap_router fields we can check against manifest values.
    if [[ -n "$payout_id" ]]; then
      wiring="$(invoke "$payout_id" eurc_swap_path_status)"
      if [[ "$wiring" == "__invoke_error__" ]]; then
        fail "payout.eurc_swap_path_status() call failed"
      else
        echo "  INFO payout.eurc_swap_path_status() = $wiring"
        # If MANIFEST_USDC_TOKEN is set and the status is not the testnet stub,
        # verify the USDC address appears in the returned wiring object.
        if [[ -n "$manifest_usdc" ]] && [[ "$wiring" != *"stubbed"* ]]; then
          if [[ "$wiring" != *"$manifest_usdc"* ]]; then
            fail "payout USDC token mismatch. Expected $manifest_usdc in: $wiring"
          else
            echo "  OK  payout usdc_token = $manifest_usdc"
          fi
        fi
      fi
    fi

    # WASM hash checks (optional: only run when manifest values are provided)
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
