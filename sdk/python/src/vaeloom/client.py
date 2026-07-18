from typing import Any, Optional
from httpx import Client, HTTPError

from .models import Memory, Agent, MemoryQuery, PaginatedResponse


class VaeloomClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = "https://api.vaeloom.dev",
        tenant_id: Optional[str] = None,
        timeout: int = 30,
    ):
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["X-API-Key"] = api_key
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        self.client = Client(base_url=base_url, headers=headers, timeout=timeout)

    def _request(self, method: str, path: str, **kwargs) -> Any:
        response = self.client.request(method, path, **kwargs)
        if response.status_code == 401:
            raise PermissionError("Authentication failed")
        if response.status_code == 403:
            raise PermissionError("Permission denied")
        if response.status_code == 429:
            raise Exception("Rate limit exceeded")
        response.raise_for_status()
        return response.json()

    def create_memory(self, data: dict) -> Memory:
        result = self._request("POST", "/api/v1/memory", json=data)
        return Memory(**result)

    def get_memory(self, memory_id: str) -> Memory:
        result = self._request("GET", f"/api/v1/memory/{memory_id}")
        return Memory(**result["data"])

    def search_memories(self, query: MemoryQuery) -> PaginatedResponse[Memory]:
        result = self._request("POST", "/api/v1/memory/search", json=query.model_dump())
        return PaginatedResponse(**result)

    def list_agents(self) -> list[Agent]:
        result = self._request("GET", "/api/v1/agents")
        return [Agent(**a) for a in result["data"]]

    def health_check(self) -> str:
        result = self._request("GET", "/health")
        return result["status"]
