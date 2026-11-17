import logging
import re
from typing import AsyncGenerator, Sequence

from sqlalchemy.orm import Session

from app.core.config import settings
from app.providers.factory import get_llm
from app.services.retrieval import RetrievalResult, retrieval_service

logger = logging.getLogger(__name__)

CITATION_PATTERN = re.compile(r"\[(\d+)\]")

# Rich conversational system prompt for document-grounded answers
SYSTEM_PROMPT = """You are RAG Orchestrator, an intelligent, articulate AI assistant with access to user documents and knowledge graphs.

HOW TO ANSWER:
1. Ground your answers thoroughly in the provided Context.
2. Place citation markers [n] inline, immediately before the terminal punctuation.
   Example: "The total sales revenue reached $45,000 in Q3 [1]."
3. Use each citation number at most ONCE per sentence.
4. Do NOT add a separate "References" or "Sources" section at the end.
5. If a fact comes from multiple sources, write them together: [1][2].
6. Write numbers, currencies, and dates with clear spacing.
7. You may synthesize, explain, analyze, and provide reasoning based on the context. If the user asks for calculations, summaries, or insights, compute and explain them clearly."""

# Conversational system prompt when no specific document chunks are matched
GENERAL_ASSISTANT_PROMPT = """You are RAG Orchestrator, an intelligent and friendly AI assistant.
Answer the user's question clearly, thoroughly, and intelligently.
You excel at data analysis, conversational chat, answering questions, writing code, reasoning, and explaining concepts.
If the user asks about specific private uploaded documents that are not available in context, provide a helpful general response and let them know they can select or reference their uploaded documents for direct citations."""


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

        # If no specific document chunks are found, don't fail! Act as a real conversational AI assistant.
        if not results:
            answer = ""
            try:
                async for token in get_llm().generate_stream(query, [GENERAL_ASSISTANT_PROMPT]):
                    answer += token
                    yield "token", {"text": token}
            except Exception as exc:
                logger.warning("Conversational LLM streaming failed: %s", exc)
                fallback = (
                    "Hello! I am RAG Orchestrator, your AI assistant. "
                    "To generate answers with full citations, please select or upload a document in the sidebar. "
                    "(If using cloud deployment, please ensure you configured a free Groq or Gemini API key in ⚙️ Settings)."
                )
                yield "token", {"text": fallback}
                answer = fallback

            yield "done", {"citation_validation": validate_citations(answer, 0)}
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
                    f"Vector Context (from uploaded documents):\n{vector_context}\n\n"
                    f"Knowledge Graph Context (entity relationships):\n{graph_ctx}\n\n"
                    f"User Question: {query}"
                )
            except Exception:
                prompt = f"Context:\n{vector_context}\n\nUser Question: {query}"
        else:
            prompt = f"Context:\n{vector_context}\n\nUser Question: {query}"

        answer = ""
        try:
            async for token in get_llm().generate_stream(prompt, [SYSTEM_PROMPT]):
                answer += token
                yield "token", {"text": token}
        except Exception as exc:
            logger.error("LLM streaming failed: %s", exc)
            err_msg = (
                "⚠️ AI Generation Error: Unable to connect to the active LLM provider. "
                "Please open ⚙️ Settings in the sidebar and make sure your API key (e.g. Groq or Gemini) is set."
            )
            yield "token", {"text": err_msg}
            answer = err_msg

        cleaned = _post_process(answer)
        yield "done", {"citation_validation": validate_citations(cleaned, len(sources))}


rag_orchestrator = RAGOrchestrator()