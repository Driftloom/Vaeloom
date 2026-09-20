from uuid import UUID
from typing import Any, Optional
from vaeloom_agent_contracts import MemoryFact, MemoryQuery


class SemanticVectorStore:
    """Tier-2 vector embeddings and semantic search provider."""

    def __init__(self):
        self._facts: dict[UUID, list[MemoryFact]] = {}

    def insert_fact(self, fact: MemoryFact) -> None:
        if fact.workspace_id not in self._facts:
            self._facts[fact.workspace_id] = []
        self._facts[fact.workspace_id].append(fact)

    def search_facts(self, query: MemoryQuery) -> list[MemoryFact]:
        if query.workspace_id not in self._facts:
            return []
        
        # In-memory keyword/mock similarity search
        results = []
        q_words = set(query.query_text.lower().split())
        for f in self._facts[query.workspace_id]:
            f_words = set(f.content.lower().split())
            overlap = len(q_words & f_words)
            if overlap > 0:
                results.append((f, overlap))
        
        results.sort(key=lambda x: x[1], reverse=True)
        return [r[0] for r in results[:query.limit]]
