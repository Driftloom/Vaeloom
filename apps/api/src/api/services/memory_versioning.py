import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel


class MemoryVersion(BaseModel):
    id: uuid.UUID
    memory_id: uuid.UUID
    version_number: int
    changes: dict[str, dict[str, Any]]
    snapshot: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionDiff(BaseModel):
    added: dict[str, Any]
    removed: dict[str, Any]
    modified: dict[str, tuple[Any, Any]]


_versions: dict[uuid.UUID, list[MemoryVersion]] = {}
_version_counters: dict[uuid.UUID, int] = {}


def create_version(memory_id: uuid.UUID, old_state: dict[str, Any], new_state: dict[str, Any]) -> MemoryVersion:
    changes: dict[str, dict[str, Any]] = {}
    all_keys = set(old_state) | set(new_state)
    for key in all_keys:
        old_val = old_state.get(key)
        new_val = new_state.get(key)
        if old_val != new_val:
            entry: dict[str, Any] = {}
            if key in old_state:
                entry["from"] = _make_json_safe(old_val)
            if key in new_state:
                entry["to"] = _make_json_safe(new_val)
            if entry:
                changes[key] = entry

    if memory_id not in _version_counters:
        _version_counters[memory_id] = 0
    _version_counters[memory_id] += 1
    version_number = _version_counters[memory_id]

    version = MemoryVersion(
        id=uuid.uuid4(),
        memory_id=memory_id,
        version_number=version_number,
        changes=changes,
        snapshot=_make_json_safe(new_state),
        created_at=datetime.now(UTC),
    )

    if memory_id not in _versions:
        _versions[memory_id] = []
    _versions[memory_id].append(version)

    return version


def get_history(memory_id: uuid.UUID) -> list[MemoryVersion]:
    return _versions.get(memory_id, [])


def diff(version_a: MemoryVersion, version_b: MemoryVersion) -> VersionDiff:
    added: dict[str, Any] = {}
    removed: dict[str, Any] = {}
    modified: dict[str, tuple[Any, Any]] = {}

    snapshot_a = version_a.snapshot
    snapshot_b = version_b.snapshot

    all_keys = set(snapshot_a) | set(snapshot_b)

    for key in all_keys:
        val_a = snapshot_a.get(key)
        val_b = snapshot_b.get(key)
        if key not in snapshot_b:
            removed[key] = val_a
        elif key not in snapshot_a:
            added[key] = val_b
        elif val_a != val_b:
            modified[key] = (val_a, val_b)

    return VersionDiff(added=added, removed=removed, modified=modified)


def _make_json_safe(val: Any) -> Any:
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, set):
        return list(val)
    if isinstance(val, bytes):
        return val.hex()
    return val
