"""
Akkuea shared design-system tokens for Graphviz diagrams.

Every value below is copied directly from the real design tokens documented
in docs/design-system/foundations.md (light theme, since diagrams render on
white documentation pages and in slide decks), sourced ultimately from
apps/shared/src/styles/tokens.css. Nothing here is invented: the six real
chromatic tokens (accent, accent-secondary, accent-tertiary, accent-quaternary,
warning, destructive) cover every diagram category without needing to
generate anything. Transparent background so diagrams render cleanly on both
light docs pages and dark slide decks.
"""

# Background
BGCOLOR = "transparent"

# Typography
FONT = "Helvetica"
T_DARK = "#0A0A0A"  # --foreground (light)          primary text
T_MED = "#737373"  # --muted-foreground              secondary / edge labels
T_LITE = "#A3A3A3"  # --foreground-subtle (light)     minor annotations
T_WHITE = "#FFFFFF"  # --primary-foreground (light)

# Node fills (light, opaque tints of the real accent hues)
F_DEFAULT = "#FAFAFA"  # --card (light)                          general nodes
F_CLIENT = "#EAF4FB"  # tint, frontend / client                  browser / frontend
F_BACKEND = "#EBF9F3"  # --accent-secondary tint                  backend API
F_CONTRACT = "#FBEEEA"  # --accent tint                            smart contracts / on-chain
F_EXTERNAL = "#F1EAFB"  # --accent-quaternary tint                 Stellar network / external
F_DECISION = "#FFF4E5"  # --accent-tertiary tint                   decision / gate nodes
F_SUCCESS = "#E2F8EE"  # --accent-secondary tint, deeper tier      success / terminal states
F_DANGER = "#FBEAEA"  # --destructive tint                        error / blocker states
F_ACCENT = "#FBEEEA"  # --accent tint                              accent / highlight nodes
F_WARNING = "#FFF3E5"  # --warning tint                            advisory / pending states
F_DB = "#FFF4E5"  # --accent-tertiary tint                        database / storage
F_KYC = "#F1EAFB"  # --accent-quaternary tint                     KYC / compliance
F_MONOREPO = "#EAF4FB"  # tint, structural                        monorepo / workspace

# Borders (real tokens, exact where a real token exists)
B_DEFAULT = "#D4D4D4"  # --border-hover (light)
B_CLIENT = "#0284C7"  # sky-600, structural (client/frontend)
B_BACKEND = "#00C969"  # --accent-secondary (exact)
B_CONTRACT = "#FF3E00"  # --accent (exact)
B_EXTERNAL = "#B388FF"  # --accent-quaternary (exact)
B_DECISION = "#F5A623"  # --accent-tertiary (exact)
B_SUCCESS = "#0C9755"  # --accent-secondary, deeper lightness tier
B_DANGER = "#FF4444"  # --destructive (exact)
B_ACCENT = "#FF3E00"  # --accent (exact)
B_WARNING = "#FFAB40"  # --warning (exact)
B_DB = "#F5A623"  # --accent-tertiary (exact)
B_KYC = "#B388FF"  # --accent-quaternary (exact)
B_MONOREPO = "#0284C7"  # sky-600, structural (monorepo/workspace)

# Edges
E_DEFAULT = "#A3A3A3"  # --foreground-subtle (light)
E_SUCCESS = "#0C9755"  # --accent-secondary, deeper lightness tier
E_DANGER = "#FF4444"  # --destructive (exact)
E_WARNING = "#FFAB40"  # --warning (exact)
E_CLIENT = "#0284C7"  # structural (client/frontend)
E_BACKEND = "#00C969"  # --accent-secondary (exact)
E_CONTRACT = "#FF3E00"  # --accent (exact)
E_EXTERNAL = "#B388FF"  # --accent-quaternary (exact)
E_DECISION = "#F5A623"  # --accent-tertiary (exact)


# Helpers


def _safe(text: str) -> str:
    """Sanitize text for Graphviz HTML-label content."""
    return text.replace("&", "&amp;").replace("\n", "<BR/>").replace("->", "-&gt;")


def hl(title: str, subtitle: str = "", subtitle2: str = "") -> str:
    """HTML label: bold title plus optional smaller subtitle lines."""
    s = f"<B>{_safe(title)}</B>"
    if subtitle:
        s += f'<BR/><FONT POINT-SIZE="9" COLOR="{T_MED}">{_safe(subtitle)}</FONT>'
    if subtitle2:
        s += f'<BR/><FONT POINT-SIZE="9" COLOR="{T_MED}">{_safe(subtitle2)}</FONT>'
    return f"<{s}>"


def render(g, name: str, out: str = "docs/diagrams") -> None:
    """Render graph to both SVG and PNG, in vertical and horizontal variants."""
    from pathlib import Path

    Path(out).mkdir(parents=True, exist_ok=True)

    # Vertical (default), top-to-bottom layout
    svg_v = g.pipe(format="svg")
    png_v = g.pipe(format="png")
    Path(f"{out}/{name}-vertical.svg").write_bytes(svg_v)
    Path(f"{out}/{name}-vertical.png").write_bytes(png_v)

    # Horizontal, left-to-right layout (clone rankdir)
    g_copy = g.copy()
    current_rankdir = g_copy.graph_attr.get("rankdir", "TB")
    if current_rankdir == "TB":
        g_copy.attr(rankdir="LR")
    svg_h = g_copy.pipe(format="svg")
    png_h = g_copy.pipe(format="png")
    Path(f"{out}/{name}-horizontal.svg").write_bytes(svg_h)
    Path(f"{out}/{name}-horizontal.png").write_bytes(png_h)

    print(f"  OK {name}  (.svg + .png, vertical + horizontal)")


def base_graph_attr(**extra):
    return {
        "bgcolor": BGCOLOR,
        "fontname": FONT,
        "fontsize": "13",
        "fontcolor": T_DARK,
        "labelloc": "t",
        "labeljust": "l",
        "pad": "0.7",
        "nodesep": "0.55",
        "ranksep": "0.8",
        "dpi": "150",
        **extra,
    }


def base_node_attr(**extra):
    return {
        "shape": "box",
        "style": "filled,rounded",
        "fillcolor": F_DEFAULT,
        "color": B_DEFAULT,
        "fontname": FONT,
        "fontsize": "11",
        "fontcolor": T_DARK,
        "margin": "0.22,0.13",
        "penwidth": "1.6",
        **extra,
    }


def base_edge_attr(**extra):
    return {
        "color": E_DEFAULT,
        "fontname": FONT,
        "fontsize": "10",
        "fontcolor": T_MED,
        "arrowsize": "0.85",
        "penwidth": "1.4",
        **extra,
    }
