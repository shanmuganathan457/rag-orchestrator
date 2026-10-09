import math
import os

import pytest

from app.providers.embeddings.base import validate_embedding, validate_embedding_batch
from app.providers.embeddings.fastembed_provider import FastEmbedProvider
from app.providers.factory import ProviderFactory, get_embedding


class FakeModel:
    def __init__(self, vectors):
        self.vectors = vectors
        self.calls = 0

    def embed(self, texts):
        self.calls += 1
        return iter(self.vectors[: len(texts)])


@pytest.mark.asyncio
async def test_fastembed_provider_validates_and_reuses_its_model():
    provider = FastEmbedProvider(model_name="test-model", dimension=3, model=FakeModel([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]))
    provider.model = FakeModel([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])

    assert await provider.embed_text("first") == [0.1, 0.2, 0.3]
    assert await provider.embed_batch(["second", "third"]) == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    assert provider.model.calls == 2


@pytest.mark.asyncio
async def test_fastembed_provider_rejects_invalid_input_and_output():
    provider = FastEmbedProvider(model_name="test-model", dimension=3, model=FakeModel([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]))
    provider.model = FakeModel([[1.0, float("nan"), 3.0]])
    with pytest.raises(ValueError, match="non-empty"):
        await provider.embed_text(" ")
    with pytest.raises(ValueError, match="non-finite"):
        await provider.embed_text("question")


def test_embedding_validation_rejects_bad_dimensions_and_batch_counts():
    assert validate_embedding([1, 2, 3], 3) == [1.0, 2.0, 3.0]
    with pytest.raises(ValueError, match="dimension"):
        validate_embedding([1, 2], 3)
    with pytest.raises(ValueError, match="non-finite"):
        validate_embedding([1, math.inf, 3], 3)
    with pytest.raises(ValueError, match="returned 1 vectors"):
        validate_embedding_batch([[1, 2, 3]], 2, 3)


def test_provider_factory_reuses_the_configured_provider():
    original = ProviderFactory._embedding_provider
    provider = object()
    try:
        ProviderFactory._embedding_provider = provider
        assert get_embedding() is provider
        assert get_embedding() is provider
    finally:
        ProviderFactory._embedding_provider = original


@pytest.mark.skipif(os.getenv("RUN_REAL_EMBEDDING_SMOKE") != "1", reason="set RUN_REAL_EMBEDDING_SMOKE=1 to run FastEmbed model smoke test")
@pytest.mark.asyncio
async def test_real_fastembed_model_smoke():
    provider = FastEmbedProvider()
    embedding = await provider.embed_text("A short real embedding smoke test.")
    assert len(embedding) == 384
    assert all(math.isfinite(value) for value in embedding)