"""
GraphRAG ingestion helper (free Neo4j Community + spaCy en_core_web_sm).

Called after a document chunk is persisted to PostgreSQL.  Extracts named
entities with spaCy and stores them as nodes in Neo4j, linking them back to
the chunk they came from.

Usage:
    from app.services.graph_ingest import graph_ingest
    graph_ingest(chunk_id=42, text="Apple was founded by Steve Jobs in 1976.")

If Neo4j or spaCy is unavailable the call is a no-op — the system degrades
gracefully to plain vector RAG.
"""
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_nlp = None
_driver = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy  # type: ignore
            _nlp = spacy.load("en_core_web_sm")
        except Exception as exc:
            logger.warning("spaCy model could not be loaded: %s", exc)
    return _nlp


def _get_driver():
    global _driver
    if _driver is None:
        try:
            from neo4j import GraphDatabase  # type: ignore
            _driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            )
        except Exception as exc:
            logger.warning("Neo4j driver could not be created: %s", exc)
    return _driver


def graph_ingest(chunk_id: int, text: str) -> None:
    """
    Extract entities from *text* and upsert them into the Neo4j graph,
    linking each entity to the Chunk node identified by *chunk_id*.
    """
    if not settings.USE_GRAPH_RAG:
        return

    nlp = _get_nlp()
    driver = _get_driver()
    if nlp is None or driver is None:
        return

    doc = nlp(text)
    entities = [(ent.text.strip(), ent.label_) for ent in doc.ents if ent.text.strip()]
    if not entities:
        return

    try:
        with driver.session() as session:
            # Upsert the chunk node
            session.run(
                "MERGE (c:Chunk {id: $cid}) SET c.text = $txt",
                cid=chunk_id,
                txt=text[:500],  # store a preview only
            )
            for name, label in entities:
                session.run(
                    """
                    MERGE (e:Entity {name: $name, type: $typ})
                    WITH e
                    MATCH (c:Chunk {id: $cid})
                    MERGE (c)-[:MENTIONS]->(e)
                    """,
                    name=name,
                    typ=label,
                    cid=chunk_id,
                )
        logger.debug("Graph ingest OK – chunk %s, %d entities", chunk_id, len(entities))
    except Exception as exc:
        logger.warning("Graph ingest failed for chunk %s: %s", chunk_id, exc)

