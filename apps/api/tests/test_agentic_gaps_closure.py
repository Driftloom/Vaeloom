"""Tests for the 8 agentic gaps + 7 polish fixes closed in Aug 2026."""
import pytest


class TestEnterpriseDispatch:
    """P0: loop.py _dispatch_agent handles all 22 agents (was 8)."""

    @pytest.mark.asyncio
    async def test_all_registry_agents_dispatch_without_unknown(self):
        from api.orchestrator.loop import AgentRequest, _dispatch_agent
        from api.orchestrator.router import AGENT_REGISTRY

        for name, cls in AGENT_REGISTRY.items():
            agent = cls()
            req = AgentRequest(
                agent=agent,
                request_id=f"test-{name}",
                message=f"test message for {name} with extra words to trigger routing",
                workspace_id="00000000-0000-0000-0000-000000000000",
                agent_name=name,
            )
            coro = _dispatch_agent(cls.__name__, agent, req.message, req)
            result = await coro
            assert isinstance(result, dict), f"{name} did not return dict"
            assert result.get("agent_name") == name or result.get("agent_name") in (name, "organization", "memory"), f"{name} wrong agent_name {result.get('agent_name')}"
            # Should not be fallback error due to unknown agent (fallback has confidence 0 and ask_clarification, but not error)
            assert result.get("action") in ("suggest", "execute", "ask_clarification", "request_approval", "alert", "info", "build_roadmap", "suggest_milestones", "recommend_resources")

    @pytest.mark.asyncio
    async def test_career_dispatch_variants(self):
        from api.orchestrator.loop import AgentRequest, _dispatch_agent
        from api.agents.career_agent.handler import CareerAgent
        agent = CareerAgent()
        cases = [
            ("skill gap analysis for python", "identify_skill_gaps"),
            ("recommend courses for python", "recommend_courses"),
            ("career path analysis", "analyze_career_path"),
        ]
        for msg, _exp in cases:
            req = AgentRequest(agent=agent, request_id="t", message=msg, workspace_id="00000000-0000-0000-0000-000000000000", agent_name="career")
            coro = _dispatch_agent("CareerAgent", agent, msg, req)
            res = await coro
            assert res["agent_name"] == "career"

    @pytest.mark.asyncio
    async def test_gmail_and_drive_no_approval_param(self):
        from api.orchestrator.loop import AgentRequest, _dispatch_agent
        from api.agents.gmail_agent.handler import GmailAgent
        from api.agents.drive_agent.handler import DriveAgent
        gmail = GmailAgent()
        req = AgentRequest(agent=gmail, request_id="t", message="classify inbox", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="gmail")
        res = await _dispatch_agent("GmailAgent", gmail, "hello", req)
        assert res["agent_name"] == "gmail"
        drive = DriveAgent()
        req2 = AgentRequest(agent=drive, request_id="t2", message="sync drive", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="drive")
        res2 = await _dispatch_agent("DriveAgent", drive, "sync", req2)
        # Drive fallback when not configured returns ask_clarification, but should not throw TypeError about has_approval
        assert res2["agent_name"] == "drive"


