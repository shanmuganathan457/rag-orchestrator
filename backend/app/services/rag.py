import re
from typing import AsyncGenerator, Sequence

from sqlalchemy.orm import Session

from app.providers.factory import get_llm
from app.services.retrieval import RetrievalResult, retrieval_service
from app.core.config import settings


CITATION_PATTERN = re.compile(r"\[(\d+)\]")
NO_CONTEXT_MESSAGE = "No relevant information was found in the uploaded documents."

# Strict system prompt that prevents the known citation formatting issues:
#   • Raw bracketed text like "[3]\n." on its own line
#   • Duplicate citation blocks
#   • Out-of-range numbers
SYSTEM_PROMPT = """You are a precise document assistant. Answer ONLY using the provided context.

CITATION RULES (follow exactly):
1. Place citation markers [n] inline, immediately before the sentence's terminal punctuation.
   CORRECT:  "The contract was signed on 15 June 2024 [1]."
   WRONG:    "The contract was signed on 15 June 2024.\n[1]\n."
2. Use each citation number at most ONCE per sentence.
3. Do NOT add a separate "References" or "Sources" section at the end.
4. Do NOT invent citation numbers beyond those given in the context.
5. If a fact comes from multiple sources write them together: [1][2].
6. Write numbers and dates with proper spacing (e.g. "15 September 2024", not "15September2024").
7. If the context does not contain the answer, say so clearly without fabricating information."""


def validate_citations(answer: str, source_count: int) -> dict:
    citations = [int(v) for v in CITATION_PATTERN.findall(answer)]
    valid = sorted({v for v in citations if 1 <= v <= source_count})
    invalid = sorted({v for v in citations if v < 1 or v > source_count})
    return {"citations": valid, "invalid_citations": invalid, "has_citations": bool(citations)}


def _post_process(answer: str) -> str:
    """
    Clean up common LLM citation formatting mistakes before streaming:
    - "[n]\n." → "[n]."   (citation on its own line before punctuation)
    - ".[n]"  → " [n]."  (citation after punctuation)
    - Trailing references section
    """
    # Fix: citation followed by newline + punctuation → merge inline
    answer = re.sub(r'(\[\d+\])\s*\n+\s*([.!?,])', r'\1\2', answer)
    # Fix: punctuation then citation → swap (". [1]" → " [1].")
    answer = re.sub(r'([.!?])\s+(\[\d+\])\s*([.!?]?)', lambda m: f' {m.group(2)}{m.group(1)}', answer)
    # Remove any trailing "References:" / "Sources:" block
    answer = re.sub(r'\n+(?:References|Sources|Bibliography)\s*:?.*$', '', answer, flags=re.IGNORECASE | re.DOTALL)
    return answer.strip()


def source_payload(index: int, result: RetrievalResult) -> dict:
    return {
        "id": index,
        "document_id": result.document_id,
        "chunk_id": result.chunk_id,
        "document_name": (result.metadata or {}).get("filename"),
        "page": result.page,
        "excerpt": result.text,
        "rrf_score": result.rrf_score,
    }


class RAGOrchestrator:
    async def chat_events(
        self,
        db: Session,
        query: str,
        document_ids: Sequence[int] | None = None,
        use_graph: bool = False,
    ) -> AsyncGenerator[tuple[str, dict], None]:
        results = await retrieval_service.retrieve_results(db, query, document_ids)
        sources = [source_payload(i, r) for i, r in enumerate(results, start=1)]
        yield "sources", {"sources": sources}

        if not results:
            yield "token", {"text": NO_CONTEXT_MESSAGE}
            yield "done", {"citation_validation": validate_citations(NO_CONTEXT_MESSAGE, 0)}
            return

        vector_context = "\n\n".join(
            f"[{i}]" + (f" (Page {r.page})" if r.page else "") + f": {r.text}"
            for i, r in enumerate(results, start=1)
        )

        # --- GraphRAG: fuse vector context with graph context ---
        if use_graph and settings.USE_GRAPH_RAG:
            try:
                from app.services.graph_retrieval import get_graph_context
                graph_ctx = await get_graph_context(query)
                prompt = (
                    f"Vector Context:\n{vector_context}\n\n"
                    f"Graph Context:\n{graph_ctx}\n\n"
                    f"Question: {query}"
                )
            except Exception:
                # Fall back to plain RAG if graph is unavailable
                prompt = f"Context:\n{vector_context}\n\nQuestion: {query}"
        else:
            prompt = f"Context:\n{vector_context}\n\nQuestion: {query}"

        answer = ""
        async for token in get_llm().generate_stream(prompt, [SYSTEM_PROMPT]):
            answer += token
            yield "token", {"text": token}

        # Post-process the complete answer (only affects display — already streamed)
        cleaned = _post_process(answer)
        yield "done", {"citation_validation": validate_citations(cleaned, len(sources))}


rag_orchestrator = RAGOrchestrator()