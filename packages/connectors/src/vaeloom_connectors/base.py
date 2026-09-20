from abc import ABC, abstractmethod
from typing import Any, Optional
from pydantic import BaseModel, Field


class ConnectorStatus(BaseModel):
    is_healthy: bool
    service_name: str
    latency_ms: float = 0.0
    error_message: Optional[str] = None


class BaseConnector(ABC):
    """Canonical interface for all external third-party integrations."""

    def __init__(self, connector_id: str, config: dict[str, Any]):
        self.connector_id = connector_id
        self.config = config

    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def health_check(self) -> ConnectorStatus:
        pass

    @abstractmethod
    async def execute_action(self, action_name: str, payload: dict[str, Any]) -> dict[str, Any]:
        pass
