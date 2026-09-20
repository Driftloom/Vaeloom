import time
from typing import Optional


class AgentCancelledError(Exception):
    pass


class CancellationToken:
    def __init__(self, timeout_seconds: Optional[float] = None):
        self._cancelled = False
        self._deadline = (time.time() + timeout_seconds) if timeout_seconds else None

    def cancel(self) -> None:
        self._cancelled = True

    def check(self) -> None:
        if self._cancelled:
            raise AgentCancelledError("Agent execution was cancelled by user or system.")
        if self._deadline and time.time() > self._deadline:
            raise AgentCancelledError("Agent execution timed out.")

    @property
    def is_cancelled(self) -> bool:
        return self._cancelled or (bool(self._deadline) and time.time() > self._deadline)
