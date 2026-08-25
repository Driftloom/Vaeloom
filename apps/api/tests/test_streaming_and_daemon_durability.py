"""Tests for ADR-033 fixes: ReAct flag-gate, true token streaming,
durable background scheduling (daemon enqueuer + worker retry/backoff)."""
import json
from datetime import UTC, datetime

import pytest

# ── Test doubles ────────────────────────────────────────────────────


class FakeRedis:
    """Minimal redis-py stand-in covering the daemon/worker surface."""

    def __init__(self):
        self.strings: dict = {}
        self.hashes: dict = {}
        self.lists: dict = {}
        self.zsets: dict = {}

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.strings:
            return False
        self.strings[key] = value
        return True

    async def delete(self, *keys):
        n = 0
        for k in keys:
            if k in self.strings:
                del self.strings[k]
                n += 1
        return n

    async def hset(self, key, mapping=None, **kw):
        self.hashes.setdefault(key, {}).update(mapping or {})
        return len(mapping or {})

    async def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    async def expire(self, key, ttl):
        return True

    async def lpush(self, key, value):
        self.lists.setdefault(key, []).insert(0, value)
        return len(self.lists[key])

    async def blpop(self, key, timeout=None):
        lst = self.lists.get(key)
        if lst:
            return (key, lst.pop(0))
        return None

    async def zadd(self, key, mapping):
        self.zsets.setdefault(key, {}).update(mapping)
        return len(mapping)

    async def zrangebyscore(self, key, lo, hi, start=0, num=None):
        lo_f = float(lo)
        hi_f = float(hi)
        items = sorted((s, m) for m, s in self.zsets.get(key, {}).items() if lo_f <= s <= hi_f)
        window = items[start:] if num is None else items[start:start + num]
        return [m for _, m in window]

    async def zrem(self, key, member):
        zs = self.zsets.get(key, {})
        if member in zs:
            del zs[member]
            return 1
        return 0

    async def ping(self):
        return True


class _FakeResp:
    def __init__(self, lines):
        self.status_code = 200
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def aread(self):
        return b"{}"


class _FakeStreamCtx:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, *exc):
        return False


class _FakeAsyncClient:
    """httpx.AsyncClient stand-in whose .stream() replays canned SSE lines."""

    instances: list = []

    def __init__(self, lines, **kw):
        self.lines = lines
        _FakeAsyncClient.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def stream(self, method, url, **kw):
        return _FakeStreamCtx(_FakeResp(self.lines))


@pytest.fixture
def fake_redis(monkeypatch):
    fr = FakeRedis()
    monkeypatch.setattr("api.infrastructure.background_daemon.get_daemon_redis", lambda: fr)
    return fr


# ── Task 1: ReAct flag-gate ────────────────────────────────────────


class TestReActGate:
    @pytest.mark.asyncio
    async def test_try_react_loop_disabled_by_default(self, monkeypatch):
        """Flag off (default) → None even WITH a key present."""
        monkeypatch.setattr("api.orchestrator.loop.settings.agent_react_enabled", False)
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "sk-test")
        from api.agents.career_agent.handler import CareerAgent
        from api.orchestrator.loop import _try_react_loop

        res = await _try_react_loop(CareerAgent(), "career analysis python senior", "00000000-0000-0000-0000-000000000000", "career")
        assert res is None

    @pytest.mark.asyncio
    async def test_act_phase_skips_react_when_disabled(self, monkeypatch, tmp_path):
        """act_phase must NOT call the LLM tools API when flag is off."""
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        monkeypatch.setattr("api.orchestrator.loop.settings.agent_react_enabled", False)
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "sk-test")

        called = {"react": False}

        async def _spy(*a, **k):
            called["react"] = True
            return None

        import api.orchestrator.loop as loop_mod
        monkeypatch.setattr(loop_mod, "_try_react_loop", _spy)

        from api.agents.career_agent.handler import CareerAgent
        from api.orchestrator.loop import AgentRequest, act_phase

        req = AgentRequest(agent=CareerAgent(), request_id="gate-test", message="analyze career path", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="career")
        plan = {"message": req.message, "workspace_id": req.workspace_id, "context_prompt": ""}
        result = await act_phase(plan, req)
        assert called["react"] is False, "ReAct attempted while disabled"
        assert result.get("agent_name") == "career"

    @pytest.mark.asyncio
    async def test_react_enabled_uses_stream_path(self, monkeypatch, tmp_path):
        """Flag on + key set → ReAct runs through the streaming generator."""
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        monkeypatch.setattr("api.orchestrator.loop.settings.agent_react_enabled", True)
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "sk-test")

        deltas = ["Hel", "lo ", "wor", "ld!"]

        async def fake_stream(self, messages, tools, *a, **k):
            for d in deltas:
                yield {"type": "text_delta", "text": d}
            yield {"type": "done", "finish_reason": "end_turn"}

        import api.services.llm_service as ls_mod
        monkeypatch.setattr(ls_mod.LLMService, "generate_completion_with_tools_stream", fake_stream)

        from api.agents.career_agent.handler import CareerAgent
        from api.orchestrator.loop import _try_react_loop

        tokens: list[str] = []
        res = await _try_react_loop(
            CareerAgent(), "analyze my career path for senior roles",
            "00000000-0000-0000-0000-000000000000", "career",
            on_token=tokens.append,
        )
        assert tokens == deltas, f"on_token received {tokens}"
        assert res["action"] == "suggest"
        assert res["result"]["details"] == "Hello world!"


