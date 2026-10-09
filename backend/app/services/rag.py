import re
from typing import AsyncGenerator, Sequence

from sqlalchemy.orm import Session

from app.providers.factory import get_llm
from app.services.retrieval import RetrievalResult, retrieval_service

CITATION_PATTERN = re.compile(r"\[(\d+)\]")
NO_CONTEXT_MESSAGE = "No relevant information was found in the uploaded documents."


def validate_citations(answer: str, source_count: int) -> dict:
    citations = [int(value) for value in CITATION_PATTERN.findall(answer)]
    valid = sorted({value for value in citations if 1 <= value <= source_count})
    invalid = sorted({value for value in citations if value < 1 or value > source_count})
    return {"citations": valid, "invalid_citations": invalid, "has_citations": bool(citations)}


def source_payload(index: int, result: RetrievalResult) -> dict:
    return {"id": index, "document_id": result.document_id, "chunk_id": result.chunk_id, "document_name": (result.metadata or {}).get("filename"), "page": result.page, "excerpt": result.text, "rrf_score": result.rrf_score}


class RAGOrchestrator:
    async def chat_events(self, db: Session, query: str, document_ids: Sequence[int] | None = None) -> AsyncGenerator[tuple[str, dict], None]:
        results = await retrieval_service.retrieve_results(db, query, document_ids)
        sources = [source_payload(index, result) for index, result in enumerate(results, start=1)]
        yield "sources", {"sources": sources}
        if not results:
            yield "token", {"text": NO_CONTEXT_MESSAGE}
            yield "done", {"citation_validation": validate_citations(NO_CONTEXT_MESSAGE, 0)}
            return
        context = "\n\n".join(f"[{index}]" + (f" (Page {result.page})" if result.page else "") + f": {result.text}" for index, result in enumerate(results, start=1))
        prompt = f"Context:\n{context}\n\nQuestion: {query}"
        system = "Answer only from context. Cite sources using [n] matching the provided excerpts."
        answer = ""
        async for token in get_llm().generate_stream(prompt, [system]):
            answer += token
            yield "token", {"text": token}
        yield "done", {"citation_validation": validate_citations(answer, len(sources))}


rag_orchestrator = RAGOrchestrator()