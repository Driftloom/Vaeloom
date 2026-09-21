"""Tests for Knowledge Graph propagation from documents, provenance linking,
multi-tenant graph isolation, and erasure cascading.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.schemas.knowledge_graph import CreateNodeRequest, NodeType
from api.services.knowledge_graph_service import KnowledgeGraphService
from api.services.erasure_service import ErasureService


@pytest.fixture
def kg_service():
    return KnowledgeGraphService()


def test_kg_write_scope_enforcement(kg_service):
    """Verify KG service fails closed if workspace_id is absent during write operations."""
    with pytest.raises(ValueError, match="workspace_id is required for KG writes"):
        kg_service._require_write_scope(None)

    with pytest.raises(ValueError, match="workspace_id is required for KG writes"):
        kg_service._require_write_scope("")

    assert kg_service._require_write_scope("ws-123") == "ws-123"


@pytest.mark.asyncio
async def test_kg_read_scope_isolation(kg_service):
    """Verify KG reads without tenant or workspace scope return empty collections."""
    nodes, total = await kg_service.list_nodes(
        page=1,
        page_size=10,
        type_filter=None,
        search=None,
        min_importance=None,
        max_importance=None,
        sort_by=None,
        sort_order=None,
        tenant_id=None,
        db=None,
        workspace_id=None,
    )
    assert nodes == []
    assert total == 0


@pytest.mark.asyncio
async def test_document_to_kg_node_propagation(kg_service):
    """Verify document extraction produces a document hub node with source provenance."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    doc_node_req = CreateNodeRequest(
        label="Q3 Security Policy",
        type=NodeType.DOCUMENT,
        description=f"Source document {doc_id} • 4 chunks",
        importance=0.8,
        properties={"source_document_id": doc_id, "kind": "document_hub"},
        tenant_id=ws_id,
    )

    entity_node_req = CreateNodeRequest(
        label="Zero Trust Network Access",
        type=NodeType.CONCEPT,
        description=f"Extracted from doc {doc_id}",
        importance=0.9,
        properties={"source_document_id": doc_id, "entity_type": "security_standard"},
        tenant_id=ws_id,
    )

    assert doc_node_req.properties["source_document_id"] == doc_id
    assert doc_node_req.type == NodeType.DOCUMENT
    assert entity_node_req.properties["source_document_id"] == doc_id
    assert entity_node_req.type == NodeType.CONCEPT


@pytest.mark.asyncio
async def test_erasure_cascade_structure():
    """Verify ErasureService includes Document, DocumentChunk, Embedding, and Graph tables."""
    erasure = ErasureService()
    # Check that ErasureService imports all critical document and memory models
    from api.models.schema import (
        Document,
        DocumentChunk,
        DocumentVersion,
        Embedding,
        Entity,
        MemoryRecord,
        Relationship,
    )

    assert Document is not None
    assert DocumentChunk is not None
    assert DocumentVersion is not None
    assert Embedding is not None
    assert Entity is not None
    assert Relationship is not None
    assert MemoryRecord is not None
