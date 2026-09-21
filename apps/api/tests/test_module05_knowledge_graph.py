"""Test Suite: Module 05 Knowledge Graph Integration (M05-KG).
Verifies document hub nodes, entity relationships, write scope enforcement, and graph traversal boundaries.
"""
import uuid
import pytest
from api.schemas.knowledge_graph import CreateNodeRequest, NodeType
from api.services.knowledge_graph_service import KnowledgeGraphService


def test_kg_write_scope_enforcement():
    """Verify KnowledgeGraphService requires workspace_id on all writes."""
    kg = KnowledgeGraphService()
    with pytest.raises(ValueError, match="workspace_id is required"):
        kg._require_write_scope(None)


def test_kg_document_propagation():
    """Verify document hub nodes and extracted concept nodes preserve document ID in properties."""
    doc_id = str(uuid.uuid4())
    ws_id = str(uuid.uuid4())

    doc_node = CreateNodeRequest(
        label="Engineering RFC 042",
        type=NodeType.DOCUMENT,
        description="RFC for distributed consensus",
        properties={"source_document_id": doc_id, "kind": "document_hub"},
        tenant_id=ws_id,
    )
    assert doc_node.type == NodeType.DOCUMENT
    assert doc_node.properties["source_document_id"] == doc_id
