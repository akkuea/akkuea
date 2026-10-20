#!/usr/bin/env bash
# Run bun audit for high+critical findings, ignoring only documented allowlist IDs.
# Fails (non-zero) when any non-allowlisted high/critical advisory is present.
# Also fails when the allowlist contains an ID that bun audit no longer reports.
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

allow_ids=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  # strip comments and whitespace
  line="${line%%#*}"
  line="$(echo "${line}" | xargs 2>/dev/null || true)"
  [[ -z "${line}" ]] && continue
  allow_ids+=("${line}")
done < "${ALLOWLIST}"

echo "Running bun audit --audit-level=${LEVEL} in ${WORKDIR:-.}"
echo "Allowlisted advisories: ${#allow_ids[@]}"

# Validate the allowlist against the low-level audit output so stale entries fail loudly.
low_output="$(bun audit --audit-level=low 2>&1 || true)"

stale_ids=()
for id in "${allow_ids[@]}"; do
  if ! grep -q -F -- "${id}" <<<"${low_output}"; then
    stale_ids+=("${id}")
  fi
done

if [ "${#stale_ids[@]}" -gt 0 ]; then
  echo "" >&2
  echo 'error: the audit allowlist contains GHSA IDs that `bun audit` no longer reports:' >&2
  for id in "${stale_ids[@]}"; do
    echo "  - ${id}" >&2
  done
  echo "" >&2
  echo "Please delete these stale entries from .github/security/audit-allowlist.txt." >&2
  echo "Stale allowlist entries hide future regressions and are not allowed." >&2
  exit 1
fi

if [ "${#allow_ids[@]}" -eq 0 ]; then
  bun audit --audit-level="${LEVEL}"
else
  ignore_flags=()
  for id in "${allow_ids[@]}"; do
    ignore_flags+=("--ignore=${id}")
  done
  bun audit --audit-level="${LEVEL}" "${ignore_flags[@]}"
fi
