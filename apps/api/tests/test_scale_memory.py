"""
End-to-End Tests for PIOS SCALE Multiscale Temporal Memory Hierarchy & Overnight Cognition Daemon.
Verifies:
- 5-Tier SCALE Memory Nodes (SUB_DAILY, DAILY, WEEKLY, MONTHLY, ANNUAL, NORTH_STAR)
- Hierarchical Temporal Rollups (Daily -> Weekly -> Monthly)
- Reality Gap Engine (Commitments vs Chronological Actions)
- Overnight Background Cognition Cycle & Morning Briefing
- Zero-Trust Cross-Workspace Security & Scoping
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.schema import AgentAction, Memory, ScaleMemoryNode, User, Workspace
from api.services.overnight_cognition_service import overnight_cognition_service
from api.services.reality_gap_service import reality_gap_service
from api.services.scale_memory_service import (
    ScaleMemoryCreate,
    ScaleTier,
    scale_memory_service,
)

pytestmark = pytest.mark.asyncio


class TestScaleMemoryService:
    async def test_create_and_query_scale_nodes(self, client: AsyncClient):
        """Verify creation and filtering across SCALE memory tiers."""
        # Setup test user and workspace
        email = f"scale_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        assert res.status_code == 201
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create workspace
        ws_res = await client.post("/api/v1/workspaces", json={"name": "SCALE WS"}, headers=headers)
        assert ws_res.status_code == 201
        workspace_id = ws_res.json()["id"]

        now = datetime.now(UTC)
        # 1. Create a DAILY node
        daily_payload = {
            "tier": "DAILY",
            "period_start": (now - timedelta(days=1)).isoformat(),
            "period_end": now.isoformat(),
            "summary": "Built the PIOS scale temporal hierarchy core engine.",
            "key_insights": ["Temporal rollups preserve long-term context while bounding tokens."],
            "friction_points": ["SQLite pgvector mock required careful type decorators."],
            "unresolved_questions": ["How will local PGLite sync interact with weekly rollups?"],
            "action_commitments": ["Implement overnight cognition daemon", "Add reality gap engine"],
            "metadata": {"test": True},
        }
        res_create = await client.post(
            f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}",
            json=daily_payload,
            headers=headers,
        )
        assert res_create.status_code == 200, res_create.text
        node_data = res_create.json()
        assert node_data["tier"] == "DAILY"
        assert len(node_data["action_commitments"]) == 2
        daily_id = node_data["id"]

        # 2. Create a NORTH_STAR node
        ns_payload = {
            "tier": "NORTH_STAR",
            "period_start": now.isoformat(),
            "period_end": (now + timedelta(days=365)).isoformat(),
            "summary": "Core Purpose: Maximize human sovereignty and cognitive agency through AI.",
            "key_insights": ["Sovereign agents must align with verified personal values."],
            "friction_points": [],
            "unresolved_questions": [],
            "action_commitments": ["Never delegate destructive irreversible actions without human consent."],
            "metadata": {"immutable": True},
        }
        res_ns = await client.post(
            f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}",
            json=ns_payload,
            headers=headers,
        )
        assert res_ns.status_code == 200

        # 3. List nodes with tier filter
        res_list_daily = await client.get(
            f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}&tier=DAILY",
            headers=headers,
        )
        assert res_list_daily.status_code == 200
        assert res_list_daily.json()["total"] == 1
        assert res_list_daily.json()["nodes"][0]["id"] == daily_id

        res_list_ns = await client.get(
            f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}&tier=NORTH_STAR",
            headers=headers,
        )
        assert res_list_ns.status_code == 200
        assert res_list_ns.json()["total"] == 1
        assert res_list_ns.json()["nodes"][0]["tier"] == "NORTH_STAR"

        # 4. Fetch node by ID
        res_get = await client.get(
            f"/api/v1/cognition/scale/nodes/{daily_id}?workspace_id={workspace_id}",
            headers=headers,
        )
        assert res_get.status_code == 200
        assert res_get.json()["id"] == daily_id

        # 5. Delete node
        res_del = await client.delete(
            f"/api/v1/cognition/scale/nodes/{daily_id}?workspace_id={workspace_id}",
            headers=headers,
        )
        assert res_del.status_code == 200
        assert res_del.json() == {"deleted": True}

    async def test_hierarchical_weekly_rollup(self, client: AsyncClient):
        """Verify daily logs roll up into a synthesized weekly node."""
        email = f"rollup_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": "Rollup WS"}, headers=headers)
        workspace_id = ws_res.json()["id"]

        now = datetime.now(UTC)
        # Create 3 daily logs
        for i in range(3):
            day_start = now - timedelta(days=i + 1)
            day_end = day_start + timedelta(hours=23)
            payload = {
                "tier": "DAILY",
                "period_start": day_start.isoformat(),
                "period_end": day_end.isoformat(),
                "summary": f"Day {i + 1} progress on PIOS subsystem architecture.",
                "key_insights": [f"Day {i + 1} breakthrough in distributed consensus."],
                "friction_points": [f"Day {i + 1} bottleneck in network latency."],
                "action_commitments": [f"Day {i + 1} task completed."],
            }
            res_c = await client.post(
                f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}",
                json=payload,
                headers=headers,
            )
            assert res_c.status_code == 200

        # Trigger Weekly Rollup
        rollup_payload = {
            "workspace_id": workspace_id,
            "target_tier": "WEEKLY",
            "period_start": (now - timedelta(days=7)).isoformat(),
            "period_end": now.isoformat(),
        }
        res_rollup = await client.post(
            "/api/v1/cognition/scale/rollup",
            json=rollup_payload,
            headers=headers,
        )
        assert res_rollup.status_code == 200, res_rollup.text
        rollup_node = res_rollup.json()
        assert rollup_node["tier"] == "WEEKLY"
        assert len(rollup_node["key_insights"]) >= 1
        assert "source_daily_count" in rollup_node["metadata"]


class TestRealityGapEngine:
    async def test_reality_gap_analysis(self, client: AsyncClient):
        """Verify intention vs actual action gap detection."""
        email = f"gap_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": "Reality Gap WS"}, headers=headers)
        workspace_id = ws_res.json()["id"]

        now = datetime.now(UTC)
        yesterday = now - timedelta(days=1)

        # 1. Create a DAILY node with stated commitments
        await client.post(
            f"/api/v1/cognition/scale/nodes?workspace_id={workspace_id}",
            json={
                "tier": "DAILY",
                "period_start": yesterday.isoformat(),
                "period_end": now.isoformat(),
                "summary": "Planning day",
                "action_commitments": [
                    "Complete zero-trust security audit",
                    "Fix database indexing latency",
                ],
            },
            headers=headers,
        )

        # 2. Query Reality Gap
        res_gap = await client.get(
            f"/api/v1/cognition/reality-gap?workspace_id={workspace_id}",
            headers=headers,
        )
        assert res_gap.status_code == 200
        gap = res_gap.json()
        assert gap["total_commitments"] == 2
        assert "alignment_score" in gap
        assert "discrepancy_score" in gap
        assert "friction_recommendation" in gap
        assert len(gap["commitments"]) == 2


class TestOvernightCognitionAndBriefing:
    async def test_overnight_cognition_cycle_and_briefing(self, client: AsyncClient):
        """Verify 02:00 AM cycle compiles daily memory into morning briefing."""
        email = f"night_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": "Night Cognition WS"}, headers=headers)
        workspace_id = ws_res.json()["id"]

        # Run overnight cycle on-demand
        cycle_res = await client.post(
            "/api/v1/cognition/overnight/run",
            json={"workspace_id": workspace_id},
            headers=headers,
        )
        assert cycle_res.status_code == 200, cycle_res.text
        briefing = cycle_res.json()
        assert len(briefing["top_priorities"]) >= 1
        assert "reality_gap" in briefing
        assert "micro_learning" in briefing
        assert briefing["micro_learning"]["estimated_read_seconds"] == 30

        # Retrieve today's briefing via GET
        get_res = await client.get(
            f"/api/v1/cognition/briefing/today?workspace_id={workspace_id}",
            headers=headers,
        )
        assert get_res.status_code == 200
        assert get_res.json()["briefing_date"] == briefing["briefing_date"]


class TestCognitionZeroTrustSecurity:
    async def test_cross_workspace_access_denied(self, client: AsyncClient):
        """Zero-Trust: User B must not access User A's cognition nodes or briefings."""
        # User A
        email_a = f"user_a_{uuid.uuid4().hex[:8]}@test.com"
        res_a = await client.post("/api/v1/auth/signup", json={"email": email_a, "password": "TestPassword123!"})
        token_a = res_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        ws_res_a = await client.post("/api/v1/workspaces", json={"name": "A's Private Workspace"}, headers=headers_a)
        ws_id_a = ws_res_a.json()["id"]

        # User B
        email_b = f"user_b_{uuid.uuid4().hex[:8]}@test.com"
        res_b = await client.post("/api/v1/auth/signup", json={"email": email_b, "password": "TestPassword123!"})
        token_b = res_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User B attempts to list User A's scale nodes: MUST return 403 Forbidden
        res_b_list = await client.get(
            f"/api/v1/cognition/scale/nodes?workspace_id={ws_id_a}",
            headers=headers_b,
        )
        assert res_b_list.status_code == 403

        # User B attempts to access User A's morning briefing: MUST return 403 Forbidden
        res_b_brief = await client.get(
            f"/api/v1/cognition/briefing/today?workspace_id={ws_id_a}",
            headers=headers_b,
        )
        assert res_b_brief.status_code == 403

        # User B attempts to trigger overnight cycle in User A's workspace: MUST return 403 Forbidden
        res_b_run = await client.post(
            "/api/v1/cognition/overnight/run",
            json={"workspace_id": ws_id_a},
            headers=headers_b,
        )
        assert res_b_run.status_code == 403
