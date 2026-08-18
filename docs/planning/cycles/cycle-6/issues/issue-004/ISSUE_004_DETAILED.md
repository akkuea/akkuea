# C6-004: Build the Professional Diagram Generation Pipeline

## Issue Metadata

| Attribute       | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Issue ID        | C6-004                                                                                     |
| Area            | TOOLING                                                                                    |
| Difficulty      | High                                                                                       |
| Labels          | documentation, high                                                                        |
| Dependencies    | None                                                                                       |
| Estimated Lines | 4000-5500 (Python diagram definitions, style module, generated docs embeds, README wiring) |

**Description**

Build `scripts/diagrams/`, a Python and Graphviz diagram-as-code pipeline modeled on LumenWipe's `render-all.py`, producing a full library of vertical and horizontal diagrams for this project's strategy and architecture documentation.

**Requirements and context**

- Reference implementation to study before starting: [`LumenWipe/lumenwipe apps/web/scripts/diagrams/render-all.py`](https://github.com/LumenWipe/lumenwipe/blob/main/apps/web/scripts/diagrams/render-all.py). Match its overall approach (one Python module per diagram, a shared entry point, Graphviz as the rendering engine) rather than copying it directly, since this project's diagram content and styling are different.
- Python dependency: `graphviz` (the Python binding, which shells out to the Graphviz `dot` binary). Document the system-level Graphviz install requirement in `scripts/diagrams/README.md` and in `docs/local-setup.md`.
- Style module (`scripts/diagrams/style.py` or similar): defines the color palette (pull the actual hex values from `apps/webapp/src/app/globals.css` / `docs/design-system/foundations.md`, including light and dark variants if diagrams are themed), font choices matching the monospace/terminal aesthetic where appropriate, and standard node/edge shapes so every diagram in the set reads as one coherent system.
- Orientation handling: each diagram module should define its content once (nodes, edges, labels) and accept an orientation parameter (`rankdir="TB"` for vertical, `rankdir="LR"` for horizontal in Graphviz terms), rather than maintaining two separate diagram definitions per diagram.
- Diagram list and suggested source of truth for content:
  - System architecture: `docs/architecture/system-architecture.md`
  - Payout-cycle sequence: `docs/strategy/product-brief.md`'s mermaid sequence diagram (port to Graphviz)
  - Tokenization/mint sequence: `docs/api/minting-workflow.md`'s existing sequence diagram (existing platform build, still worth diagramming since the pattern is instructive)
  - Whitelist/KYC review flow: `docs/api/kyc-workflow.md`
  - Phase 1a treasury flow: `docs/strategy/roadmap.md`
  - Phase 1 to Phase 2 roadmap timeline: `docs/strategy/roadmap.md`'s existing mermaid flowchart (port to Graphviz, this one especially benefits from a horizontal presentation version)
  - Deployment topology: `docs/architecture/system-architecture.md`'s deployment section
  - Monorepo/workspace structure: `README.md`'s project structure section
- Output convention: `docs/diagrams/<diagram-name>-vertical.svg`, `docs/diagrams/<diagram-name>-horizontal.svg`, plus `.png` equivalents for presentation use.

**Suggested execution**

1. `git checkout -b feature/diagram-generation-pipeline`
2. Install Graphviz locally (`brew install graphviz` or equivalent) and confirm the Python `graphviz` package renders a trivial test diagram.
3. Build the style module first, referencing the actual design-system tokens.
4. Build the entry point (`render_all.py`) and one trivial diagram end to end (both orientations, both formats) to prove the pipeline before building out the full set.
5. Implement the remaining seven-plus diagrams, one module each.
6. Embed the vertical SVGs into the relevant markdown docs, replacing ASCII art where a Graphviz version is now equivalent or better.
7. Write `scripts/diagrams/README.md` documenting how to add a new diagram and regenerate the set.

**Test and commit**

- [ ] `python scripts/diagrams/render_all.py` runs cleanly from a fresh checkout with only the documented dependencies installed
- [ ] Every diagram produces both a vertical and a horizontal file, in both SVG and PNG
- [ ] Diagrams render legibly at typical viewing sizes (spot-check at README width and at a 16:9 slide size)
- [ ] Style module is the single source of truth for colors and fonts across all diagrams (no diagram hardcodes its own palette)
- [ ] Embedded diagrams in markdown docs render correctly on GitHub

Example commit:
`git commit -m "feat(diagrams): add python/graphviz pipeline with vertical and horizontal renders"`

**Guidelines**

- Keep each diagram module focused on one diagram; don't build a single monolithic file for the whole set.
- Prefer clarity over density; a diagram that needs a magnifying glass has failed its purpose.
- Document the Graphviz system dependency clearly, since it's not installed via `bun install` and contributors without it will otherwise be confused.
