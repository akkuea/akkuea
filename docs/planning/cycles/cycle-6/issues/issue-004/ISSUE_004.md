# Build the Professional Diagram Generation Pipeline

## Context

Every strategic and architectural document this project has (`docs/strategy/`, `docs/architecture/system-architecture.md`, `docs/deployment/`) currently explains itself in prose and ASCII boxes. That's usable for a developer but not for the audiences this project actually needs to convince: a real estate agency ally, an investor, a grant reviewer. This project's own documentation standard already commits to "proper diagrams (mermaid sequence and architecture diagrams)" as a requirement, but mermaid alone doesn't produce presentation-quality output, and nothing in the repository currently generates a diagram in a form suitable for a slide deck.

This issue builds a real diagram-as-code pipeline in Python and Graphviz, following the pattern already proven at [LumenWipe's `render-all.py`](https://github.com/LumenWipe/lumenwipe/blob/main/apps/web/scripts/diagrams/render-all.py): diagrams defined as code, versioned, regenerated on demand, never hand-drawn and never manually re-exported.

## What Needs to Be Done

- Build `scripts/diagrams/` at the repository root: a Python package with one module per diagram, a shared style module (colors, fonts, node shapes) that mirrors the actual design-system tokens in `docs/design-system/foundations.md` so the diagrams look like they belong to this product, and a `render-all.py` entry point that regenerates every diagram in one run.
- Every diagram must be produced in two layouts: **vertical** (tall, narrow, optimized for embedding in a README or a docs page) and **horizontal** (wide, optimized for a presentation slide). Same content, same styling, different orientation and aspect ratio.
- Diagram set (minimum, more are welcome): system architecture (the five-app monorepo), the pilot's monthly payout-cycle sequence, the tokenization/mint sequence, the whitelist/KYC review flow, the Phase 1a treasury flow, the Phase 1 to Phase 2 roadmap timeline, the deployment topology (testnet vs. mainnet), and the monorepo/workspace structure.
- Output to `docs/diagrams/` as both SVG (for docs, scales cleanly) and PNG (for presentations, universally embeddable), with a clear vertical/horizontal naming convention.
- Embed the vertical versions into the relevant docs (`docs/strategy/product-brief.md`, `docs/strategy/roadmap.md`, `docs/architecture/system-architecture.md`, the root `README.md`), replacing the existing ASCII-art boxes and Mermaid diagrams where a Graphviz version now covers the same content at higher quality. Mermaid diagrams that describe something better suited to a live-rendered sequence (where GitHub's native Mermaid rendering is actually the better reading experience) may stay; use judgment, don't remove Mermaid diagrams reflexively.

## Acceptance Criteria

- `python scripts/diagrams/render_all.py` (or equivalent entry point) regenerates every diagram from a clean checkout with no manual steps.
- Every diagram exists in both a vertical and a horizontal rendering.
- Diagram styling (colors, fonts) is driven by a shared style module referencing the actual tokens in `docs/design-system/foundations.md`, not arbitrary Graphviz defaults.
- At least the eight diagrams listed above exist and are embedded in the relevant documentation.
- A short `scripts/diagrams/README.md` explains how to add a new diagram and how to regenerate the set, so this doesn't become a one-time artifact nobody knows how to update.
- All five required CI workflows pass on the pull request (a CI step that regenerates diagrams and fails if the committed output is stale is a strong option, but not mandatory for this issue).

## Quality Standard

These diagrams are a first-class communication tool for non-technical stakeholders, not internal engineering notes. Every diagram must be legible at the size it will actually be viewed (a slide projected in a room, a README on a phone screen), use consistent iconography and color meaning across the whole set, and avoid unexplained jargon in labels, the same discipline `docs/strategy/decision-log.md` records Bri applying to the ally-facing one-pager.
