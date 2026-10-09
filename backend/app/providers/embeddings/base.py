from math import isfinite
from abc import ABC, abstractmethod
from typing import Iterable, List, Sequence


def validate_embedding(embedding: Sequence[float], dimension: int, label: str = "Embedding") -> list[float]:
    if len(embedding) != dimension:
        raise ValueError(f"{label} dimension {len(embedding)} does not match expected {dimension}")
    try:
        values = [float(value) for value in embedding]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must contain numeric values") from exc
    if not all(isfinite(value) for value in values):
        raise ValueError(f"{label} contains non-finite values")
    return values


def validate_embedding_batch(embeddings: Iterable[Sequence[float]], expected_count: int, dimension: int) -> list[list[float]]:
    values = list(embeddings)
    if len(values) != expected_count:
        raise ValueError(f"Embedding provider returned {len(values)} vectors for {expected_count} chunks")
    return [validate_embedding(embedding, dimension, f"Embedding at index {index}") for index, embedding in enumerate(values)]


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        pass