# ── Fix 1: streaming-with-tools parsers ────────────────────────────


class TestToolStreamParsers:
    @pytest.mark.asyncio
    async def test_openai_parser_deltas_and_tool_calls(self, monkeypatch):
        lines = [
            'data: {"choices":[{"delta":{"role":"assistant"}}]}',
            'data: {"choices":[{"delta":{"content":"Let me search."}}]}',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"web_search","arguments":"{\\"q"}}]}}]}',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"uery\\":\\"ats\\"}"}}]}}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
            "data: [DONE]",
        ]
        monkeypatch.setattr("api.config.settings.llm_api_key", "sk-test")
        import api.services.llm_service as ls_mod
        monkeypatch.setattr(ls_mod.httpx, "AsyncClient", lambda *_a, **_k: _FakeAsyncClient(lines))

        events = []
        async for evt in ls_mod.llm_service.generate_completion_with_tools_stream(
            messages=[], tools=[{"type": "function", "function": {"name": "web_search"}}], model="gpt-4o"
        ):
            events.append(evt)

        types = [e["type"] for e in events]
        assert "text_delta" in types
        tc_evt = next(e for e in events if e["type"] == "tool_calls")
        assert tc_evt["tool_calls"][0]["id"] == "c1"
        assert tc_evt["tool_calls"][0]["function"]["name"] == "web_search"
        assert tc_evt["tool_calls"][0]["function"]["arguments"] == {"query": "ats"}
        assert events[-1]["type"] == "done"
        assert events[-1]["finish_reason"] == "tool_calls"

    @pytest.mark.asyncio
    async def test_anthropic_parser_deltas_and_tool_calls(self, monkeypatch):
        lines = [
            'data: {"type":"message_start"}',
            'data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}',
            'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Checking repo."}}',
            'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"t1","name":"fetch_github_repo"}}',
            'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"repo\\":"}}',
            'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"o/r\\"}"}}',
            'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
            'data: {"type":"message_stop"}',
        ]
        monkeypatch.setattr("api.config.settings.llm_api_key", "sk-test")
        monkeypatch.setattr("api.services.llm_service.settings.llm_provider", "anthropic")
        import api.services.llm_service as ls_mod
        monkeypatch.setattr(ls_mod.httpx, "AsyncClient", lambda *_a, **_k: _FakeAsyncClient(lines))

        events = []
        async for evt in ls_mod.llm_service._anthropic_tool_completion_stream(
            messages=[], tools=[], model="claude-3-haiku-20240307", temperature=0.7, api_key="sk-test"
        ):
            events.append(evt)

        text_evt = next(e for e in events if e["type"] == "text_delta")
        assert text_evt["text"] == "Checking repo."
        tc_evt = next(e for e in events if e["type"] == "tool_calls")
        assert tc_evt["tool_calls"][0]["id"] == "t1"
        assert tc_evt["tool_calls"][0]["function"]["name"] == "fetch_github_repo"
        assert tc_evt["tool_calls"][0]["function"]["arguments"] == {"repo": "o/r"}
        assert events[-1]["finish_reason"] == "tool_use"

    @pytest.mark.asyncio
    async def test_no_key_delegates_to_buffered_contract(self):
        """No API key → buffered fallback emits single-shot text_delta + done."""
        from api.services.llm_service import llm_service

        events = [e async for e in llm_service.generate_completion_with_tools_stream(messages=[{"role": "user", "content": "hi"}], tools=[])]
        assert events[0]["type"] == "text_delta"
        assert "Mock tool reply" in events[0]["text"]
        assert events[-1]["type"] == "done"


