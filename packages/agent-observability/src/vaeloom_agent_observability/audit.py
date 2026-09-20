import hashlib
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Any, Optional
from vaeloom_agent_contracts import ProvenanceRecord


class CryptographicAuditLog:
    """Tamper-evident audit log with hash-chained provenance records."""

    def __init__(self):
        self._chain: list[ProvenanceRecord] = []

    def append_event(self, session_id: UUID, agent_id: str, action_type: str, payload: dict[str, Any]) -> ProvenanceRecord:
        parent_hash = self._chain[-1].current_hash if self._chain else "GENESIS_HASH"
        payload_hash = hashlib.sha256(str(payload).encode("utf-8")).hexdigest()

        rec = ProvenanceRecord(
            session_id=session_id,
            agent_id=agent_id,
            action_type=action_type,
            parent_hash=parent_hash,
            payload_hash=payload_hash,
        )
        rec.current_hash = rec.compute_hash()
        self._chain.append(rec)
        return rec

    def verify_integrity(self) -> bool:
        """Verifies the hash chain integrity from genesis to tip."""
        for i, rec in enumerate(self._chain):
            if rec.current_hash != rec.compute_hash():
                return False
            expected_parent = self._chain[i - 1].current_hash if i > 0 else "GENESIS_HASH"
            if rec.parent_hash != expected_parent:
                return False
        return True

    def get_chain_length(self) -> int:
        return len(self._chain)
