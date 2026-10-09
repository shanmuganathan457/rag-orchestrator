from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services.retrieval import HybridRetrievalService, reciprocal_rank_fusion


def test_rrf_scores_deduplicate_and_order_deterministically():
    fused = reciprocal_rank_fusion([(2, 0.8), (1, 0.9)], [(1, 4.0), (2, 3.0), (3, 2.0)], 60)

    assert [row[0] for row in fused] == [1, 2, 3]
    assert fused[0][1] == pytest.approx(1 / 62 + 1 / 61)
    assert fused[0][2:] == (0.9, 4.0)


def test_rrf_empty_lists_and_ties_are_stable():
    assert reciprocal_rank_fusion([], [], 60) == []
    tied = reciprocal_rank_fusion([(9, 1.0), (3, 1.0)], [], 1)
    assert [row[0] for row in tied] == [9, 3]
    exact_tie = reciprocal_rank_fusion([(9, 1.0)], [(3, 1.0)], 1)
    assert [row[0] for row in exact_tie] == [3, 9]


def test_invalid_retrieval_settings_and_document_filters_fail_clearly():
    with pytest.raises(ValueError, match="positive"):
        HybridRetrievalService(top_k=0)
    with pytest.raises(ValidationError):
        Settings(VECTOR_TOP_K=0)
    with pytest.raises(ValueError, match="positive integer"):
        HybridRetrievalService._normalise_document_ids([1, -2])


@pytest.mark.asyncio
async def test_empty_query_and_empty_document_scope_skip_embedding():
    service = HybridRetrievalService(embedding_dimension=3)
    assert await service.retrieve_results(SimpleNamespace(), "   ") == []
    assert await service.retrieve_results(SimpleNamespace(), "question", []) == []


@pytest.mark.asyncio
async def test_embedding_dimension_mismatch_is_rejected(monkeypatch):
    class Provider:
        async def embed_text(self, query):
            return [0.1, 0.2]

    monkeypatch.setattr("app.services.retrieval.get_embedding", lambda: Provider())
    with pytest.raises(ValueError, match="dimension 2"):
        await HybridRetrievalService(embedding_dimension=3).retrieve_results(SimpleNamespace(), "question")


@pytest.mark.asyncio
async def test_retrieval_builds_parameterized_queries_and_preserves_metadata(monkeypatch):
    class Provider:
        async def embed_text(self, query):
            return [0.1, 0.2, 0.3]

    class Result:
        def __init__(self, rows):
            self.rows = rows

        def fetchall(self):
            return self.rows

    chunk = SimpleNamespace(
        id=7,
        document_id=4,
        content="Matched passage",
        page_num=2,
        document=SimpleNamespace(metadata_={"filename": "guide.pdf"}),
    )

    class Query:
        def filter(self, *_):
            return self

        def all(self):
            return [chunk]

    class Db:
        def __init__(self):
            self.calls = []

        def execute(self, statement, params):
            self.calls.append((str(statement), params))
            rows = [SimpleNamespace(id=7, score=0.9)] if len(self.calls) == 1 else [SimpleNamespace(id=7, score=0.5)]
            return Result(rows)

        def query(self, *_):
            return Query()

    monkeypatch.setattr("app.services.retrieval.get_embedding", lambda: Provider())
    db = Db()
    result = await HybridRetrievalService(top_k=3, vector_top_k=4, keyword_top_k=5, embedding_dimension=3).retrieve_results(
        db, "vector security", [4]
    )

    assert result[0].chunk_id == 7
    assert result[0].document_id == 4
    assert result[0].vector_score == 0.9
    assert result[0].keyword_score == 0.5
    assert result[0].metadata == {"filename": "guide.pdf"}
    assert "ANY(:document_ids)" in db.calls[0][0]
    assert db.calls[0][1]["document_ids"] == [4]
    assert db.calls[0][1]["vector_top_k"] == 4
    assert db.calls[1][1]["keyword_top_k"] == 5