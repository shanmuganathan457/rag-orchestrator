import pytest
from app.providers.embeddings.fastembed_provider import FastEmbedProvider

@pytest.mark.asyncio
async def test_fastembed_provider():
    # If the model download takes too long or fails in CI, this test might need mocking or a smaller model.
    # We will test the actual instantiation and embedding generation.
    provider = FastEmbedProvider(model_name="BAAI/bge-small-en-v1.5")
    text = "This is a test sentence for embeddings."
    
    embedding = await provider.embed_text(text)
    
    assert len(embedding) == 384
    assert isinstance(embedding[0], float)
    
@pytest.mark.asyncio
async def test_fastembed_batch():
    provider = FastEmbedProvider(model_name="BAAI/bge-small-en-v1.5")
    texts = ["First sentence.", "Second sentence."]
    
    embeddings = await provider.embed_batch(texts)
    
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384
    assert len(embeddings[1]) == 384
