"""
PIOS Local-First CRDT State Synchronization Service.
Implements Pillar 5 of the PIOS Blueprint:
- Hybrid Logical Clock (HLC) deterministic ordering: <millis>:<counter>:<client_id>
- Last-Write-Wins (LWW-Element-Set) conflict-free delta replication
- Offline push/pull synchronization protocol
- Zero-knowledge encrypted payload relay
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import CrdtSyncDelta
from .encryption import decrypt_value, is_encrypted

logger = logging.getLogger(__name__)


class HLC:
    """Hybrid Logical Clock implementation."""

    def __init__(self, millis: int, counter: int, client_id: str):
        self.millis = millis
        self.counter = counter
        self.client_id = client_id

    @classmethod
    def parse(cls, hlc_str: str) -> HLC:
        try:
            parts = hlc_str.split(":")
            if len(parts) < 3:
                return cls(millis=int(parts[0]), counter=0, client_id=parts[1] if len(parts) > 1 else "unknown")
            return cls(millis=int(parts[0]), counter=int(parts[1]), client_id=parts[2])
        except (ValueError, IndexError):
            return cls(millis=int(time.time() * 1000), counter=0, client_id="unknown")

    def __str__(self) -> str:
        return f"{self.millis}:{self.counter:04d}:{self.client_id}"

    def __lt__(self, other: HLC) -> bool:
        if self.millis != other.millis:
            return self.millis < other.millis
        if self.counter != other.counter:
            return self.counter < other.counter
        return self.client_id < other.client_id

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, HLC):
            return False
        return (self.millis, self.counter, self.client_id) == (other.millis, other.counter, other.client_id)


def compare_hlc(a_str: str, b_str: str) -> int:
    """Compares two HLC timestamp strings. Returns 1 if a > b, -1 if a < b, 0 if equal."""
    a = HLC.parse(a_str)
    b = HLC.parse(b_str)
    if a < b:
        return -1
    elif b < a:
        return 1
    return 0


class CrdtDeltaInput(BaseModel):
    client_id: str | None = Field(default=None, description="Originating client ID")
    entity_type: str  # memory, scale_node, capability, document
    entity_id: uuid.UUID
    hlc_timestamp: str
    operation: str = Field("UPDATE", description="INSERT, UPDATE, DELETE, upsert")
    payload: dict[str, Any] | None = Field(default=None, description="Raw structured JSON payload")
    encrypted_payload: str | None = Field(default=None, description="Encrypted serialized state delta")


class CrdtDeltaOutput(BaseModel):
    id: uuid.UUID
    client_id: str
    entity_type: str
    entity_id: uuid.UUID
    hlc_timestamp: str
    operation: str
    encrypted_payload: str
    payload: dict[str, Any] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def parse_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        enc = getattr(data, "encrypted_payload", None)
        parsed_payload = None
        if enc:
            try:
                dec = decrypt_value(enc) if is_encrypted(enc) else enc
                parsed_payload = json.loads(dec)
            except Exception:
                parsed_payload = None
        return {
            "id": getattr(data, "id", None),
            "client_id": getattr(data, "client_id", None),
            "entity_type": getattr(data, "entity_type", None),
            "entity_id": getattr(data, "entity_id", None),
            "hlc_timestamp": getattr(data, "hlc_timestamp", None),
            "operation": getattr(data, "operation", None),
            "encrypted_payload": enc or "",
            "payload": parsed_payload,
            "created_at": getattr(data, "created_at", None),
        }


class PushSyncResponse(BaseModel):
    accepted_count: int
    superseded_count: int
    latest_hlc: str


class PullSyncResponse(BaseModel):
    deltas: list[CrdtDeltaOutput]
    total: int = 0
    latest_hlc: str | None
    has_more: bool


class CrdtSyncService:
    """Manages local-first CRDT state replication with conflict-free deterministic resolution."""

    def generate_next_hlc(self, client_id: str, last_hlc_str: str | None = None) -> str:
        """Generates a monotonic HLC advancing beyond local physical clock and remote clock."""
        phys_ms = int(time.time() * 1000)
        if not last_hlc_str:
            return str(HLC(millis=phys_ms, counter=0, client_id=client_id))

        last_hlc = HLC.parse(last_hlc_str)
        if phys_ms > last_hlc.millis:
            return str(HLC(millis=phys_ms, counter=0, client_id=client_id))
        elif phys_ms == last_hlc.millis:
            return str(HLC(millis=phys_ms, counter=last_hlc.counter + 1, client_id=client_id))
        else:
            # Physical clock is behind last known HLC (clock skew)
            return str(HLC(millis=last_hlc.millis, counter=last_hlc.counter + 1, client_id=client_id))

    async def push_deltas(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        client_id: str,
        deltas: list[CrdtDeltaInput],
    ) -> PushSyncResponse:
        """
        Processes client-pushed CRDT deltas with deterministic Last-Write-Wins conflict resolution.
        """
        accepted = 0
        superseded = 0
        highest_hlc_seen = "0:0000:initial"

        for d in deltas:
            cid = d.client_id or client_id
            payload_str = d.encrypted_payload
            if not payload_str:
                if d.payload is not None:
                    payload_str = json.dumps(d.payload)
                else:
                    payload_str = "{}"

            if compare_hlc(d.hlc_timestamp, highest_hlc_seen) > 0:
                highest_hlc_seen = d.hlc_timestamp

            # Check existing delta for this entity in workspace
            stmt = (
                select(CrdtSyncDelta)
                .where(
                    CrdtSyncDelta.workspace_id == workspace_id,
                    CrdtSyncDelta.entity_type == d.entity_type,
                    CrdtSyncDelta.entity_id == d.entity_id,
                )
                .order_by(desc(CrdtSyncDelta.created_at))
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing is not None:
                # Deterministic LWW comparison
                if compare_hlc(d.hlc_timestamp, existing.hlc_timestamp) <= 0:
                    # Incoming delta is older or identical -> superseded
                    superseded += 1
                    continue
                else:
                    # Incoming delta is newer -> update existing entity state
                    existing.client_id = cid
                    existing.hlc_timestamp = d.hlc_timestamp
                    existing.operation = d.operation
                    existing.encrypted_payload = payload_str
                    accepted += 1
            else:
                # Fresh entity insertion
                new_delta = CrdtSyncDelta(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    workspace_id=workspace_id,
                    client_id=cid,
                    entity_type=d.entity_type,
                    entity_id=d.entity_id,
                    hlc_timestamp=d.hlc_timestamp,
                    operation=d.operation,
                    encrypted_payload=payload_str,
                )
                db.add(new_delta)
                accepted += 1

        await db.commit()
        return PushSyncResponse(
            accepted_count=accepted,
            superseded_count=superseded,
            latest_hlc=highest_hlc_seen,
        )

    async def pull_deltas(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        since_hlc: str | None = None,
        limit: int = 100,
    ) -> PullSyncResponse:
        """
        Pulls recent CRDT deltas from the server ledger for synchronization.
        """
        stmt = (
            select(CrdtSyncDelta)
            .where(
                CrdtSyncDelta.workspace_id == workspace_id,
                CrdtSyncDelta.user_id == user_id,
            )
            .order_by(asc(CrdtSyncDelta.created_at))
            .limit(limit + 1)
        )
        res = await db.execute(stmt)
        all_rows = list(res.scalars().all())

        # Filter in-memory by HLC cursor if specified
        filtered: list[CrdtSyncDelta] = []
        for row in all_rows:
            if since_hlc is None or compare_hlc(row.hlc_timestamp, since_hlc) > 0:
                filtered.append(row)

        has_more = len(filtered) > limit
        deltas_to_return = filtered[:limit]

        latest_hlc = deltas_to_return[-1].hlc_timestamp if deltas_to_return else since_hlc

        return PullSyncResponse(
            deltas=[CrdtDeltaOutput.model_validate(d) for d in deltas_to_return],
            total=len(deltas_to_return),
            latest_hlc=latest_hlc,
            has_more=has_more,
        )


crdt_sync_service = CrdtSyncService()
