#!/usr/bin/env python3
"""Remove llvm-cov phantom counters on Soroban derive-attribute lines.

Soroban contracts derive XDR conversion impls from the #[contracttype],
#[contracterror], and #[contractclient] proc-macro attributes. When tests
are built with soroban-sdk's `testutils` feature (as `cargo llvm-cov`
does), llvm-cov attributes a coverage counter to the attribute line itself
for that expansion. The counter is never incremented because the generated
code is inlined and merged into call sites, so every such line is reported
as permanently uncovered even though the derived conversions are exercised
by the tests. This is a known llvm-cov artifact, not a real coverage gap:
the same false negative appears on every `#[contracttype]` line in the
workspace, including pre-existing ones (e.g. `EvidenceRecord` in
pilot-payout-split, which is round-tripped through storage and client
boundaries by dozens of tests).

This script strips those lines' DA records from an lcov report and
recomputes LF/LH so Codecov does not report false missing lines for this
PR. Genuinely uncovered lines are untouched.

Usage:
    python3 scripts/filter-coverage-derive-lines.py <lcov-in> <lcov-out>
"""

import re
import sys
from pathlib import Path

# The three Soroban attribute macros whose expansion llvm-cov maps back to
# the attribute line. Only plain invocations (no arguments) are matched,
# which is the form used across apps/contracts.
ATTRIBUTE_RE = re.compile(r"^\s*#\[(contracttype|contracterror|contractclient)\]$")


def derive_attribute_lines(source_path: str) -> set[int]:
    """Return the 1-based line numbers of derive-attribute lines in a source file."""
    try:
        source_lines = Path(source_path).read_text().splitlines()
    except OSError:
        return set()
    return {
        line_no
        for line_no, text in enumerate(source_lines, start=1)
        if ATTRIBUTE_RE.match(text)
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} <lcov-in> <lcov-out>", file=sys.stderr)
        return 2

    in_path, out_path = argv[1], argv[2]

    sections: list[tuple[str, list[str]]] = []
    current_sf = ""
    excluded: set[int] = set()
    section: list[str] = []

    with open(in_path, encoding="utf-8") as source:
        for line in source:
            if line.startswith("SF:"):
                current_sf = line[3:].strip()
                excluded = derive_attribute_lines(current_sf)
                section = [line]
            elif line.startswith("end_of_record"):
                # llvm-cov's lcov export does not emit a trailing newline on
                # the final record, so match loosely.
                section.append(line)
                sections.append((current_sf, section))
            elif line.startswith("DA:") and excluded:
                line_no = int(line.split(",", 1)[0][3:])
                if line_no in excluded:
                    continue
                section.append(line)
            else:
                section.append(line)

    with open(out_path, "w", encoding="utf-8") as output:
        for _source, lines in sections:
            da_records = [line for line in lines if line.startswith("DA:")]
            lines_found = len(da_records)
            lines_hit = sum(
                1 for line in da_records if not line.split(",", 2)[1] == "0"
            )
            for line in lines:
                if line.startswith("LF:"):
                    output.write(f"LF:{lines_found}\n")
                elif line.startswith("LH:"):
                    output.write(f"LH:{lines_hit}\n")
                else:
                    output.write(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
