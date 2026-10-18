#!/usr/bin/env bash
# Run locally the same checks pull-request CI runs, for the parts of the repo
# this branch changes. Usage:
#
#   make check        checks for what you changed (compared with upstream develop)
#   make check-all    every check, whatever you changed
#   make fix          apply the automatic fixes (formatting)
#
# Each block mirrors a workflow in .github/workflows/. When a workflow changes,
# update the matching block here. Optional, slower checks:
#
#   E2E=1 make check        also run the Playwright end-to-end tests
#   COVERAGE=1 make check   also run contract coverage (needs cargo-llvm-cov)

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

MODE="changed"
case "${1:-}" in
  --all) MODE="all" ;;
  --fix) MODE="fix" ;;
  "") ;;
  *) echo "usage: scripts/check.sh [--all|--fix]" >&2; exit 2 ;;
esac

if [ -t 1 ]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

PASSED=()
FAILED=()
SKIPPED=()
DONE=" "

# run <dir> <label> <command...>: run a command in a directory and record the result.
run() {
  local dir="$1" label="$2"
  shift 2
  printf '\n%s==> %s%s\n' "$BOLD" "$label" "$RESET"
  if (cd "$dir" && "$@"); then
    PASSED+=("$label")
  else
    FAILED+=("$label")
  fi
}

# once <key> <dir> <label> <command...>: like run, but a step shared by several workflows runs once.
once() {
  local key="$1"
  shift
  case "$DONE" in *" $key "*) return 0 ;; esac
  DONE="$DONE$key "
  run "$@"
}

# need <tool> <how to install> <label>: true if the tool exists, otherwise record a skip.
need() {
  if command -v "$1" >/dev/null 2>&1; then
    return 0
  fi
  SKIPPED+=("$3 (needs $1: $2)")
  return 1
}

# ---------------------------------------------------------------------------
# What changed

UPSTREAM_URL="https://github.com/akkuea/akkuea.git"
base_ref() {
  local remote
  for remote in $(git remote); do
    case "$(git remote get-url "$remote" 2>/dev/null)" in
      *akkuea/akkuea*)
        if git rev-parse -q --verify "$remote/develop" >/dev/null; then
          echo "$remote/develop"
          return
        fi
        ;;
    esac
  done
  for ref in upstream/develop origin/develop develop; do
    if git rev-parse -q --verify "$ref" >/dev/null; then
      echo "$ref"
      return
    fi
  done
}

CHANGED=""
if [ "$MODE" = "changed" ]; then
  REF="$(base_ref)"
  if [ -z "$REF" ]; then
    echo "${YELLOW}Could not find develop to compare with, so every check runs.${RESET}"
    echo "Tip: git remote add upstream $UPSTREAM_URL && git fetch upstream"
    MODE="all"
  else
    BASE="$(git merge-base HEAD "$REF")"
    CHANGED="$(
      {
        git diff --name-only "$BASE"...HEAD
        git diff --name-only HEAD
        git ls-files --others --exclude-standard
      } | sort -u
    )"
    echo "Comparing with ${BOLD}$REF${RESET}. Changed files: $(printf '%s' "$CHANGED" | grep -c . || true)"
    case "$REF" in
      upstream/*) ;;
      *) echo "Tip: to compare with the real upstream, run: git remote add upstream $UPSTREAM_URL && git fetch upstream" ;;
    esac
  fi
fi

# touched <regex>: true in --all mode, or when a changed path matches.
touched() {
  [ "$MODE" = "all" ] && return 0
  printf '%s\n' "$CHANGED" | grep -qE "$1"
}

ROOT_DEPS='^(package\.json|bun\.lock)$'
SHARED_PATHS="^apps/shared/|$ROOT_DEPS|^\.github/workflows/shared-ci\.yml$"
API_PATHS="^apps/api/|$ROOT_DEPS|^\.github/workflows/api-ci\.yml$"
WEBAPP_PATHS="^apps/webapp/|$ROOT_DEPS|^\.github/workflows/(webapp-ci|vercel-preview)\.yml$"
MONOREPO_PATHS="^(apps|docs|scripts|\.github)/|$ROOT_DEPS"
CONTRACTS_PATHS='^apps/contracts/|^\.github/workflows/contracts-ci\.yml$'

# ---------------------------------------------------------------------------
# make fix: automatic fixes only, then stop.

if [ "$MODE" = "fix" ]; then
  if need bun "https://bun.sh" "prettier"; then
    run apps/api "prettier (api)" bunx prettier --write "src/**/*.{ts,json}"
    run apps/shared "prettier (shared)" bunx prettier --write .
    run apps/webapp "prettier (webapp)" bunx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css}"
  fi
  run apps/contracts "cargo fmt (contracts)" cargo fmt --all
  echo
  echo "Done. Review the changes with 'git diff', commit only files your change touches, then run 'make check'."
  [ "${#FAILED[@]}" -eq 0 ]
  exit $?
