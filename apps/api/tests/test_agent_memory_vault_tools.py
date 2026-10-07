"""
Unit & Integration Test Suite for Vaeloom Second Brain & Vault Sync Agent Tools.
Verifies:
1. Tool definitions, schemas, scopes, categories, and ALL_TOOLS registration.
2. Agent Card (MEMORY_CARD) tool wiring and capability registry integration.
3. Intent classification with vault keywords and background context stripping.
4. Permission boundaries and AgentCard tool whitelist enforcement.
5. Tool execution for sync_vault, ingest_vault_notes, search_memories, create_memory.
6. Background memory and vault context retrieval helper and chat routing.
"""
import uuid
import pytest
from sqlalchemy import select

from api.agents.conversation_agent.handler import ConversationAgent
from api.agents.memory_agent.handler import MemoryAgentHandler
from api.models.schema import Connector, Document, Folder, Memory, Workspace, User
from api.orchestrator.card_registry import MEMORY_CARD, get_agent_card
from api.orchestrator.contracts.capability import RiskClass
from api.orchestrator.contracts.proposals import ProposalType
from api.orchestrator.proposals_engine import action_proposal_engine
from api.orchestrator.router import (
    CATEGORY_KEYWORDS,
    classify_intent,
)
from api.services.memory_service import retrieve_memory_and_vault_context
from api.tools.definitions import (
    ALL_TOOLS,
    CREATE_MEMORY,
    INGEST_VAULT_NOTES,
    SEARCH_MEMORIES,
    SYNC_VAULT,
)
from api.tools.executor import (
    PermissionDeniedError,
    _execute_create_memory,
    _execute_ingest_vault_notes,
    _execute_search_memories,
    _execute_sync_vault,
    execute_tool,
)

pytestmark = pytest.mark.asyncio


async def _create_test_workspace(db_session, name: str = "Test WS") -> tuple[uuid.UUID, uuid.UUID]:
    """Helper to create a valid User and Workspace satisfying NOT NULL constraints."""
    user = User(
        id=uuid.uuid4(),
        email=f"user-{uuid.uuid4().hex[:8]}@example.com",
        display_name="Test User",
    )
    db_session.add(user)
    await db_session.flush()

    ws = Workspace(
        id=uuid.uuid4(),
        user_id=user.id,
        name=name,
    )
    db_session.add(ws)
    await db_session.commit()
    return ws.id, user.id


# ── 1. Tool Definitions & Registration ────────────────────────────────────────

async def test_tool_declarations_and_scopes():
    """Verify tool definitions are correctly configured and registered in ALL_TOOLS."""
    assert "sync_vault" in ALL_TOOLS
    assert "ingest_vault_notes" in ALL_TOOLS
    assert "search_memories" in ALL_TOOLS
    assert "create_memory" in ALL_TOOLS

    # Scopes
    assert SYNC_VAULT.required_scope == "memory.write"
    assert INGEST_VAULT_NOTES.required_scope == "memory.write"
    assert SEARCH_MEMORIES.required_scope == "memory.read"
    assert CREATE_MEMORY.required_scope == "memory.write"

    # Categories
    assert SYNC_VAULT.category == "memory_write"
    assert INGEST_VAULT_NOTES.category == "memory_write"
    assert SEARCH_MEMORIES.category == "memory_read"
    assert CREATE_MEMORY.category == "memory_write"

    # Input Schema validation
    assert "force" in SYNC_VAULT.input_schema["properties"]
    assert "auto_extract_entities" in INGEST_VAULT_NOTES.input_schema["properties"]
    assert "query" in SEARCH_MEMORIES.input_schema["properties"]
    assert "content" in CREATE_MEMORY.input_schema["properties"]

    # Output Schema validation
    assert SYNC_VAULT.output_schema["type"] == "object"
    assert INGEST_VAULT_NOTES.output_schema["type"] == "object"
    assert SEARCH_MEMORIES.output_schema["type"] == "array"
    assert CREATE_MEMORY.output_schema["type"] == "object"


# ── 2. Agent Card & Orchestrator Routing ─────────────────────────────────────

