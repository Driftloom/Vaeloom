"""
Tool executor with permission checking, retry logic, and audit logging.
"""
import asyncio
import logging
import time
from typing import Any, Dict, Optional

from .definitions import ToolDefinition

logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
    """Raised when the agent lacks the required scope for a tool call."""
    pass


class ToolExecutionError(Exception):
    """Raised when a tool call fails after all retries."""
    pass


# Timeouts per category (in seconds) per the Tool-Calling spec
CATEGORY_TIMEOUTS = {
    "memory_read": 2,
    "memory_write": 2,
    "connector_read": 5,
    "connector_write": 10,
    "system": 1,
}

# Retry config per category
CATEGORY_RETRIES = {
    "memory_read": 3,
    "memory_write": 3,
    "connector_read": 3,
    "connector_write": 3,
    "system": 1,
}


async def check_permission(
    agent_scopes: list[str], required_scope: str
) -> bool:
    """
    Check if the agent has the required scope.
    In production this calls the Permission Engine; here it's a local check.
    """
    # Simple prefix matching: "memory.read" is granted by "memory.read" or "memory.*"
    for scope in agent_scopes:
        if scope == required_scope:
            return True
        if scope.endswith(".*"):
            prefix = scope[:-2]
            if required_scope.startswith(prefix):
                return True
    return False


async def _mock_execute_tool(tool: ToolDefinition, params: Dict[str, Any]) -> Any:
    """
    Mock tool execution. In production, this dispatches to real connectors/services.
    """
    return {
        "status": "success",
        "tool": tool.name,
        "result": f"Mock result for {tool.name}",
        "params_received": list(params.keys()),
    }


async def execute_tool(
    tool: ToolDefinition,
    params: Dict[str, Any],
    agent_id: str,
    agent_scopes: list[str],
    workspace_id: str,
) -> Dict[str, Any]:
    """
    Execute a tool call with permission checking, retry logic, and audit logging.

    Flow:
    1. Permission check (zero retries on denial)
    2. Execute with timeout
    3. Retry on transient failure (exponential backoff)
    4. Audit log metadata
    """
    start_time = time.monotonic()

    # ── 1. Permission Check ────────────────────────────────────────
    has_permission = await check_permission(agent_scopes, tool.required_scope)
    if not has_permission:
        logger.warning(
            f"PERMISSION_DENIED: agent={agent_id} tool={tool.name} "
            f"required={tool.required_scope} granted={agent_scopes}"
        )
        # Audit log: permission denied
        _audit_log(agent_id, tool.name, workspace_id, False, 0, "permission_denied")
        raise PermissionDeniedError(
            f"Agent '{agent_id}' lacks scope '{tool.required_scope}' for tool '{tool.name}'"
        )

    # ── 2. Execute with retry ──────────────────────────────────────
    timeout = CATEGORY_TIMEOUTS.get(tool.category, 5)
    max_retries = CATEGORY_RETRIES.get(tool.category, 3)
    last_error: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            result = await asyncio.wait_for(
                _mock_execute_tool(tool, params), timeout=timeout
            )
            duration_ms = int((time.monotonic() - start_time) * 1000)
            _audit_log(agent_id, tool.name, workspace_id, True, duration_ms, None)
            return result

        except asyncio.TimeoutError:
            last_error = TimeoutError(f"Tool {tool.name} timed out after {timeout}s")
            backoff = min(2 ** (attempt - 1), 8)  # 1s, 2s, 4s, 8s max
            logger.warning(
                f"RETRY {attempt}/{max_retries}: {tool.name} timed out, "
                f"backoff={backoff}s"
            )
            await asyncio.sleep(backoff)

        except Exception as e:
            last_error = e
            # Don't retry on non-transient errors
            if "permission" in str(e).lower() or "input" in str(e).lower():
                break
            backoff = min(2 ** (attempt - 1), 8)
            logger.warning(
                f"RETRY {attempt}/{max_retries}: {tool.name} failed: {e}, "
                f"backoff={backoff}s"
            )
            await asyncio.sleep(backoff)

    duration_ms = int((time.monotonic() - start_time) * 1000)
    error_msg = str(last_error) if last_error else "unknown"
    _audit_log(agent_id, tool.name, workspace_id, False, duration_ms, error_msg)
    raise ToolExecutionError(
        f"Tool '{tool.name}' failed after {max_retries} attempts: {error_msg}"
    )


def _audit_log(
    agent_id: str,
    tool_name: str,
    workspace_id: str,
    success: bool,
    duration_ms: int,
    error: Optional[str],
):
    """
    Append-only audit log. Records metadata only — never payload content.
    In production this writes to PostgreSQL `agent_actions` table.
    """
    log_entry = {
        "agent_id": agent_id,
        "tool_name": tool_name,
        "workspace_id": workspace_id,
        "success": success,
        "duration_ms": duration_ms,
    }
    if error:
        log_entry["error"] = error
    logger.info(f"AUDIT: {log_entry}")
