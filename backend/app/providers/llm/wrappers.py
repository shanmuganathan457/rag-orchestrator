from app.providers.llm.openai_compatible import OpenAICompatibleProvider

class GroqProvider(OpenAICompatibleProvider):
    def __init__(self, api_key: str, model: str = "llama3-8b-8192"):
        super().__init__(api_key=api_key, base_url="https://api.groq.com/openai/v1", model=model)

class OpenRouterProvider(OpenAICompatibleProvider):
    def __init__(self, api_key: str, model: str = "anthropic/claude-3-haiku"):
        super().__init__(api_key=api_key, base_url="https://openrouter.ai/api/v1", model=model)

class OllamaProvider(OpenAICompatibleProvider):
    def __init__(self, base_url: str = "http://localhost:11434/v1", model: str = "llama3.2:3b"):
        # Ollama doesn't require an API key, so we pass a dummy one
        super().__init__(api_key="ollama", base_url=base_url, model=model)
