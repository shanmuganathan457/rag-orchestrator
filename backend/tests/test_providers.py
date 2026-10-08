import pytest
from app.providers.factory import ProviderFactory
from app.providers.base import LLMProvider, EmbeddingProvider

class MockLLM(LLMProvider):
    async def generate_stream(self, prompt, context, **kwargs):
        yield "mock"
    async def generate(self, prompt, context, **kwargs):
        return "mock"

class MockEmbedding(EmbeddingProvider):
    async def embed_text(self, text):
        return [0.1, 0.2]
    async def embed_batch(self, texts):
        return [[0.1, 0.2]]

def test_provider_factory():
    ProviderFactory.set_llm_provider(MockLLM())
    ProviderFactory.set_embedding_provider(MockEmbedding())
    
    assert isinstance(ProviderFactory.get_llm_provider(), MockLLM)
    assert isinstance(ProviderFactory.get_embedding_provider(), MockEmbedding)
