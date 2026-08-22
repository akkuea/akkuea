"""
Akkuea - 07 Deployment Topology
Development (local machine, Stellar Testnet) versus Production (load-balanced
services, Stellar Mainnet). Mirrors the Deployment Architecture section of
docs/architecture/system-architecture.md.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("deployment-topology")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="polyline",
    size="16,15",
    label=hl(
        "Akkuea - Deployment Topology",
        "Development (Stellar Testnet) vs Production (Stellar Mainnet)",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

with g.subgraph(name="cluster_dev") as dev:
    dev.attr(
        label=hl("Development", "Local machine"),
        style="rounded",
        color=B_CLIENT,
        fontcolor=B_CLIENT,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    dev.node("dev_webapp", hl("apps/webapp", "localhost:3000"), fillcolor=F_CLIENT, color=B_CLIENT)
    dev.node("dev_land", hl("apps/akkuea-land"), fillcolor=F_CLIENT, color=B_CLIENT)
    dev.node("dev_api", hl("apps/api", "localhost:3001"), fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2")
    dev.node("dev_db", hl("PostgreSQL + Redis", "docker-compose.dev.yml"), shape="cylinder",
              fillcolor=F_DB, color=B_DB)
    dev.node("testnet", hl("Stellar Testnet", "defi-rwa + game-* + pilot contracts"),
              fillcolor=F_CONTRACT, color=B_CONTRACT, penwidth="2")

    dev.edge("dev_webapp", "dev_api", dir="both")
    dev.edge("dev_land", "dev_api", dir="both")
    dev.edge("dev_api", "dev_db", dir="both")
    dev.edge("dev_api", "testnet", label="admin-signed", fontsize="9")
    dev.edge("dev_webapp", "testnet", label="wallet-signed", fontsize="9", style="dashed")

with g.subgraph(name="cluster_prod") as prod:
    prod.attr(
        label=hl("Production"),
        style="rounded",
        color=B_ACCENT,
        fontcolor=B_ACCENT,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    prod.node("prod_fe", hl("Frontends", "Static / edge hosting"), fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2")
    prod.node("prod_api", hl("API", "Load-balanced Elysia/Bun"), fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2")
    prod.node("prod_db", hl("Managed PostgreSQL", "+ Redis (optional)"), shape="cylinder",
               fillcolor=F_DB, color=B_DB, penwidth="2")
    prod.node("mainnet", hl("Stellar Mainnet", "defi-rwa + game-* deployed independently"),
               fillcolor=F_CONTRACT, color=B_CONTRACT, penwidth="2.5")

    prod.edge("prod_fe", "prod_api", dir="both", penwidth="2")
    prod.edge("prod_api", "prod_db", dir="both", penwidth="2")
    prod.edge("prod_api", "mainnet", label="admin-signed", fontsize="9", penwidth="2")
    prod.edge("prod_fe", "mainnet", label="wallet-signed", fontsize="9", style="dashed", penwidth="2")

g.edge("testnet", "mainnet", label="verified integrations promote to mainnet", fontsize="9",
       style="dashed", color=E_WARNING, fontcolor=E_WARNING, penwidth="2", constraint="false")

render(g, "07-deployment-topology")
