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

if [[ ${#ignore_flags[@]} -eq 0 ]]; then
  bun audit --audit-level="${LEVEL}"
else
  bun audit --audit-level="${LEVEL}" "${ignore_flags[@]}"
fi
