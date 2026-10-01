import hashlib
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestVaultSyncDocumentsIntegration:
    async def _auth_header(self, client: AsyncClient) -> dict:
        unique_email = f"vault-doc-{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": unique_email, "password": "TestPassword123!",
        })
        assert res.status_code == 201
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Second Brain WS"}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    async def test_vault_notes_ingest_documents_memory_kg_and_search(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        note_content_1 = """---
title: Cognitive Brain Engine
tags:
  - cognitive
  - second-brain
concepts:
  - Vector Engine
---
# Cognitive Brain Engine

This is our sovereign cognitive second brain architecture.
It features #neural-pipeline and connects directly to [[Obsidian Vault]].
"""
        note_content_2 = """# Daily Standup Log 2026-10-01

Syncing Obsidian notes with Second Brain Knowledge Graph.
Contains tag #daily and links to [[Cognitive Brain Engine]].
"""

        # 1. Ingest notes via Vault Sync
        ingest_res = await client.post("/api/v1/vault-sync/ingest", json={
            "workspace_id": ws_id,
            "notes": [
                {
                    "filename": "Cognitive-Brain.md",
                    "content": note_content_1,
                    "relative_path": "Architecture/Cognitive-Brain.md",
                    "tags": ["core"],
                },
                {
                    "filename": "Daily-Log.md",
                    "content": note_content_2,
                    "relative_path": "Logs/Daily-Log.md",
                    "tags": ["standup"],
                },
            ],
        }, headers=headers)

        assert ingest_res.status_code == 200
        data = ingest_res.json()
        assert data["success"] is True
        assert data["ingested_documents"] == 2
        assert data["created_or_updated_memories"] == 2
        assert data["created_kg_nodes"] >= 2
        assert data.get("created_relationships", 0) >= 2

        # 2. Verify Document records under 'Vault Notes' folder with category='vault_note' and mime_type='text/markdown'
        docs_res = await client.get(f"/api/v1/documents?workspace_id={ws_id}", headers=headers)
        assert docs_res.status_code == 200
        docs_list = docs_res.json().get("documents", [])
        assert len(docs_list) == 2

        doc1 = next((d for d in docs_list if "Cognitive-Brain.md" in d["path"]), None)
        assert doc1 is not None
        assert doc1["type"] == "markdown"
        assert doc1["detected_mime_type"] == "text/markdown"
        assert doc1["metadata"]["category"] == "vault_note"
        assert "cognitive" in doc1["metadata"]["tags"]
        assert "second-brain" in doc1["metadata"]["tags"]
        assert "neural-pipeline" in doc1["metadata"]["tags"]
        assert "core" in doc1["metadata"]["tags"]

        doc2 = next((d for d in docs_list if "Daily-Log.md" in d["path"]), None)
        assert doc2 is not None
        assert doc2["type"] == "markdown"
        assert doc2["detected_mime_type"] == "text/markdown"
        assert doc2["metadata"]["category"] == "vault_note"

        # 3. Verify Memory records with source_type='vault_note', sha256 content_hash, and document_id link
        mems_res = await client.get(f"/api/v1/memories?workspace_id={ws_id}", headers=headers)
        assert mems_res.status_code == 200
        mems_data = mems_res.json()
        mems = mems_data.get("memories", mems_data) if isinstance(mems_data, dict) else mems_data
        assert len(mems) >= 2

        mem1 = next((m for m in mems if m.get("source_uri") == "Architecture/Cognitive-Brain.md"), None)
        assert mem1 is not None
        assert mem1["source_type"] == "vault_note"
        expected_hash = hashlib.sha256(note_content_1.encode("utf-8")).hexdigest()
        assert mem1["content_hash"] == expected_hash
        assert mem1["metadata"]["document_id"] == doc1["id"]
        assert mem1["title"] == "Cognitive Brain Engine"

        # 4. Verify Knowledge Graph nodes & bidirectional edges via kg_service endpoints
        nodes_res = await client.get(f"/api/v1/knowledge-graph/nodes?workspace_id={ws_id}", headers=headers)
        assert nodes_res.status_code == 200
        kg_nodes_data = nodes_res.json()
        kg_nodes = kg_nodes_data.get("items", kg_nodes_data) if isinstance(kg_nodes_data, dict) else kg_nodes_data
        node_labels = [n["label"] for n in kg_nodes]

        assert "Cognitive Brain Engine" in node_labels
        assert "#cognitive" in node_labels or "#second-brain" in node_labels
        assert "Vector Engine" in node_labels or "Obsidian Vault" in node_labels

        # Find the Cognitive Brain Engine node
        brain_node = next(n for n in kg_nodes if n["label"] == "Cognitive Brain Engine")
        edges_res = await client.get(
            f"/api/v1/knowledge-graph/nodes/{brain_node['id']}/edges?workspace_id={ws_id}",
            headers=headers,
        )
        assert edges_res.status_code == 200
        edges_data = edges_res.json()
        edges = edges_data.get("items", edges_data) if isinstance(edges_data, dict) else edges_data
        assert len(edges) >= 1
        edge_rels = [e["relationship"] for e in edges]
        # Should have tagged_with, references, etc.
        assert any(r in ("tagged_with", "references", "tag_of", "referenced_by") for r in edge_rels)

        # 5. Verify Document Search includes vault notes
        doc_search_res = await client.get(
            f"/api/v1/documents/search?workspace_id={ws_id}&q=Cognitive",
            headers=headers,
        )
        assert doc_search_res.status_code == 200
        search_docs = doc_search_res.json()
        assert len(search_docs) >= 1
        assert any("Cognitive-Brain.md" in d["path"] for d in search_docs)

        # Search by tag in metadata
        tag_search_res = await client.get(
            f"/api/v1/documents/search?workspace_id={ws_id}&q=neural-pipeline",
            headers=headers,
        )
        assert tag_search_res.status_code == 200
        tag_docs = tag_search_res.json()
        assert len(tag_docs) >= 1

        # 6. Verify Memory Search includes vault notes
        mem_search_res = await client.post(
            "/api/v1/memories/search",
            json={"query": "sovereign cognitive architecture", "workspace_id": ws_id},
            headers={**headers, "X-Workspace-ID": ws_id},
        )
        assert mem_search_res.status_code == 200
        found_mems = mem_search_res.json()
        assert len(found_mems) >= 1
        top_mem = found_mems[0]["memory"]
        assert "Cognitive" in top_mem["title"]

        # 7. Verify Global Search includes vault notes and memories
        global_search_res = await client.post(
            "/api/v1/search",
            json={"query": "Brain Engine", "filters": {"workspace_id": ws_id}},
            headers={**headers, "X-Workspace-ID": ws_id},
        )
        assert global_search_res.status_code == 200
        g_results = global_search_res.json().get("results", [])
        assert len(g_results) >= 1
        sources = {r["source"] for r in g_results}
        assert "document" in sources or "memory" in sources or "entity" in sources
