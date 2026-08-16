import uuid
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from types import SimpleNamespace

pytestmark = pytest.mark.asyncio


class TestKnowledgeGraphService:
    @pytest.fixture
    def service(self):
        from api.services.knowledge_graph_service import KnowledgeGraphService
        return KnowledgeGraphService()

    def _make_simple_row(self, **kwargs):
        d = {k: v for k, v in kwargs.items()}
        ns = SimpleNamespace(**d)
        ns._mapping = d
        return ns

    def _make_db(self, fetchone_val=None, fetchall_val=None, scalar_val=None):
        db = AsyncMock()
        exec_result = MagicMock()
        exec_result.fetchone.return_value = fetchone_val
        if fetchall_val is not None:
            exec_result.fetchall.return_value = fetchall_val
        if scalar_val is not None:
            exec_result.scalar.return_value = scalar_val
        db.execute = AsyncMock(return_value=exec_result)
        return db

    async def test_fix_row_parses_json_properties(self, service):
        row = self._make_simple_row(
            id="abc", properties='{"key":"val"}', embedding='[0.1,0.2]',
            edge_count=5, created_at=None, updated_at=None,
        )
        fixed = service._fix_row(row)
        assert fixed._mapping["properties"] == {"key": "val"}
        assert fixed._mapping["edge_count"] == 5

    async def test_fix_row_handles_invalid_json(self, service):
        row = self._make_simple_row(
            id="abc", properties='{invalid json}', embedding='[0.1,0.2]',
            edge_count=5, created_at=None, updated_at=None,
        )
        fixed = service._fix_row(row)
        assert fixed._mapping["properties"] == "{invalid json}"

    async def test_fix_row_with_none(self, service):
        assert service._fix_row(None) is None

    async def test_fix_rows_empty(self, service):
        rows = service._fix_rows([])
        assert rows == []

    async def test_compute_embedding_success(self, service, monkeypatch):
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        result = await service._compute_embedding("hello")
        assert result == [0.5] * 1536

    async def test_compute_embedding_failure(self, service, monkeypatch):
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(side_effect=ValueError("fail"))),
        )
        result = await service._compute_embedding("hello")
        assert result == [0.0] * 1536

    async def test_create_node(self, service, monkeypatch):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="Test", type="concept", description="desc",
            importance=0.8, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db = self._make_db(fetchone_val=row)
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        dto = MagicMock()
        dto.label = "Test"
        dto.type.value = "concept"
        dto.description = "desc"
        dto.importance = 0.8
        dto.properties = {}
        dto.tenant_id = None
        result = await service.create_node(dto, tenant_id="t1", db=db)
        assert result._mapping["label"] == "Test"

    async def test_get_node(self, service):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="N", type="concept", description="d",
            importance=0.5, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01", edge_count=3,
        )
        db = self._make_db(fetchone_val=row)
        result = await service.get_node(uuid.uuid4(), db=db)
        assert result._mapping["edge_count"] == 3

    async def test_get_node_none(self, service):
        db = self._make_db(fetchone_val=None)
        result = await service.get_node(uuid.uuid4(), db=db)
        assert result is None

    async def test_update_node(self, service, monkeypatch):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="Updated", type="concept", description="d",
            importance=0.9, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db = self._make_db(fetchone_val=row)
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        dto = MagicMock()
        dto.model_dump.return_value = {"label": "Updated", "importance": 0.9}
        dto.label = "Updated"
        dto.description = None
        result = await service.update_node(uuid.uuid4(), dto, db=db)
        assert result._mapping["label"] == "Updated"

    async def test_update_node_type_and_properties(self, service, monkeypatch):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="N", type="old_type", description="d",
            importance=0.5, properties='{"old": "val"}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db = self._make_db(fetchone_val=row)
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        dto = MagicMock()
        dto.model_dump.return_value = {"type": type("FakeType", (), {"value": "new_type"})(), "properties": {"new": "val"}}
        dto.type.value = "new_type"
        dto.label = "N"
        dto.description = None
        result = await service.update_node(uuid.uuid4(), dto, db=db)
        assert result._mapping["label"] == "N"

    async def test_update_node_description_triggers_reembed(self, service, monkeypatch):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="N", type="concept", description="old desc",
            importance=0.5, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db = self._make_db(fetchone_val=row)
        monkeypatch.setattr(
            "api.services.knowledge_graph_service.llm_service",
            AsyncMock(generate_embedding=AsyncMock(return_value=[0.5] * 1536)),
        )
        dto = MagicMock()
        dto.model_dump.return_value = {"description": "new desc"}
        dto.label = "N"
        dto.description = "new desc"
        result = await service.update_node(uuid.uuid4(), dto, db=db)
        assert result._mapping["label"] == "N"

    async def test_update_node_empty_data(self, service, monkeypatch):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="Same", type="concept", description="d",
            importance=0.5, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01", edge_count=0,
        )
        db = self._make_db(fetchone_val=row)
        dto = MagicMock()
        dto.model_dump.return_value = {}
        result = await service.update_node(uuid.uuid4(), dto, db=db)
        assert result._mapping["label"] == "Same"

    async def test_delete_node(self, service):
        row = self._make_simple_row(id=str(uuid.uuid4()))
        db = self._make_db(fetchone_val=row)
        result = await service.delete_node(uuid.uuid4(), db=db)
        assert result is not None

    async def test_list_nodes(self, service):
        row = self._make_simple_row(
            id=str(uuid.uuid4()), label="N", type="concept", description="d",
            importance=0.5, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db_execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=1)),
            MagicMock(fetchall=MagicMock(return_value=[row])),
        ])
        db = AsyncMock()
        db.execute = db_execute
        rows, total = await service.list_nodes(
            page=1, page_size=20, type_filter=None, search=None,
            min_importance=None, max_importance=None, sort_by=None,
            sort_order=None, tenant_id="t1", db=db,
        )
        assert total == 1
        assert len(rows) == 1

    async def test_list_nodes_with_filters(self, service):
        db_execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=0)),
            MagicMock(fetchall=MagicMock(return_value=[])),
        ])
        db = AsyncMock()
        db.execute = db_execute
        rows, total = await service.list_nodes(
            page=1, page_size=20, type_filter="person", search="test",
            min_importance=0.5, max_importance=1.0, sort_by="label",
            sort_order="ASC", tenant_id="t1", db=db,
        )
        assert total == 0

    async def test_traverse_bfs(self, service):
        edge_result = MagicMock()
        edge_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=edge_result)
        result = await service.traverse(uuid.uuid4(), depth=0, mode="bfs", db=db)
        assert isinstance(result, list)

    async def test_traverse_dfs(self, service):
        edge_result = MagicMock()
        edge_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=edge_result)
        result = await service.traverse(uuid.uuid4(), depth=0, mode="dfs", db=db)
        assert isinstance(result, list)

    async def test_find_shortest_path_same_node(self, service):
        nid = uuid.uuid4()
        row = self._make_simple_row(
            id=str(nid), label="self", type="concept", description="",
            importance=0.5, properties='{}', tenant_id="t1",
            created_at="2025-01-01", updated_at="2025-01-01",
        )
        db = self._make_db(fetchone_val=row)
        nodes, depth = await service.find_shortest_path(nid, nid, 5, db=db)
        assert depth == 0
        assert len(nodes) == 1

    async def test_find_shortest_path_no_path(self, service):
        from_id = uuid.uuid4()
        to_id = uuid.uuid4()
        edge_result = MagicMock()
        edge_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(return_value=edge_result)
        nodes, depth = await service.find_shortest_path(from_id, to_id, 1, db=db)
        assert nodes is None

    async def test_edge_rows_with_source_target_invalid_json(self, service):
        from types import SimpleNamespace
        row = SimpleNamespace(**{
            "src_id": "s1", "src_label": "Source", "src_type": "concept",
            "tgt_id": "t1", "tgt_label": "Target", "tgt_type": "concept",
            "properties": "{invalid json}",
            "id": "e1", "source_id": "s1", "target_id": "t1",
            "relationship": "knows", "weight": 0.5, "created_at": "2025-01-01",
        })
        row._mapping = row.__dict__
        count_result = MagicMock()
        count_result.scalar.return_value = 1
        rows_result = MagicMock()
        rows_result.fetchall.return_value = [row]
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[count_result, rows_result])
        enriched, total = await service.list_edges(uuid.uuid4(), 1, 20, db=db)
        assert total == 1
        assert len(enriched) == 1

    async def test_list_edges(self, service):
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        rows_result = MagicMock()
        rows_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[count_result, rows_result])
        rows, total = await service.list_edges(uuid.uuid4(), 1, 20, db=db)
        assert total == 0

    async def test_list_all_edges(self, service):
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        rows_result = MagicMock()
        rows_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[count_result, rows_result])
        rows, total = await service.list_all_edges(1, 20, relationship=None, db=db)
        assert total == 0

    async def test_list_all_edges_with_relationship(self, service):
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        rows_result = MagicMock()
        rows_result.fetchall.return_value = []
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[count_result, rows_result])
        rows, total = await service.list_all_edges(1, 20, relationship="knows", db=db)
        assert total == 0

    async def test_delete_edge(self, service):
        result = MagicMock()
        result.fetchone.return_value = self._make_simple_row(id=str(uuid.uuid4()))
        db = AsyncMock()
        db.execute = AsyncMock(return_value=result)
        r = await service.delete_edge(uuid.uuid4(), db=db)
        assert r is not None

    async def test_delete_edge_not_found(self, service):
        result = MagicMock()
        result.fetchone.return_value = None
        db = AsyncMock()
        db.execute = AsyncMock(return_value=result)
        r = await service.delete_edge(uuid.uuid4(), db=db)
        assert r is None

    async def test_create_edge_source_not_found(self, service):
        db = self._make_db(fetchone_val=None)
        dto = MagicMock()
        dto.target_id = str(uuid.uuid4())
        dto.relationship = "knows"
        result = await service.create_edge(uuid.uuid4(), dto, db=db)
        assert result is None