async def test_memory_agent_card_tools():
    """Verify MEMORY_CARD includes the new tools."""
    for tool_name in ["sync_vault", "ingest_vault_notes", "search_memories", "create_memory"]:
        assert tool_name in MEMORY_CARD.tools, f"{tool_name} missing from MEMORY_CARD.tools"
        card = get_agent_card("memory")
        assert card is not None
        assert tool_name in card.tools


async def test_category_keywords_include_vault():
    """Verify CATEGORY_KEYWORDS contains vault, obsidian, and second brain terms."""
    mem_kw = CATEGORY_KEYWORDS["memory_extraction"]
    for kw in ["vault", "obsidian", "second brain", "notes", "sync vault"]:
        assert kw in mem_kw, f"'{kw}' missing from CATEGORY_KEYWORDS['memory_extraction']"


async def test_intent_classification_routes_vault_queries():
    """Verify vault-specific user queries route to memory agent."""
    agent, conf = await classify_intent("Sync my Obsidian vault notes with my second brain")
    assert agent == "memory"
    assert conf >= 0.70

    agent2, conf2 = await classify_intent("Remember that my obsidian second brain has my notes")
    assert agent2 == "memory"
    assert conf2 >= 0.70


async def test_intent_classification_strips_background_context():
    """Verify that appended background context does not distort query intent."""
    query = "Please critique my resume summary for a Staff Engineer role"
    bg_context = "\n\n[Background Context from Workspace Memories & Vault Notes]\n- Vault Note (obsidian.md): notes about python architecture"
    full_message = query + bg_context

    agent, conf = await classify_intent(full_message)
    # Must classify based on the actual user query (resume), NOT the vault note context
    assert agent == "resume"
    assert conf >= 0.70


# ── 3. Permission Enforcement ────────────────────────────────────────────────

async def test_permission_denial_missing_scopes():
    """Verify execute_tool raises PermissionDeniedError when agent lacks required scopes."""
    ws_id = str(uuid.uuid4())

    # Lack memory.read for search_memories
    with pytest.raises(PermissionDeniedError) as exc:
        await execute_tool(
            tool=SEARCH_MEMORIES,
            params={"query": "test"},
            agent_id="memory",
            agent_scopes=["connector.read"],  # missing memory.read
            workspace_id=ws_id,
        )
    assert "lacks scope 'memory.read'" in str(exc.value)

    # Lack memory.write for create_memory
    with pytest.raises(PermissionDeniedError) as exc2:
        await execute_tool(
            tool=CREATE_MEMORY,
            params={"content": "test preference"},
            agent_id="memory",
            agent_scopes=["memory.read"],  # missing memory.write
            workspace_id=ws_id,
        )
    assert "lacks scope 'memory.write'" in str(exc2.value)


async def test_agent_card_denial():
    """Verify an agent cannot use tools not listed in its AgentCard."""
    ws_id = str(uuid.uuid4())

    # gmail agent does not have create_memory in its card
    with pytest.raises(PermissionDeniedError) as exc:
        await execute_tool(
            tool=CREATE_MEMORY,
            params={"content": "testing unauthorized card"},
            agent_id="gmail",
            agent_scopes=["memory.write", "connector.email.write"],
            workspace_id=ws_id,
        )
    assert "is not authorized to use tool 'create_memory' per AgentCard" in str(exc.value)


class _SessionCtx:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        return False


# ── 4. Tool Execution Functions ──────────────────────────────────────────────

