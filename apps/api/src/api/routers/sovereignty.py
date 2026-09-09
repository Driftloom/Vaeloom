"""
PIOS Sovereign Trust, Verifiable Credentials & CRDT Sync API Router.
Exposes endpoints for:
- Sovereign DIDs and cryptographic key discovery
- W3C Verifiable Credentials issuance (Capabilities & Agent Execution Audits)
- Mathematical cryptographic proof verification
- Local-First CRDT push/pull state replication
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace, WorkspaceUser
from ..services.crdt_sync_service import (
    CrdtDeltaInput,
    PullSyncResponse,
    PushSyncResponse,
    crdt_sync_service,
)
from ..services.sovereign_identity_service import sovereign_identity_service
from ..services.verifiable_credentials_service import (
    VerificationResult,
    verifiable_credentials_service,
)

router = APIRouter()


async def _verify_workspace_access(
    db: AsyncSession,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> bool:
    """Verifies that the user owns or belongs to the specified workspace."""
    r1 = await db.execute(
        select(Workspace.id).where(Workspace.id == workspace_id, Workspace.user_id == user_id)
    )
    if r1.scalar_one_or_none() is not None:
        return True
    r2 = await db.execute(
        select(WorkspaceUser.id).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == user_id,
        )
    )
    return r2.scalar_one_or_none() is not None


class IssueCapabilityRequest(BaseModel):
    workspace_id: uuid.UUID
    capability_tag: str = Field(..., description="e.g. capability:backend.python@v3")
    validation_tier: str = Field("V3", description="V0, V1, V2, V3, V4")
    evidence: list[str] = Field(default_factory=list)


class IssueAuditRequest(BaseModel):
    workspace_id: uuid.UUID
    agent_name: str
    execution_id: str
    tools_invoked: list[str] = Field(default_factory=list)
    council_verdict: str = "SHIP"
    policy_checks_passed: bool = True


class VerifyCredentialRequest(BaseModel):
    credential: dict[str, Any]


class PushSyncRequest(BaseModel):
    workspace_id: uuid.UUID
    client_id: str
    deltas: list[CrdtDeltaInput]


@router.get("/identity", response_model=dict[str, Any])
async def get_sovereign_identity(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieves the authenticated user's sovereign DID and W3C DID document."""
    user_id = uuid.UUID(current_user["sub"])
    did_doc = await sovereign_identity_service.get_did_document(db, user_id)
    identity = await sovereign_identity_service.get_or_create_identity(db, user_id)

    return {
        "did": identity.did,
        "publicKeyBase64": identity.public_key,
        "didDocument": did_doc,
        "createdAt": identity.created_at.isoformat() if identity.created_at else None,
    }


@router.post("/credentials/issue/capability", response_model=dict[str, Any])
async def issue_capability_credential(
    body: IssueCapabilityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Issues a cryptographically signed W3C Verifiable Credential for a validated skill."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    vc_doc = await verifiable_credentials_service.issue_capability_credential(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        capability_tag=body.capability_tag,
        validation_tier=body.validation_tier,
        evidence=body.evidence,
    )
    return vc_doc


@router.post("/credentials/issue/audit", response_model=dict[str, Any])
async def issue_audit_credential(
    body: IssueAuditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Issues a tamper-evident audit credential certifying agent execution safety."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    vc_doc = await verifiable_credentials_service.issue_agent_audit_credential(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        agent_name=body.agent_name,
        execution_id=body.execution_id,
        tools_invoked=body.tools_invoked,
        council_verdict=body.council_verdict,
        policy_checks_passed=body.policy_checks_passed,
    )
    return vc_doc


@router.get("/credentials", response_model=dict[str, Any])
async def list_credentials(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    credential_type: str | None = Query(None, description="CapabilityCredential or AgentAuditCredential"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Lists verifiable credentials in the user's sovereign workspace."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    credentials = await verifiable_credentials_service.list_credentials(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        credential_type=credential_type,
    )
    return {
        "credentials": [
            {
                "id": str(c.id),
                "credentialType": c.credential_type,
                "subjectDid": c.subject_did,
                "issuerDid": c.issuer_did,
                "claims": c.claims,
                "status": c.status,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
            }
            for c in credentials
        ],
        "total": len(credentials),
    }


@router.get("/credentials/{credential_id}", response_model=dict[str, Any])
async def get_credential(
    credential_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Exports a single verifiable credential as W3C JSON-LD."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    vc_json = await verifiable_credentials_service.get_credential_json(
        db=db,
        credential_id=credential_id,
        user_id=user_id,
        workspace_id=workspace_id,
    )
    if not vc_json:
        raise HTTPException(status_code=404, detail="Verifiable credential not found")
    return vc_json


@router.post("/credentials/verify", response_model=VerificationResult)
async def verify_credential(
    body: VerifyCredentialRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> VerificationResult:
    """Mathematically verifies any W3C Verifiable Credential against its Ed25519 proof."""
    return await verifiable_credentials_service.verify_credential(
        db=db,
        credential_dict=body.credential,
    )


@router.post("/sync/push", response_model=PushSyncResponse)
async def push_crdt_deltas(
    body: PushSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PushSyncResponse:
    """Pushes local-first CRDT deltas with deterministic LWW conflict resolution."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    return await crdt_sync_service.push_deltas(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        client_id=body.client_id,
        deltas=body.deltas,
    )


@router.get("/sync/pull", response_model=PullSyncResponse)
async def pull_crdt_deltas(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    since_hlc: str | None = Query(None, description="Last synchronized HLC timestamp"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PullSyncResponse:
    """Pulls recent CRDT deltas updated since the specified HLC cursor."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    return await crdt_sync_service.pull_deltas(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        since_hlc=since_hlc,
        limit=limit,
    )
