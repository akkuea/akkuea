#!/usr/bin/env bash
# Run bun audit for high+critical findings, ignoring only documented allowlist IDs.
# Fails (non-zero) when any non-allowlisted high/critical advisory is present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ALLOWLIST="${ROOT}/.github/security/audit-allowlist.txt"
LEVEL="${AUDIT_LEVEL:-high}"
WORKDIR="${1:-.}"

if [[ ! -f "${ALLOWLIST}" ]]; then
  echo "error: missing allowlist at ${ALLOWLIST}" >&2
  exit 2
fi

cd "${ROOT}/${WORKDIR}"

ignore_flags=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  # strip comments and whitespace
  line="${line%%#*}"
  line="$(echo "${line}" | xargs 2>/dev/null || true)"
  [[ -z "${line}" ]] && continue
  ignore_flags+=(--ignore="${line}")
done < "${ALLOWLIST}"

echo "Running bun audit --audit-level=${LEVEL} in ${WORKDIR:-.}"
echo "Allowlisted advisories: ${#ignore_flags[@]}"

audit_with_retry() {
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    echo "Running bun audit (attempt $attempt of $max_attempts)..."
    
    set +e
    if [[ ${#ignore_flags[@]} -eq 0 ]]; then
      bun audit --audit-level="${LEVEL}"
    else
      bun audit --audit-level="${LEVEL}" "${ignore_flags[@]}"
    fi
    local exit_code=$?
    set -e

    if [ $exit_code -eq 0 ]; then
      echo "✅ Audit passed"
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      echo "Audit failed, retrying in 30 seconds..."
      sleep 30
    fi

    attempt=$((attempt + 1))
  done

  echo "❌ Audit failed after $max_attempts attempts"
  return 1
}

audit_with_retry