fi

# Bun version used by the repo
WANT_BUN="$(sed -n 's/.*"packageManager": *"bun@\([0-9.]*\)".*/\1/p' package.json)"
if command -v bun >/dev/null 2>&1 && [ -n "$WANT_BUN" ]; then
  HAVE_BUN="$(bun --version)"
  if [ "$(printf '%s\n%s\n' "$WANT_BUN" "$HAVE_BUN" | sort -V | head -1)" != "$WANT_BUN" ]; then
    echo "${YELLOW}This repo uses bun $WANT_BUN and you have $HAVE_BUN. Upgrade with: bun upgrade${RESET}"
  fi
fi

install_deps() {
  once install . "install: bun install --frozen-lockfile" bun install --frozen-lockfile
}
build_shared() {
  install_deps
  once shared-build apps/shared "shared: build" bun run build
}

# ---------------------------------------------------------------------------
# Monorepo - Quality and Security CI (monorepo-ci.yml)

if touched "$MONOREPO_PATHS"; then
  run . "monorepo: style rules (no em dashes, no emojis)" python3 .github/scripts/check-style-rules.py .
  run . "monorepo: no eval or new Function in apps/" bash -c '
    if grep -rE "\beval\(|\bnew Function\(" apps/ --include="*.ts" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next | grep -v "//.*eval\|//.*Function("; then
      echo "Remove eval() and new Function() from the files above."
      exit 1
    fi'
  run . "monorepo: workspaces and tsconfig files are valid" bash -c '
    status=0
    for ws in $(jq -r ".workspaces[]" package.json); do
      [ -f "$ws/package.json" ] || { echo "Missing $ws/package.json"; status=1; }
    done
    for cfg in apps/*/tsconfig.json; do
      jq . "$cfg" >/dev/null || { echo "Invalid JSON: $cfg"; status=1; }
    done
    exit $status'
fi

if touched '\.sh$|^\.github/workflows/monorepo-ci\.yml$'; then
  run . "monorepo: shell scripts parse (bash -n)" bash -c '
    status=0
    while IFS= read -r s; do bash -n "$s" || status=1; done < <(git ls-files "*.sh")
    exit $status'
  if need shellcheck "brew install shellcheck, or apt install shellcheck" "monorepo: shellcheck"; then
    run . "monorepo: shellcheck" bash -c '
      status=0
      while IFS= read -r s; do shellcheck --severity=warning "$s" || status=1; done < <(git ls-files "*.sh")
      exit $status'
  fi
  run . "monorepo: shell scripts are executable" bash -c '
    status=0
    while IFS= read -r s; do
      [ -x "$s" ] || { echo "NOT EXECUTABLE: $s (run: git update-index --chmod=+x $s)"; status=1; }
    done < <(git ls-files "*.sh")
    exit $status'
fi

if touched "$MONOREPO_PATHS" && need bun "https://bun.sh" "monorepo: TypeScript checks"; then
  build_shared
  run apps/api "monorepo: api imports shared" bun -e "const shared = await import('../shared/dist/index.js'); console.log(typeof shared.ValidationService);"
  run . "monorepo: webapp imports shared" bun -e "await import('./apps/shared/dist/index.js');"
  run apps/api "monorepo: api types against shared" bunx tsc --noEmit --skipLibCheck
  run apps/webapp "monorepo: webapp types against shared" bunx tsc --noEmit --skipLibCheck
  # Performance Benchmark job: full production builds.
  once webapp-build apps/webapp "webapp: production build" env SKIP_ENV_VALIDATION=true bun run build
  once api-build apps/api "api: build" bun run build
  run . "monorepo: dependency audit" bash .github/scripts/dependency-audit.sh .
fi

# ---------------------------------------------------------------------------
# Shared Library - Quality and Security CI (shared-ci.yml)

if touched "$SHARED_PATHS" && need bun "https://bun.sh" "shared"; then
  install_deps
  run apps/shared "shared: build types" bun run build:types
  run apps/shared "shared: lint" bun run lint
  run apps/shared "shared: format check" bun run format:check
  build_shared
  run apps/shared "shared: strict type safety" bunx tsc --noEmit --strict --noImplicitAny --noImplicitReturns --noImplicitThis
fi

# ---------------------------------------------------------------------------
# API - Quality and Security CI (api-ci.yml)

PG_CONTAINER="akkuea-check-postgres"
PG_PORT="${AKKUEA_CHECK_PG_PORT:-55432}"
cleanup_pg() { docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true; }

if touched "$API_PATHS" && need bun "https://bun.sh" "api"; then
  install_deps
  run apps/api "api: type check" bun run type-check
  run apps/api "api: lint" bun run lint
  run apps/api "api: format check" bun run format:check
  once api-build apps/api "api: build" bun run build

  if need docker "https://docs.docker.com/get-docker/" "api: database tests"; then
    if docker info >/dev/null 2>&1; then
      trap cleanup_pg EXIT
      cleanup_pg
      docker run -d --name "$PG_CONTAINER" -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
        -e POSTGRES_DB=akkuea_test -p "$PG_PORT:5432" postgres:16 >/dev/null
      run . "api: wait for test database" bash -c "
        for i in \$(seq 1 30); do
          docker exec $PG_CONTAINER pg_isready -U test -d akkuea_test >/dev/null 2>&1 && exit 0
          sleep 2
        done
        echo 'The test database did not start.'; exit 1"
      DB_URL="postgresql://test:test@localhost:$PG_PORT/akkuea_test"
      run apps/api "api: migrations" env DATABASE_URL="$DB_URL" bun run db:migrate
      run apps/api "api: tests" env DATABASE_URL="$DB_URL" TEST_DATABASE_URL="$DB_URL" \
        bun test --coverage --coverage-threshold=60 --max-concurrency=1 --isolate
      cleanup_pg
    else
      SKIPPED+=("api: database tests (start Docker first)")
    fi
  fi
fi

# ---------------------------------------------------------------------------
# WebApp - Quality and Security CI (webapp-ci.yml) and Preview CI Checks (vercel-preview.yml)

if touched "$WEBAPP_PATHS" && need bun "https://bun.sh" "webapp"; then
  build_shared
  run apps/webapp "webapp: type check" env SKIP_ENV_VALIDATION=true bun run type-check
  run apps/webapp "webapp: lint" bun run lint
  run apps/webapp "webapp: format check" bunx prettier --check "src/**/*.{ts,tsx,js,jsx,json,css}"
  once webapp-build apps/webapp "webapp: production build" env SKIP_ENV_VALIDATION=true bun run build
  run apps/webapp "webapp: tests" env SKIP_ENV_VALIDATION=true bun test --coverage --coverage-threshold=60 --isolate
  run apps/webapp "webapp: no secret-like names in src/ or public/" bash -c '
    if grep -r -E "(API_KEY|SECRET|PASSWORD|PRIVATE_KEY)" src/ public/ --exclude-dir=node_modules --exclude-dir=.next; then
      echo "CI rejects these names in apps/webapp. Rename them or move the values to the API."
      exit 1
    fi'
  if [ "${E2E:-0}" = "1" ]; then
    run apps/webapp "webapp: install Playwright chromium" bunx playwright install chromium
    run apps/webapp "webapp: end-to-end tests" env CI=true bun run test:e2e
  else
    SKIPPED+=("webapp: Playwright end-to-end tests (run with E2E=1 make check)")
  fi
