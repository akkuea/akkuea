"""
Akkuea - 04 KYC Review Flow
The existing platform build's compliance layer: entirely off-chain, the
'admin as oracle' pattern. An investor uploads documents, the platform admin
manually reviews them, and users.kycStatus flips once every document is
approved. Mirrors docs/api/kyc-workflow.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("kyc-review")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="ortho",
    size="14,15",
    label=hl(
        "Akkuea - KYC Review Flow (existing platform build)",
        "The 'admin as oracle' pattern - no third-party KYC provider",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("investor", hl("Investor", "Uploads compliance documents"),
       style="filled,rounded", fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2")
g.node("admin", hl("Platform Admin", "Reviews documents manually", "The admin IS the compliance decision-maker"),
       style="filled,rounded", fillcolor=F_KYC, color=B_KYC, penwidth="2")
g.node("db", hl("PostgreSQL", "kycDocuments + users.kycStatus"), shape="cylinder",
       style="filled,rounded", fillcolor=F_DB, color=B_DB, penwidth="2")

g.edge("investor", "db",
       label="POST /kyc/upload -> kycDocuments.status = 'pending'", fontsize="9",
       color=B_CLIENT, fontcolor=B_CLIENT, penwidth="2")

with g.subgraph(name="cluster_review") as r:
    r.attr(
        label=hl("Manual Review", "No automated identity verification"),
        style="rounded,dashed",
        color=B_KYC,
        fontcolor=B_KYC,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    r.node("review", hl("Review Document", "POST /kyc/verify/:documentId", "{ verified, notes }"),
             style="filled,rounded", fillcolor=F_KYC, color=B_KYC)
    r.node("recompute", hl("Recompute Status", "Re-evaluate ALL user documents"),
             style="filled,rounded", fillcolor=F_KYC, color=B_KYC)

g.edge("db", "admin", label="Pending documents", style="dashed", fontsize="9", color=E_DEFAULT)
g.edge("admin", "review", fontsize="9")
g.edge("review", "recompute", fontsize="9")

g.node("gate", hl("Any document rejected?"),
        shape="diamond", style="filled", fillcolor=F_DECISION, color=B_DECISION, fontsize="10")
g.edge("recompute", "gate", style="dashed", fontsize="9")

g.node("approved", hl("kycStatus = approved", "Every document approved"),
        shape="box", style="filled,rounded", fillcolor=F_SUCCESS, color=B_SUCCESS)
g.node("rejected", hl("kycStatus = rejected", "Blocks approval, even if others passed"),
        shape="box", style="filled,rounded", fillcolor=F_DANGER, color=B_DANGER)

g.edge("gate", "approved", label="no, all approved", fontsize="9", color=B_SUCCESS, fontcolor=B_SUCCESS)
g.edge("gate", "rejected", label="yes", fontsize="9", color=B_DANGER, fontcolor=B_DANGER)

g.edge("approved", "investor", label="Notification: verification approved", style="dashed", fontsize="9", color=E_SUCCESS)
g.edge("rejected", "investor", label="Notification: verification rejected + reason", style="dashed", fontsize="9", color=E_DANGER)

g.node("note_gap",
       hl("Known Gap", "POST /kyc/verify/:documentId has no auth middleware", "Must be protected before production"),
       shape="note", fillcolor=F_WARNING, color=B_WARNING, fontsize="9")
g.edge("review", "note_gap", style="dotted", color=E_DEFAULT)

render(g, "04-kyc-review")
