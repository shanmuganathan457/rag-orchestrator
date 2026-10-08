from abc import ABC, abstractmethod
from typing import List, AsyncGenerator, Any

class LLMProvider(ABC):
    @abstractmethod
    async def generate_stream(self, prompt: str, context: List[str], **kwargs) -> AsyncGenerator[str, None]:
        pass
        
    @abstractmethod
    async def generate(self, prompt: str, context: List[str], **kwargs) -> str:
        pass
