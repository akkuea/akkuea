"""
Render all Akkuea diagrams to docs/diagrams/ (SVG + PNG, vertical + horizontal).

Usage:
    python scripts/diagrams/render_all.py        (from repo root)
    python scripts/diagrams/render_all.py --dry   (list scripts without running)

Each diagram script produces:
    docs/diagrams/<name>-vertical.svg
    docs/diagrams/<name>-vertical.png
    docs/diagrams/<name>-horizontal.svg
    docs/diagrams/<name>-horizontal.png
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
OUTPUT = ROOT / "docs" / "diagrams"
OUTPUT.mkdir(parents=True, exist_ok=True)

scripts = [
    "01_system_architecture.py",
    "02_payout_cycle.py",
    "03_tokenization_mint.py",
    "04_kyc_review.py",
    "05_treasury_flow.py",
    "06_roadmap_timeline.py",
    "07_deployment_topology.py",
    "08_monorepo_structure.py",
]

if "--dry" in sys.argv:
    print("Diagrams that would be rendered:")
    for s in scripts:
        print(f"  {s}")
    sys.exit(0)

base = Path(__file__).parent
errors = []

print(f"Rendering {len(scripts)} diagrams -> {OUTPUT}\n")

for script in scripts:
    path = base / script
    if not path.exists():
        print(f"\n  ! {script} not found, skipping")
        errors.append(script)
        continue
    result = subprocess.run(
        [sys.executable, str(path)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"\n  X {script}\n{result.stderr}")
        errors.append(script)
    elif result.stdout:
        print(result.stdout.strip())

if errors:
    print(f"\n{len(errors)} script(s) failed: {errors}")
    sys.exit(1)
else:
    print(f"\nAll {len(scripts)} diagrams rendered -> {OUTPUT}")
    print("Output files:")
    for f in sorted(OUTPUT.glob("*")):
        if f.is_file():
            print(f"  {f.name}")
