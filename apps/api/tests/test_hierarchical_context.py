"""
Unit & Integration Tests for Hierarchical Cognitive Architecture.
Validates:
1. Active Grounding Documents (Claude-style authoritative grounding) placed FIRST.
2. Dynamic Second Brain Memories (ChatGPT-style personalization & memory cards) placed SECOND.
3. Explicit Cognitive Precedence Directive: Active documents supersede past memory in contradictions.
4. Token budget compression preserves P1 Active Grounding before P3 Dynamic Memories.
5. Integration with retrieve_memory_and_vault_context and context assembler.
"""
import uuid
import pytest
from unittest.mock import MagicMock

from api.services.context_engine import (
    CognitivePriority,
    ContextItem,
    assemble,
    assemble_hierarchical,
    compress_to_budget,
    rank_items,
)
from api.orchestrator.context.context_assembler import ContextAssembler
from api.models.schema import Document, Memory
from api.services.memory_service import retrieve_memory_and_vault_context


class TestHierarchicalContextEngine:
    def test_cognitive_priority_ranking(self):
        """Active grounding documents (P1) must rank before dynamic memory cards (P3)."""
        p3_memory = ContextItem(
            kind="memory",
            content="User lives in New York and works as Junior Engineer",
            relevance=0.99,  # high score
            confidence=0.9,
            freshness=0.9,
            provenance="ws:ws-1:mem-1",
            permission_scope="workspace",
            priority="P3_DYNAMIC_MEMORY",
        )
        p1_document = ContextItem(
            kind="evidence",
            content="Active Resume: Senior Staff Engineer located in Seattle, WA",
            relevance=0.50,  # lower relevance score
            confidence=0.9,
            freshness=0.9,
            provenance="ws:ws-1:doc-1",
            permission_scope="workspace",
            priority="P1_ACTIVE_GROUNDING",
        )
        p0_directive = ContextItem(
            kind="task",
            content="Strict constraint: Output JSON only",
            relevance=0.10,
            confidence=1.0,
            freshness=1.0,
            provenance="ws:ws-1:task-1",
            permission_scope="workspace",
            priority="P0_CRITICAL_DIRECTIVE",
        )

        ranked = rank_items([p3_memory, p1_document, p0_directive], limit=10)

        # Priority order must strictly put P0 first, P1 second, P3 third, regardless of individual score
        assert ranked[0].priority == "P0_CRITICAL_DIRECTIVE"
        assert ranked[1].priority == "P1_ACTIVE_GROUNDING"
        assert ranked[2].priority == "P3_DYNAMIC_MEMORY"
        assert "Senior Staff Engineer" in ranked[1].content
        assert "Junior Engineer" in ranked[2].content

    def test_assemble_hierarchical_xml_fences_and_precedence(self):
        """assemble_hierarchical creates XML fences with Grounding Context first and Precedence Directive."""
        doc_item = ContextItem(
            kind="evidence",
            content="Primary Source: Q3 Revenue reached $42M",
            relevance=0.8,
            confidence=0.95,
            freshness=0.9,
            provenance="ws:ws-1:q3-report.pdf",
            permission_scope="workspace",
            priority="P1_ACTIVE_GROUNDING",
        )
        mem_item = ContextItem(
            kind="memory",
            content="User preference: Always summarize financials in EUR",
            relevance=0.7,
            confidence=0.8,
            freshness=0.7,
            provenance="ws:ws-1:pref-1",
            permission_scope="workspace",
            priority="P3_DYNAMIC_MEMORY",
        )

        assembled = assemble_hierarchical([doc_item, mem_item])

        # Assert Precedence Directive is at the top
        assert "[COGNITIVE PRECEDENCE DIRECTIVE]" in assembled
        assert "You MUST inspect and ground your answer on active grounding information first" in assembled

        # Assert XML fences
        assert "<active_grounding_context priority=\"high\">" in assembled
        assert "<memory_context priority=\"enrichment\">" in assembled

        # Assert Grounding Context appears BEFORE Dynamic Memory in the string
        idx_doc = assembled.index("<active_grounding_context")
        idx_mem = assembled.index("<memory_context")
        assert idx_doc < idx_mem, "Active grounding context MUST appear before dynamic memory context"

    def test_budget_compression_protects_active_grounding(self):
        """Under tight token budget, background memories (P3) are dropped while active grounding (P1) is preserved."""
        # 100 tokens document
        doc_item = ContextItem(
            kind="evidence",
            content="Authoritative Spec: " + ("x" * 200),
            relevance=0.8,
            confidence=0.9,
            freshness=0.9,
            provenance="ws:ws-1:spec.md",
            permission_scope="workspace",
            priority="P1_ACTIVE_GROUNDING",
        )
        # 200 tokens memory
        mem_item = ContextItem(
            kind="memory",
            content="Old Memory: " + ("y" * 600),
            relevance=0.9,
            confidence=0.9,
            freshness=0.9,
            provenance="ws:ws-1:old-mem",
            permission_scope="workspace",
            priority="P3_DYNAMIC_MEMORY",
        )

        # Budget large enough only for doc_item (~60 tokens) but not both (~220 tokens)
        kept, dropped = compress_to_budget([mem_item, doc_item], token_budget=80)

        assert len(kept) == 1
        assert kept[0].priority == "P1_ACTIVE_GROUNDING"
        assert "Authoritative Spec" in kept[0].content
        assert "memory" in dropped


