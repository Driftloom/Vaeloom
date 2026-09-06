"""Context Engine — task-specific, permission-aware context assembly.

Implements §7-8, §11 (retrieval planner), §54-55 of the Harness spec.

Pipeline:
  plan -> retrieve(descriptors) -> filter(permission/classification) ->
  rank(relevance*freshness*confidence) -> compress(budget) ->
  assemble(typed sections) -> validate(workspace binding, size, leakage)

This module is the *policy* layer: it does not itself query pgvector or
the graph. Callers supply retrieved candidates (from memory_service,
search_service, knowledge_graph_service); the engine decides what the
agent actually gets to see. That keeps the trust boundary testable
without a database.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any, Literal

ContextKind = Literal[
    "system", "agent", "task", "user", "memory", "working",
    "tool", "environmental", "evidence", "historical", "evaluation",
]

RetrievalStrategy = Literal[
    "vector", "keyword", "graph", "structured", "temporal",
    "metadata", "hybrid", "iterative", "multi_hop",
]

CLASSIFICATION_ORDER = {
    "PUBLIC": 0, "INTERNAL": 1, "PERSONAL": 2,
    "SENSITIVE": 3, "HIGHLY_SENSITIVE": 4, "SECRET": 5,
}

# Maximum classification rank allowed to leave the workspace to a
# third-party model provider without explicit policy override.
DEFAULT_MAX_EXTERNAL_CLASSIFICATION = "PERSONAL"


def estimate_tokens(text: str) -> int:
    return max(1, (len(text or "") + 3) // 4) if text else 0


@dataclass
class ContextItem:
    kind: ContextKind
    content: str
    relevance: float = 0.5  # 0..1 query relevance
    confidence: float = 0.5  # 0..1 source confidence
    freshness: float = 0.5  # 0..1 recency score (1 = now)
    provenance: str = "unknown"
    permission_scope: str = "workspace"
    classification: str = "INTERNAL"
    created_at: float = field(default_factory=time.time)
    token_estimate: int = 0

    def __post_init__(self):
        if not self.token_estimate:
            self.token_estimate = estimate_tokens(self.content)
        # clamp scores
        for attr in ("relevance", "confidence", "freshness"):
            v = getattr(self, attr)
            setattr(self, attr, max(0.0, min(1.0, float(v))))

    @property
    def score(self) -> float:
        # Weighted: relevance dominates, confidence breaks ties, freshness decays.
        return round(0.55 * self.relevance + 0.25 * self.confidence + 0.20 * self.freshness, 4)


@dataclass
class RetrievalPlan:
    strategy: RetrievalStrategy
    depth: int = 1
    breadth: int = 8
    max_iterations: int = 1
    evidence_threshold: float = 0.4
    freshness_requirement: float = 0.0
    token_budget: int = 2000
    reason: str = ""


def plan_retrieval(query: str, task_type: str = "general", has_graph_cues: bool = False) -> RetrievalPlan:
    """Deterministic retrieval-strategy planner (no LLM — keyword heuristics).

    Heuristics are intentionally cheap and legible; the LLM re-ranker downstream
    (search_ranking.rerank_with_llm) handles nuance. This planner only picks
    the *strategy envelope* so every query doesn't pay for full hybrid fan-out.
    """
    q = (query or "").lower()
    if any(k in q for k in ("connected to", "relationship", "reports to", "works with", "depends on", "related entities")) or has_graph_cues:
        return RetrievalPlan(strategy="graph", depth=2, breadth=8, reason="relationship cues -> graph traversal")
    if any(k in q for k in ("exact", "course code", "invoice #", "file named", "titled exactly")):
        return RetrievalPlan(strategy="keyword", breadth=10, reason="exact-match cues -> keyword")
    if any(k in q for k in ("after", "before", "last week", "recent", "timeline", "when did")):
        return RetrievalPlan(strategy="temporal", breadth=10, reason="temporal cues -> temporal query")
    if len(q.split()) > 12 or " and " in q or "compare" in q:
        return RetrievalPlan(strategy="hybrid", breadth=12, reason="complex multi-clause query -> hybrid")
    if any(k in q for k in ("why", "how", "multi-step", "research", "investigate")):
        return RetrievalPlan(strategy="iterative", max_iterations=3, breadth=8, reason="open-ended -> iterative retrieval")
    return RetrievalPlan(strategy="vector", breadth=8, reason="default semantic similarity")


def filter_items(
    items: list[ContextItem],
    *,
    workspace_id: str = "",
    allowed_scopes: set[str] | None = None,
    min_confidence: float = 0.0,
    min_freshness: float = 0.0,
    max_classification: str = "SECRET",
) -> tuple[list[ContextItem], list[str]]:
    """Permission + quality + classification filter. Returns (kept, excluded_reasons)."""
    kept: list[ContextItem] = []
    excluded: list[str] = []
    max_rank = CLASSIFICATION_ORDER.get(max_classification, 5)
    scopes = allowed_scopes or {"workspace", "tenant", "public", "user"}
    for it in items:
        if it.permission_scope not in scopes:
            excluded.append(f"scope:{it.permission_scope}")
            continue
        if it.confidence < min_confidence:
            excluded.append("low-confidence")
            continue
        if it.freshness < min_freshness:
            excluded.append("stale")
            continue
        if CLASSIFICATION_ORDER.get(it.classification, 0) > max_rank:
            excluded.append(f"classification:{it.classification}")
            continue
        if workspace_id and it.provenance.startswith("ws:") and workspace_id not in it.provenance:
            excluded.append("cross-workspace")
            continue
        kept.append(it)
    return kept, excluded


def rank_items(items: list[ContextItem], limit: int = 8) -> list[ContextItem]:
    return sorted(items, key=lambda i: (-i.score, i.token_estimate))[:limit]


def compress_to_budget(items: list[ContextItem], token_budget: int) -> tuple[list[ContextItem], list[str]]:
    """Keep highest-score items; truncate the tail item instead of dropping
    everything when slightly over budget."""
    kept: list[ContextItem] = []
    used = 0
    compressed: list[str] = []
    for it in sorted(items, key=lambda i: -i.score):
        if used + it.token_estimate <= token_budget:
            kept.append(it)
            used += it.token_estimate
        elif not kept:
            # single huge item: hard-truncate to budget
            chars = max(256, token_budget * 4)
            kept.append(ContextItem(
                kind=it.kind, content=it.content[:chars] + "…[truncated]",
                relevance=it.relevance, confidence=it.confidence, freshness=it.freshness,
                provenance=it.provenance, permission_scope=it.permission_scope,
                classification=it.classification, created_at=it.created_at,
            ))
            compressed.append(it.kind)
            break
        else:
            compressed.append(it.kind)
    return kept, compressed


def assemble(items: list[ContextItem]) -> str:
    """Typed sections — never one undifferentiated blob."""
    by_kind: dict[str, list[ContextItem]] = {}
    for it in items:
        by_kind.setdefault(it.kind, []).append(it)
    sections: list[str] = []
    for kind in ("task", "evidence", "memory", "historical", "working", "tool", "environmental", "user", "evaluation", "agent", "system"):
        group = by_kind.get(kind, [])
        if not group:
            continue
        body = "\n---\n".join(
            f"(conf={g.confidence:.2f} src={g.provenance})\n{g.content[:2000]}" for g in group
        )
        sections.append(f"## {kind}\n{body}")
    return "\n\n".join(sections)


def validate_assembly(
    text: str, items: list[ContextItem], *, workspace_id: str = "", token_budget: int = 4000,
    external_provider: bool = False, max_external_classification: str = DEFAULT_MAX_EXTERNAL_CLASSIFICATION,
) -> list[str]:
    """Return a list of violations (empty = valid). Deterministic checks only."""
    problems: list[str] = []
    if estimate_tokens(text) > token_budget:
        problems.append(f"over-budget: {estimate_tokens(text)} > {token_budget}")
    if workspace_id:
        for it in items:
            if it.provenance.startswith("ws:") and workspace_id not in it.provenance:
                problems.append(f"cross-workspace leak: {it.provenance}")
                break
    if external_provider:
        max_rank = CLASSIFICATION_ORDER.get(max_external_classification, 2)
        for it in items:
            if CLASSIFICATION_ORDER.get(it.classification, 0) > max_rank:
                problems.append(f"blocked {it.classification} from external provider")
                break
    return problems


def context_fingerprint(items: list[ContextItem]) -> str:
    h = hashlib.sha256()
    for it in sorted(items, key=lambda i: (i.kind, i.provenance, i.content[:128])):
        h.update(f"{it.kind}|{it.provenance}|{it.content[:256]}".encode())
    return h.hexdigest()[:16]
