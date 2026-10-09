from dataclasses import dataclass
from math import isfinite
from typing import Iterable, Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.document import DocumentChunk
from app.providers.factory import get_embedding


@dataclass(frozen=True)
class RetrievalResult:
    chunk_id: int
    document_id: int
    text: str
    page: int | None
    vector_score: float | None
    keyword_score: float | None
    rrf_score: float
    metadata: dict | None


def reciprocal_rank_fusion(
    vector_results: Iterable[tuple[int, float]],
    keyword_results: Iterable[tuple[int, float]],
    rrf_k: int,
) -> list[tuple[int, float, float | None, float | None]]:
    """Merge ranked result lists deterministically using one-based RRF ranks."""
    if rrf_k < 1:
        raise ValueError("rrf_k must be at least 1")

    scores: dict[int, dict[str, float | None]] = {}
    for source, results in (("vector", vector_results), ("keyword", keyword_results)):
        for rank, (chunk_id, raw_score) in enumerate(results, start=1):
            if chunk_id not in scores:
                scores[chunk_id] = {"rrf": 0.0, "vector": None, "keyword": None}
            scores[chunk_id]["rrf"] = float(scores[chunk_id]["rrf"] or 0.0) + 1.0 / (rrf_k + rank)
            if scores[chunk_id][source] is None:
                scores[chunk_id][source] = float(raw_score)

    return [
        (chunk_id, float(score["rrf"] or 0.0), score["vector"], score["keyword"])
        for chunk_id, score in sorted(scores.items(), key=lambda item: (-float(item[1]["rrf"] or 0.0), item[0]))
    ]


class HybridRetrievalService:
    def __init__(
        self,
        top_k: int | None = None,
        rrf_k: int | None = None,
        vector_top_k: int | None = None,
        keyword_top_k: int | None = None,
        embedding_dimension: int | None = None,
    ):
        self.vector_top_k = vector_top_k if vector_top_k is not None else settings.VECTOR_TOP_K
        self.keyword_top_k = keyword_top_k if keyword_top_k is not None else settings.KEYWORD_TOP_K
        self.top_k = top_k if top_k is not None else settings.FINAL_TOP_K
        self.rrf_k = rrf_k if rrf_k is not None else settings.RRF_K
        self.embedding_dimension = embedding_dimension if embedding_dimension is not None else settings.EMBEDDING_DIMENSION
        if min(self.vector_top_k, self.keyword_top_k, self.top_k, self.rrf_k, self.embedding_dimension) < 1:
            raise ValueError("retrieval settings must be positive")

    @staticmethod
    def _normalise_document_ids(document_ids: Sequence[int] | None) -> list[int] | None:
        if document_ids is None:
            return None
        if not document_ids:
            return []
        if any(isinstance(document_id, bool) or not isinstance(document_id, int) or document_id < 1 for document_id in document_ids):
            raise ValueError("document_ids must contain positive integer IDs")
        return sorted(set(document_ids))

    def _validate_embedding(self, embedding: Sequence[float]) -> list[float]:
        if len(embedding) != self.embedding_dimension:
            raise ValueError(
                f"Query embedding dimension {len(embedding)} does not match expected {self.embedding_dimension}"
            )
        values = [float(value) for value in embedding]
        if not all(isfinite(value) for value in values):
            raise ValueError("Query embedding contains non-finite values")
        return values

    async def retrieve_results(
        self, db: Session, query: str, document_ids: Sequence[int] | None = None
    ) -> list[RetrievalResult]:
        if not isinstance(query, str) or not query.strip():
            return []
        document_ids = self._normalise_document_ids(document_ids)
        if document_ids == []:
            return []

        embedding = self._validate_embedding(await get_embedding().embed_text(query))
        params = {
            "embedding": "[" + ",".join(str(value) for value in embedding) + "]",
            "query": query.strip(),
            "vector_top_k": self.vector_top_k,
            "keyword_top_k": self.keyword_top_k,
        }
        where_filter = ""
        if document_ids:
            where_filter = " AND document_id = ANY(:document_ids)"
            params["document_ids"] = document_ids

        vector_sql = text(
            "SELECT id, 1 - (embedding <=> CAST(:embedding AS vector)) AS score "
            "FROM document_chunks WHERE embedding IS NOT NULL" + where_filter + " "
            "ORDER BY embedding <=> CAST(:embedding AS vector), id LIMIT :vector_top_k"
        )
        keyword_sql = text(
            "SELECT id, ts_rank_cd(full_text_search, websearch_to_tsquery('english', :query)) AS score "
            "FROM document_chunks WHERE full_text_search @@ websearch_to_tsquery('english', :query)" + where_filter + " "
            "ORDER BY score DESC, id LIMIT :keyword_top_k"
        )
        vector_rows = [(row.id, float(row.score)) for row in db.execute(vector_sql, params).fetchall()]
        keyword_rows = [(row.id, float(row.score)) for row in db.execute(keyword_sql, params).fetchall()]
        fused = reciprocal_rank_fusion(vector_rows, keyword_rows, self.rrf_k)[: self.top_k]
        if not fused:
            return []

        chunks = db.query(DocumentChunk).filter(DocumentChunk.id.in_([item[0] for item in fused])).all()
        by_id = {chunk.id: chunk for chunk in chunks}
        return [
            RetrievalResult(
                chunk_id=chunk_id,
                document_id=by_id[chunk_id].document_id,
                text=by_id[chunk_id].content,
                page=by_id[chunk_id].page_num,
                vector_score=vector_score,
                keyword_score=keyword_score,
                rrf_score=rrf_score,
                metadata=by_id[chunk_id].document.metadata_ if by_id[chunk_id].document else None,
            )
            for chunk_id, rrf_score, vector_score, keyword_score in fused
            if chunk_id in by_id
        ]

    async def retrieve(self, db: Session, query: str, document_ids: Sequence[int] | None = None) -> list[DocumentChunk]:
        results = await self.retrieve_results(db, query, document_ids)
        if not results:
            return []
        chunks = db.query(DocumentChunk).filter(DocumentChunk.id.in_([result.chunk_id for result in results])).all()
        by_id = {chunk.id: chunk for chunk in chunks}
        return [by_id[result.chunk_id] for result in results if result.chunk_id in by_id]


retrieval_service = HybridRetrievalService()