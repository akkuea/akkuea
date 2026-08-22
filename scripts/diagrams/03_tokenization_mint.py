"""
Akkuea - 03 Property Tokenization Sequence
The existing platform build's mint flow: a property owner submits a property,
an admin reviews it, and tokenizing it calls mint_shares on the defi-rwa
Soroban contract. Mirrors the mermaid sequence in
docs/architecture/system-architecture.md and docs/api/minting-workflow.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("tokenization-mint")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="ortho",
    size="14,15",
    label=hl(
        "Akkuea - Property Tokenization (existing platform build)",
        "POST /properties/:id/tokenize -> mint_shares on defi-rwa",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

actors = [
    ("owner", "Property Owner", F_CLIENT, B_CLIENT),
    ("fe", "apps/webapp", F_CLIENT, B_CLIENT),
    ("api", "apps/api (Elysia/Bun)", F_BACKEND, B_BACKEND),
    ("db", "PostgreSQL", F_DB, B_DB),
    ("sc", "defi-rwa contract", F_CONTRACT, B_CONTRACT),
]
for node_id, label, fill, border in actors:
    shape = "cylinder" if node_id == "db" else "box"
    g.node(node_id, hl(label), shape=shape, style="filled,rounded",
           fillcolor=fill, color=border, penwidth="2")

g.edge("owner", "fe", label="1.  Submit property details", fontsize="9", color=B_CLIENT, fontcolor=B_CLIENT)
g.edge("fe", "api", label="2.  POST /properties", fontsize="9", color=B_CLIENT, fontcolor=B_CLIENT, penwidth="2")
g.edge("api", "db", label="3.  Insert property (verified=false)", fontsize="9", color=B_BACKEND, fontcolor=B_BACKEND, penwidth="2")

g.node("review", hl("Admin Review Queue", "/internal/operations", "Property must be verified before tokenizing"),
       shape="note", fillcolor=F_DECISION, color=B_DECISION, fontsize="9")
g.edge("db", "review", style="dotted", color=E_DEFAULT)

g.edge("owner", "fe", label="4.  Trigger tokenize", fontsize="9", color=B_CLIENT, fontcolor=B_CLIENT, style="dashed")
g.edge("fe", "api", label="5.  POST /properties/:id/tokenize", fontsize="9", color=B_CLIENT, fontcolor=B_CLIENT, penwidth="2", style="dashed")

with g.subgraph(name="cluster_guard") as gu:
    gu.attr(
        label=hl("Guards", "verified, not already tokenized"),
        style="rounded,dashed",
        color=B_BACKEND,
        fontcolor=B_BACKEND,
        fontname=FONT,
        fontsize="11",
        penwidth="2",
        margin="14",
    )
    gu.node("guard", hl("Validate Preconditions", "property.verified === true", "tokenAddress === null"),
             fillcolor=F_BACKEND, color=B_BACKEND)

g.edge("api", "guard", style="dashed", fontsize="9")

g.edge("guard", "sc",
       label="6.  mint_shares(admin, property_id, owner, amount)", fontsize="9",
       color=B_CONTRACT, fontcolor=B_CONTRACT, penwidth="2")
g.edge("sc", "api", label="7.  txHash", fontsize="9", style="dashed", color=B_CONTRACT, fontcolor=B_CONTRACT)
g.edge("api", "db",
       label="8.  Write tokenAddress only after on-chain success", fontsize="9",
       color=B_SUCCESS, fontcolor=B_SUCCESS, penwidth="2")
g.edge("api", "fe", label="9.  200 { txHash, tokenAddress, ... }", fontsize="9", style="dashed", color=B_SUCCESS, fontcolor=B_SUCCESS)

render(g, "03-tokenization-mint")
