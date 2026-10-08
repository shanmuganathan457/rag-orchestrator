from app.providers.llm.base import LLMProvider
from app.providers.embeddings.base import EmbeddingProvider
from app.providers.embeddings.fastembed_provider import FastEmbedProvider

class ProviderFactory:
    _llm_provider: LLMProvider | None = None
    _embedding_provider: EmbeddingProvider | None = None
    
    @classmethod
    def set_llm_provider(cls, provider: LLMProvider):
        cls._llm_provider = provider
        
    @classmethod
    def get_llm_provider(cls) -> LLMProvider:
        if not cls._llm_provider:
            raise ValueError("LLM Provider not configured")
        return cls._llm_provider
        
    @classmethod
    def set_embedding_provider(cls, provider: EmbeddingProvider):
        cls._embedding_provider = provider
        
    @classmethod
    def get_embedding_provider(cls) -> EmbeddingProvider:
        if not cls._embedding_provider:
            # Default to FastEmbed
            cls._embedding_provider = FastEmbedProvider()
        return cls._embedding_provider

def get_llm() -> LLMProvider:
    return ProviderFactory.get_llm_provider()
    
def get_embedding() -> EmbeddingProvider:
    return ProviderFactory.get_embedding_provider()