class TestLiveTokenStreaming:
    @pytest.mark.asyncio
    async def test_stream_loop_forwards_real_deltas_before_done(self, monkeypatch, tmp_path):
        """run_agent_loop_stream yields provider deltas live; typewriter suppressed."""
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        monkeypatch.setattr("api.orchestrator.loop.settings.agent_react_enabled", True)
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "sk-test")

        deltas = ["Par", "tial ", "ans", "wer!"]

        async def fake_stream(self, messages, tools, *a, **k):
            for d in deltas:
                yield {"type": "text_delta", "text": d}
            yield {"type": "done", "finish_reason": "end_turn"}

        import api.services.llm_service as ls_mod
        monkeypatch.setattr(ls_mod.LLMService, "generate_completion_with_tools_stream", fake_stream)

        from api.agents.career_agent.handler import CareerAgent
        from api.orchestrator.loop import AgentRequest, run_agent_loop_stream

        req = AgentRequest(agent=CareerAgent(), request_id="live-tok", message="plan my career growth strategy", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="career")
        token_events = []
        done_seen = False
        async for evt in run_agent_loop_stream(req):
            if evt["event"] == "token":
                token_events.append(evt["data"]["text"])
            elif evt["event"] == "done":
                done_seen = True
                break
        assert token_events == deltas, "token events must be exact provider deltas"
        assert done_seen

    @pytest.mark.asyncio
    async def test_static_path_still_typewriter_chunks(self, monkeypatch, tmp_path):
        """Default flags → static dispatch → chunked final answer (≤40 chars each)."""
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        monkeypatch.setattr("api.orchestrator.loop.settings.agent_react_enabled", False)
        monkeypatch.setattr("api.orchestrator.loop.settings.llm_api_key", "")

        from api.agents.organization_agent.handler import OrganizationAgent
        from api.orchestrator.loop import AgentRequest, run_agent_loop_stream

        req = AgentRequest(agent=OrganizationAgent(), request_id="static-tok", message="organize files rename duplicate folder categorize", workspace_id="00000000-0000-0000-0000-000000000000", agent_name="organization")
        chunks = []
        async for evt in run_agent_loop_stream(req):
            if evt["event"] == "token":
                chunks.append(evt["data"]["text"])
            elif evt["event"] == "done":
                break
        assert chunks, "static path must still emit typewriter chunks"
        assert all(len(c) <= 40 for c in chunks)

    @pytest.mark.asyncio
    async def test_supervisor_single_path_forwards_token_events(self, monkeypatch, tmp_path):
        """ADR-033 completion: supervisor's single-agent mode streams tokens."""
        monkeypatch.setenv("VAELOOM_STATE_DIR", str(tmp_path))
        import api.orchestrator.supervisor as sup

        async def _single(message):
            return [("memory", 0.95)]

        monkeypatch.setattr(sup, "_detect_subtasks", _single)

        types = []
        async for evt in sup.run_supervisor_stream(
            "remember that I prefer weekly written summaries every friday",
            "00000000-0000-0000-0000-000000000000",
            "sup-tok",
        ):
            types.append(evt["event"])
        assert types[0] == "supervisor_start"
        assert "token" in types, f"expected token passthrough, got {types}"
        assert types[-1] == "done"


# ── Fix 2: durable scheduling ──────────────────────────────────────


@pytest.fixture
def sched_db(tmp_path, monkeypatch):
    """Real per-test SQLite DB wired into api.database.async_session_factory."""
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    import api.database as db_mod
    import api.models  # noqa: F401

    async def _build():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sched.db'}", poolclass=NullPool)
        async with engine.begin() as conn:
            from api.database import Base
            await conn.run_sync(Base.metadata.create_all)
        return engine, async_sessionmaker(engine, expire_on_commit=False)

    loop = asyncio.get_event_loop()
    engine, factory = loop.run_until_complete(_build())
    monkeypatch.setattr(db_mod, "async_session_factory", factory)
    yield factory
    loop.run_until_complete(engine.dispose())


