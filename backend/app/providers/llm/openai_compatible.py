from typing import List, AsyncGenerator
from openai import AsyncOpenAI
from app.providers.llm.base import LLMProvider

class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, api_key: str, base_url: str, model: str):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        
    async def generate_stream(self, prompt: str, context: List[str], **kwargs) -> AsyncGenerator[str, None]:
        messages = [{"role": "system", "content": c} for c in context]
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True
        )
        
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def generate(self, prompt: str, context: List[str], **kwargs) -> str:
        messages = [{"role": "system", "content": c} for c in context]
        messages.append({"role": "user", "content": prompt})
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=False
        )
        return response.choices[0].message.content
