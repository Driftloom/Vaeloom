import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestEnterpriseMemory:
    async def _auth_header(self, client: AsyncClient, email: str = "enterprise_mem@test.com") -> tuple[dict, str]:
        res = await client.post("/api/v1/auth/signup", json={
            "email": email, "password": "Password123!",
        })
        token = res.json()["access_token"]
        # Also grab or create workspace
        ws_res = await client.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {token}"})
        workspaces = ws_res.json()
        ws_id = workspaces[0]["id"] if workspaces else None
        if not ws_id:
            create_ws = await client.post(
                "/api/v1/workspaces",
                json={"name": "Enterprise Test Workspace"},
                headers={"Authorization": f"Bearer {token}"},
            )
            ws_id = create_ws.json()["id"]
        return {"Authorization": f"Bearer {token}"}, ws_id

    async def test_enterprise_supersession_immutable_lineage(self, client: AsyncClient):
        headers, ws_id = await self._auth_header(client, "ent_supersede@test.com")

        # 1. Create original memory
        create_res = await client.post("/api/v1/memories", json={
            "type": "career",
            "title": "Software Engineer II at Driftloom",
            "content": "Worked on backend microservices and Redis caching layers.",
            "workspace_id": ws_id,
            "tags": ["career", "role"],
        }, headers=headers)
        assert create_res.status_code == 201
        orig_mem = create_res.json()
        orig_id = orig_mem["id"]
        assert orig_mem["status"] == "active"

        # 2. Supersede with human correction
        supersede_res = await client.post(f"/api/v1/memories/{orig_id}/supersede", json={
            "reason": "Promoted to Senior Platform Architect in Q3",
            "title": "Senior Platform Architect at Driftloom",
            "content": "Lead architect for distributed multi-tenant agent execution platform.",
            "tags": ["career", "role", "leadership"],
        }, headers=headers)
        assert supersede_res.status_code == 201
        new_mem = supersede_res.json()
        new_id = new_mem["id"]

        assert new_mem["status"] == "active"
        assert new_mem["title"] == "Senior Platform Architect at Driftloom"
        assert new_mem["supersedes_id"] == orig_id
        assert "leadership" in new_mem["tags"]

        # 3. Verify original memory is now marked 'superseded' (immutable historical fact)
        old_check = await client.get(f"/api/v1/memories/{orig_id}", headers=headers)
        assert old_check.status_code == 200
        assert old_check.json()["status"] == "superseded"

        # 4. Verify lineage endpoint walks the chain backwards and connects them
        lineage_res = await client.get(f"/api/v1/memories/{new_id}/lineage", headers=headers)
        assert lineage_res.status_code == 200
        lineage = lineage_res.json()
        assert len(lineage["chain_backwards"]) >= 2
        # Target memory is first in backwards chain, predecessor is second
        assert lineage["chain_backwards"][0]["id"] == new_id
        assert lineage["chain_backwards"][1]["id"] == orig_id

    async def test_enterprise_export_memories(self, client: AsyncClient):
        headers, ws_id = await self._auth_header(client, "ent_export@test.com")

        # Create multiple memories
        for i in range(3):
            await client.post("/api/v1/memories", json={
                "type": "skill" if i == 0 else "goal",
                "title": f"Enterprise Memory Item {i}",
                "content": f"Important skill or milestone record number {i}",
                "workspace_id": ws_id,
                "tags": ["export-test"],
            }, headers=headers)

        # Export active memories
        res = await client.get(f"/api/v1/memories/export?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["export_version"] == "1.0"
        assert data["total_count"] >= 3
        assert len(data["memories"]) >= 3
        # Check integrity of export metadata
        first = data["memories"][0]
        assert "id" in first
        assert "content_hash" in first
        assert "created_at" in first

    async def test_enterprise_import_memories_deduplication(self, client: AsyncClient):
        headers, ws_id = await self._auth_header(client, "ent_import@test.com")

        batch = {
            "workspace_id": ws_id,
            "deduplicate_by_hash": True,
            "memories": [
                {
                    "type": "decision",
                    "title": "Selected PostgreSQL + pgvector for Cognitive Store",
                    "summary": "Unified relational and vector embeddings with RLS multi-tenancy.",
                    "content": "Selected PostgreSQL + pgvector for Cognitive Store. High performance and ACID guarantees.",
                    "tags": ["architecture", "adr"],
                },
                {
                    "type": "project",
                    "title": "Autonomous Agent Dispatcher",
                    "summary": "Sub-50ms reactive orchestrator loop with HITL approval gates.",
                    "content": "Autonomous Agent Dispatcher. Sub-50ms reactive orchestrator loop with HITL approval gates.",
                    "tags": ["agent", "runtime"],
                },
            ],
        }

        # 1. Initial import: both should be imported
        res1 = await client.post("/api/v1/memories/import", json=batch, headers=headers)
        assert res1.status_code == 200
        out1 = res1.json()
        assert out1["imported_count"] == 2
        assert out1["skipped_count"] == 0

        # 2. Second import with identical content and deduplicate_by_hash: both should be skipped
        res2 = await client.post("/api/v1/memories/import", json=batch, headers=headers)
        assert res2.status_code == 200
        out2 = res2.json()
        assert out2["imported_count"] == 0
        assert out2["skipped_count"] == 2

    async def test_enterprise_bulk_status_and_tags(self, client: AsyncClient):
        headers, ws_id = await self._auth_header(client, "ent_bulk@test.com")

        # Create 2 memories
        r1 = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Bulk Candidate Alpha", "content": "Alpha content",
            "workspace_id": ws_id,
        }, headers=headers)
        r2 = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Bulk Candidate Beta", "content": "Beta content",
            "workspace_id": ws_id,
        }, headers=headers)
        id1 = r1.json()["id"]
        id2 = r2.json()["id"]

        # Bulk tag
        tag_res = await client.post("/api/v1/memories/bulk-tag", json={
            "workspace_id": ws_id,
            "memory_ids": [id1, id2],
            "add_tags": ["batch-processed", "verified"],
        }, headers=headers)
        assert tag_res.status_code == 200
        assert tag_res.json()["success_count"] == 2

        # Check tag application
        check1 = await client.get(f"/api/v1/memories/{id1}", headers=headers)
        assert "verified" in check1.json()["tags"]

        # Bulk status to archived
        status_res = await client.post("/api/v1/memories/bulk-status", json={
            "workspace_id": ws_id,
            "memory_ids": [id1, id2],
            "status": "archived",
        }, headers=headers)
        assert status_res.status_code == 200
        assert status_res.json()["success_count"] == 2

        # Verify status is archived
        check2 = await client.get(f"/api/v1/memories/{id2}", headers=headers)
        assert check2.json()["status"] == "archived"

    async def test_enterprise_hybrid_rrf_search(self, client: AsyncClient):
        headers, ws_id = await self._auth_header(client, "ent_search@test.com")

        await client.post("/api/v1/memories", json={
            "type": "skill",
            "title": "Kubernetes Cluster Administration & ArgoCD",
            "content": "Production Helm charts, multi-cluster federation, and GitOps pipelines.",
            "workspace_id": ws_id,
            "tags": ["devops", "k8s"],
        }, headers=headers)

        await client.post("/api/v1/memories", json={
            "type": "career",
            "title": "Machine Learning Engineer Portfolio",
            "content": "Deep learning vector spaces, PyTorch fine-tuning, and transformer attention.",
            "workspace_id": ws_id,
            "tags": ["ai", "ml"],
        }, headers=headers)

        # 1. Search with hybrid strategy (RRF fusion)
        hybrid_res = await client.post("/api/v1/memories/search", json={
            "workspace_id": ws_id,
            "query": "Kubernetes GitOps",
            "strategy": "hybrid",
            "top_k": 5,
        }, headers=headers)
        assert hybrid_res.status_code == 200
        hybrid_items = hybrid_res.json()
        assert len(hybrid_items) >= 1
        assert "Kubernetes" in hybrid_items[0]["memory"]["title"]

        # 2. Search with keyword strategy
        keyword_res = await client.post("/api/v1/memories/search", json={
            "workspace_id": ws_id,
            "query": "transformer attention",
            "strategy": "keyword",
            "top_k": 5,
        }, headers=headers)
        assert keyword_res.status_code == 200
        keyword_items = keyword_res.json()
        assert len(keyword_items) >= 1
        assert "Machine Learning" in keyword_items[0]["memory"]["title"]

    async def test_enterprise_cross_workspace_isolation(self, client: AsyncClient):
        headers_a, ws_a = await self._auth_header(client, "user_a@test.com")
        headers_b, ws_b = await self._auth_header(client, "user_b@test.com")

        # User A creates memory in Workspace A
        res_a = await client.post("/api/v1/memories", json={
            "type": "note",
            "title": "Confidential Strategic Plans A",
            "content": "Internal proprietary roadmap details for Tenant A.",
            "workspace_id": ws_a,
        }, headers=headers_a)
        mem_a_id = res_a.json()["id"]

        # User B attempts to export Workspace A -> 403 Forbidden
        export_cross = await client.get(f"/api/v1/memories/export?workspace_id={ws_a}", headers=headers_b)
        assert export_cross.status_code == 403

        # User B attempts to supersede User A's memory -> 403 Forbidden
        supersede_cross = await client.post(f"/api/v1/memories/{mem_a_id}/supersede", json={
            "reason": "Unauthorized malicious revision",
            "title": "Tampered Title",
        }, headers=headers_b)
        assert supersede_cross.status_code == 403

        # User B attempts bulk operation on User A's memory -> does not update User A's memory
        bulk_cross = await client.post("/api/v1/memories/bulk-status", json={
            "workspace_id": ws_b,
            "memory_ids": [mem_a_id],
            "status": "deleted",
        }, headers=headers_b)
        assert bulk_cross.status_code == 200
        assert bulk_cross.json()["success_count"] == 0  # 0 updated because memory is in ws_a, not ws_b

        # Verify User A's memory remains intact and active
        check_a = await client.get(f"/api/v1/memories/{mem_a_id}", headers=headers_a)
        assert check_a.status_code == 200
        assert check_a.json()["status"] == "active"
        assert check_a.json()["title"] == "Confidential Strategic Plans A"
