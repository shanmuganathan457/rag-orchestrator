import ipaddress
from urllib.parse import urlparse

from app.core.config import settings
from app.providers.embeddings.base import EmbeddingProvider
from app.providers.embeddings.fastembed_provider import FastEmbedProvider
from app.providers.llm.base import LLMProvider
from app.providers.llm.gemini import GeminiProvider
from app.providers.llm.openai_compatible import OpenAICompatibleProvider
from app.providers.llm.wrappers import GroqProvider, OllamaProvider, OpenRouterProvider

SUPPORTED_LLM_PROVIDERS = {"gemini", "groq", "openrouter", "ollama", "openai-compatible"}


def validate_endpoint(base_url: str, allow_private: bool = False) -> str:
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Base URL must be an absolute HTTP(S) URL")
    try:
        address = ipaddress.ip_address(parsed.hostname)
        if not allow_private and (address.is_private or address.is_loopback or address.is_link_local):
            raise ValueError("Private or local provider URLs are blocked")
    except ValueError as exc:
        if str(exc) == "Private or local provider URLs are blocked":
            raise
    return base_url.rstrip("/")


def create_llm_provider(provider: str, model: str, api_key: str | None = None, base_url: str | None = None) -> LLMProvider:
    provider = provider.lower()
    if provider not in SUPPORTED_LLM_PROVIDERS:
        raise ValueError(f"Unsupported LLM provider: {provider}")
    if provider == "ollama":
        return OllamaProvider(base_url=validate_endpoint(base_url or settings.LLM_BASE_URL, allow_private=not settings.BLOCK_PRIVATE_LLM_URLS), model=model)
    if not api_key:
        raise ValueError(f"{provider} requires an API key")
    if provider == "gemini":
        return GeminiProvider(api_key=api_key, model=model)
    if provider == "groq":
        return GroqProvider(api_key=api_key, model=model)
    if provider == "openrouter":
        return OpenRouterProvider(api_key=api_key, model=model)
    return OpenAICompatibleProvider(api_key=api_key, base_url=validate_endpoint(base_url or settings.LLM_BASE_URL, settings.BLOCK_PRIVATE_LLM_URLS is False), model=model)


class ProviderFactory:
    _llm_provider: LLMProvider | None = None
    _embedding_provider: EmbeddingProvider | None = None

    @classmethod
    def set_llm_provider(cls, provider: LLMProvider): cls._llm_provider = provider
    @classmethod
    def get_llm_provider(cls) -> LLMProvider:
        if cls._llm_provider is None:
            cls._llm_provider = create_llm_provider(settings.LLM_PROVIDER, settings.LLM_MODEL, settings.LLM_API_KEY, settings.LLM_BASE_URL)
        return cls._llm_provider
    @classmethod
    def set_embedding_provider(cls, provider: EmbeddingProvider): cls._embedding_provider = provider
    @classmethod
    def get_embedding_provider(cls) -> EmbeddingProvider:
        if cls._embedding_provider is None: cls._embedding_provider = FastEmbedProvider()
        return cls._embedding_provider


def get_llm() -> LLMProvider: return ProviderFactory.get_llm_provider()
def get_embedding() -> EmbeddingProvider: return ProviderFactory.get_embedding_provider()