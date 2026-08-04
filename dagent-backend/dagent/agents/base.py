from abc import ABC, abstractmethod

from pydantic import BaseModel


class AgentResult(BaseModel):
    success: bool
    output: str
    metadata: dict = {}
    error_message: str = ""


class BaseAgent(ABC):
    @property
    @abstractmethod
    def agent_type(self) -> str: ...

    @abstractmethod
    async def execute(self, context: dict) -> AgentResult: ...
