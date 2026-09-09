"""
PIOS W3C Verifiable Credentials Service.
Implements Pillar 5 of the PIOS Blueprint:
- Standards-compliant W3C JSON-LD Verifiable Credentials (VC)
- Cryptographic Ed25519Signature2020 proofs
- Verifiable Capabilities (Validation Tiers V2-V4 from capability_engine.py)
- Tamper-Evident Agent Execution Audit Credentials
- Independent Mathematical Verification Engine
"""
from __future__ import annotations

import copy
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import SovereignIdentity, VerifiableCredential
from .capability_engine import TAG_PATTERN, ValidationTier, capability_engine
from .sovereign_identity_service import canonicalize_json, sovereign_identity_service

logger = logging.getLogger(__name__)

W3C_CONTEXT = [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://vaeloom.app/credentials/v1",
]


class VerificationResult(BaseModel):
    is_valid: bool
    issuer: str
    subject: str
    credential_type: str
    claims_verified: bool
    signature_verified: bool
    reason: str | None = None
    checked_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class VerifiableCredentialsService:
    """Issues, manages, and mathematically verifies W3C Verifiable Credentials."""

    def _prepare_document_for_signing(self, vc_dict: dict[str, Any]) -> dict[str, Any]:
        """Strips proofValue from proof block for deterministic signature creation/verification."""
        doc = copy.deepcopy(vc_dict)
        if "proof" in doc and isinstance(doc["proof"], dict):
            doc["proof"].pop("proofValue", None)
        return doc

    async def issue_capability_credential(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        capability_tag: str,
        validation_tier: str = ValidationTier.V3.value,
        evidence: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Issues a W3C Verifiable Credential certifying a validated skill/capability.
        """
        match = TAG_PATTERN.match(capability_tag)
        domain = match.group("domain") if match else "general"
        descriptor = match.group("descriptor") if match else capability_tag

        identity = await sovereign_identity_service.get_or_create_identity(db, user_id)
        priv_key = sovereign_identity_service.get_decrypted_private_key(identity)

        cred_id = f"urn:uuid:{uuid.uuid4()}"
        now_iso = datetime.now(UTC).isoformat()

        claims = {
            "id": identity.did,
            "capabilityTag": capability_tag,
            "domain": domain,
            "descriptor": descriptor,
            "validationTier": validation_tier,
            "evidence": evidence or ["Demonstrated across verified execution cycles."],
        }

        vc_doc: dict[str, Any] = {
            "@context": W3C_CONTEXT,
            "id": cred_id,
            "type": ["VerifiableCredential", "CapabilityCredential"],
            "issuer": {
                "id": identity.did,
                "name": "Vaeloom Sovereign Authority",
            },
            "issuanceDate": now_iso,
            "credentialSubject": claims,
            "proof": {
                "type": "Ed25519Signature2020",
                "created": now_iso,
                "verificationMethod": f"{identity.did}#key-1",
                "proofPurpose": "assertionMethod",
            },
        }

        # Canonicalize and sign
        doc_to_sign = self._prepare_document_for_signing(vc_doc)
        signature = sovereign_identity_service.sign_payload(priv_key, doc_to_sign)
        vc_doc["proof"]["proofValue"] = signature

        # Persist in ledger
        vc_row = VerifiableCredential(
            id=uuid.UUID(cred_id.replace("urn:uuid:", "")),
            user_id=user_id,
            workspace_id=workspace_id,
            credential_type="CapabilityCredential",
            subject_did=identity.did,
            issuer_did=identity.did,
            claims=claims,
            proof=vc_doc["proof"],
            status="ACTIVE",
        )
        db.add(vc_row)
        await db.commit()
        return vc_doc

    async def issue_agent_audit_credential(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        agent_name: str,
        execution_id: str,
        tools_invoked: list[str],
        council_verdict: str = "SHIP",
        policy_checks_passed: bool = True,
    ) -> dict[str, Any]:
        """
        Issues a tamper-evident W3C audit credential proving agent execution compliance.
        """
        identity = await sovereign_identity_service.get_or_create_identity(db, user_id)
        priv_key = sovereign_identity_service.get_decrypted_private_key(identity)

        cred_id = f"urn:uuid:{uuid.uuid4()}"
        now_iso = datetime.now(UTC).isoformat()

        claims = {
            "id": identity.did,
            "agentName": agent_name,
            "executionId": execution_id,
            "toolsInvoked": tools_invoked,
            "councilVerdict": council_verdict,
            "policyChecksPassed": policy_checks_passed,
            "auditTimestamp": now_iso,
        }

        vc_doc: dict[str, Any] = {
            "@context": W3C_CONTEXT,
            "id": cred_id,
            "type": ["VerifiableCredential", "AgentAuditCredential"],
            "issuer": {
                "id": identity.did,
                "name": "Vaeloom PIOS Conscience & Audit Gate",
            },
            "issuanceDate": now_iso,
            "credentialSubject": claims,
            "proof": {
                "type": "Ed25519Signature2020",
                "created": now_iso,
                "verificationMethod": f"{identity.did}#key-1",
                "proofPurpose": "assertionMethod",
            },
        }

        doc_to_sign = self._prepare_document_for_signing(vc_doc)
        signature = sovereign_identity_service.sign_payload(priv_key, doc_to_sign)
        vc_doc["proof"]["proofValue"] = signature

        vc_row = VerifiableCredential(
            id=uuid.UUID(cred_id.replace("urn:uuid:", "")),
            user_id=user_id,
            workspace_id=workspace_id,
            credential_type="AgentAuditCredential",
            subject_did=identity.did,
            issuer_did=identity.did,
            claims=claims,
            proof=vc_doc["proof"],
            status="ACTIVE",
        )
        db.add(vc_row)
        await db.commit()
        return vc_doc

    async def verify_credential(
        self,
        db: AsyncSession,
        credential_dict: dict[str, Any],
    ) -> VerificationResult:
        """
        Mathematically verifies a W3C Verifiable Credential against its Ed25519 cryptographic proof.
        """
        # 1. Structural validation
        if not isinstance(credential_dict, dict):
            return VerificationResult(
                is_valid=False,
                issuer="unknown",
                subject="unknown",
                credential_type="unknown",
                claims_verified=False,
                signature_verified=False,
                reason="Malformed credential: root must be a JSON object",
            )

        proof = credential_dict.get("proof")
        if not isinstance(proof, dict) or "proofValue" not in proof or "verificationMethod" not in proof:
            return VerificationResult(
                is_valid=False,
                issuer=str(credential_dict.get("issuer", "")),
                subject=str(credential_dict.get("credentialSubject", {}).get("id", "")),
                credential_type=str(credential_dict.get("type", "")),
                claims_verified=False,
                signature_verified=False,
                reason="Missing or incomplete cryptographic proof block",
            )

        issuer_field = credential_dict.get("issuer")
        issuer_did = issuer_field.get("id") if isinstance(issuer_field, dict) else str(issuer_field)
        subject_did = credential_dict.get("credentialSubject", {}).get("id", "")
        signature_b64 = proof["proofValue"]
        cred_type = "/".join(credential_dict.get("type", [])) if isinstance(credential_dict.get("type"), list) else str(credential_dict.get("type"))

        # 2. Resolve public key from issuer DID
        # If issuer is did:vaeloom:<user-id>, find in database
        stmt = select(SovereignIdentity).where(SovereignIdentity.did == issuer_did)
        res = await db.execute(stmt)
        identity = res.scalar_one_or_none()

        if identity is None:
            return VerificationResult(
                is_valid=False,
                issuer=issuer_did,
                subject=subject_did,
                credential_type=cred_type,
                claims_verified=True,
                signature_verified=False,
                reason=f"Issuer DID '{issuer_did}' cannot be resolved to a known public verification method",
            )

        # 3. Check revocation status in DB
        cred_id_str = credential_dict.get("id", "").replace("urn:uuid:", "")
        try:
            cred_uuid = uuid.UUID(cred_id_str)
            stmt_vc = select(VerifiableCredential).where(VerifiableCredential.id == cred_uuid)
            res_vc = await db.execute(stmt_vc)
            vc_record = res_vc.scalar_one_or_none()
            if vc_record and vc_record.status == "REVOKED":
                return VerificationResult(
                    is_valid=False,
                    issuer=issuer_did,
                    subject=subject_did,
                    credential_type=cred_type,
                    claims_verified=True,
                    signature_verified=True,
                    reason="Credential has been revoked by the issuer",
                )
        except (ValueError, TypeError):
            pass

        # 4. Cryptographic proof verification
        doc_to_verify = self._prepare_document_for_signing(credential_dict)
        sig_valid = sovereign_identity_service.verify_signature(
            public_key_b64=identity.public_key,
            payload=doc_to_verify,
            signature_b64=signature_b64,
        )

        if not sig_valid:
            return VerificationResult(
                is_valid=False,
                issuer=issuer_did,
                subject=subject_did,
                credential_type=cred_type,
                claims_verified=False,
                signature_verified=False,
                reason="Cryptographic signature verification failed — document has been altered or tampered with",
            )

        return VerificationResult(
            is_valid=True,
            issuer=issuer_did,
            subject=subject_did,
            credential_type=cred_type,
            claims_verified=True,
            signature_verified=True,
            reason=None,
        )

    async def list_credentials(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        credential_type: str | None = None,
    ) -> list[VerifiableCredential]:
        """Lists active verifiable credentials scoped to user and workspace."""
        stmt = select(VerifiableCredential).where(
            VerifiableCredential.workspace_id == workspace_id,
            VerifiableCredential.user_id == user_id,
        )
        if credential_type:
            stmt = stmt.where(VerifiableCredential.credential_type == credential_type)
        stmt = stmt.order_by(desc(VerifiableCredential.created_at))
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def get_credential_json(
        self,
        db: AsyncSession,
        credential_id: uuid.UUID,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> dict[str, Any] | None:
        """Exports a single credential as W3C JSON-LD."""
        stmt = select(VerifiableCredential).where(
            VerifiableCredential.id == credential_id,
            VerifiableCredential.workspace_id == workspace_id,
            VerifiableCredential.user_id == user_id,
        )
        res = await db.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            return None

        return {
            "@context": W3C_CONTEXT,
            "id": f"urn:uuid:{record.id}",
            "type": ["VerifiableCredential", record.credential_type],
            "issuer": {
                "id": record.issuer_did,
                "name": "Vaeloom Sovereign Authority",
            },
            "issuanceDate": record.created_at.isoformat() if record.created_at else "",
            "credentialSubject": record.claims,
            "proof": record.proof,
            "status": record.status,
        }


verifiable_credentials_service = VerifiableCredentialsService()
