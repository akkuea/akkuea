#!/usr/bin/env bash
# Post-deploy smoke tests for Akkuea (API happy-path).
# See scripts/smoke/README.md for env configuration.
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TIMEOUT_SECS="${SMOKE_TIMEOUT_SECS:-10}"
# Strip trailing slash
API_BASE_URL="${API_BASE_URL%/}"

PASS=0
FAIL=0
SKIP=0

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[0;33m%s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }

# curl wrapper: sets HTTP_CODE + BODY; returns 0 on transport OK
request() {
  local method="$1" path="$2"
  shift 2
  local url="${API_BASE_URL}${path}"
  local tmp
  tmp="$(mktemp)"
  set +e
  HTTP_CODE="$(
    curl -sS -o "$tmp" -w '%{http_code}' \
      --connect-timeout "$TIMEOUT_SECS" \
      --max-time "$TIMEOUT_SECS" \
      -X "$method" \
      -H 'Accept: application/json' \
      "$@" \
      "$url" 2>/dev/null
  )"
  local curl_rc=$?
  set -e
  BODY="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  if [[ $curl_rc -ne 0 || -z "$HTTP_CODE" ]]; then
    HTTP_CODE="000"
    BODY="curl failed (rc=$curl_rc)"
    return 1
  fi
  return 0
}

assert_status() {
  local name="$1" expected="$2"
  if [[ "$HTTP_CODE" == "$expected" ]]; then
    green "PASS  $name (HTTP $HTTP_CODE)"
    PASS=$((PASS + 1))
    return 0
  fi
  red "FAIL  $name (expected HTTP $expected, got $HTTP_CODE)"
  info "body: ${BODY:0:200}"
  FAIL=$((FAIL + 1))
  return 1
}

assert_json_field() {
  local name="$1" expr="$2" expect="$3"
  local got
  got="$(printf '%s' "$BODY" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print($expr)
except Exception as e:
  print('__ERR__' + str(e))
" 2>/dev/null || echo '__ERR__parse')"
  if [[ "$got" == "$expect" ]]; then
    green "PASS  $name ($got)"
    PASS=$((PASS + 1))
    return 0
  fi
  red "FAIL  $name (expected '$expect', got '$got')"
  info "body: ${BODY:0:200}"
  FAIL=$((FAIL + 1))
  return 1
}

echo "=== Akkuea smoke tests ==="
echo "API_BASE_URL=$API_BASE_URL"
echo "TIMEOUT=${TIMEOUT_SECS}s"
echo

# 1. Health — app boots + DB dependency
echo "[1/4] GET /health"
if request GET /health; then
  assert_status "health responds" "200" || true
  if [[ "$HTTP_CODE" == "200" ]]; then
    assert_json_field "health.status is healthy" "d.get('status','')" "healthy" || true
    assert_json_field "health.services.database.healthy" "str(d.get('services',{}).get('database',{}).get('healthy','')).lower()" "true" || true
  fi
else
  red "FAIL  health unreachable"
  FAIL=$((FAIL + 1))
fi
echo

# 2. Swagger docs — service surface reachable
echo "[2/4] GET /swagger"
if request GET /swagger; then
  # Swagger UI may be 200 HTML or redirect; accept 200/301/302/308
  case "$HTTP_CODE" in
    200|301|302|307|308)
      green "PASS  swagger reachable (HTTP $HTTP_CODE)"
      PASS=$((PASS + 1))
      ;;
    *)
      red "FAIL  swagger (HTTP $HTTP_CODE)"
      FAIL=$((FAIL + 1))
      ;;
  esac
else
  yellow "SKIP  swagger unreachable (non-fatal if /health passed)"
  SKIP=$((SKIP + 1))
fi
echo

# 3. Properties list — public happy path (no auth)
echo "[3/4] GET /properties?limit=5"
# property routes may be mounted at /properties (index.ts dual-mount) — try both
PROPS_PATH="/properties?limit=5"
if ! request GET "$PROPS_PATH"; then
  PROPS_PATH="/api/properties?limit=5"
  request GET "$PROPS_PATH" || true
fi
if [[ "$HTTP_CODE" == "200" ]]; then
  green "PASS  properties list (HTTP 200, path=$PROPS_PATH)"
  PASS=$((PASS + 1))
  # Accept array or {data:[]} shapes
  SHAPE="$(printf '%s' "$BODY" | python3 -c "
import sys, json
try:
  d=json.load(sys.stdin)
  if isinstance(d, list): print('array')
  elif isinstance(d, dict) and ('data' in d or 'items' in d or 'properties' in d): print('object')
  else: print('object')
except Exception:
  print('invalid')
" 2>/dev/null || echo invalid)"
  if [[ "$SHAPE" != "invalid" ]]; then
    green "PASS  properties body is JSON ($SHAPE)"
    PASS=$((PASS + 1))
  else
    red "FAIL  properties body not JSON"
    FAIL=$((FAIL + 1))
  fi
elif [[ "$HTTP_CODE" == "000" ]]; then
  red "FAIL  properties unreachable"
  FAIL=$((FAIL + 1))
else
  # 401/403/404 still means process is up; mark soft-fail for unauth envs
  yellow "WARN  properties returned HTTP $HTTP_CODE (path=$PROPS_PATH) — service up, check mount/auth"
  info "body: ${BODY:0:200}"
  SKIP=$((SKIP + 1))
fi
echo

# 4. Optional webapp check
if [[ -n "${WEBAPP_BASE_URL:-}" ]]; then
  echo "[4/4] GET ${WEBAPP_BASE_URL%/}/"
  WEBAPP_BASE_URL="${WEBAPP_BASE_URL%/}"
  tmp="$(mktemp)"
  set +e
  WCODE="$(curl -sS -o "$tmp" -w '%{http_code}' --connect-timeout "$TIMEOUT_SECS" --max-time "$TIMEOUT_SECS" "$WEBAPP_BASE_URL/" 2>/dev/null)"
  set -e
  rm -f "$tmp"
  if [[ "$WCODE" == "200" || "$WCODE" == "304" ]]; then
    green "PASS  webapp root (HTTP $WCODE)"
    PASS=$((PASS + 1))
  else
    red "FAIL  webapp root (HTTP ${WCODE:-000})"
    FAIL=$((FAIL + 1))
  fi
else
  yellow "SKIP  webapp (set WEBAPP_BASE_URL to enable)"
  SKIP=$((SKIP + 1))
fi
echo

echo "=== Summary: pass=$PASS fail=$FAIL skip=$SKIP ==="
if [[ "$FAIL" -gt 0 ]]; then
  red "Smoke tests FAILED"
  exit 1
fi
green "Smoke tests PASSED"
exit 0
