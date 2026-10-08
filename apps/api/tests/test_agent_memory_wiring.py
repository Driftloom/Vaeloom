"""Agent memory wiring — findings #14-#17 from the production audit.

The audit found memory was effectively disconnected from the agent:

  #14 the agent's search tool was ILIKE-only, so the vector/RRF path was
      unreachable from the loop
  #15 create_memory wrote rows with no embedding, making them permanently
      invisible to semantic search
  #16 PromptLayers.memory_context was hardcoded ""
  #17 nothing asserted that memory ever reached an LLM prompt

These tests cover the wiring end to end. They are deliberately negative-control
shaped: each one fails against the pre-wiring code.
"""

import uuid

import pytest

from api.models.schema import Entity, Memory, RankingWeightProfile, User, Workspace
from api.orchestrator.loop import (
    MEMORY_CONTEXT_MAX_CHARS,
    MEMORY_CONTEXT_MAX_ITEMS,
    _assemble_rag_context,
    _render_memory_context,
)
from api.services.prompt_compiler import PromptCompiler, PromptLayers
from api.tools.executor import _execute_create_memory, _execute_search_memories

pytestmark = pytest.mark.asyncio


def _hash(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class _SessionCtx:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        return False


async def _ws(db_session, name: str) -> uuid.UUID:
    ws_id, _user_id = await _ws_with_user(db_session, name)
    return ws_id


async def _ws_with_user(db_session, name: str) -> tuple[uuid.UUID, uuid.UUID]:
    user = User(
        id=uuid.uuid4(),
        email=f"user-{uuid.uuid4().hex[:8]}@example.com",
        display_name="Test User",
    )
    db_session.add(user)
    await db_session.flush()
    ws = Workspace(id=uuid.uuid4(), user_id=user.id, name=name)
    db_session.add(ws)
    await db_session.commit()
    return ws.id, user.id


def _agent_stub():
    class _Scopes:
        read_types = ["memory", "document"]

    class _Agent:
        memory_scopes = _Scopes()
        mission = "test"

    return _Agent()


# ── #16/#17: prompt rendering ────────────────────────────────────────────


class TestMemoryContextRendering:
    def test_empty_input_renders_empty_string(self):
        # So the prompt compiler omits the section rather than showing a
        # dangling header.
        assert _render_memory_context([]) == ""
        assert _render_memory_context(None) == ""

    def test_renders_title_summary_type_and_traceable_id(self):
        out = _render_memory_context(
            [
                {
                    "id": "mem-abc",
                    "title": "Prefers dark mode",
                    "summary": "User set the theme to dark",
                    "type": "preference",
                    "score": 0.91,
                }
            ]
        )
        assert "Prefers dark mode" in out
        assert "User set the theme to dark" in out
        assert "[preference]" in out
        # The agent needs the id to cite or supersede the memory.
        assert "memory_id=mem-abc" in out
        # Framed as retrieved, not as user instruction.
        assert "not user input" in out

    def test_summarizes_memory_with_title_only(self):
        out = _render_memory_context([{"id": "m1", "title": "Standalone title", "summary": ""}])
        assert "Standalone title" in out
        assert "memory_id=m1" in out

    def test_labels_untitled_memory_rather_than_rendering_a_dangling_dash(self):
        out = _render_memory_context([{"id": "m1", "title": "", "summary": "body only"}])
        assert "(untitled)" in out
        assert "body only" in out

    def test_skips_entries_with_no_usable_text(self):
        out = _render_memory_context([{"id": "m1", "title": "", "summary": ""}])
        assert out == ""

    def test_respects_item_cap(self):
        memories = [
            {"id": f"m{i}", "title": f"T{i}", "summary": f"S{i}", "type": "note"}
            for i in range(MEMORY_CONTEXT_MAX_ITEMS + 12)
        ]
        out = _render_memory_context(memories)
        assert out.count("memory_id=") <= MEMORY_CONTEXT_MAX_ITEMS

    def test_respects_character_budget(self):
        # Each entry is large enough that the char cap bites before the item cap.
        big = "x" * 1200
        memories = [
            {"id": f"m{i}", "title": f"T{i}", "summary": big, "type": "note"}
            for i in range(20)
        ]
        out = _render_memory_context(memories)
        body = out.split("\n", 1)[1]
        assert len(body) <= MEMORY_CONTEXT_MAX_CHARS
        assert out.count("memory_id=") < 20


# ── #17: memory must actually survive into the compiled prompt ───────────


class TestMemoryReachesPrompt:
    def test_prompt_compiler_includes_recalled_memory(self):
        """The end of the chain: rendered memory must land in the prompt text."""
        memory_text = _render_memory_context(
            [{"id": "mem-1", "title": "Deploys on Fridays", "summary": "no", "type": "fact"}]
        )
        assert memory_text, "renderer must produce text for a real memory"

        layers = PromptLayers(
            platform_policy="policy",
            agent_contract="contract",
            task_contract="task",
            user_intent="when do we deploy?",
            memory_context=memory_text,
        )
        compiled = PromptCompiler().compile(layers, agent_name="memory_agent")
        text = compiled if isinstance(compiled, str) else str(compiled)
        assert "Deploys on Fridays" in text, "recalled memory missing from compiled prompt"

    def test_no_recalled_memory_means_no_fabricated_memory_section(self):
        layers = PromptLayers(
            platform_policy="policy",
            agent_contract="contract",
            task_contract="task",
            user_intent="anything",
            memory_context=_render_memory_context([]),
        )
        compiled = PromptCompiler().compile(layers, agent_name="memory_agent")
        text = compiled if isinstance(compiled, str) else str(compiled)
        assert "Recalled workspace memory" not in text


# ── #14: the loop actually queries the Memory table ─────────────────────


class TestRagAssemblerRetrievesMemories:
    async def test_assembler_returns_stored_memories(self, db_session):
        ws_id = await _ws(db_session, "RAG Memory WS")
        db_session.add(
            Memory(
                id=uuid.uuid4(),
                workspace_id=ws_id,
                type="preference",
                status="active",
                title="Deployment window",
                summary="Deploy only on Tuesday or Wednesday mornings",
                content="Deploy only on Tuesday or Wednesday mornings",
                content_hash=_hash("Deploy only on Tuesday or Wednesday mornings"),
                source_type="agent",
                source_label="Agent Memory",
                tags=["preference"],
            )
        )
        await db_session.commit()

        ctx = await _assemble_rag_context(
            str(ws_id),
            "when should we deploy to production?",
            _agent_stub(),
            session_factory=lambda: _SessionCtx(db_session),
        )

        # The loop previously returned only entities/documents/preferences and
        # never touched the Memory table at all.
        assert "memories" in ctx, "assembler must expose a memories key"
        memories = ctx["memories"]
        assert isinstance(memories, list)
        titles = [m["title"] for m in memories]
        assert "Deployment window" in titles, f"stored memory not recalled: {memories}"

    async def test_recalled_memory_carries_substance_not_just_a_label(self, db_session):
        ws_id = await _ws(db_session, "RAG Content WS")
        db_session.add(
            Memory(
                id=uuid.uuid4(),
                workspace_id=ws_id,
                type="fact",
                status="active",
                title="Rollout policy",
                summary="Never deploy on a Friday afternoon",
                content="Never deploy on a Friday afternoon",
                content_hash=_hash("Never deploy on a Friday afternoon"),
                source_type="agent",
                tags=["fact"],
            )
        )
        await db_session.commit()

        ctx = await _assemble_rag_context(
            str(ws_id),
            "what is the rollout policy for friday afternoon?",
            _agent_stub(),
            session_factory=lambda: _SessionCtx(db_session),
        )

        rec = next(
            (m for m in ctx["memories"] if m["title"] == "Rollout policy"), None
        )
        assert rec is not None, f"memory not recalled: {ctx['memories']}"
        # Content, not just the title: the old injection was title+type only,
        # so the model saw a label with none of the recalled meaning.
        assert "Friday afternoon" in rec["summary"]

    async def test_assembler_degrades_to_empty_memories_on_bad_input(self, db_session):
        ws_id = await _ws(db_session, "RAG Edge WS")

        # Empty query must not raise and must still return the key.
        ctx = await _assemble_rag_context(str(ws_id), "   ", _agent_stub(),
                                          session_factory=lambda: _SessionCtx(db_session))
        assert ctx["memories"] == []

        # Non-UUID workspace id must degrade, not explode.
        ctx2 = await _assemble_rag_context("not-a-uuid", "hello there friend",
                                            _agent_stub(),
                                            session_factory=lambda: _SessionCtx(db_session))
        assert ctx2["memories"] == []

    async def test_workspace_scoping_is_enforced(self, db_session):
        """A memory from another workspace must never be recalled."""
        ws_a = await _ws(db_session, "WS A")
        ws_b = await _ws(db_session, "WS B")

        db_session.add(
            Memory(
                id=uuid.uuid4(),
                workspace_id=ws_b,
                type="fact",
                status="active",
                title="Confidential B only",
                summary="secret information belonging to workspace B",
                content="secret information belonging to workspace B",
                content_hash=_hash("secret information belonging to workspace B"),
                source_type="agent",
            )
        )
        await db_session.commit()

        ctx = await _assemble_rag_context(
            str(ws_a),
            "confidential information",
            _agent_stub(),
            session_factory=lambda: _SessionCtx(db_session),
        )
        titles = [m["title"] for m in ctx["memories"]]
        assert "Confidential B only" not in titles, "cross-workspace memory leak"


# ── #14/#15: round trip through the agent tools ──────────────────────────


class TestAgentMemoryRoundTrip:
    async def test_memory_written_by_the_agent_is_searchable_by_it(self, db_session, monkeypatch):
        import api.tools.executor as executor_mod

        monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
        ws_id = await _ws(db_session, "Round Trip WS")

        written = await _execute_create_memory(
            params={
                "content": "The staging database is reset every night at midnight UTC",
                "category": "fact",
                "confidence": 0.9,
            },
            workspace_id=str(ws_id),
        )
        assert written["status"] == "success"

        found = await _execute_search_memories(
            params={"query": "staging database reset", "strategy": "keyword"},
            workspace_id=str(ws_id),
        )
        assert found["status"] == "success"
        ids = [r["id"] for r in found["result"]]
        assert written["result"]["id"] in ids, (
            "a memory the agent just wrote must be findable by the agent"
        )

    async def test_written_memory_reaches_the_prompt_end_to_end(
        self, db_session, monkeypatch
    ):
        """#14 + #15 + #16 + #17 in one path: write, retrieve, render, compile."""
        import api.tools.executor as executor_mod

        monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
        ws_id = await _ws(db_session, "End To End WS")

        await _execute_create_memory(
            params={
                "content": "Customer requires invoices to be numbered sequentially",
                "category": "preference",
            },
            workspace_id=str(ws_id),
        )

        ctx = await _assemble_rag_context(
            str(ws_id),
            "how should customer invoices be numbered?",
            _agent_stub(),
            session_factory=lambda: _SessionCtx(db_session),
        )
        assert ctx["memories"], "the loop recalled nothing from a memory that exists"

        memory_text = _render_memory_context(ctx["memories"])
        assert "sequentially" in memory_text

        compiled = PromptCompiler().compile(
            PromptLayers(
                platform_policy="policy",
                agent_contract="contract",
                task_contract="task",
                user_intent="how should customer invoices be numbered?",
                memory_context=memory_text,
            ),
            agent_name="memory_agent",
        )
        text = compiled if isinstance(compiled, str) else str(compiled)
        assert "sequentially" in text, "memory written by the agent never reached the prompt"


class TestMemorySurvivesContextBudget:
    """Memory must not be the first thing truncated away."""

    async def test_memory_is_prepended_so_budget_truncation_keeps_it(self, db_session):
        """
        `_act_phase_inner` truncates context_prompt to the RAG token budget
        before embedding it in the message. Memory is appended by plan_phase and
        must therefore be placed ahead of document paths, or a long document
        listing would silently drop the recalled memory entirely.
        """
        ws_id = await _ws(db_session, "Budget WS")
        db_session.add(
            Memory(
                id=uuid.uuid4(),
                workspace_id=ws_id,
                type="preference",
                status="active",
                title="Escalation contact",
                summary="Escalate billing issues to the finance lead named Priya",
                content="Escalate billing issues to the finance lead named Priya",
                content_hash=_hash("Escalate billing issues to the finance lead named Priya"),
                source_type="agent",
            )
        )
        await db_session.commit()

        ctx = await _assemble_rag_context(
            str(ws_id),
            "who should billing escalations go to?",
            _agent_stub(),
            session_factory=lambda: _SessionCtx(db_session),
        )
        assert ctx["memories"], "memory not recalled"

        # Mirror _act_phase_inner's composition order.
        context_prompt = "documents: " + ("x" * 4000)
        recalled = _render_memory_context(ctx["memories"])
        composed = f"{recalled}\n\n{context_prompt}" if context_prompt else recalled

        assert composed.index("Escalation contact") < composed.index("documents:")
        assert composed.startswith("Recalled workspace memory")

        # Even after truncating to a small budget, the memory header survives.
        truncated = composed[:200]
        assert "Recalled workspace memory" in truncated
        assert "Escalation contact" in truncated


# ── Task 4: resolved per-user weights reach the ranker ─────────────────


def _agent_stub_unfiltered():
    """read_types=["any"] so the graph lookup is not narrowed by agent scope.

    The default stub declares ["memory", "document"], which filters out the
    ``preference`` Entity these tests seed -- a known, separate bug (F-07 in the
    audit trail) that would make the weight wiring untestable here.
    """

    class _Scopes:
        read_types = ["any"]

    class _Agent:
        memory_scopes = _Scopes()
        mission = "test"

    return _Agent()


_LEARNED = {
    "relevance": 0.7,
    "recency": 0.15,
    "importance": 0.1,
    "user_preference": 0.05,
}


async def _seed_learned_profile(db_session, ws_id, user_id):
    db_session.add(
        RankingWeightProfile(
            tenant_id=uuid.uuid4(),
            workspace_id=ws_id,
            user_id=user_id,
            relevance=_LEARNED["relevance"],
            recency=_LEARNED["recency"],
            importance=_LEARNED["importance"],
            user_preference=_LEARNED["user_preference"],
            sample_size=25,
        )
    )
    await db_session.commit()


def _capture_rank_results(monkeypatch) -> list:
    """Record every user_context handed to the ranker, then delegate for real."""
    from api.services.search_ranking import search_ranking_service

    seen: list = []
    real = search_ranking_service.rank_results

    def _capture(results, query, user_context=None):
        seen.append(user_context)
        return real(results, query, user_context=user_context)

    monkeypatch.setattr(search_ranking_service, "rank_results", _capture)
    return seen


class TestResolvedWeightsReachRanker:
    async def test_resolved_weights_are_passed_into_rank_results(
        self, db_session, monkeypatch
    ):
        """The end of the chain: a stored profile must arrive at the ranker.

        Asserted on the ``user_context`` handed to ``rank_results`` rather than
        on the resulting score, so a resolver that silently degrades to
        defaults is caught here instead of being indistinguishable from a
        weighting that happened not to matter for this candidate set.
        """
        ws_id, user_id = await _ws_with_user(db_session, "Weights WS")
        db_session.add(
            Entity(
                id=uuid.uuid4(),
                workspace_id=ws_id,
                type="preference",
                canonical_name="likes alpha-unicorn",
                aliases=[],
                metadata_={"importance": 0.9},
            )
        )
        await _seed_learned_profile(db_session, ws_id, user_id)
        seen = _capture_rank_results(monkeypatch)

        await _assemble_rag_context(
            str(ws_id),
            "likes alpha-unicorn",
            _agent_stub_unfiltered(),
            session_factory=lambda: _SessionCtx(db_session),
            user_id=str(user_id),
        )

        assert seen, "ranking never ran -- the Entity candidate was not retrieved"
        assert seen[0]["weights"] == pytest.approx(_LEARNED), (
            "the stored per-user profile must be what the ranker multiplies by"
        )

    async def test_weights_arrive_without_any_preference_entities(
        self, db_session, monkeypatch
    ):
        """Weights are independent of the preference Entity lookup.

        The preference path leaves ``user_context`` unset when the workspace has
        no preference entities, which is the common case. If the weights rode
        along on that dict they would silently never apply for most users --
        learned weights that look wired and are not.
        """
        ws_id, user_id = await _ws_with_user(db_session, "No Prefs WS")
        db_session.add(
            Entity(
                id=uuid.uuid4(),
                workspace_id=ws_id,
                type="concept",
                canonical_name="alpha-unicorn telemetry",
                aliases=[],
                metadata_={"importance": 0.9},
            )
        )
        await _seed_learned_profile(db_session, ws_id, user_id)
        seen = _capture_rank_results(monkeypatch)

        ctx = await _assemble_rag_context(
            str(ws_id),
            "alpha-unicorn telemetry",
            _agent_stub_unfiltered(),
            session_factory=lambda: _SessionCtx(db_session),
            user_id=str(user_id),
        )

        assert not ctx["preferences"], "fixture must have no preference entities"
        assert seen, "ranking never ran"
        assert seen[0]["weights"] == pytest.approx(_LEARNED)

    async def test_weights_resolve_before_the_session_is_closed(
        self, tmp_path, monkeypatch
    ):
        """Production-shaped session lifecycle rather than a test double.

        The other two tests inject ``_SessionCtx``, which never closes its
        session -- so anything about lifecycle is invisible to them. This drives a
        real ``async_sessionmaker`` on its own file-backed engine: closes on
        ``__aexit__``, commits on exit, real SQLAlchemy ``Result`` semantics
        from the resolver's raw ``text()`` statement.

        What it does NOT do: pin the resolution's position inside the session
        block. Moving the lookup below that block was tried and this test stayed
        green, because a closed AsyncSession is reusable. The production-only
        failure is subtler -- ``database.scoped_session`` sets its RLS GUCs with
        ``set_config(..., is_local=true)``, so they die with the previous
        transaction and the FORCE-RLS profile table returns zero rows, pinning
        every user to defaults with no error anywhere. SQLite has no RLS, so
        that cannot be reproduced here; it needs the live-PostgreSQL suite.
        """
        from sqlalchemy.ext.asyncio import (
            AsyncSession,
            async_sessionmaker,
            create_async_engine,
        )
        from sqlalchemy.pool import NullPool

        from api.database import Base

        engine = create_async_engine(
            f"sqlite+aiosqlite:///{tmp_path}/weights.db", poolclass=NullPool
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        fac = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async def _seeded_session(sess_factory):
            async with sess_factory() as s:
                return await _ws_with_user(s, "Closed Session WS")

        ws_id, user_id = await _seeded_session(fac)
        async with fac() as s:
            s.add(
                Entity(
                    id=uuid.uuid4(),
                    workspace_id=ws_id,
                    type="concept",
                    canonical_name="bravo-kestrel signal",
                    aliases=[],
                    metadata_={"importance": 0.9},
                )
            )
            await s.commit()
            await _seed_learned_profile(s, ws_id, user_id)

        seen = _capture_rank_results(monkeypatch)
        try:
            await _assemble_rag_context(
                str(ws_id),
                "bravo-kestrel signal",
                _agent_stub_unfiltered(),
                session_factory=fac,
                user_id=str(user_id),
            )
        finally:
            await engine.dispose()

        assert seen, "ranking never ran"
        assert seen[0]["weights"] == pytest.approx(_LEARNED), (
            "the resolved profile must survive a factory that commits and "
            "closes on exit, i.e. the real production lifecycle"
        )


class TestLangGraphPathForwardsUserId:
    """The second production caller must not discard an id it already holds.

    ``retrieve_context_node`` is reached with ``user_id`` in hand: it is
    required graph state (``state.validate_graph_state`` rejects a state without
    it) and ``build_initial_state`` populates it from trusted ids via
    ``graph/runner.py:309-310``. Not forwarding it makes learned ranking weights
    dead on this path -- and this path takes *all* agent traffic when
    ``langgraph_agent_run_percent=0`` ("no limit", ``graph/runner.py:123-125``),
    so the feature would look live in logs while silently never applying.
    """

    @staticmethod
    def _capture(monkeypatch) -> dict:
        import api.orchestrator.loop as loop_mod

        seen: dict = {}

        async def _fake(workspace_id, query, agent, session_factory=None, *, user_id=None):
            seen.update(workspace_id=workspace_id, query=query, user_id=user_id)
            return {"entities": [], "documents": [], "preferences": [], "memories": []}

        # nodes.py imports _assemble_rag_context INSIDE the function, so patching
        # the module attribute is what the call site actually reads.
        monkeypatch.setattr(loop_mod, "_assemble_rag_context", _fake)
        return seen

    async def test_graph_node_forwards_user_id(self, monkeypatch):
        from api.graph.nodes import retrieve_context_node

        seen = self._capture(monkeypatch)

        out = await retrieve_context_node(
            {
                "workspace_id": "ws-123",
                "user_id": "user-456",
                "agent_id": "memory",
                "request_id": "req-1",
                "task": "research python career paths",
            }
        )

        assert seen.get("workspace_id") == "ws-123", "guard: the fake was not called"
        assert seen["user_id"] == "user-456", (
            "the graph node must forward user_id, or learned ranking weights are "
            "silently dead on this path"
        )
        assert out["rag_status"] in ("ok", "empty"), "guard: node completed normally"

    async def test_missing_user_id_becomes_none_not_a_bare_string(self, monkeypatch):
        """`or None` matters: ``effective_weights`` short-circuits on falsy.

        A forwarded ``""`` still short-circuits, but a forwarded ``"None"`` (what
        ``build_initial_state`` produces from ``str(None)``) does not -- it would
        issue a pointless profile lookup against a user that cannot exist.
        """
        from api.graph.nodes import retrieve_context_node

        seen = self._capture(monkeypatch)

        await retrieve_context_node(
            {"workspace_id": "ws-123", "task": "research python career paths"}
        )

        assert seen.get("workspace_id") == "ws-123", "guard: the fake was not called"
        assert seen["user_id"] is None, (
            "an absent user_id must arrive as None, not as an empty or stringified "
            "placeholder that would skip the falsy short-circuit in effective_weights"
        )
