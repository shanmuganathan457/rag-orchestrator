from typing import List

from fastembed import TextEmbedding

from app.core.config import settings
from app.providers.embeddings.base import EmbeddingProvider, validate_embedding, validate_embedding_batch


class FastEmbedProvider(EmbeddingProvider):
    """Production provider backed by the configured FastEmbed model."""

    def __init__(self, model_name: str | None = None, dimension: int | None = None, model=None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dimension = dimension or settings.EMBEDDING_DIMENSION
        self.model = model if model is not None else TextEmbedding(
            model_name=self.model_name,
            threads=4,            # use multiple CPU threads
        )

    @staticmethod
    def _validate_text(text: str) -> str:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Embedding input must be non-empty text")
        return text

    async def embed_text(self, text: str) -> List[float]:
        text = self._validate_text(text)
        try:
            embeddings = list(self.model.embed([text]))
        except Exception as exc:
            raise RuntimeError(f"Embedding generation failed for model {self.model_name}") from exc
        if len(embeddings) != 1:
            raise RuntimeError("Embedding provider returned an unexpected number of vectors")
        return validate_embedding(embeddings[0], self.dimension)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        validated_texts = [self._validate_text(text) for text in texts]
        try:
            embeddings = list(self.model.embed(
                validated_texts,
                batch_size=64,    # process 64 chunks at once instead of default 32
                parallel=0,       # auto-detect parallelism (uses all cores)
            ))
        except Exception as exc:
            raise RuntimeError(f"Embedding generation failed for model {self.model_name}") from exc
        return validate_embedding_batch(embeddings, len(validated_texts), self.dimension)