#!/usr/bin/env python3
import os
import re
import sys
import subprocess

# Directories ignored from scanning entirely (build artifacts, dependencies, etc.)
IGNORED_DIRS = {
    ".git",
    ".gemini",
    "brain",
    "node_modules",
    ".next",
    "dist",
    "out",
    "target",
    "build",
    "coverage",
    ".turbo",
    "venv",
    ".venv",
}

# File extensions ignored (binary assets, images, lockfiles)
IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".wasm",
    ".pdf", ".ttf", ".woff", ".woff2", ".eot", ".mp4", ".mp3",
    ".zip", ".tar", ".gz", ".lock", ".bin", ".svg"
}

# Explicit allowed exceptions for existing pre-date codebase files or external references
ALLOWED_EXCEPTIONS = [
    ".github/workflows/",
    "apps/api/src/index.ts",
    "apps/webapp/src/components/portfolio/PropertyReportCard.tsx",
    "docs/README.md",
    "docs/deployment/deploy-game-contracts.md",
    "packages/nextjs/",
]

EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F9FF"
    r"\U0001FA00-\U0001FAFF"
    r"\u2600-\u27BF"
    r"\U0001F600-\U0001F64F"
    r"\U0001F680-\U0001F6FF]"
)

EM_DASH_PATTERN = re.compile(r"\u2014")

def is_allowed(rel_path):
    normalized = rel_path.replace("\\", "/")
    for allowed in ALLOWED_EXCEPTIONS:
        if allowed.endswith("/") and normalized.startswith(allowed):
            return True
        if normalized == allowed:
            return True
    return False

def get_tracked_files(root_dir):
    try:
        res = subprocess.run(
            ["git", "ls-files"],
            cwd=root_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True
        )
        return [f.strip() for f in res.stdout.splitlines() if f.strip()]
    except Exception:
        # Fallback to os.walk if git is unavailable
        files = []
        for dirpath, dirnames, filenames in os.walk(root_dir):
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
            for filename in filenames:
                rel = os.path.relpath(os.path.join(dirpath, filename), root_dir)
                files.append(rel.replace("\\", "/"))
        return files

def scan_repository(root_dir="."):
    violations = []
    tracked_files = get_tracked_files(root_dir)

    for rel_path in tracked_files:
        if is_allowed(rel_path):
            continue

        ext = os.path.splitext(rel_path)[1].lower()
        if ext in IGNORED_EXTENSIONS:
            continue

        full_path = os.path.join(root_dir, rel_path)
        if not os.path.isfile(full_path):
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                for line_num, line in enumerate(f, start=1):
                    if EM_DASH_PATTERN.search(line):
                        violations.append({
                            "file": rel_path,
                            "line": line_num,
                            "type": "Em Dash (\\u2014)",
                            "content": line.strip()
                        })
                    if EMOJI_PATTERN.search(line):
                        violations.append({
                            "file": rel_path,
                            "line": line_num,
                            "type": "Emoji character",
                            "content": line.strip()
                        })
        except Exception:
            pass

    return violations

def main():
    root_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    print(f"Scanning repository at {root_dir} for style non-negotiables (em dashes & emojis)...")

    violations = scan_repository(root_dir)

    if violations:
        print("\nStyle Rule Violations Found:")
        print("==============================")
        for v in violations:
            # Use ASCII safe formatting to avoid Windows console encoding issues
            safe_content = v['content'].encode('ascii', errors='backslashreplace').decode('ascii')
            print(f"  [FAIL] {v['file']}:{v['line']} [{v['type']}] -> {safe_content}")
        print(f"\nTotal violations: {len(violations)}")
        print("\nPlease fix the above violations (refer to CLAUDE.md non-negotiable rules: no em dashes, no emojis).")
        sys.exit(1)
    else:
        print("No style rule violations found (0 em dashes, 0 emojis outside allowed exceptions). Quality gate passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
