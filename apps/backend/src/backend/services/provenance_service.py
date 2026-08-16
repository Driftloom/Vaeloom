"""Provenance tracing service — walks data lineage chains."""
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import (
    Memory, Document, Embedding, AgentAction, AgentExecution,
)


@dataclass
class ProvenanceNode:
    table: str
    id: str
    type: str = ""
    detail: str = ""


@dataclass
class ProvenanceChain:
    nodes: list[ProvenanceNode] = field(default_factory=list)


class ProvenanceService:
    async def trace_memory_lineage(
        self, db: AsyncSession, memory_id: uuid.UUID
    ) -> ProvenanceChain:
        """Trace: memory -> source document -> embedding -> agent action."""
        chain = ProvenanceChain()

        result = await db.execute(select(Memory).where(Memory.id == memory_id))
        memory = result.scalar_one_or_none()
        if not memory:
            return chain

        chain.nodes.append(
            ProvenanceNode("memories", str(memory.id), memory.type, memory.title)
        )

        if memory.source_type == "document" and memory.source_uri:
            try:
                doc_result = await db.execute(
                    select(Document).where(Document.id == uuid.UUID(memory.source_uri))
                )
                doc = doc_result.scalar_one_or_none()
                if doc:
                    chain.nodes.append(
                        ProvenanceNode("documents", str(doc.id), doc.type, doc.path)
                    )
            except ValueError:
                pass

        emb_result = await db.execute(
            select(Embedding).where(
                Embedding.source_type == "memory",
                Embedding.source_id == memory_id,
            )
        )
        for emb in emb_result.scalars():
            chain.nodes.append(
                ProvenanceNode("embeddings", str(emb.id), emb.model_version)
            )

        action_result = await db.execute(
            select(AgentAction).where(AgentAction.output_ref.contains(str(memory_id)))
        )
        for action in action_result.scalars():
            chain.nodes.append(
                ProvenanceNode(
                    "agent_actions", str(action.id), action.action_type, action.agent_name
                )
            )

        return chain

    async def trace_action_lineage(
        self, db: AsyncSession, action_id: uuid.UUID
    ) -> ProvenanceChain:
        """Trace: agent_action -> agent_execution -> approval."""
        chain = ProvenanceChain()

        result = await db.execute(select(AgentAction).where(AgentAction.id == action_id))
        action = result.scalar_one_or_none()
        if not action:
            return chain

        chain.nodes.append(
            ProvenanceNode(
                "agent_actions", str(action.id), action.action_type, action.agent_name
            )
        )

        exec_result = await db.execute(
            select(AgentExecution).where(AgentExecution.agent_id == action_id)
        )
        for ex in exec_result.scalars():
            chain.nodes.append(
                ProvenanceNode("agent_executions", str(ex.id), ex.status)
            )

        return chain

    async def get_embedding_provenance(
        self, db: AsyncSession, embedding_id: uuid.UUID
    ) -> ProvenanceChain:
        """Trace: embedding -> source_table -> source_id."""
        chain = ProvenanceChain()

        result = await db.execute(select(Embedding).where(Embedding.id == embedding_id))
        emb = result.scalar_one_or_none()
        if not emb:
            return chain

        chain.nodes.append(
            ProvenanceNode("embeddings", str(emb.id), emb.model_version)
        )

        if emb.source_type == "memory":
            mem_result = await db.execute(
                select(Memory).where(Memory.id == emb.source_id)
            )
            mem = mem_result.scalar_one_or_none()
            if mem:
                chain.nodes.append(
                    ProvenanceNode("memories", str(mem.id), mem.type, mem.title)
                )
        elif emb.source_type == "document":
            doc_result = await db.execute(
                select(Document).where(Document.id == emb.source_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                chain.nodes.append(
                    ProvenanceNode("documents", str(doc.id), doc.type, doc.path)
                )

        return chain
