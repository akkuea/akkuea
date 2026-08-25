"""
Akkuea - 05 Phase 1a Treasury Track
The accumulated platform fee is deposited into two already-audited, already-
deployed DeFindex Vaults (a Blend USDC strategy and an EtherFuse CETES
Stablebond strategy) so it earns a return and settles on-chain, checkable by
anyone against the ledger. Mirrors docs/operations/runbook-treasury-track.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("treasury-flow")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="spline",
    size="15,13",
    label=hl(
        "Akkuea - Phase 1a Treasury Track",
        "Platform fee -> DeFindex Vaults -> checkable on-chain yield",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("fee_account", hl("Platform Fee Account", "TREASURY_SOURCE_PUBLIC_KEY", "10% fee from each payout cycle"),
       shape="box", style="filled,rounded", fillcolor=F_WARNING, color=B_WARNING, penwidth="2")

g.node("service", hl("TreasuryService", "apps/api/src/services/TreasuryService.ts"),
       fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2")

with g.subgraph(name="cluster_blend") as bl:
    bl.attr(
        label=hl("DeFindex Vault - Blend", "defindex-blend"),
        style="rounded",
        color=B_ACCENT,
        fontcolor=B_ACCENT,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    bl.node("usdc", hl("USDC", "Underlying asset"), fillcolor=F_CONTRACT, color=B_CONTRACT)
    bl.node("blend_strategy", hl("USDC Blend Strategy"), fillcolor=F_CONTRACT, color=B_CONTRACT)

with g.subgraph(name="cluster_ether") as et:
    et.attr(
        label=hl("DeFindex Vault - EtherFuse", "etherfuse-stablebond"),
        style="rounded",
        color=B_EXTERNAL,
        fontcolor=B_EXTERNAL,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    et.node("cetes", hl("CETES", "Mexican sovereign-debt Stablebond"), fillcolor=F_EXTERNAL, color=B_EXTERNAL)
    et.node("cetes_strategy", hl("CETES Blend Strategy"), fillcolor=F_EXTERNAL, color=B_EXTERNAL)

g.edge("fee_account", "service", label="POST /api/v1/treasury/deposit", fontsize="9", penwidth="2", color=B_BACKEND, fontcolor=B_BACKEND)
g.edge("service", "usdc", label="deposit", fontsize="9", color=B_ACCENT, fontcolor=B_ACCENT, penwidth="2")
g.edge("service", "cetes", label="deposit", fontsize="9", color=B_EXTERNAL, fontcolor=B_EXTERNAL, penwidth="2")
g.edge("usdc", "blend_strategy", style="dashed")
g.edge("cetes", "cetes_strategy", style="dashed")

g.node("position", hl("GET /api/v1/treasury", "Position across every venue", "positionValue, shares"),
       shape="note", fillcolor=F_SUCCESS, color=B_SUCCESS, fontsize="9")
g.edge("blend_strategy", "position", style="dotted", color=E_SUCCESS)
g.edge("cetes_strategy", "position", style="dotted", color=E_SUCCESS)

g.node("history", hl("GET /api/v1/treasury/history", "Failed movements are recorded too", "status = failed, with contract error"),
       shape="note", fillcolor=F_WARNING, color=B_WARNING, fontsize="9")
g.edge("service", "history", style="dotted", color=E_DEFAULT)

g.node("explorer", hl("stellar.expert", "Public ledger verification"),
       shape="box", style="filled,rounded", fillcolor=F_DEFAULT, color=B_DEFAULT)
g.edge("position", "explorer", label="checkable by anyone", style="dashed", fontsize="9", color=E_DEFAULT)

render(g, "05-treasury-flow")
