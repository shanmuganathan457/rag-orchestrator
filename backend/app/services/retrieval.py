from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.document import DocumentChunk
from app.providers.factory import get_embedding

class HybridRetrievalService:
    def __init__(self, top_k: int = 5, rrf_k: int = 60):
        self.top_k = top_k
        self.rrf_k = rrf_k

    async def retrieve(self, db: Session, query: str, document_ids: List[int] = None) -> List[DocumentChunk]:
        # Embed query
        embedding_provider = get_embedding()
        query_embedding = await embedding_provider.embed_text(query)
        
        doc_filter = ""
        if document_ids:
            doc_filter = f"AND document_id IN ({','.join(map(str, document_ids))})"
            
        # 1. Vector Search
        # Uses cosine distance <=> (1 - cosine_similarity)
        vector_sql = f"""
            SELECT id, 1 - (embedding <=> :embedding) AS score
            FROM document_chunks
            WHERE 1=1 {doc_filter}
            ORDER BY embedding <=> :embedding
            LIMIT 20
        """
        
        # 2. Keyword Search
        keyword_sql = f"""
            SELECT id, ts_rank_cd(full_text_search, websearch_to_tsquery('english', :query)) AS score
            FROM document_chunks
            WHERE full_text_search @@ websearch_to_tsquery('english', :query) {doc_filter}
            ORDER BY score DESC
            LIMIT 20
        """
        
        # Execute queries
        # (Handling the case where pgvector might throw an error if embedding is passed as list in some drivers, 
        # but SQLAlchemy text allows it if formatted properly. For safety in a foundation, we convert to string format)
        vec_embedding_str = f"[{','.join(map(str, query_embedding))}]"
        
        vector_results = db.execute(text(vector_sql), {"embedding": vec_embedding_str}).fetchall()
        keyword_results = db.execute(text(keyword_sql), {"query": query}).fetchall()
        
        # 3. Reciprocal Rank Fusion
        # score = 1 / (rrf_k + rank)
        rrf_scores: Dict[int, float] = {}
        
        for rank, (chunk_id, score) in enumerate(vector_results, 1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (self.rrf_k + rank)
            
        for rank, (chunk_id, score) in enumerate(keyword_results, 1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (self.rrf_k + rank)
            
        # Sort by RRF score
        sorted_chunk_ids = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        top_chunk_ids = [cid for cid, _ in sorted_chunk_ids[:self.top_k]]
        
        if not top_chunk_ids:
            return []
            
        # Fetch the actual chunk objects (maintaining RRF order)
        chunks = db.query(DocumentChunk).filter(DocumentChunk.id.in_(top_chunk_ids)).all()
        chunk_map = {c.id: c for c in chunks}
        
        return [chunk_map[cid] for cid in top_chunk_ids if cid in chunk_map]

retrieval_service = HybridRetrievalService()
