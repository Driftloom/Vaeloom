"""
End-to-End Tests for PIOS Phase 4:
- Multi-Agent Council Weighted Quorum & W3C Credential Certification
- Proactive Anticipation Daemon (Calendar Dossiers, Application Follow-ups, Anti-Nagging Caps)
- Peer-to-Peer Agent Federation Handshake & Bounded Capability Delegation
- Zero-Trust Cross-Workspace Security Isolation
"""
from __future__ import annotations

import copy
import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestPhase4:
    async def _setup_user_and_workspace(self, client: AsyncClient, prefix: str = "p4") -> tuple[dict, str, str]:
        email = f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        assert res.status_code == 201, res.text
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": f"{prefix.upper()} Workspace"}, headers=headers)
        assert ws_res.status_code == 201, ws_res.text
        workspace_id = ws_res.json()["id"]

        return headers, workspace_id, token

    async def test_council_quorum_and_certification(self, client: AsyncClient):
        """Verify weighted multi-persona quorum and automatic W3C AgentAuditCredential generation."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "council")

        # 1. Clean artifact passes with SHIP and certifies
        clean_req = {
            "workspace_id": workspace_id,
            "agent_name": "TestArchitectAgent",
            "execution_id": "exec-clean-01",
            "artifact": "This architectural design document defines clear boundary conditions, robust schema validations, and exhaustive unit test strategies.",
            "artifact_type": "text",
            "tools_invoked": ["view_file", "write_to_file"],
            "mode": "collaborative",
        }
        res_clean = await client.post("/api/v1/council/evaluate-and-certify", json=clean_req, headers=headers)
        assert res_clean.status_code == 200, res_clean.text
        data_clean = res_clean.json()

        assert data_clean["certified"] is True
        verdict = data_clean["verdict"]
        assert verdict["verdict"] == "SHIP"
        assert verdict["quorum_achieved"] is True
        assert verdict["quorum_score"] >= 75.0
        assert "skeptic" in verdict["persona_scores"]
        assert "evidence_calibration" in verdict["persona_scores"]

        credential = data_clean["credential"]
        assert credential is not None
        assert "AgentAuditCredential" in credential["type"]
        assert credential["credentialSubject"]["agentName"] == "TestArchitectAgent"
        assert credential["proof"]["type"] == "Ed25519Signature2020"

        # 2. Flawed adversarial artifact fails quorum and refuses certification
        flawed_req = {
            "workspace_id": workspace_id,
            "agent_name": "TestAdversarialAgent",
            "execution_id": "exec-flawed-02",
            "artifact": "Fatal unhandled exception and memory leak in the core loop caused undefined behavior and system crash.",
            "artifact_type": "text",
            "tools_invoked": ["raw_exec"],
            "mode": "adversarial",
        }
        res_flawed = await client.post("/api/v1/council/evaluate-and-certify", json=flawed_req, headers=headers)
        assert res_flawed.status_code == 200
        data_flawed = res_flawed.json()

        assert data_flawed["certified"] is False
        assert data_flawed["credential"] is None
        assert data_flawed["verdict"]["verdict"] in ["HOLD", "REVISE"]

    async def test_proactive_anticipation_daemon_lifecycle(self, client: AsyncClient):
        """Verify calendar trajectory evaluation, proposal generation, and anti-nagging controls."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "ant")

        # 1. Seed upcoming schedule event (happening in 4 hours)
        now = datetime.now(UTC)
        event_time = now + timedelta(hours=4)
        event_payload = {
            "title": "Technical Deep-Dive with Stripe",
            "source": "calendar",
            "type": "interview",
            "date": event_time.isoformat(),
            "workspace_id": workspace_id,
        }
        res_ev = await client.post("/api/v1/scheduler/events", json=event_payload, headers=headers)
        assert res_ev.status_code == 200, res_ev.text

        # 2. Trigger scan
        scan_res = await client.post("/api/v1/anticipation/scan", json={"workspace_id": workspace_id}, headers=headers)
        assert scan_res.status_code == 200, scan_res.text
        scan_data = scan_res.json()
        assert scan_data["total"] >= 1

        # Find the event proposal
        event_prop = next((p for p in scan_data["proposals"] if p["trigger_type"] == "UPCOMING_EVENT"), None)
        assert event_prop is not None
        assert "Stripe" in event_prop["title"]
        assert event_prop["proposed_action"] == "PREPARE_BRIEF"
        assert event_prop["urgency"] == "HIGH"
        assert event_prop["status"] == "PENDING"
        prop_id = event_prop["id"]

        # 3. Accept proposal
        acc_res = await client.post(
            f"/api/v1/anticipation/proposals/{prop_id}/accept",
            json={"workspace_id": workspace_id},
            headers=headers,
        )
        assert acc_res.status_code == 200
        assert acc_res.json()["status"] == "ACCEPTED"

        # 4. Trigger second scan (deduplication check: must not duplicate accepted event)
        scan_res2 = await client.post("/api/v1/anticipation/scan", json={"workspace_id": workspace_id}, headers=headers)
        assert scan_res2.status_code == 200
        scan_data2 = scan_res2.json()
        event_pending = [p for p in scan_data2["proposals"] if p["trigger_type"] == "UPCOMING_EVENT" and p["status"] == "PENDING"]
        assert len(event_pending) == 0

        # 5. Test dismiss proposal on any other generated proposal
        if len(scan_data2["proposals"]) > 1:
            other_prop = scan_data2["proposals"][1]
            dis_res = await client.post(
                f"/api/v1/anticipation/proposals/{other_prop['id']}/dismiss",
                json={"workspace_id": workspace_id, "reason": "Not relevant right now"},
                headers=headers,
            )
            assert dis_res.status_code == 200
            assert dis_res.json()["status"] == "DISMISSED"

    async def test_agent_federation_p2p_handshake(self, client: AsyncClient):
        """Verify cross-workspace agent delegation guarded by W3C capability credentials."""
        headers_a, workspace_a, _ = await self._setup_user_and_workspace(client, "feda")
        headers_b, workspace_b, _ = await self._setup_user_and_workspace(client, "fedb")

        # 1. User A gets sovereign identity and issues a capability credential for resume build
        id_res = await client.get("/api/v1/sovereignty/identity", headers=headers_a)
        assert id_res.status_code == 200
        caller_did = id_res.json()["did"]

        cap_res = await client.post(
            "/api/v1/sovereignty/credentials/issue/capability",
            json={
                "workspace_id": workspace_a,
                "capability_tag": "capability:career.resume_build@v2",
                "validation_tier": "V2",
                "evidence": ["Unit test certified"],
            },
            headers=headers_a,
        )
        assert cap_res.status_code == 200
        valid_capability_credential = cap_res.json()

        # 2. Dispatch federated task to target workspace presenting valid credential
        dispatch_req = {
            "caller_did": caller_did,
            "caller_workspace_id": workspace_a,
            "target_workspace_id": workspace_b,
            "target_agent": "ResumeBuilderAgent",
            "required_capability": "capability:career.resume_build",
            "capability_credential": valid_capability_credential,
            "task_name": "tailor_resume_section",
            "task_parameters": {"section": "skills", "target_role": "Platform Engineer"},
        }
        res_dispatch = await client.post("/api/v1/federation/dispatch", json=dispatch_req, headers=headers_a)
        assert res_dispatch.status_code == 200, res_dispatch.text
        disp_data = res_dispatch.json()

        assert disp_data["success"] is True
        assert disp_data["target_agent"] == "ResumeBuilderAgent"
        assert disp_data["result"]["status"] == "COMPLETED"
        assert disp_data["audit_credential"] is not None
        assert "AgentAuditCredential" in disp_data["audit_credential"]["type"]

        # 3. Tampered credential fails handshake closed
        tampered_cred = copy.deepcopy(valid_capability_credential)
        tampered_cred["credentialSubject"]["capabilityTag"] = "capability:career.resume_build@v4"  # fraudulent upgrade
        tampered_dispatch = copy.deepcopy(dispatch_req)
        tampered_dispatch["capability_credential"] = tampered_cred

        res_tampered = await client.post("/api/v1/federation/dispatch", json=tampered_dispatch, headers=headers_a)
        assert res_tampered.status_code == 200
        tampered_data = res_tampered.json()
        assert tampered_data["success"] is False
        assert "Federation handshake rejected" in tampered_data["result"]["error"]
        assert tampered_data["audit_credential"] is None

    async def test_zero_trust_workspace_isolation_phase4(self, client: AsyncClient):
        """Verify cross-workspace unauthorized calls fail closed with 403."""
        headers_a, workspace_a, _ = await self._setup_user_and_workspace(client, "alice4")
        headers_b, workspace_b, _ = await self._setup_user_and_workspace(client, "bob4")

        # User B attempts to access User A's anticipation proposals
        res1 = await client.get(
            f"/api/v1/anticipation/proposals?workspace_id={workspace_a}",
            headers=headers_b,
        )
        assert res1.status_code == 403

        # User B attempts to trigger scan on User A's workspace
        res2 = await client.post(
            "/api/v1/anticipation/scan",
            json={"workspace_id": workspace_a},
            headers=headers_b,
        )
        assert res2.status_code == 403

        # User B attempts to dispatch federation using Workspace A as caller
        res3 = await client.post(
            "/api/v1/federation/dispatch",
            json={
                "caller_did": "did:vaeloom:fake",
                "caller_workspace_id": workspace_a,
                "target_workspace_id": workspace_b,
                "target_agent": "FakeAgent",
                "required_capability": "capability:test",
                "capability_credential": {},
                "task_name": "test",
            },
            headers=headers_b,
        )
        assert res3.status_code == 403
