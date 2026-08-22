"""
Akkuea - 06 Roadmap: Phase 1 (Pilot) to Phase 2 (Differentiated Expansion)
Phase 1a (treasury track) runs in parallel with Phase 1b (the core pilot,
testnet then mainnet). Phase 2 is gated on Phase 1 validating. Mirrors the
mermaid flowchart in docs/strategy/roadmap.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("roadmap-timeline")
g.attr(**base_graph_attr(
    rankdir="LR",
    splines="ortho",
    size="22,10",
    label=hl(
        "Akkuea - Roadmap: Phase 1 (Pilot) to Phase 2 (Differentiated Expansion)",
        "Phase 2 is gated on Phase 1 validating, not a fixed calendar date",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

with g.subgraph(name="cluster_phase1") as p1:
    p1.attr(
        label=hl("Phase 1 - Pilot"),
        style="rounded",
        color=B_SUCCESS,
        fontcolor=B_SUCCESS,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    p1.node("p1a", hl("Phase 1a", "Treasury & Early Mainnet Presence", "Parallel, fast - DeFindex + EtherFuse"),
            fillcolor=F_WARNING, color=B_WARNING, penwidth="2")
    p1.node("p1b_testnet", hl("Phase 1b - Testnet Track", "Income token + whitelist + payout-split", "Isolates product-logic risk"),
            fillcolor=F_SUCCESS, color=B_SUCCESS)
    p1.node("p1b_mainnet", hl("Phase 1b - Mainnet Track", "Verified contracts + real ally", "Real investor capital"),
            fillcolor=F_SUCCESS, color=B_SUCCESS, penwidth="2.5")

# Phase 1a runs parallel to 1b, both feed into the pilot validating
g.edge("p1b_testnet", "p1b_mainnet", penwidth="2", color=E_SUCCESS, label="testnet proves the core logic", fontsize="9")

with g.subgraph(name="cluster_phase2") as p2:
    p2.attr(
        label=hl("Phase 2 - Differentiated Expansion", "Gated on Phase 1 validating"),
        style="rounded",
        color=B_ACCENT,
        fontcolor=B_ACCENT,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    p2.node("p2_transfer", hl("Token Transferability", "Secondary market", "Once a real holder base exists"),
            fillcolor=F_ACCENT, color=B_ACCENT)
    p2.node("p2_brazil", hl("Brazil / CVM-88", "Formalization", "Strongest regulatory fit found"),
            fillcolor=F_ACCENT, color=B_ACCENT)
    p2.node("p2_ether", hl("EtherFuse Expanded", "Beyond treasury use", "Once a custom yield strategy exists"),
            fillcolor=F_EXTERNAL, color=B_EXTERNAL)
    p2.node("p2_rmi", hl("Marshall Islands / ENRA", "Government partnership", "Extension of an existing relationship"),
            fillcolor=F_EXTERNAL, color=B_EXTERNAL)
    p2.node("p2_multi", hl("Multi-Tenant Platform", "Beyond one ally", "Only once Phase 1 proves demand"),
            fillcolor=F_KYC, color=B_KYC)
    p2.node("p2_oracle", hl("Yield-Oracle Automation", "API/webhook-verified feed", "Per-ally, once tooling is known"),
            fillcolor=F_KYC, color=B_KYC)

g.node("now", hl("NOW", "Phase 1b: pilot in progress"), shape="circle",
       style="filled", fillcolor=B_WARNING, color=B_WARNING, fontsize="10",
       width="0.5", fixedsize="true", fontcolor=T_WHITE)

g.edge("p1a", "now", penwidth="2", color=E_WARNING, style="dashed", label="runs in parallel", fontsize="9")
g.edge("p1b_mainnet", "now", penwidth="3", color=B_SUCCESS, fontcolor=B_SUCCESS, label="validates", fontsize="10")
g.edge("now", "p2_transfer", penwidth="2", color=B_ACCENT, fontcolor=B_ACCENT, label="gated on validating", fontsize="10")

g.edge("p2_transfer", "p2_brazil", penwidth="2", color=E_CLIENT, style="dashed")
g.edge("p2_brazil", "p2_ether", penwidth="2", color=E_CLIENT, style="dashed")
g.edge("p2_ether", "p2_rmi", penwidth="2", color=E_EXTERNAL, style="dashed")
g.edge("p2_rmi", "p2_multi", penwidth="2", color=E_EXTERNAL, style="dashed")
g.edge("p2_multi", "p2_oracle", penwidth="2", color=E_EXTERNAL, style="dashed")

g.node("criteria", hl("Phase 1 Success Criteria", "1 ally . 5+ investors . 3 consecutive on-chain cycles", "First payout under 60 days of signing"),
       shape="note", fillcolor=F_SUCCESS, color=B_SUCCESS, fontsize="10")
g.edge("p1b_mainnet", "criteria", style="dotted", color=E_DEFAULT)

render(g, "06-roadmap-timeline")
