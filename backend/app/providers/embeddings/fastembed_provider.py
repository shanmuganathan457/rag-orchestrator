from typing import List
from fastembed import TextEmbedding
from app.providers.embeddings.base import EmbeddingProvider

class FastEmbedProvider(EmbeddingProvider):
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.model = TextEmbedding(model_name=model_name)
        
    async def embed_text(self, text: str) -> List[float]:
        # fastembed returns a generator yielding numpy arrays
        embeddings = list(self.model.embed([text]))
        return embeddings[0].tolist()
        
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        embeddings = list(self.model.embed(texts))
        return [e.tolist() for e in embeddings]
