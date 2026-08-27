"""Temporal durable execution package (ADR-038).

Boundaries (spec §3/§4):
- Workflows orchestrate lifecycle/retries/timeouts/signals/queries.
- Activities perform side effects (DB, embeddings, connectors, audit).
- Domain logic + auth/RBAC lives in application services.
- Future LangGraph inserts behind DurableAgentRunActivity.

Idempotency: deterministic workflow IDs (workspace+op+logicalId) + DB
unique guards. Secrets never enter workflow history (§15) — activities
resolve connector creds via SecretManager.
Payloads are IDs/refs wherever possible (§16)."""

from .client import get_temporal_client, is_temporal_enabled
from .queues import TASK_QUEUES

__all__ = ["get_temporal_client", "is_temporal_enabled", "TASK_QUEUES"]