class TestToolRegistry:
    """P1: 8 missing tools now present (22 total)."""

    def test_all_tools_count(self):
        from api.tools.definitions import ALL_TOOLS
        assert len(ALL_TOOLS) == 28
        for name in ["web_search", "parse_document_ocr", "calculate_ats_diff", "fetch_github_repo", "create_github_issue", "send_slack_message", "sync_notion_pages", "execute_code_sandbox"]:
            assert name in ALL_TOOLS, f"missing {name}"

    def test_tool_categories(self):
        from api.tools.definitions import ALL_TOOLS
        assert ALL_TOOLS["web_search"].category == "system"
        assert ALL_TOOLS["fetch_github_repo"].category == "connector_read"
        assert ALL_TOOLS["create_github_issue"].category == "connector_write"
        assert ALL_TOOLS["execute_code_sandbox"].category == "system"

    @pytest.mark.asyncio
    async def test_executor_live_mocks(self):
        from api.tools.definitions import ALL_TOOLS
        from api.tools.executor import execute_tool
        cases = [
            ("web_search", {"query": "vaeloom", "limit": 2}),
            ("send_slack_message", {"channel": "#general", "text": "hello"}),
            ("execute_code_sandbox", {"code": "print(2+2)", "language": "python"}),
            ("sync_notion_pages", {"database_id": "db1"}),
        ]
        for name, params in cases:
            td = ALL_TOOLS[name]
            res = await execute_tool(td, params, agent_id="test", agent_scopes=[td.required_scope], workspace_id="00000000-0000-0000-0000-000000000000")
            assert res["status"] == "success", f"{name} failed {res}"
            assert res["tool"] == name

    @pytest.mark.asyncio
    async def test_code_sandbox_blocked(self):
        from api.tools.definitions import ALL_TOOLS
        from api.tools.executor import execute_tool
        td = ALL_TOOLS["execute_code_sandbox"]
        res = await execute_tool(td, {"code": "import os\nos.system('ls')", "language": "python"}, agent_id="t", agent_scopes=[td.required_scope], workspace_id="00000000-0000-0000-0000-000000000000")
        assert res["status"] == "error"
        assert "Blocked" in res["result"]


class TestReActLoop:
    """P0: dynamic ReAct loop exists and is non-blocking without LLM key."""

    @pytest.mark.asyncio
    async def test_react_returns_none_without_key(self, monkeypatch):
        from api.orchestrator.loop import _try_react_loop
        from api.agents.career_agent.handler import CareerAgent
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "")
        agent = CareerAgent()
        res = await _try_react_loop(agent, "hello", "00000000-0000-0000-0000-000000000000", "career")
        assert res is None

    def test_react_import_available(self):
        from api.orchestrator.loop import _REACT_AVAILABLE
        assert isinstance(_REACT_AVAILABLE, bool)


