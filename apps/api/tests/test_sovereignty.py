"""
End-to-End Tests for PIOS Sovereign Trust, Local-First Sync & W3C Verifiable Credentials (Phase 3).
Verifies:
- Ed25519 Sovereign DID Generation and W3C DID Document compliance
- W3C Capability Credential Issuance & Mathematical Verification
- W3C Agent Execution Audit Credential Issuance & Verification
- Cryptographic Proof Tamper Detection (Tamper-evident claims fail-closed)
- Local-First CRDT State Push / Pull with Deterministic LWW Conflict Resolution
- Zero-Trust Cross-Workspace Access Control (Fail-closed 403)
"""
from __future__ import annotations

import copy
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestSovereignty:
    async def _setup_user_and_workspace(self, client: AsyncClient, prefix: str = "sov") -> tuple[dict, str, str]:
        email = f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPassword123!"})
        assert res.status_code == 201, res.text
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": f"{prefix.upper()} Workspace"}, headers=headers)
        assert ws_res.status_code == 201, ws_res.text
        workspace_id = ws_res.json()["id"]

        return headers, workspace_id, token

    async def test_sovereign_identity_and_did_document(self, client: AsyncClient):
        """Verify Ed25519 key generation and W3C DID document structure."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "identity")

        res = await client.get("/api/v1/sovereignty/identity", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()

        assert "did" in data
        assert data["did"].startswith("did:vaeloom:")
        assert "publicKeyBase64" in data
        assert len(data["publicKeyBase64"]) > 30

        did_doc = data["didDocument"]
        assert did_doc["id"] == data["did"]
        assert "@context" in did_doc
        assert len(did_doc["verificationMethod"]) == 1
        vm = did_doc["verificationMethod"][0]
        assert vm["type"] == "Ed25519VerificationKey2020"
        assert vm["controller"] == data["did"]
        assert vm["publicKeyBase64"] == data["publicKeyBase64"]
        assert vm["id"] == f"{data['did']}#key-1"

    async def test_capability_credential_issuance_and_verification(self, client: AsyncClient):
        """Verify issuance and cryptographic proof verification of a Capability Credential."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "cap")

        payload = {
            "workspace_id": workspace_id,
            "capability_tag": "capability:backend.python@v3",
            "validation_tier": "V3",
            "evidence": ["Passed 35 test suites", "Clean AST static analysis", "Zero trust verified"],
        }
        res = await client.post(
            "/api/v1/sovereignty/credentials/issue/capability",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 200, res.text
        vc = res.json()

        assert "https://www.w3.org/2018/credentials/v1" in vc["@context"]
        assert "VerifiableCredential" in vc["type"]
        assert "CapabilityCredential" in vc["type"]
        issuer_id = vc["issuer"] if isinstance(vc["issuer"], str) else vc["issuer"]["id"]
        assert issuer_id.startswith("did:vaeloom:")
        assert vc["credentialSubject"]["capabilityTag"] == "capability:backend.python@v3"
        assert vc["credentialSubject"]["validationTier"] == "V3"
        assert len(vc["credentialSubject"]["evidence"]) == 3
        assert "proof" in vc
        assert vc["proof"]["type"] == "Ed25519Signature2020"
        assert "proofValue" in vc["proof"]

        # Verify the credential mathematically
        verify_res = await client.post(
            "/api/v1/sovereignty/credentials/verify",
            json={"credential": vc},
            headers=headers,
        )
        assert verify_res.status_code == 200, verify_res.text
        verification = verify_res.json()
        assert verification["is_valid"] is True
        assert verification["issuer"] == issuer_id
        assert verification["signature_verified"] is True

    async def test_agent_audit_credential_issuance_and_verification(self, client: AsyncClient):
        """Verify issuance and verification of an Agent Execution Audit Credential."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "audit")

        payload = {
            "workspace_id": workspace_id,
            "agent_name": "JobSearchAgent",
            "execution_id": "exec-abc-123",
            "tools_invoked": ["browse_job_page", "calculate_semantic_ats_score"],
            "council_verdict": "SHIP",
            "policy_checks_passed": True,
        }
        res = await client.post(
            "/api/v1/sovereignty/credentials/issue/audit",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 200, res.text
        vc = res.json()

        assert "AgentAuditCredential" in vc["type"]
        assert vc["credentialSubject"]["agentName"] == "JobSearchAgent"
        assert vc["credentialSubject"]["councilVerdict"] == "SHIP"

        # Verify valid signature
        verify_res = await client.post(
            "/api/v1/sovereignty/credentials/verify",
            json={"credential": vc},
            headers=headers,
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["is_valid"] is True

    async def test_tamper_detection_fails_closed(self, client: AsyncClient):
        """Verify that any tampering with credential claims causes verification failure."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "tamper")

        payload = {
            "workspace_id": workspace_id,
            "capability_tag": "capability:frontend.react@v2",
            "validation_tier": "V2",
            "evidence": ["Initial test run"],
        }
        res = await client.post(
            "/api/v1/sovereignty/credentials/issue/capability",
            json=payload,
            headers=headers,
        )
        assert res.status_code == 200
        original_vc = res.json()

        # 1. Tamper with validation tier (upgrade claim fraudulently)
        tampered_vc = copy.deepcopy(original_vc)
        tampered_vc["credentialSubject"]["validationTier"] = "V4"

        verify_res = await client.post(
            "/api/v1/sovereignty/credentials/verify",
            json={"credential": tampered_vc},
            headers=headers,
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["is_valid"] is False
        assert "Cryptographic signature verification failed" in verify_res.json()["reason"]

        # 2. Tamper with proof signature value
        corrupted_proof_vc = copy.deepcopy(original_vc)
        corrupted_proof_vc["proof"]["proofValue"] = "AAAA" + corrupted_proof_vc["proof"]["proofValue"][4:]
        verify_res2 = await client.post(
            "/api/v1/sovereignty/credentials/verify",
            json={"credential": corrupted_proof_vc},
            headers=headers,
        )
        assert verify_res2.status_code == 200
        assert verify_res2.json()["is_valid"] is False

    async def test_credentials_listing_and_retrieval(self, client: AsyncClient):
        """Verify listing and detail retrieval of verifiable credentials."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "list")

        # Issue two credentials
        await client.post(
            "/api/v1/sovereignty/credentials/issue/capability",
            json={
                "workspace_id": workspace_id,
                "capability_tag": "capability:cloud.docker@v1",
                "validation_tier": "V1",
                "evidence": ["Container builds"],
            },
            headers=headers,
        )
        await client.post(
            "/api/v1/sovereignty/credentials/issue/audit",
            json={
                "workspace_id": workspace_id,
                "agent_name": "TestAgent",
                "execution_id": "exec-999",
                "tools_invoked": [],
                "council_verdict": "SHIP",
                "policy_checks_passed": True,
            },
            headers=headers,
        )

        # List all credentials in workspace
        list_res = await client.get(
            f"/api/v1/sovereignty/credentials?workspace_id={workspace_id}",
            headers=headers,
        )
        assert list_res.status_code == 200
        cred_list = list_res.json()
        assert cred_list["total"] == 2

        cred_id = cred_list["credentials"][0]["id"]

        # Fetch single credential
        detail_res = await client.get(
            f"/api/v1/sovereignty/credentials/{cred_id}?workspace_id={workspace_id}",
            headers=headers,
        )
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == f"urn:uuid:{cred_id}"

    async def test_crdt_sync_push_pull_and_lww(self, client: AsyncClient):
        """Verify local-first CRDT synchronization and Last-Write-Wins conflict resolution."""
        headers, workspace_id, _ = await self._setup_user_and_workspace(client, "crdt")

        entity_id = str(uuid.uuid4())

        # 1. Client A pushes delta 1 (HL timestamp: 1000:0001:clientA)
        push1 = {
            "workspace_id": workspace_id,
            "client_id": "clientA",
            "deltas": [
                {
                    "entity_type": "scale_memory_node",
                    "entity_id": entity_id,
                    "operation": "upsert",
                    "payload": {"summary": "Initial client A version", "tier": "DAILY"},
                    "hlc_timestamp": "1000:0001:clientA",
                }
            ],
        }
        res1 = await client.post("/api/v1/sovereignty/sync/push", json=push1, headers=headers)
        assert res1.status_code == 200, res1.text
        data1 = res1.json()
        assert data1["accepted_count"] == 1
        assert data1["superseded_count"] == 0

        # 2. Client B pushes an older delta (HL timestamp: 900:0001:clientB) -> Must be rejected by LWW
        push2 = {
            "workspace_id": workspace_id,
            "client_id": "clientB",
            "deltas": [
                {
                    "entity_type": "scale_memory_node",
                    "entity_id": entity_id,
                    "operation": "upsert",
                    "payload": {"summary": "Older client B version", "tier": "DAILY"},
                    "hlc_timestamp": "0900:0001:clientB",
                }
            ],
        }
        res2 = await client.post("/api/v1/sovereignty/sync/push", json=push2, headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["accepted_count"] == 0
        assert data2["superseded_count"] == 1

        # 3. Client B pushes a newer delta (HL timestamp: 1100:0001:clientB) -> Must be accepted by LWW
        push3 = {
            "workspace_id": workspace_id,
            "client_id": "clientB",
            "deltas": [
                {
                    "entity_type": "scale_memory_node",
                    "entity_id": entity_id,
                    "operation": "upsert",
                    "payload": {"summary": "Newest client B version", "tier": "DAILY"},
                    "hlc_timestamp": "1100:0001:clientB",
                }
            ],
        }
        res3 = await client.post("/api/v1/sovereignty/sync/push", json=push3, headers=headers)
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["accepted_count"] == 1

        # 4. Pull sync deltas since 1050:0000:0
        pull_res = await client.get(
            f"/api/v1/sovereignty/sync/pull?workspace_id={workspace_id}&since_hlc=1050:0000:0",
            headers=headers,
        )
        assert pull_res.status_code == 200
        pull_data = pull_res.json()
        assert pull_data["total"] == 1
        assert pull_data["deltas"][0]["payload"]["summary"] == "Newest client B version"
        assert pull_data["latest_hlc"] == "1100:0001:clientB"

    async def test_zero_trust_workspace_isolation(self, client: AsyncClient):
        """Verify cross-workspace requests fail closed with 403 Forbidden."""
        headers_a, workspace_id_a, _ = await self._setup_user_and_workspace(client, "alice")
        headers_b, workspace_id_b, _ = await self._setup_user_and_workspace(client, "bob")

        # User B attempts to issue credential in Workspace A
        res1 = await client.post(
            "/api/v1/sovereignty/credentials/issue/capability",
            json={
                "workspace_id": workspace_id_a,
                "capability_tag": "capability:hack",
                "validation_tier": "V1",
                "evidence": [],
            },
            headers=headers_b,
        )
        assert res1.status_code == 403

        # User B attempts to list credentials in Workspace A
        res2 = await client.get(
            f"/api/v1/sovereignty/credentials?workspace_id={workspace_id_a}",
            headers=headers_b,
        )
        assert res2.status_code == 403

        # User B attempts to push CRDT delta into Workspace A
        res3 = await client.post(
            "/api/v1/sovereignty/sync/push",
            json={
                "workspace_id": workspace_id_a,
                "client_id": "bob-client",
                "deltas": [],
            },
            headers=headers_b,
        )
        assert res3.status_code == 403

        # User B attempts to pull CRDT deltas from Workspace A
        res4 = await client.get(
            f"/api/v1/sovereignty/sync/pull?workspace_id={workspace_id_a}",
            headers=headers_b,
        )
        assert res4.status_code == 403
