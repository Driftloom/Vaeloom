from uuid import UUID
from typing import Any, Optional
from vaeloom_agent_contracts import (
    MemoryFact,
    MemoryQuery,
    MemoryScope,
    MemoryAccessType,
)
from vaeloom_agent_policy import PolicyEngine, PolicyViolationError
from .working_memory import WorkingMemoryStore
from .semantic_vector import SemanticVectorStore


class MemoryService:
    """Unified two-tier memory service enforcing declarative policy scope gates."""

    def __init__(self, working_store: Optional[WorkingMemoryStore] = None, vector_store: Optional[SemanticVectorStore] = None):
        self.working = working_store or WorkingMemoryStore()
        self.vector = vector_store or SemanticVectorStore()

    def query_semantic(self, policy: PolicyEngine, query: MemoryQuery) -> list[MemoryFact]:
        verdict = policy.authorize_memory_access("semantic_vector", MemoryAccessType.READ)
        if not verdict.allowed:
            raise PolicyViolationError(f"Memory read access denied: {verdict.reason}")
        return self.vector.search_facts(query)

    def write_fact(self, policy: PolicyEngine, fact: MemoryFact) -> None:
        verdict = policy.authorize_memory_access("semantic_vector", MemoryAccessType.WRITE)
        if not verdict.allowed:
            raise PolicyViolationError(f"Memory write access denied: {verdict.reason}")
        self.vector.insert_fact(fact)
