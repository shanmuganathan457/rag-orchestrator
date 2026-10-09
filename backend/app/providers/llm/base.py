from abc import ABC, abstractmethod
from typing import AsyncGenerator, List


class LLMProvider(ABC):
    @abstractmethod
    async def generate_stream(self, prompt: str, context: List[str], **kwargs) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def generate(self, prompt: str, context: List[str], **kwargs) -> str:
        pass

    async def test_connection(self) -> None:
        """Perform a minimal provider request without exposing credentials."""
        await self.generate("Reply with OK.", [])