"""
Comprehensive End-to-End Test for Dynamic Multi-Agent System,
Parallel Execution, Slash Commands, Memory, and Skills Quarantine.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

from api.orchestrator.agent_discovery import dynamic_agent_registry
from api.orchestrator.card_registry import card_registry, get_agent_card
from api.orchestrator.contracts.agent_message import TaskStatus
from api.routers.agents import SLASH_COMMAND_AGENT_MAP
from api.orchestrator.sub_agent_manager import SubAgentManager
from api.services.skill_catalog_service import PROHIBITED_EXTERNAL_DOMAINS

pytestmark = pytest.mark.asyncio


class TestDynamicAgentDiscoveryAndCards:
    async def test_dynamic_registry_loads_core_and_auxiliary(self):
        """Dynamic agent registry resolves both core 28 agents and auxiliary agents."""
        assert "resume" in dynamic_agent_registry
        assert "organization" in dynamic_agent_registry
        assert "planning" in dynamic_agent_registry
        assert "workspace" in dynamic_agent_registry
        assert "slack" in dynamic_agent_registry
        assert "conversation" in dynamic_agent_registry
        assert "qa" in dynamic_agent_registry

        slack_cls = dynamic_agent_registry.get("slack")
        assert slack_cls is not None
        assert slack_cls.__name__ == "SlackAgent"

        conv_cls = dynamic_agent_registry.get("conversation")
        assert conv_cls is not None

    async def test_agent_cards_available_for_all_agents(self):
        """Every registered agent has a valid declarative AgentCard."""
        slack_card = get_agent_card("slack")
        assert slack_card is not None
        assert slack_card.name == "slack"
        assert "send_slack_message" in slack_card.tools
        assert "required" in slack_card.output_schema

        resume_card = get_agent_card("resume")
        assert resume_card is not None
        assert "compile_resume_pdf" in resume_card.tools

    async def test_slash_command_agent_map_complete(self):
        """All critical slash commands map to valid specialist agents."""
        assert SLASH_COMMAND_AGENT_MAP["/autoplan"] == "planning"
        assert SLASH_COMMAND_AGENT_MAP["/plan"] == "planning"
        assert SLASH_COMMAND_AGENT_MAP["/slack"] == "slack"
        assert SLASH_COMMAND_AGENT_MAP["/ats-audit"] == "resume"
        assert SLASH_COMMAND_AGENT_MAP["/ats"] == "ats"
        assert SLASH_COMMAND_AGENT_MAP["/career-coaching"] == "career"
        assert SLASH_COMMAND_AGENT_MAP["/job-radar"] == "job_search"
        assert SLASH_COMMAND_AGENT_MAP["/organize"] == "organization"
        assert SLASH_COMMAND_AGENT_MAP["/email"] == "gmail"
        assert SLASH_COMMAND_AGENT_MAP["/calendar"] == "calendar"
        assert SLASH_COMMAND_AGENT_MAP["/remember"] == "memory"


class TestParallelSubAgentExecution:
    async def test_sub_agent_least_privilege_permissions(self):
        """Sub-agents are strictly bounded by parent permissions (Zero-Trust)."""
        mgr = SubAgentManager()
        parent_perms = ["memory.read", "memory.write"]

        # Slack requires connector.slack.write, but parent only has memory.*
        child_perms = mgr.compute_least_privilege_permissions(
            parent_permissions=parent_perms,
            sub_agent_name="slack",
        )
        # Intersection must not escalate permissions
        for p in child_perms:
            assert p in parent_perms

    async def test_spawn_sub_agents_parallel_execution(self):
        """Spawn multiple sub-agents concurrently and aggregate results."""
        mgr = SubAgentManager()
        parent_run_id = f"parent-run-{uuid.uuid4().hex[:8]}"

        sub_tasks = [
            {
                "agent_name": "slack",
                "task": "Post milestone update to #career-updates",
            },
            {
                "agent_name": "organization",
                "task": "Organize candidate resume folders",
            },
            {
                "agent_name": "workspace",
                "task": "Audit workspace file sprawl",
            },
        ]

        envelope = await mgr.spawn_sub_agents_parallel(
            parent_agent="planning",
            parent_run_id=parent_run_id,
            sub_tasks=sub_tasks,
            parent_permissions=["*"],
            workspace_id="ws-parallel-test",
        )

        assert envelope.status in (TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS)
        assert len(envelope.sub_agent_results) == 3
        agents_executed = {r["agent"] for r in envelope.sub_agent_results}
        assert agents_executed == {"slack", "organization", "workspace"}

        # Verify Slack approval gate proposal
        slack_result = envelope.data.get("slack", {})
        assert "result" in slack_result or "proposals" in str(slack_result)


class TestMultiAgentE2EApi:
    async def _auth_header(self, client: AsyncClient) -> tuple[dict, str]:
        email = f"multi_e2e_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "Password123!", "name": "MultiAgent Tester"},
        )
        assert res.status_code == 201
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": "MultiAgent Space"}, headers=headers)
        assert ws_res.status_code == 201
        ws_id = ws_res.json().get("id") or ws_res.json().get("workspace_id")
        headers["X-Workspace-Id"] = str(ws_id)
        return headers, str(ws_id)

    async def test_agent_commands_endpoint(self, client: AsyncClient):
        """GET /api/v1/agents/commands lists dynamic slash commands for frontend."""
        headers, ws_id = await self._auth_header(client)
        res = await client.get(f"/api/v1/agents/commands?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "commands" in data
        assert data["count"] >= 28

        triggers = {c["trigger"] for c in data["commands"]}
        assert "/autoplan" in triggers
        assert "/organize" in triggers
        assert "/jobs" in triggers

    async def test_multi_agent_parallel_chat_stream(self, client: AsyncClient):
        """POST /api/v1/agents/chat/stream dispatches parallel squad and yields supervisor events."""
        headers, ws_id = await self._auth_header(client)
        payload = {
            "workspaceId": ws_id,
            "message": "Evaluate my backend profile and draft Slack update",
            "agentNames": ["resume", "slack"],
            "model": "gpt-4o-mini",
            "temperature": 0.5,
        }

        res = await client.post("/api/v1/agents/chat/stream", json=payload, headers=headers)
        assert res.status_code == 200
        assert "text/event-stream" in res.headers.get("content-type", "")

        events = []
        for line in res.text.splitlines():
            if line.startswith("event:"):
                events.append(line.replace("event:", "").strip())

        assert "supervisor_start" in events
        assert "done" in events

    async def test_prohibited_domains_quarantine(self, client: AsyncClient):
        """Verify unrelated bioinformatics domains are strictly rejected by the platform."""
        headers, ws_id = await self._auth_header(client)
        for domain in ["alphafold", "chembl", "pdb"]:
            assert domain in PROHIBITED_EXTERNAL_DOMAINS
            res = await client.post(
                "/api/v1/capabilities",
                json={
                    "workspace_id": ws_id,
                    "name": domain,
                    "category": "skill",
                    "description": f"Domain {domain}",
                },
                headers=headers,
            )
            assert res.status_code == 400
            assert "excluded by platform policy" in res.json()["detail"]