async def _insert_schedule(factory, cron: str, last_run_at=None, enabled=True):
    import uuid

    from api.models.schema import AgentSchedule

    sched_id = uuid.uuid4()
    async with factory() as session:
        session.add(AgentSchedule(id=sched_id, agent_id=uuid.uuid4(), cron=cron, input={"k": "v"}, enabled=enabled, last_run_at=last_run_at))
        await session.commit()
    return str(sched_id)


class TestDaemonEnqueuer:
    @pytest.mark.asyncio
    async def test_due_schedule_enqueued_once_per_slot(self, fake_redis, sched_db, monkeypatch):
        from api.infrastructure.background_daemon import _run_due_agent_schedules

        await _insert_schedule(sched_db, "* * * * *")
        now = datetime.now(UTC).replace(second=30, microsecond=0)

        first = await _run_due_agent_schedules(now)
        second = await _run_due_agent_schedules(now.replace(second=45))
        assert first == 1
        assert second == 0, "same slot claimed twice — dedup failed"

        wait_key = "bull:schedules:wait"
        assert len(fake_redis.lists.get(wait_key, [])) == 1
        job_id = fake_redis.lists[wait_key][0]
        job = fake_redis.hashes[f"bull:schedules:{job_id}"]
        assert job["name"] == "schedule.agent_run"
        data = json.loads(job["data"])
        assert set(data.keys()) >= {"schedule_id", "agent_id", "input"}

    @pytest.mark.asyncio
    async def test_inline_fallback_without_redis(self, sched_db, monkeypatch):
        """No Redis → degraded inline execution exactly like pre-ADR behavior."""
        monkeypatch.setattr("api.infrastructure.background_daemon.get_daemon_redis", lambda: None)

        executed: list[tuple] = []

        async def _fake_exec(schedule_id, agent_id, input_data):
            executed.append((schedule_id, agent_id, input_data))
            return {"status": "success", "error": None, "summary": "ok"}

        import api.infrastructure.background_daemon as bd
        monkeypatch.setattr(bd, "execute_agent_schedule_job", _fake_exec)

        sid = await _insert_schedule(sched_db, "* * * * *")
        now = datetime.now(UTC).replace(second=10, microsecond=0)
        count = await bd._run_due_agent_schedules(now)
        assert count == 1
        assert executed and executed[0][0] == sid

    @pytest.mark.asyncio
    async def test_catch_up_missed_slot_once(self, fake_redis, sched_db):
        from api.infrastructure.background_daemon import catch_up_missed_runs

        last_run = datetime(2026, 8, 22, 9, 0, tzinfo=UTC)
        await _insert_schedule(sched_db, "5 10 * * *", last_run_at=last_run)
        now = datetime(2026, 8, 22, 10, 7, tzinfo=UTC)

        triggered = await catch_up_missed_runs(now)
        assert triggered == 1
        # Second startup must NOT re-fire (claim + last_run_at updated)
        again = await catch_up_missed_runs(now)
        assert again == 0

    @pytest.mark.asyncio
    async def test_catch_up_skips_up_to_date_schedule(self, fake_redis, sched_db):
        from api.infrastructure.background_daemon import catch_up_missed_runs

        now = datetime(2026, 8, 22, 10, 7, tzinfo=UTC)
        # Ran AFTER most recent due slot → nothing missed
        await _insert_schedule(sched_db, "5 10 * * *", last_run_at=datetime(2026, 8, 22, 10, 6, tzinfo=UTC))
        triggered = await catch_up_missed_runs(now)
        assert triggered == 0

    @pytest.mark.asyncio
    async def test_daily_watcher_routed_via_queue_at_gate_hour(self, fake_redis, monkeypatch):
        from datetime import datetime as dt

        import api.infrastructure.background_daemon as bd

        scan_called = {"n": 0}

        async def _scan():
            scan_called["n"] += 1
            return 3

        monkeypatch.setitem(bd.WATCHER_REGISTRY, "gmail", _scan)
        six_am = dt(2026, 8, 22, 6, 0, tzinfo=UTC)
        wrong_hour = dt(2026, 8, 22, 7, 0, tzinfo=UTC)

        assert await bd._run_gmail_watcher(wrong_hour) == 0
        assert scan_called["n"] == 0

        got = await bd._run_gmail_watcher(six_am)
        assert got == 1
        assert scan_called["n"] == 0, "durable mode must delegate to worker, not scan inline"
        job_id = fake_redis.lists["bull:schedules:wait"][0]
        job = fake_redis.hashes[f"bull:schedules:{job_id}"]
        assert job["name"] == "daemon.watcher"
        assert json.loads(job["data"])["watcher"] == "gmail"


