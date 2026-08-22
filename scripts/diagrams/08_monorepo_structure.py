"""
Akkuea - 08 Monorepo Structure
The apps/ workspace tree: five applications, four of them bun workspaces plus
the Rust contracts workspace, which itself holds two independent contract
systems. Mirrors the Project Structure section of README.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("monorepo-structure")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="polyline",
    size="16,14",
    label=hl(
        "Akkuea - Monorepo Structure",
        "Bun workspaces under apps/, plus the Rust contracts workspace",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("root", hl("akkuea/", "Bun monorepo root"),
       shape="box", style="filled,rounded,bold", fillcolor=F_MONOREPO, color=B_MONOREPO, penwidth="3")

g.node("apps", hl("apps/"), fillcolor=F_MONOREPO, color=B_MONOREPO, penwidth="2")
g.edge("root", "apps", penwidth="2")

g.node("webapp", hl("webapp/", "Next.js 16 + React 19", "@akkuea/webapp - existing platform build"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("land", hl("akkuea-land/", "Next.js", "@akkuea/akkuea-land - pilot's visual companion"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("api", hl("api/", "Elysia / Bun", "@akkuea/api"),
       fillcolor=F_BACKEND, color=B_BACKEND)
g.node("shared", hl("shared/", "TypeScript", "@akkuea/shared - imported by webapp, land, api"),
       fillcolor=F_KYC, color=B_KYC)
g.node("contracts", hl("contracts/", "Rust / Soroban", "Not a bun workspace, built separately"),
       fillcolor=F_CONTRACT, color=B_CONTRACT, penwidth="2")

for child in ("webapp", "land", "api", "shared", "contracts"):
    g.edge("apps", child, penwidth="2")

with g.subgraph(name="cluster_contracts") as c:
    c.attr(
        label=hl("Two independent contract systems"),
        style="rounded,dashed",
        color=B_CONTRACT,
        fontcolor=B_CONTRACT,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    c.node("rwa", hl("defi-rwa/", "Existing platform build", "Fractional shares + lending"),
            fillcolor=F_CONTRACT, color=B_CONTRACT, penwidth="2")
    c.node("g_nft", hl("game-property-nft/"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    c.node("g_token", hl("game-land-token/"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    c.node("g_engine", hl("game-engine/"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    c.node("g_mkt", hl("game-marketplace/"), fillcolor=F_CONTRACT, color=B_CONTRACT)

for child in ("rwa", "g_nft", "g_token", "g_engine", "g_mkt"):
    g.edge("contracts", child)

g.node("pilot_note",
       hl("Pilot contract surface", "Income token + whitelist + payout-split", "Being built here, as a third independent system"),
       shape="note", fillcolor=F_WARNING, color=B_WARNING, fontsize="9")
g.edge("contracts", "pilot_note", style="dotted", color=E_DEFAULT)

# shared library consumed by all three TypeScript workspaces
g.edge("webapp", "shared", style="dotted", dir="none", color=E_DEFAULT)
g.edge("land", "shared", style="dotted", dir="none", color=E_DEFAULT)
g.edge("api", "shared", style="dotted", dir="none", color=E_DEFAULT)

render(g, "08-monorepo-structure")