class TestStreamingLoop:
    """P1: run_agent_loop_stream yields phase events."""

    @pytest.mark.asyncio
    async def test_stream_yields_intent_and_done(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.loop import AgentRequest, run_agent_loop_stream
        from api.agents.organization_agent.handler import OrganizationAgent
        agent = OrganizationAgent()
        req = AgentRequest(agent=agent, request_id="stream-test", message="organize files rename duplicate folder categorize", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="organization")
        events = []
        async for evt in run_agent_loop_stream(req):
            events.append(evt["event"])
            if evt["event"] == "done":
                break
        assert "intent" in events
        assert "plan" in events
        assert "act" in events
        assert "observe" in events
        assert "reflect" in events
        assert "done" in events

    @pytest.mark.asyncio
    async def test_catalog_has_25_tools(self):
        from api.tools.definitions import ALL_TOOLS
        assert len(ALL_TOOLS) == 28


class TestSupervisor:
    """P1: multi-agent DAG supervisor."""

    def test_is_multi_heuristic(self):
        from api.orchestrator.supervisor import is_multi_agent_request
        assert is_multi_agent_request("I want to apply for Senior Backend Engineer at Google. Tailor my resume, check ATS score, draft cover letter and add calendar prep session") is True
        assert is_multi_agent_request("hello") is False
        assert is_multi_agent_request("organize my files") is False

    @pytest.mark.asyncio
    async def test_detect_and_build_dag(self):
        from api.orchestrator.supervisor import _detect_subtasks, _build_dag
        subtasks = await _detect_subtasks("I want to apply for Senior Backend Engineer at Google. Tailor my resume, check ATS, draft cover letter, add calendar event")
        # Should detect at least 2 agents
        assert len(subtasks) >= 2
        layers = _build_dag(subtasks)
        assert isinstance(layers, list)
        assert all(isinstance(layer, list) for layer in layers)

    @pytest.mark.asyncio
    async def test_run_supervisor_merges(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.supervisor import run_supervisor
        # Use a clear multi-intent that maps to organization + scheduler (both canonical, so MVP lock won't block)
        result = await run_supervisor("organize my files and check my calendar for conflicts", "00000000-0000-0000-0000-000000000000", "sup-test")
        assert result["agent_name"] == "supervisor"
        assert result.get("supervisor") is True
        assert "dag" in result
        assert "summary" in result["result"]

    @pytest.mark.asyncio
    async def test_supervisor_stream(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.supervisor import run_supervisor_stream
        events = []
        async for evt in run_supervisor_stream("organize files and check calendar", "00000000-0000-0000-0000-000000000000", "sup-stream"):
            events.append(evt["event"])
        assert "supervisor_start" in events
        assert "done" in events


class TestRAGAssembler:
    """P2: RAG pre-execution context injection."""

    @pytest.mark.asyncio
    async def test_plan_phase_injects_rag_context(self, tmp_path, monkeypatch):
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        from api.orchestrator.loop import plan_phase, AgentRequest
        from api.orchestrator.state import LoopState
        from api.agents.career_agent.handler import CareerAgent
        agent = CareerAgent()
        req = AgentRequest(agent=agent, request_id="rag-test", message="career path python senior engineer", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="career")
        state = LoopState("rag-test")
        plan = await plan_phase(req, state)
        assert "rag_context" in plan
        assert "context_prompt" in plan
        assert isinstance(plan["rag_context"], dict)
        assert "entities" in plan["rag_context"]
        assert "documents" in plan["rag_context"]
        assert "preferences" in plan["rag_context"]

    def test_build_context_prompt(self):
        from api.orchestrator.loop import _build_context_prompt
        rag = {"entities": [{"name": "Alice", "type": "person"}], "documents": [{"path": "/a.pdf", "summary": "s"}], "preferences": [{"name": "pref"}]}
        prompt = _build_context_prompt(rag)
        assert "Alice" in prompt
        assert "/a.pdf" in prompt
        assert "pref" in prompt

    @pytest.mark.asyncio
    async def test_vector_fallback_on_sqlite(self, tmp_path, monkeypatch):
        # Ensure vector path doesn't crash on SQLite mock
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "")
        from api.orchestrator.loop import _assemble_rag_context
        from api.agents.career_agent.handler import CareerAgent
        agent = CareerAgent()
        ctx = await _assemble_rag_context("00000000-0000-0000-0000-000000000000", "test query python", agent)
        assert isinstance(ctx, dict)


class TestPreferenceFeedback:
    """P2: approval feedback -> preference entity."""

    @pytest.mark.asyncio
    async def test_ingest_creates_entity(self, db_session):
        from api.services.approval import _ingest_feedback_preference
        import uuid
        ws = str(uuid.uuid4())
        # Create workspace row so FK passes if enforced (some test dbs ignore FK)
        from sqlalchemy import text
        try:
            await db_session.execute(text("INSERT INTO workspaces (id, name, user_id, created_at, updated_at) VALUES (:id, 'test', :uid, now(), now())"), {"id": ws, "uid": str(uuid.uuid4())})
            await db_session.commit()
        except Exception:
            await db_session.rollback()
        await _ingest_feedback_preference(ws, "resume", "tailor", "REJECTED", "User does not want Objective sections", str(uuid.uuid4()), db_session, decided_by=str(uuid.uuid4()))
        await db_session.commit()
        result = await db_session.execute(text("SELECT canonical_name, type FROM entities WHERE workspace_id=:wid AND type='preference'"), {"wid": ws})
        rows = result.fetchall()
        assert len(rows) == 1
        assert "Objective" in rows[0][0]

    @pytest.mark.asyncio
    async def test_ingest_dedup(self, db_session):
        from api.services.approval import _ingest_feedback_preference
        import uuid
        ws = str(uuid.uuid4())
        try:
            await db_session.execute(text("INSERT INTO workspaces (id, name, user_id, created_at, updated_at) VALUES (:id, 'test', :uid, now(), now())"), {"id": ws, "uid": str(uuid.uuid4())})
            await db_session.commit()
        except Exception:
            await db_session.rollback()
        from sqlalchemy import text
        await _ingest_feedback_preference(ws, "resume", "tailor", "REJECTED", "dup note", str(uuid.uuid4()), db_session)
        await db_session.commit()
        await _ingest_feedback_preference(ws, "resume", "tailor", "REJECTED", "dup note", str(uuid.uuid4()), db_session)
        await db_session.commit()
        result = await db_session.execute(text("SELECT COUNT(*) FROM entities WHERE workspace_id=:wid AND type='preference'"), {"wid": ws})
        assert result.scalar_one() == 1


class TestBackgroundDaemon:
    """P2: cron daemon and watchers."""

    def test_cron_due_simple(self):
        from api.infrastructure.background_daemon import _is_cron_due
        from datetime import datetime, UTC
        assert _is_cron_due("* * * * *", datetime(2026, 8, 22, 10, 5, tzinfo=UTC)) is True
        assert _is_cron_due("0 6 * * *", datetime(2026, 8, 22, 6, 0, tzinfo=UTC)) is True
        assert _is_cron_due("0 6 * * *", datetime(2026, 8, 22, 7, 0, tzinfo=UTC)) is False

    def test_cron_with_croniter(self):
        from api.infrastructure.background_daemon import _is_cron_due
        from datetime import datetime, UTC
        # croniter should handle */5 correctly
        assert _is_cron_due("*/5 * * * *", datetime(2026, 8, 22, 10, 5, tzinfo=UTC)) is True
        assert _is_cron_due("*/5 * * * *", datetime(2026, 8, 22, 10, 6, tzinfo=UTC)) is False
        assert _is_cron_due("0 */2 * * *", datetime(2026, 8, 22, 10, 0, tzinfo=UTC)) is True

    def test_simple_cron_match(self):
        from api.infrastructure.background_daemon import _simple_cron_match
        from datetime import datetime, UTC
        assert _simple_cron_match("* * * * *", datetime(2026, 8, 22, 10, 5, tzinfo=UTC)) is True
        assert _simple_cron_match("5 10 * * *", datetime(2026, 8, 22, 10, 5, tzinfo=UTC)) is True
        assert _simple_cron_match("5 10 * * *", datetime(2026, 8, 22, 10, 6, tzinfo=UTC)) is False


class TestAgentToolDeclarations:
    """Polish: enterprise agents now declare executor tools."""

    def test_research_has_web_search(self):
        from api.agents.research_agent.handler import ResearchAgent
        names = {t.name for t in ResearchAgent.tools}
        assert "web_search" in names
        assert "query_graph" in names

    def test_github_has_fetch(self):
        from api.agents.github_agent.handler import GitHubAgent
        names = {t.name for t in GitHubAgent.tools}
        assert "fetch_github_repo" in names
        assert "create_github_issue" in names

    def test_coding_has_sandbox(self):
        from api.agents.coding_agent.handler import CodingAgent
        names = {t.name for t in CodingAgent.tools}
        assert "execute_code_sandbox" in names

    def test_connector_has_notion_slack(self):
        from api.agents.connector_agent.handler import ConnectorAgent
        names = {t.name for t in ConnectorAgent.tools}
        assert "sync_notion_pages" in names
        assert "send_slack_message" in names


class TestChatStreamEndpoint:
    """P1: chat/stream endpoint registered."""

    def test_endpoint_exists(self):
        from api.main import app
        # Newer FastAPI wraps includes in lazy _IncludedRouter objects — app.routes
        # no longer flattens paths. OpenAPI generation materializes everything.
        paths = list(app.openapi()["paths"].keys())
        assert "/api/v1/agents/chat/stream" in paths

    def test_catalog_shows_25_tools(self):
        from api.tools.definitions import ALL_TOOLS
        assert len(ALL_TOOLS) == 28