fi

# ---------------------------------------------------------------------------
# Smart Contracts CI/CD (contracts-ci.yml)

if touched "$CONTRACTS_PATHS" && need cargo "https://rustup.rs" "contracts"; then
  if command -v rustup >/dev/null 2>&1 && ! rustup target list --installed | grep -q '^wasm32v1-none$'; then
    run . "contracts: add wasm32v1-none target" rustup target add wasm32v1-none
  fi
  run apps/contracts "contracts: cargo fmt --check" cargo fmt --all -- --check
  run apps/contracts "contracts: clippy" cargo clippy --all-targets --all-features -- -D warnings
  run apps/contracts "contracts: wasm build" cargo build --target wasm32v1-none --release
  run apps/contracts "contracts: wasm size under 1 MiB" bash -c '
    status=0
    for f in target/wasm32v1-none/release/*.wasm; do
      size=$(wc -c <"$f" | tr -d " ")
      if [ "$size" -gt 1048576 ]; then echo "$f is $size bytes, over the 1 MiB limit"; status=1; fi
    done
    exit $status'
  run apps/contracts "contracts: tests" cargo test --lib
  run apps/contracts "contracts: invocation budget" cargo test --package rwa-defi-contract budget_check -- --nocapture
  if cargo deny --version >/dev/null 2>&1; then
    run apps/contracts "contracts: cargo deny" cargo deny check
  else
    SKIPPED+=("contracts: cargo deny (install with: cargo install --locked cargo-deny)")
  fi
  if cargo audit --version >/dev/null 2>&1; then
    run apps/contracts "contracts: cargo audit (high and critical)" bash -c '
      out="$(cargo audit --deny warnings --file Cargo.lock 2>&1)"
      echo "$out"
      if echo "$out" | grep -Eqi "Severity: (high|critical)"; then exit 1; fi'
  else
    SKIPPED+=("contracts: cargo audit (install with: cargo install cargo-audit)")
  fi
  if [ "${COVERAGE:-0}" = "1" ]; then
    if cargo llvm-cov --version >/dev/null 2>&1; then
      run apps/contracts "contracts: coverage" cargo llvm-cov --lib --workspace --summary-only
    else
      SKIPPED+=("contracts: coverage (install with: cargo install cargo-llvm-cov)")
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Summary

echo
echo "${BOLD}Summary${RESET}"
for item in "${PASSED[@]+"${PASSED[@]}"}"; do echo "  ${GREEN}pass${RESET}  $item"; done
for item in "${SKIPPED[@]+"${SKIPPED[@]}"}"; do echo "  ${YELLOW}skip${RESET}  $item"; done
for item in "${FAILED[@]+"${FAILED[@]}"}"; do echo "  ${RED}FAIL${RESET}  $item"; done

if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo
  echo "${YELLOW}Skipped checks still run in CI. Install the tool shown to run them here.${RESET}"
fi
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo
  echo "${RED}${#FAILED[@]} check(s) failed.${RESET} CI will fail the same way. Fix them before pushing."
  echo "Formatting can be fixed automatically with: make fix"
  exit 1
fi
echo
echo "${GREEN}All checks passed.${RESET} Read your diff once more (git diff), then push."
