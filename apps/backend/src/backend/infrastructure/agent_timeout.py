"""
Agent execution timeout — context manager using asyncio.wait_for.
Configurable per-agent-type timeouts via AGENT_TIMEOUT_SECONDS env var.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 120

AGENT_TIMEOUTS: dict[str, int] = {
    "memory": 300,
    "chat": 60,
    "resume": 180,
    "planner": 120,
    "organization": 120,
    "ats": 60,
    "job_search": 90,
    "application": 60,
    "gmail": 90,
    "scheduler": 60,
    "career": 120,
    "learning": 120,
    "research": 180,
    "github": 90,
    "coding": 180,
    "reminder": 60,
    "analytics": 60,
    "recommendation": 90,
    "reflection": 120,
    "security": 60,
    "connector": 60,
    "plugin": 60,
    "drive": 90,
    "qa": 30,
}


def get_timeout_seconds() -> int:
    return int(os.environ.get("AGENT_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT)))


def timeout_for(agent_name: str) -> int:
    return AGENT_TIMEOUTS.get(agent_name, get_timeout_seconds())


class AgentTimeoutError(asyncio.TimeoutError):
    """Raised when an agent execution times out."""
    def __init__(self, agent_name: str, timeout: int):
        self.agent_name = agent_name
        self.timeout = timeout
        super().__init__(f"Agent '{agent_name}' timed out after {timeout}s")


class AgentTimeout:
    """
    Context manager for agent execution with configurable timeout.
    Logs warning and kills execution on timeout. Returns partial results if available.
    """

    def __init__(self, agent_name: str, timeout: int | None = None):
        self.agent_name = agent_name
        self.timeout = timeout or timeout_for(agent_name)
        self._partial_result: Any = None
        self._timed_out = False

    @property
    def timed_out(self) -> bool:
        return self._timed_out

    @property
    def partial_result(self) -> Any:
        return self._partial_result

    @asynccontextmanager
    async def run(self) -> AsyncIterator["AgentTimeout"]:
        try:
            yield self
        except asyncio.TimeoutError:
            self._timed_out = True
            logger.warning(
                "Agent '%s' timed out after %ds",
                self.agent_name, self.timeout,
            )
        except Exception:
            raise

    async def execute(self, coro: Any, partial_on_timeout: Any = None) -> Any:
        try:
            result = await asyncio.wait_for(coro, timeout=self.timeout)
            return result
        except asyncio.TimeoutError:
            self._timed_out = True
            self._partial_result = partial_on_timeout
            logger.warning(
                "Agent '%s' execution timed out after %ds",
                self.agent_name, self.timeout,
            )
            return partial_on_timeout


async def with_timeout(
    agent_name: str,
    coro: Any,
    timeout: int | None = None,
    partial_on_timeout: Any = None,
) -> Any:
    """
    Execute a coroutine with a timeout for the given agent type.
    Returns partial_on_timeout if the timeout is exceeded.
    """
    effective_timeout = timeout or timeout_for(agent_name)
    try:
        return await asyncio.wait_for(coro, timeout=effective_timeout)
    except asyncio.TimeoutError:
        logger.warning(
            "Agent '%s' timed out after %ds",
            agent_name, effective_timeout,
        )
        return partial_on_timeout
