from typing import List, AsyncGenerator
from google import genai
from app.providers.llm.base import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        
    async def generate_stream(self, prompt: str, context: List[str], **kwargs) -> AsyncGenerator[str, None]:
        # Using synchronous generation in async wrapper since genai client might be sync or async
        # genai SDK supports generate_content_stream
        
        full_prompt = ""
        for c in context:
            full_prompt += f"{c}\n"
        full_prompt += f"\n{prompt}"
        
        # This is a naive async wrapper, ideally we'd use the async client if available
        # google-genai 0.2.0 might have a different API, assuming basic usage here.
        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=full_prompt
        )
        for chunk in response:
            yield chunk.text

    async def generate(self, prompt: str, context: List[str], **kwargs) -> str:
        full_prompt = ""
        for c in context:
            full_prompt += f"{c}\n"
        full_prompt += f"\n{prompt}"
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=full_prompt
        )
        return response.text
