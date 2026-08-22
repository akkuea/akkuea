"""
Akkuea - 01 System Architecture
The five-app monorepo: two Next.js frontends, one Elysia API, one shared
TypeScript library, and one Rust/Soroban contracts workspace holding two
independent contract systems (the existing defi-rwa platform and the four
Akkuea Land game contracts). Mirrors the mermaid diagram in
docs/architecture/system-architecture.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("system-architecture")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="polyline",
    size="16,16",
    label=hl(
        "Akkuea - System Architecture",
        "Five-app Bun monorepo on Stellar / Soroban",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

with g.subgraph(name="cluster_frontends") as fe:
    fe.attr(
        label=hl("Frontends"),
        style="rounded,dashed",
        color=B_CLIENT,
        fontcolor=B_CLIENT,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    fe.node("webapp", hl("apps/webapp", "Next.js 16 + React 19", "Existing platform build"),
             fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2")
    fe.node("land", hl("apps/akkuea-land", "Next.js", "Pilot's visual companion"),
             fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2")

g.node("api", hl("apps/api", "Elysia / Bun", "localhost:3001"),
       fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2")
g.node("shared", hl("apps/shared", "Types . Validation", "Stellar SDK helpers"),
       fillcolor=F_MONOREPO, color=B_MONOREPO, penwidth="2")

g.node("db", hl("PostgreSQL", "via Drizzle"), shape="cylinder",
       fillcolor=F_DB, color=B_DB)
g.node("redis", hl("Redis", "optional cache"), shape="cylinder",
       fillcolor=F_DB, color=B_DB)

with g.subgraph(name="cluster_stellar") as st:
    st.attr(
        label=hl("Stellar Network (Soroban)", "apps/contracts - two independent contract systems"),
        style="rounded,dashed",
        color=B_CONTRACT,
        fontcolor=B_CONTRACT,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    st.node("rwa", hl("defi-rwa", "Shares + lending", "Existing platform build"),
             fillcolor=F_CONTRACT, color=B_CONTRACT, penwidth="2")
    st.node("g_engine", hl("game-engine"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    st.node("g_nft", hl("game-property-nft"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    st.node("g_token", hl("game-land-token"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    st.node("g_mkt", hl("game-marketplace"), fillcolor=F_CONTRACT, color=B_CONTRACT)

# Frontend <-> API
g.edge("webapp", "api", dir="both", penwidth="2", color=E_CLIENT)
g.edge("land", "api", dir="both", penwidth="2", color=E_CLIENT)

# Direct wallet calls to contracts
g.edge("webapp", "rwa", label="direct wallet calls", style="dashed", fontsize="9", color=E_CONTRACT)
g.edge("land", "g_engine", label="direct wallet calls", style="dashed", fontsize="9", color=E_CONTRACT)
g.edge("land", "g_nft", style="dashed", color=E_CONTRACT)
g.edge("land", "g_token", style="dashed", color=E_CONTRACT)
g.edge("land", "g_mkt", style="dashed", color=E_CONTRACT)

# API infra
g.edge("api", "db", dir="both", penwidth="2", color=E_BACKEND)
g.edge("api", "redis", dir="both", penwidth="2", color=E_BACKEND)
g.edge("api", "rwa", label="admin-signed transactions", fontsize="9", penwidth="2", color=E_BACKEND)

# Shared library
g.edge("webapp", "shared", dir="none", style="dotted", color=E_DEFAULT)
g.edge("land", "shared", dir="none", style="dotted", color=E_DEFAULT)
g.edge("api", "shared", dir="none", style="dotted", color=E_DEFAULT)

render(g, "01-system-architecture")
