# Akkuea Diagram Generation Pipeline

Professional diagrams as code using Python + Graphviz. Every diagram is versioned, regenerated on demand, and never hand-drawn.

## Prerequisites

```bash
# 1. Python 3.9+
python --version   # verify

# 2. Graphviz system package (provides the `dot` binary)
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows (via Chocolatey)
choco install graphviz

# 3. Python graphviz package
pip install graphviz
```

## Regenerating all diagrams

From the repository root:

```bash
python scripts/diagrams/render_all.py
```

This produces every diagram in `docs/diagrams/` as both SVG and PNG, in vertical and horizontal layouts.

### Dry run (list without rendering)

```bash
python scripts/diagrams/render_all.py --dry
```

## Output naming convention

Each diagram `<name>` produces four files:

| File                    | Layout    | Use case                        |
| ----------------------- | --------- | ------------------------------- |
| `<name>-vertical.svg`   | Tall (TB) | README embedding, docs pages    |
| `<name>-vertical.png`   | Tall (TB) | Presentations (raster fallback) |
| `<name>-horizontal.svg` | Wide (LR) | Slide decks, wide layouts       |
| `<name>-horizontal.png` | Wide (LR) | Slide decks (raster fallback)   |

SVG is preferred for documentation (scales cleanly). PNG is provided for tools that don't support SVG.

## Diagram set

| #   | Script                      | Diagram                                                               | Embedded in                                             |
| --- | --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| 01  | `01_system_architecture.py` | Five-app monorepo architecture                                        | `docs/architecture/system-architecture.md`, `README.md` |
| 02  | `02_payout_cycle.py`        | Monthly income distribution cycle (target design, pending Issue #722) | `docs/operations/runbook-dividends-placeholder.md`      |
| 03  | `03_tokenization_mint.py`   | Property tokenization sequence (existing platform build)              | `docs/api/minting-workflow.md`                          |
| 04  | `04_kyc_review.py`          | KYC review flow, admin-as-oracle pattern                              | `docs/api/kyc-workflow.md`                              |
| 05  | `05_treasury_flow.py`       | Phase 1a treasury track (DeFindex + EtherFuse)                        | `docs/operations/runbook-treasury-track.md`             |
| 06  | `06_roadmap_timeline.py`    | Phase 1 to Phase 2 roadmap                                            | `docs/strategy/roadmap.md`                              |
| 07  | `07_deployment_topology.py` | Testnet vs mainnet topology                                           | `docs/architecture/system-architecture.md`              |
| 08  | `08_monorepo_structure.py`  | Workspace structure and dependencies                                  | `README.md`                                             |

These are the diagrams for the **existing platform build** and the **pilot's own flows**, kept distinct per [`docs/strategy/product-brief.md`](../../docs/strategy/product-brief.md#relationship-to-the-existing-platform-build). Diagram content is sourced from the mermaid diagrams already embedded in those documents; this pipeline exists to give the same information a presentation-quality, on-brand rendering for non-technical stakeholders, not to replace the mermaid diagrams GitHub already renders natively.

## Adding a new diagram

1. Create `scripts/diagrams/NN_name.py` (number increments from the last existing script).
2. Import the shared style module:

```python
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz
```

3. Build your `graphviz.Digraph`, using the shared palette tokens from `_style.py`:
   - `F_*` for node fills, `B_*` for borders, `E_*` for edges
   - `hl()` for HTML labels with title + subtitle
   - `base_graph_attr()`, `base_node_attr()`, `base_edge_attr()` for defaults
4. Call `render(g, "NN-name")` at the end of the script.
5. Add the script name to the `scripts` list in `render_all.py`.
6. Run `python scripts/diagrams/render_all.py` to generate output.
7. Embed the vertical SVG in the relevant doc using:

```markdown
![Diagram Title](../diagrams/NN-name-vertical.svg)
```

### Style tokens

The `_style.py` module provides the Akkuea design-system palette, copied directly from [`docs/design-system/foundations.md`](../../docs/design-system/foundations.md) (light theme). The six real chromatic tokens (`--accent`, `--accent-secondary`, `--accent-tertiary`, `--accent-quaternary`, `--warning`, `--destructive`) cover every diagram category - nothing here is invented or picked from an unrelated palette:

| Category | Tokens                                                                                                        | Real source                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Fills    | `F_CLIENT`, `F_BACKEND`, `F_CONTRACT`, `F_EXTERNAL`, `F_DECISION`, `F_DB`, `F_KYC`, `F_WARNING`, `F_MONOREPO` | Light opaque tints of the tokens below                                                                                                          |
| Borders  | `B_CLIENT`, `B_BACKEND`, `B_CONTRACT`, `B_EXTERNAL`, `B_DECISION`, `B_DB`, `B_KYC`, `B_WARNING`, `B_MONOREPO` | `--accent-secondary`, `--accent`, `--accent-quaternary`, `--accent-tertiary`, `--warning` (exact), plus structural sky-blue for client/monorepo |
| Edges    | `E_CLIENT`, `E_BACKEND`, `E_CONTRACT`, `E_EXTERNAL`, `E_DECISION`, `E_WARNING`                                | Same tokens as the matching border                                                                                                              |
| Text     | `T_DARK`, `T_MED`, `T_LITE`, `T_WHITE`                                                                        | `--foreground`, `--muted-foreground`, `--foreground-subtle`, `--primary-foreground`                                                             |
| Semantic | `F_SUCCESS` / `B_SUCCESS` / `E_SUCCESS`, `F_DANGER` / `B_DANGER` / `E_DANGER`                                 | `--accent-secondary` (deeper tier), `--destructive`                                                                                             |

If `apps/shared/src/styles/tokens.css` ever changes a color, update `_style.py` to match in the same change, per `docs/design-system/foundations.md`'s own instruction that both apps move together when a token changes.

## CI integration (optional)

Add a check to your CI workflow to ensure diagrams stay up to date:

```yaml
- name: Verify diagrams are up to date
  run: |
    pip install graphviz
    python scripts/diagrams/render_all.py
    git diff --exit-code docs/diagrams/
```

If the committed SVG/PNG output doesn't match what the scripts produce, the CI job fails.

## Troubleshooting

| Error                                             | Cause                           | Fix                                                     |
| ------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| `graphviz.backend.execute.ExecutableNotFound`     | `dot` binary not installed      | Install the Graphviz system package (see Prerequisites) |
| `ModuleNotFoundError: No module named 'graphviz'` | Python graphviz package missing | `pip install graphviz`                                  |
| Empty or broken SVG                               | Graphviz version too old        | Upgrade to Graphviz 7.0+                                |
