"""
Akkuea - 02 Monthly Income Distribution Cycle
The pilot's payout cycle: an allied agency submits income evidence, an Akkuea
operator reviews and approves it, and the payout-split contract deducts a 10%
platform fee before distributing the remainder pro-rata to token holders.
Mirrors the mermaid sequence in docs/strategy/product-brief.md.

Status: target design. The payout-split contract is pending Issue #722 (see
docs/operations/runbook-dividends-placeholder.md) - this diagram documents the
intended flow, not a shipped endpoint.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("payout-cycle")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="polyline",
    size="15,14",
    label=hl(
        "Akkuea - Monthly Income Distribution Cycle",
        "Target design, pending Issue #722 - see docs/strategy/product-brief.md",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

actors = [
    ("ally", "Allied Agency", F_CLIENT, B_CLIENT),
    ("operator", "Akkuea Operator", F_DECISION, B_DECISION),
    ("contract", "Payout-Split Contract", F_CONTRACT, B_CONTRACT),
    ("investor", "Token Holder", F_BACKEND, B_BACKEND),
]

for node_id, label, fill, border in actors:
    g.node(node_id, hl(label), shape="box", style="filled,rounded",
           fillcolor=fill, color=border, penwidth="2")

g.edge("ally", "operator",
       label="1.  Submit income evidence (bank statement / PM export)", fontsize="9",
       color=B_CLIENT, fontcolor=B_CLIENT, penwidth="2")

with g.subgraph(name="cluster_review") as r:
    r.attr(
        label=hl("Manual Review", "Human-reviewed, not automated"),
        style="rounded,dashed",
        color=B_DECISION,
        fontcolor=B_DECISION,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    r.node("review", hl("Review Evidence", "Operator checks the submission", "Approve or reject"),
           fillcolor=F_DECISION, color=B_DECISION)

g.edge("operator", "review", style="dashed", fontsize="9")

g.edge("review", "contract",
       label="2.  Record evidence hash + link on-chain", fontsize="9",
       color=B_DECISION, fontcolor=B_DECISION, penwidth="2")
g.edge("operator", "contract",
       label="3.  Approve distribution for this cycle", fontsize="9",
       color=B_DECISION, fontcolor=B_DECISION, penwidth="2", style="dashed")

with g.subgraph(name="cluster_split") as d:
    d.attr(
        label=hl("On-Chain Split", "Executes atomically"),
        style="rounded,dashed",
        color=B_CONTRACT,
        fontcolor=B_CONTRACT,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    d.node("fee", hl("Platform Fee", "10% deducted", "Visible on-chain, not negotiated"),
           fillcolor=F_WARNING, color=B_WARNING)
    d.node("distribute", hl("Pro-Rata Distribution", "Remaining 90%", "Fixed holder set, no snapshot needed"),
           fillcolor=F_SUCCESS, color=B_SUCCESS)

g.edge("contract", "fee", style="dashed", fontsize="9")
g.edge("fee", "distribute", label="4.  Deduct fee, then distribute", fontsize="9")

g.edge("distribute", "investor",
       label="5.  USDC, or EURC via on-chain swap", fontsize="9",
       color=B_SUCCESS, fontcolor=B_SUCCESS, penwidth="2")

g.node("dashboard",
       hl("Read-Only Dashboard", "On-time / late / disputed / not received", "Driven off on-chain events, no accounts"),
       shape="note", fillcolor=F_ACCENT, color=B_ACCENT, fontsize="9")
g.edge("investor", "dashboard", label="6.  Status reflected per cycle", style="dotted", fontsize="9", color=E_DEFAULT)

render(g, "02-payout-cycle")