async def test_execute_create_memory_and_search_memories(db_session, monkeypatch):
    """Verify create_memory persists a memory and search_memories retrieves it."""
    import api.tools.executor as executor_mod

    monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
    ws_id, user_id = await _create_test_workspace(db_session, name="Memory WS")

    # 1. Create a memory via tool
    create_res = await _execute_create_memory(
        params={"content": "Candidate has 7 years of distributed backend systems experience in Go and Python", "category": "fact", "confidence": 0.95},
        workspace_id=str(ws_id),
    )
    assert create_res["status"] == "success"
    assert create_res["tool"] == "create_memory"
    assert "id" in create_res["result"]
    assert create_res["result"]["status"] == "created"
    mem_id = create_res["result"]["id"]

    # 2. Search memories matching "distributed backend"
    search_res = await _execute_search_memories(
        params={"query": "distributed backend", "category": "all", "limit": 5},
        workspace_id=str(ws_id),
    )
    assert search_res["status"] == "success"
    assert search_res["tool"] == "search_memories"
    assert isinstance(search_res["result"], list)
    assert len(search_res["result"]) >= 1
    found = search_res["result"][0]
    assert found["id"] == mem_id
    assert "distributed backend" in found["content"]
    # Hybrid retrieval is now in play and reports its strategy + real scores.
    assert search_res["strategy"] == "hybrid"
    assert isinstance(found["score"], (int, float))

    # 3. A nonsense query must return nothing.
    #
    # This asserts on `strategy="keyword"` deliberately. The autouse `mock_llm`
    # fixture returns a CONSTANT embedding for every query, so under hybrid/vector
    # every stored memory is an exact match for every query — cosine distance 0
    # passes the threshold filter. That is a mock artifact, not production
    # behaviour, so the negative case pins the keyword tier where the assertion
    # is meaningful. See test_agent_memory_wiring.py for the vector degradation
    # behaviour under mocks.
    empty_res = await _execute_search_memories(
        params={"query": "nonexistent_term_xyz_123", "strategy": "keyword"},
        workspace_id=str(ws_id),
    )
    assert empty_res["status"] == "success"
    assert empty_res["strategy"] == "keyword"
    assert len(empty_res["result"]) == 0

    # 3b. A nonsense query under hybrid must never error, even when the mock
    # makes the vector tier match everything.
    hybrid_res = await _execute_search_memories(
        params={"query": "nonexistent_term_xyz_123", "strategy": "hybrid"},
        workspace_id=str(ws_id),
    )
    assert hybrid_res["status"] == "success"


async def test_create_memory_generates_embedding_and_records_type(db_session, monkeypatch):
    """Finding #15: agent-created memories must be embedded, not stored blind."""
    import api.tools.executor as executor_mod

    monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
    ws_id, _user_id = await _create_test_workspace(db_session, name="Embedding WS")

    res = await _execute_create_memory(
        params={"content": "Prefers TypeScript over JavaScript for all new services", "category": "preference"},
        workspace_id=str(ws_id),
    )
    assert res["status"] == "success"
    # The tool reports whether an embedding was actually produced.
    assert "embedded" in res["result"]
    assert isinstance(res["result"]["embedded"], bool)
    # Type is echoed back so the caller can see what was stored.
    assert res["result"]["type"] == "preference"

    row = (await db_session.execute(select(Memory).where(Memory.id == __import__("uuid").UUID(res["result"]["id"])))).scalar_one()
    assert row.type == "preference"
    assert row.source_type == "agent"
    # Lineage provenance is written by memory_service (the old direct INSERT
    # wrote none).
    assert row.metadata_ is not None
    assert row.metadata_.get("created_by") == "agent_tool"


async def test_create_memory_rejects_unknown_category_by_falling_back(db_session, monkeypatch):
    """An unrecognised category must not write a type outside the taxonomy."""
    import api.tools.executor as executor_mod

    monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
    ws_id, _user_id = await _create_test_workspace(db_session, name="BadType WS")

    res = await _execute_create_memory(
        params={"content": "Some observation with a bogus type", "category": "not_a_real_type"},
        workspace_id=str(ws_id),
    )
    assert res["status"] == "success"
    # Falls back to 'note' rather than persisting an unrepresentable type.
    assert res["result"]["type"] == "note"


async def test_search_memories_requires_a_query(db_session, monkeypatch):
    """Negative control: empty query must be an explicit error, not silent []."""
    import api.tools.executor as executor_mod

    monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
    ws_id, _user_id = await _create_test_workspace(db_session, name="NoQuery WS")

    res = await _execute_search_memories(params={"query": "   "}, workspace_id=str(ws_id))
    assert res["status"] == "error"
    assert "query is required" in res["error"]


