from abc import ABC, abstractmethod
from typing import List, AsyncGenerator, Any

class LLMProvider(ABC):
    @abstractmethod
    async def generate_stream(self, prompt: str, context: List[str], **kwargs) -> AsyncGenerator[str, None]:
        pass
        
    @abstractmethod
    async def generate(self, prompt: str, context: List[str], **kwargs) -> str:
        pass

class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        pass
        
    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        pass
