import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio


class _MockScalarResult:
    def __init__(self, scalar=None, scalars_data=None):
        self._scalar = scalar
        self._scalars_data = scalars_data or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._scalars_data


def _make_agent(**overrides):
    a = MagicMock()
    a.id = overrides.get("id", uuid.uuid4())
    a.name = overrides.get("name", "TestAgent")
    a.description = overrides.get("description", "A test agent")
    a.category = overrides.get("category", "general")
    a.status = overrides.get("status", "active")
    a.config = overrides.get("config", {})
    a.user_id = overrides.get("user_id")
    a.tenant_id = overrides.get("tenant_id")
    a.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    a.updated_at = overrides.get("updated_at", datetime.now(timezone.utc))
    return a


class TestAgentService:
    @pytest.fixture
    def service(self):
        from api.services.agent_service import AgentService
        return AgentService()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def agent_create_dto(self):
        dto = MagicMock()
        dto.name = "MyAgent"
        dto.description = "Does things"
        dto.category = "utility"
        dto.config = {"key": "val"}
        return dto

    @pytest.fixture
    def agent_execute_dto(self):
        dto = MagicMock()
        dto.input = {"text": "hello"}
        dto.stream = False
        return dto

    @pytest.fixture
    def agent_update_dto(self):
        dto = MagicMock()
        dto.name = "Updated"
        dto.description = "New desc"
        dto.config = {"new": "config"}
        dto.status = "active"
        return dto

    # ── register_agent ────────────────────────────────────────────────

    async def test_register_agent_with_user_and_tenant(self, service, mock_db, agent_create_dto):
        uid = uuid.uuid4()
        tid = uuid.uuid4()
        agent = await service.register_agent(agent_create_dto, str(tid), str(uid), mock_db)
        assert agent.name == "MyAgent"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited()
        mock_db.refresh.assert_awaited()

    async def test_register_agent_without_user_tenant(self, service, mock_db, agent_create_dto):
        agent = await service.register_agent(agent_create_dto, None, None, mock_db)
        assert agent.name == "MyAgent"
        assert agent.user_id is None
        assert agent.tenant_id is None

    async def test_register_agent_empty_config(self, service, mock_db):
        dto = MagicMock()
        dto.name = "Empty"
        dto.description = None
        dto.category = "cat"
        dto.config = None
        agent = await service.register_agent(dto, None, None, mock_db)
        assert agent.config == {}

    # ── list_agents ───────────────────────────────────────────────────

    async def test_list_agents_default_filters(self, service, mock_db):
        agents_list = [_make_agent(name="A1"), _make_agent(name="A2")]
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=2),
            _MockScalarResult(scalars_data=agents_list),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, None)
        assert total == 2
        assert len(agents) == 2

    async def test_list_agents_with_tenant_id(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=0),
            _MockScalarResult(scalars_data=[]),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, str(uuid.uuid4()))
        assert total == 0

    async def test_list_agents_with_category(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=1),
            _MockScalarResult(scalars_data=[_make_agent()]),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, None, category="utility")
        assert total == 1

    async def test_list_agents_with_search(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=0),
            _MockScalarResult(scalars_data=[]),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, None, search="test")
        assert total == 0

    async def test_list_agents_active_true(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=1),
            _MockScalarResult(scalars_data=[_make_agent()]),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, None, active=True)
        assert total == 1

    async def test_list_agents_active_false(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=1),
            _MockScalarResult(scalars_data=[_make_agent(status="inactive")]),
        ])
        agents, total = await service.list_agents(mock_db, 1, 20, None, active=False)
        assert total == 1

    # ── get_agent ─────────────────────────────────────────────────────

    async def test_get_agent_found(self, service, mock_db):
        agent = _make_agent()
        mock_db.execute.return_value = _MockScalarResult(scalar=agent)
        result = await service.get_agent(mock_db, agent.id, None)
        assert result is agent

    async def test_get_agent_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.get_agent(mock_db, uuid.uuid4(), None)
        assert result is None

    async def test_get_agent_with_tenant(self, service, mock_db):
        agent = _make_agent()
        mock_db.execute.return_value = _MockScalarResult(scalar=agent)
        result = await service.get_agent(mock_db, agent.id, str(uuid.uuid4()))
        assert result is agent

    # ── update_agent ──────────────────────────────────────────────────

    async def test_update_agent_found(self, service, mock_db, agent_update_dto):
        agent = _make_agent()
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            result = await service.update_agent(agent.id, agent_update_dto, mock_db)
            assert result is agent
            assert agent.name == "Updated"
            assert agent.description == "New desc"
            assert agent.config == {"new": "config"}
            assert agent.status == "active"
            mock_db.flush.assert_awaited()
            mock_db.refresh.assert_awaited()

    async def test_update_agent_not_found(self, service, mock_db, agent_update_dto):
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = None
            result = await service.update_agent(uuid.uuid4(), agent_update_dto, mock_db)
            assert result is None

    async def test_update_agent_partial(self, service, mock_db):
        dto = MagicMock()
        dto.name = None
        dto.description = None
        dto.config = None
        dto.status = None
        agent = _make_agent()
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            result = await service.update_agent(agent.id, dto, mock_db)
            assert result is agent

    # ── deactivate_agent ──────────────────────────────────────────────

    async def test_deactivate_agent_found(self, service, mock_db):
        agent = _make_agent()
        mock_db.execute.return_value = _MockScalarResult(scalar=agent)
        result = await service.deactivate_agent(agent.id, mock_db)
        assert result is True
        assert agent.status == "inactive"
        mock_db.flush.assert_awaited()

    async def test_deactivate_agent_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.deactivate_agent(uuid.uuid4(), mock_db)
        assert result is False

    # ── schedule_agent ────────────────────────────────────────────────

    async def test_schedule_agent_with_input(self, service, mock_db):
        result = await service.schedule_agent(uuid.uuid4(), "0 0 * * *", {"key": "val"}, True, mock_db)
        assert result.agent_id is not None
        assert result.cron == "0 0 * * *"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited()
        mock_db.refresh.assert_awaited()

    async def test_schedule_agent_no_input(self, service, mock_db):
        result = await service.schedule_agent(uuid.uuid4(), "*/5 * * * *", None, False, mock_db)
        assert result.input == {}
        assert result.enabled is False

    # ── execute_agent ─────────────────────────────────────────────────

    async def _setup_execute_test(self, mock_db, mock_llm, dto, agent_cfg, llm_return):
        agent = _make_agent(config=agent_cfg)
        with patch.object(self.service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            mock_llm.generate_completion = AsyncMock(return_value=llm_return)
            mock_llm.generate_completion_with_tools = AsyncMock(return_value=llm_return)
            result = await self.service.execute_agent(mock_db, agent.id, dto, None, None)
            return result

    async def test_execute_agent_success_no_tools(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(config={"system_prompt": "Custom prompt", "temperature": 0.5})
        llm_return = {
            "content": "Hello there",
            "finish_reason": "end_turn",
            "tool_calls": [],
            "usage": {"input_tokens": 10, "output_tokens": 20},
        }
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion = AsyncMock(return_value=llm_return)
                result = await service.execute_agent(mock_db, agent.id, agent_execute_dto, None, None)
                assert result.status == "completed"
                assert result.output["content"] == "Hello there"
                assert result.tokens_used == 30
                assert result.cost > 0
                mock_llm.generate_completion.assert_awaited_once()

    async def test_execute_agent_success_with_tools(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(config={"tools": [{"name": "calc"}], "model": "gpt-4"})
        llm_return = {
            "content": "Result",
            "finish_reason": "tool_calls",
            "tool_calls": [{"id": "call_1"}],
            "usage": {"prompt_tokens": 15, "completion_tokens": 25},
        }
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion_with_tools = AsyncMock(return_value=llm_return)
                result = await service.execute_agent(mock_db, agent.id, agent_execute_dto, "tid", "uid")
                assert result.status == "completed"
                assert result.tokens_used == 40
                mock_llm.generate_completion_with_tools.assert_awaited_once()

    async def test_execute_agent_success_alternative_token_keys(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(config={})
        llm_return = {
            "content": "Hi",
            "finish_reason": "stop",
            "tool_calls": [],
            "usage": {},
        }
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion = AsyncMock(return_value=llm_return)
                result = await service.execute_agent(mock_db, agent.id, agent_execute_dto, None, None)
                assert result.tokens_used == 0

    async def test_execute_agent_no_text_input(self, service, mock_db):
        dto = MagicMock()
        dto.input = {"not_text": True}
        dto.stream = False
        agent = _make_agent(config={})
        llm_return = {
            "content": "Ok", "finish_reason": "stop", "tool_calls": [], "usage": {},
        }
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion = AsyncMock(return_value=llm_return)
                result = await service.execute_agent(mock_db, agent.id, dto, None, None)
                assert result.status == "completed"

    async def test_execute_agent_not_found(self, service, mock_db, agent_execute_dto):
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = None
            with pytest.raises(ValueError, match="not found or inactive"):
                await service.execute_agent(mock_db, uuid.uuid4(), agent_execute_dto, None, None)

    async def test_execute_agent_exception(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(config={})
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion = AsyncMock(side_effect=Exception("LLM error"))
                result = await service.execute_agent(mock_db, agent.id, agent_execute_dto, None, None)
                assert result.status == "failed"
                assert result.error == "LLM error"

    async def test_execute_agent_default_system_prompt(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(name="NoPromptAgent", config={})
        llm_return = {
            "content": "Ok", "finish_reason": "stop", "tool_calls": [], "usage": {},
        }
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion = AsyncMock(return_value=llm_return)
                result = await service.execute_agent(mock_db, agent.id, agent_execute_dto, None, None)
                assert result.status == "completed"

    # ── execute_agent_stream ─────────────────────────────────────────

    async def test_execute_agent_stream_not_found(self, service, mock_db, agent_execute_dto):
        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = None
            with pytest.raises(ValueError, match="not found or inactive"):
                async for _ in service.execute_agent_stream(mock_db, uuid.uuid4(), agent_execute_dto, None, None):
                    pass

    async def test_execute_agent_stream_content_chunks(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(config={})

        async def _fake_stream(*args, **kwargs):
            yield {"type": "content", "text": "Hello "}
            yield {"type": "content", "text": "World"}
            yield {"type": "done", "finish_reason": "end_turn"}

        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion_stream = _fake_stream
                chunks = []
                async for chunk in service.execute_agent_stream(mock_db, agent.id, agent_execute_dto, None, None):
                    chunks.append(chunk)
                assert len(chunks) == 3
                assert chunks[0] == {"type": "content", "text": "Hello "}
                assert chunks[1] == {"type": "content", "text": "World"}
                assert chunks[2] == {"type": "done", "finish_reason": "end_turn"}

    async def test_execute_agent_stream_default_prompt(self, service, mock_db, agent_execute_dto):
        agent = _make_agent(name="StreamAgent", config={})

        async def _fake_stream(*args, **kwargs):
            yield {"type": "done", "finish_reason": "stop"}

        with patch.object(service, 'get_agent', new=AsyncMock()) as mock_get:
            mock_get.return_value = agent
            with patch('api.services.agent_service.llm_service') as mock_llm:
                mock_llm.generate_completion_stream = _fake_stream
                chunks = []
                async for chunk in service.execute_agent_stream(mock_db, agent.id, agent_execute_dto, None, None):
                    chunks.append(chunk)
                assert len(chunks) == 1

    # ── list_executions ──────────────────────────────────────────────

    async def test_list_executions_defaults(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=5),
            _MockScalarResult(scalars_data=[MagicMock()]),
        ])
        executions, total = await service.list_executions(mock_db, uuid.uuid4(), 1, 20, None)
        assert total == 5
        assert len(executions) == 1

    async def test_list_executions_with_tenant_and_status(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=0),
            _MockScalarResult(scalars_data=[]),
        ])
        executions, total = await service.list_executions(mock_db, uuid.uuid4(), 1, 20, str(uuid.uuid4()), status="completed")
        assert total == 0