async def test_execute_sync_vault_and_ingest_vault_notes(db_session, monkeypatch):
    """Verify sync_vault updates connector state and ingest_vault_notes processes markdown notes."""
    import api.tools.executor as executor_mod

    monkeypatch.setattr(executor_mod, "_ws_session", lambda wid: _SessionCtx(db_session))
    ws_id, user_id = await _create_test_workspace(db_session, name="Vault WS")

    # 1. Sync vault initially
    sync_res = await _execute_sync_vault(
        params={"force": False},
        workspace_id=str(ws_id),
    )
    assert sync_res["status"] == "success"
    assert sync_res["tool"] == "sync_vault"
    assert sync_res["result"]["status"] == "completed"
    assert "files_synced" in sync_res["result"]

    # Verify Connector was created
    conn = (await db_session.execute(
        select(Connector).where(Connector.workspace_id == ws_id, Connector.type == "vault_sync")
    )).scalar_one_or_none()
    assert conn is not None
    assert conn.status == "CONNECTED"
    assert conn.config.get("status") == "in_sync"

    # 2. Ingest notes via tool
    notes_payload = [
        {
            "filename": "System_Design_Notes.md",
            "content": "# System Design Insights\nEvent-driven microservices architecture using Kafka and Postgres.",
            "tags": ["architecture", "systems"],
        },
        {
            "filename": "Career_Goals.md",
            "content": "# Career Vision\nTargeting Staff Software Engineer role in platform engineering.",
            "tags": ["career", "goals"],
        },
    ]

    ingest_res = await _execute_ingest_vault_notes(
        params={"auto_extract_entities": True, "notes": notes_payload},
        workspace_id=str(ws_id),
    )
    assert ingest_res["status"] == "success"
    assert ingest_res["tool"] == "ingest_vault_notes"
    assert ingest_res["result"]["status"] == "completed"
    assert ingest_res["result"]["notes_processed"] == 2
    assert ingest_res["result"]["memories_created"] == 2

    # 3. Search memories to verify ingested notes appear in search
    search_res = await _execute_search_memories(
        params={"query": "microservices architecture"},
        workspace_id=str(ws_id),
    )
    assert search_res["status"] == "success"
    assert len(search_res["result"]) >= 1
    assert any("microservices" in m["content"] for m in search_res["result"])


# ── 5. Background Context Retrieval for Chat ─────────────────────────────────

async def test_retrieve_memory_and_vault_context(db_session):
    """Verify retrieve_memory_and_vault_context builds structured context for chat queries."""
    ws_id, user_id = await _create_test_workspace(db_session, name="Chat Context WS")

    # Add a memory
    mem = Memory(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        title="Favorite Languages",
        summary="User is highly proficient in Rust and Python",
        content="User is highly proficient in Rust and Python",
        content_hash="hash123",
        type="preference",
        status="active",
        tags=["languages", "skills"],
    )
    # Add a vault document
    doc = Document(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        path="Engineering/Distributed_Consensus.md",
        type="markdown",
        content=b"# Raft and Paxos\nNotes on distributed consensus algorithms.",
        summary="Notes on distributed consensus algorithms and quorum mechanics.",
        status="ACTIVE",
    )
    db_session.add_all([mem, doc])
    await db_session.commit()

    # Query matching language skills
    context_lang = await retrieve_memory_and_vault_context(
        workspace_id=ws_id,
        query="Tell me about my Python and Rust experience",
        db=db_session,
    )
    assert "[Background Context from Workspace Memories & Vault Notes]" in context_lang
    assert "Favorite Languages" in context_lang
    assert "Python" in context_lang

    # Query matching distributed systems
    context_dist = await retrieve_memory_and_vault_context(
        workspace_id=ws_id,
        query="What did I write about consensus algorithms?",
        db=db_session,
    )
    assert "Distributed_Consensus.md" in context_dist or "consensus" in context_dist.lower()

    # Empty query or workspace without matches
    context_empty = await retrieve_memory_and_vault_context(
        workspace_id=ws_id,
        query="unrelated baking recipe",
        db=db_session,
    )
    assert context_empty == ""


# ── 6. Conversation & Memory Agent Scaffolding & Dynamic Proposals ───────────

