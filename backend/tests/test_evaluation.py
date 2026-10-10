import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.models.document import Document, DocumentChunk
from app.services.evaluation import EvaluationService

@pytest.mark.asyncio
async def test_evaluation_service_empty_db():
    mock_db = MagicMock()
    mock_db.query().filter().order_by().limit().all.return_value = []
    
    service = EvaluationService(mock_db)
    with pytest.raises(ValueError, match="No ingested document chunks"):
        await service.run_evaluation(sample_size=5, top_k=3)

@pytest.mark.asyncio
async def test_evaluation_service_success():
    mock_db = MagicMock()
    chunk = MagicMock()
    chunk.id = 1
    chunk.document_id = 10
    chunk.content = "Artificial intelligence and machine learning transform vector retrieval systems."
    
    mock_db.query().filter().order_by().limit().all.return_value = [chunk]

    mock_llm = AsyncMock()
    async def mock_stream(prompt, context):
        yield "What transforms vector retrieval systems?"
    mock_llm.generate_stream = mock_stream

    mock_emb = AsyncMock()
    mock_emb.embed_text.return_value = [0.1] * 384

    with patch("app.services.evaluation.ProviderFactory.get_llm_provider", return_value=mock_llm):
        with patch("app.services.evaluation.get_embedding", return_value=mock_emb):
            service = EvaluationService(mock_db)
            
            mock_retrieval = AsyncMock()
            mock_retrieval_res = MagicMock()
            mock_retrieval_res.chunk_id = 1
            mock_retrieval.retrieve_results.return_value = [mock_retrieval_res]
            service.retrieval_service = mock_retrieval

            mock_db.execute().fetchall.return_value = [MagicMock(id=1)]

            res = await service.run_evaluation(sample_size=1, top_k=5)
            assert res["total_evaluated"] == 1
            assert "hybrid" in res["summary"]
            assert res["summary"]["hybrid"]["hit_at_1"] == 1.0
