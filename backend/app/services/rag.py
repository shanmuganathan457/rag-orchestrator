from typing import List, AsyncGenerator
from sqlalchemy.orm import Session
from app.services.retrieval import retrieval_service
from app.providers.factory import get_llm
from app.models.document import DocumentChunk

class RAGOrchestrator:
    async def chat_stream(self, db: Session, query: str, document_ids: List[int] = None) -> AsyncGenerator[str, None]:
        # 1. Retrieve context chunks
        chunks = await retrieval_service.retrieve(db, query, document_ids)
        
        # 2. Format Context
        context_texts = []
        for i, chunk in enumerate(chunks, 1):
            source_page = f" (Page {chunk.page_num})" if chunk.page_num else ""
            context_texts.append(f"[{i}]{source_page}: {chunk.content}")
            
        system_prompt = (
            "You are a helpful assistant. Answer the user's question based ONLY on the provided context excerpts. "
            "If the answer is not in the context, say 'I cannot find the answer in the provided documents'. "
            "Always cite your sources using the [n] format corresponding to the excerpt number."
        )
        
        full_context = "\n\n".join(context_texts)
        
        # We can yield sources first to the frontend if desired
        # For now, we will just format them cleanly or yield a special JSON payload
        
        # 3. Generate response using LLM
        llm_provider = get_llm()
        
        prompt = f"Context:\n{full_context}\n\nQuestion: {query}"
        
        async for token in llm_provider.generate_stream(prompt, [system_prompt]):
            yield token

rag_orchestrator = RAGOrchestrator()
