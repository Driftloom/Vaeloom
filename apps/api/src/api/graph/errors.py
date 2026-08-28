"""LangGraph error taxonomy — maps to retry/no-retry/pause/approval/cancel/fail."""

from __future__ import annotations


class GraphError(Exception):
    """Base for graph errors."""


class ValidationError(GraphError):
    """Payload/state validation failed — non-retryable."""


class AuthorizationError(GraphError):
    """Workspace/user/agent permission denied — non-retryable."""


class WorkspaceMismatchError(AuthorizationError):
    """Cross-workspace access — fail-closed 404."""


class SecretPayloadError(ValidationError):
    """Secret in state/payload — non-retryable."""


class PayloadTooLargeError(ValidationError):
    """Exceeds 20KB — non-retryable."""


class QuotaExceededError(GraphError):
    """Redis quota exceeded — non-retryable, fail-closed."""


class ApprovalRequiredError(GraphError):
    """Consequential action needs human approval — pause/interrupt."""


class KillSwitchError(GraphError):
    """Agent disabled via kill switch — cancelled."""


class ConnectorUnavailableError(GraphError):
    """Connector not found/binding failed — non-retryable."""


class ExternalServiceError(GraphError):
    """Transient external failure — retryable."""


class LLMTransientError(ExternalServiceError):
    """LLM 429/5xx/timeout — retryable."""


class LLMPermanentError(GraphError):
    """LLM 400/context limit — non-retryable."""


class ToolExecutionError(GraphError):
    """Tool failed — retry per category policy, not graph retry."""


class GraphExecutionError(GraphError):
    """Graph invariant failed — failed."""


class CancellationError(GraphError):
    """Cancelled via Temporal/activity — cancelled."""


# Mapping to Temporal retry decisions
RETRYABLE = {ExternalServiceError, LLMTransientError, ToolExecutionError}
NON_RETRYABLE = {
    ValidationError, AuthorizationError, WorkspaceMismatchError,
    SecretPayloadError, PayloadTooLargeError, QuotaExceededError,
    KillSwitchError, LLMPermanentError, GraphExecutionError,
}
PAUSE = {ApprovalRequiredError}
CANCEL = {CancellationError, KillSwitchError}
