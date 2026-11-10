"""
GraphRAG retrieval service (free Neo4j Community Edition).

Queries the knowledge graph for entities and relationships relevant to the
user query, then returns a plain-text summary that is fused with the vector
context inside RAGOrchestrator.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_driver():
    """Lazy-create the Neo4j driver so the app starts even if Neo4j is offline."""
    try:
        from neo4j import GraphDatabase  # type: ignore
        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        return driver
    except Exception as exc:
        logger.warning("Neo4j driver could not be created: %s", exc)
        return None


_driver = None


def _get_driver():
    global _driver
    if _driver is None:
        _driver = _build_driver()
    return _driver


async def get_graph_context(query: str, hops: int = 2, top_k: int = 10) -> str:
    """
    Return a textual summary of the sub-graph relevant to *query*.

    Falls back gracefully if Neo4j is unavailable (returns empty string so the
    orchestrator can still serve a pure-vector answer).
    """
    driver = _get_driver()
    if driver is None:
        return ""

    terms = [t.lower() for t in query.split() if len(t) > 2]
    if not terms:
        return ""

    # Basic Cypher: find entities whose name contains any query term, then
    # traverse up to `hops` relationships away.  No APOC needed.
    cypher = """
    MATCH (e:Entity)
    WHERE any(t IN $terms WHERE toLower(e.name) CONTAINS t)
    WITH e LIMIT $top_k
    OPTIONAL MATCH path = (e)-[*1..%d]-(n)
    UNWIND nodes(path) AS node
    WITH collect(DISTINCT node) AS all_nodes, e
    UNWIND all_nodes AS nd
    RETURN nd.name AS name, labels(nd) AS lbls
    """ % hops

    parts: list[str] = []
    try:
        with driver.session() as session:
            result = session.run(cypher, terms=terms, top_k=top_k)
            for record in result:
                label = (record["lbls"] or ["Entity"])[0]
                name = record["name"] or ""
                if name:
                    parts.append(f"{label}({name})")
    except Exception as exc:
        logger.warning("Graph retrieval failed: %s", exc)
        return ""

    if not parts:
        return ""

    return "Related entities from knowledge graph: " + ", ".join(parts)
