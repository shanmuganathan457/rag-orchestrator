import time
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.document import DocumentChunk
from app.services.retrieval import HybridRetrievalService
from app.providers.factory import ProviderFactory, get_embedding

class EvaluationService:
    def __init__(self, db: Session):
        self.db = db
        self.retrieval_service = HybridRetrievalService()

    async def run_evaluation(self, sample_size: int = 10, top_k: int = 5) -> Dict[str, Any]:
        """
        Runs automated RAG evaluation by sampling real uploaded document chunks,
        generating evaluation questions using the configured LLM provider,
        and scoring vector, keyword, and hybrid retrieval modes.
        """
        chunks = (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.content != None)
            .order_by(DocumentChunk.id)
            .limit(sample_size)
            .all()
        )

        if not chunks:
            raise ValueError("No ingested document chunks available for evaluation. Upload at least one document first.")

        modes = ["vector", "keyword", "hybrid"]
        metrics = {m: {"hit1": 0, "hit5": 0, "rr": 0.0, "latency_ms": 0.0} for m in modes}
        details: List[Dict[str, Any]] = []
        llm = ProviderFactory.get_llm_provider()

        evaluated_count = 0

        for chunk in chunks:
            prompt = f"Given the following passage, write ONE concise evaluation question that can be directly answered by it. Do not include answers or extra commentary.\n\nPassage:\n{chunk.content}"
            
            try:
                question = ""
                async for token in llm.generate_stream(prompt, context=[]):
                    question += token
                question = question.strip().strip('"')
            except Exception as err:
                continue

            if len(question) < 8:
                continue

            evaluated_count += 1
            chunk_detail: Dict[str, Any] = {
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "question": question,
                "ranks": {}
            }

            for mode in modes:
                t0 = time.perf_counter()
                if mode == "vector":
                    embedding = await get_embedding().embed_text(question)
                    vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
                    sql = text("SELECT id FROM document_chunks ORDER BY embedding <=> CAST(:emb AS vector) LIMIT :k")
                    rows = self.db.execute(sql, {"emb": vec_str, "k": top_k}).fetchall()
                    retrieved_chunk_ids = [str(r.id) for r in rows]
                elif mode == "keyword":
                    sql = text("SELECT id FROM document_chunks WHERE full_text_search @@ websearch_to_tsquery('english', :q) ORDER BY ts_rank_cd(full_text_search, websearch_to_tsquery('english', :q)) DESC LIMIT :k")
                    rows = self.db.execute(sql, {"q": question, "k": top_k}).fetchall()
                    retrieved_chunk_ids = [str(r.id) for r in rows]
                else: # hybrid
                    results = await self.retrieval_service.retrieve_results(self.db, query=question)
                    retrieved_chunk_ids = [str(r.chunk_id) for r in results[:top_k]]

                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                metrics[mode]["latency_ms"] += elapsed_ms

                rank = (retrieved_chunk_ids.index(str(chunk.id)) + 1) if str(chunk.id) in retrieved_chunk_ids else None
                chunk_detail["ranks"][mode] = rank

                if rank == 1:
                    metrics[mode]["hit1"] += 1
                if rank is not None and rank <= top_k:
                    metrics[mode]["hit5"] += 1
                    metrics[mode]["rr"] += 1.0 / rank

            details.append(chunk_detail)

        if evaluated_count == 0:
            raise RuntimeError("Could not generate valid evaluation questions. Check LLM provider configuration.")

        summary = {}
        for m in modes:
            summary[m] = {
                "hit_at_1": round(metrics[m]["hit1"] / evaluated_count, 3),
                "hit_at_5": round(metrics[m]["hit5"] / evaluated_count, 3),
                "mrr": round(metrics[m]["rr"] / evaluated_count, 3),
                "avg_latency_ms": round(metrics[m]["latency_ms"] / evaluated_count, 1),
            }

        return {
            "total_evaluated": evaluated_count,
            "top_k": top_k,
            "summary": summary,
            "details": details
        }