async def test_conversation_agent_second_brain_scaffolding():
    """Verify ConversationAgent tools, greetings text, and action chips for memory."""
    agent = ConversationAgent()

    # 1. search_memories in ConversationAgent.tools
    tool_names = [t.name for t in agent.tools]
    assert "search_memories" in tool_names
    search_tool = next(t for t in agent.tools if t.name == "search_memories")
    assert "personal dynamic memories and synced vault notes" in search_tool.description

    # 2. Greeting response mentions persistent memory
    res = await agent.execute("hi")
    expected_greeting = (
        "Hello! 👋 I'm Vaeloom, your executive career partner with persistent memory. "
        "I can help you build an ATS-proof resume, sync and query your Obsidian vault and notes, "
        "discover target roles, track deadlines, and synthesize long-term career memory.\n\n"
        "What would you like to focus on today?"
    )
    assert res["result"]["summary"] == expected_greeting

    # 3. Action chips include memory notes and sync vault
    chips = res["result"]["action_chips"]
    assert "🧠 Memory Notes" in chips
    assert "🔄 Sync Vault" in chips

    # 4. Fallback action chips include memory notes and sync vault
    fb = await agent.fallback()
    fb_chips = fb["result"]["action_chips"]
    assert "🧠 Memory Notes" in fb_chips
    assert "🔄 Sync Vault" in fb_chips


async def test_memory_agent_handler_tools():
    """Verify MemoryAgentHandler includes all 4 new vault & memory tools."""
    handler = MemoryAgentHandler()
    tool_names = [t.name for t in handler.tools]
    for required in ["sync_vault", "ingest_vault_notes", "search_memories", "create_memory"]:
        assert required in tool_names, f"{required} missing from MemoryAgentHandler.tools"

    sync_t = next(t for t in handler.tools if t.name == "sync_vault")
    assert "2-way Git pull/rebase" in sync_t.description

    ingest_t = next(t for t in handler.tools if t.name == "ingest_vault_notes")
    assert "Ingest and index Markdown notes" in ingest_t.description

    search_t = next(t for t in handler.tools if t.name == "search_memories")
    assert "Search across memory items" in search_t.description

    create_t = next(t for t in handler.tools if t.name == "create_memory")
    assert "Store explicit learned fact" in create_t.description


async def test_action_proposal_engine_vault_conflict_and_graph(db_session):
    """Verify ActionProposalEngine generates proposals for vault conflicts and second brain graph."""
    ws_id, user_id = await _create_test_workspace(db_session, name="Proposal WS")

    # 1. Create a vault_sync connector with active conflicts
    conn = Connector(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        type="vault_sync",
        name="Vault Sync",
        status="CONNECTED",
        config={
            "status": "conflict",
            "branch": "main",
            "conflicts": [{"file": "Career_Notes.md", "type": "content_diverged"}],
        },
    )
    db_session.add(conn)
    await db_session.commit()

    proposals = await action_proposal_engine.generate_proposals(
        query="what should I do?",
        workspace_id=str(ws_id),
        db=db_session,
        limit=6,
    )

    # Verify conflict resolution proposal
    vault_prop = next((p for p in proposals if p.binding and p.binding.tool_name == "sync_vault"), None)
    assert vault_prop is not None, "Vault conflict proposal not generated"
    assert vault_prop.proposal_id.startswith("prop_vault_")
    assert vault_prop.title == "⚡ Resolve 1 Vault Conflict"
    assert vault_prop.description == "Vault sync detected remote rebase conflicts requiring resolution."
    assert vault_prop.proposal_type == ProposalType.WORKFLOW
    assert vault_prop.risk_class == RiskClass.MEDIUM
    assert vault_prop.requires_approval is True
    assert vault_prop.binding.tool_name == "sync_vault"
    assert vault_prop.binding.arguments == {"force": True, "workspace_id": str(ws_id)}
    assert vault_prop.binding.required_scope == "memory.write"

    # Verify second brain graph exploration proposal
    graph_prop = next((p for p in proposals if p.binding and p.binding.tool_name == "query_graph"), None)
    assert graph_prop is not None, "Memory graph proposal not generated"
    assert graph_prop.title == "🧠 Explore Memory Graph"
    assert graph_prop.description == "Query multi-hop knowledge ontology linking your documents and Obsidian notes."
    assert graph_prop.binding.tool_name == "query_graph"
    assert graph_prop.binding.arguments == {"query": "", "workspace_id": str(ws_id)}
    assert graph_prop.binding.required_scope == "memory.read"