class TestWorkerRetryBackoff:
    def _make_worker(self, monkeypatch, fr):
        from api.workers.queue_worker import BullMQWorker

        worker = BullMQWorker(queue_name="schedules")

        async def _fake_get_redis():
            return fr

        monkeypatch.setattr(worker, "_get_redis", _fake_get_redis)
        return worker

    async def _put_job(self, fr, job_id, name, max_attempts, data=None):
        await fr.hset(f"bull:schedules:{job_id}", mapping={
            "name": name,
            "data": json.dumps(data or {}),
            "timestamp": "0",
            "attempts": "0",
            "maxAttempts": str(max_attempts),
        })
        await fr.lpush("bull:schedules:wait", job_id)

    @pytest.mark.asyncio
    async def test_success_records_completed(self, monkeypatch):
        fr = FakeRedis()
        worker = self._make_worker(monkeypatch, fr)
        handled: list = []

        async def ok_handler(data):
            handled.append(data)
            return {"ok": True}

        worker.register("unit.ok", ok_handler)
        await self._put_job(fr, "j-ok", "unit.ok", 3)
        await worker._process_job("j-ok")

        assert handled == [{}]
        assert "j-ok" in fr.zsets.get("bull:schedules:completed", {})
        raw = fr.hashes["bull:schedules:j-ok"]
        assert json.loads(raw["returnvalue"]) == {"ok": True}

    @pytest.mark.asyncio
    async def test_failure_then_retry_then_deadletter(self, monkeypatch):
        fr = FakeRedis()
        worker = self._make_worker(monkeypatch, fr)

        async def flaky_handler(data):
            raise RuntimeError(f"boom {data}")

        worker.register("unit.flaky", flaky_handler)
        await self._put_job(fr, "j-flaky", "unit.flaky", max_attempts=2)

        await worker._process_job("j-flaky")  # attempt 1 → delayed
        assert int(fr.hashes["bull:schedules:j-flaky"].get("attempts", "0")) == 1
        delayed = fr.zsets.get("bull:schedules:delayed", {})
        assert "j-flaky" in delayed

        # Simulate backoff elapsing → promotion back to wait list
        due_score = int(delayed["j-flaky"]) - 1000
        await fr.zrem("bull:schedules:delayed", "j-flaky")
        await fr.zadd("bull:schedules:delayed", {"j-flaky": due_score})
        await worker._promote_delayed(fr)
        assert "j-flaky" in fr.lists.get("bull:schedules:wait", [])

        await worker._process_job("j-flaky")  # attempt 2 == maxAttempts → dead-letter
        assert "j-flaky" in fr.zsets.get("bull:schedules:failed", {})
        assert "failedReason" in fr.hashes["bull:schedules:j-flaky"]

    @pytest.mark.asyncio
    async def test_schedule_handlers_registered(self):
        from api.workers.queue_worker import (
            handle_daemon_watcher,
            handle_schedule_agent_run,
            handle_schedule_job_run,
        )

        assert callable(handle_schedule_agent_run)
        assert callable(handle_schedule_job_run)
        assert callable(handle_daemon_watcher)

    @pytest.mark.asyncio
    async def test_handle_watcher_unknown_skips(self):
        from api.workers.queue_worker import handle_daemon_watcher

        res = await handle_daemon_watcher({"watcher": "nope"})
        assert res["status"] == "skipped"


class TestAgentScheduleModel:
    def test_last_run_at_column_exists(self):
        from api.models.schema import AgentSchedule

        assert hasattr(AgentSchedule, "last_run_at")
        cols = {c.name for c in AgentSchedule.__table__.columns}
        assert "last_run_at" in cols

    def test_migration_chain_has_0022(self):
        import os

        versions_dir = os.path.join(os.path.dirname(__file__), "..", "alembic", "versions")
        files = os.listdir(versions_dir)
        assert any(f.startswith("0022") for f in files), f"0022 migration missing: {files}"