class TestContextAssemblerOrdering:
    def test_evidence_precedes_memories_in_context_assembler(self):
        """ContextAssembler.assemble_prompt orders evidence before relevant_memories."""
        prompt = ContextAssembler.assemble_prompt(
            system_policy="System Policy: Be helpful.",
            relevant_memories=[{"content": "User prefers concise answers", "provenance": "notes"}],
            untrusted_evidence=[{"title": "Architecture.md", "snippet": "System uses microservices"}],
        )

        assert "<untrusted_evidence" in prompt
        assert "<relevant_memories" in prompt
        idx_evidence = prompt.index("<untrusted_evidence")
        idx_memories = prompt.index("<relevant_memories")
        assert idx_evidence < idx_memories, "Evidence must be placed before memories in assembled prompt"


@pytest.mark.asyncio
class TestMemoryAndVaultContextHierarchy:
    async def test_retrieve_memory_and_vault_context_hierarchy(self):
        """Verify retrieve_memory_and_vault_context outputs documents first and memories second."""
        ws_id = uuid.uuid4()
        db = MagicMock()

        # Mock document (Active resume)
        doc = Document(
            id=uuid.uuid4(),
            workspace_id=ws_id,
            path="resumes/Staff_Engineer_Resume.pdf",
            type="pdf",
            summary="Staff Engineer with 10+ years scaling distributed systems in Seattle.",
        )
        # Mock memory (Personal note)
        mem = Memory(
            id=uuid.uuid4(),
            workspace_id=ws_id,
            title="Target Salary Preference",
            summary="Targeting $250k base salary.",
            type="preference",
        )

        # Mock DB execute responses
        mock_mem_res = MagicMock()
        mock_mem_res.scalars.return_value.all.return_value = [mem]
        mock_doc_res = MagicMock()
        mock_doc_res.scalars.return_value.all.return_value = [doc]

        call_count = 0
        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_mem_res
            return mock_doc_res

        db.execute = mock_execute

        ctx = await retrieve_memory_and_vault_context(
            workspace_id=ws_id,
            query="Staff Engineer salary and distributed systems",
            db=db,
        )

        assert "[Background Context from Workspace Memories & Vault Notes]" in ctx
        assert "[COGNITIVE PRECEDENCE DIRECTIVE]" in ctx
        assert "Active Grounding Documents (Authoritative)" in ctx
        assert "Dynamic Memories (Enrichment)" in ctx

        idx_doc = ctx.index("Active Grounding Documents")
        idx_mem = ctx.index("Dynamic Memories")
        assert idx_doc < idx_mem, "Active Grounding Documents must appear before Dynamic Memories"
