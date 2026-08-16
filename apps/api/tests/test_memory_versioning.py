import uuid
from datetime import datetime, timezone

import pytest

from api.services.memory_versioning import (
    MemoryVersion,
    create_version,
    get_history,
    diff,
    VersionDiff,
)


class TestCreateVersion:
    def test_creates_version_with_changes(self):
        mem_id = uuid.uuid4()
        old = {"title": "Old Title", "content": "Old content", "status": "active"}
        new = {"title": "New Title", "content": "Updated content", "status": "active"}

        version = create_version(mem_id, old, new)

        assert version.memory_id == mem_id
        assert version.version_number == 1
        assert "title" in version.changes
        assert version.changes["title"]["from"] == "Old Title"
        assert version.changes["title"]["to"] == "New Title"
        assert "content" in version.changes
        assert "status" not in version.changes

    def test_increments_version_number(self):
        mem_id = uuid.uuid4()
        old = {"title": "v1"}
        new = {"title": "v2"}

        v1 = create_version(mem_id, old, new)
        v2 = create_version(mem_id, new, {"title": "v3"})

        assert v1.version_number == 1
        assert v2.version_number == 2

    def test_tracks_timestamps(self):
        mem_id = uuid.uuid4()
        old = {"title": "old"}
        new = {"title": "new"}

        before = datetime.now(timezone.utc)
        version = create_version(mem_id, old, new)
        after = datetime.now(timezone.utc)

        assert before <= version.created_at <= after

    def test_empty_changes_no_diff(self):
        mem_id = uuid.uuid4()
        old = {"title": "Same"}
        new = {"title": "Same"}

        version = create_version(mem_id, old, new)

        assert version.changes == {}

    def test_snapshot_contains_full_state(self):
        mem_id = uuid.uuid4()
        old = {"title": "old"}
        new = {"title": "new", "content": "added"}

        version = create_version(mem_id, old, new)

        assert version.snapshot["title"] == "new"
        assert version.snapshot["content"] == "added"


class TestGetHistory:
    def test_returns_empty_for_new_memory(self):
        mem_id = uuid.uuid4()
        assert get_history(mem_id) == []

    def test_returns_all_versions(self):
        mem_id = uuid.uuid4()
        old = {"title": "v1"}
        v1 = create_version(mem_id, old, {"title": "v2"})
        v2 = create_version(mem_id, {"title": "v2"}, {"title": "v3"})

        history = get_history(mem_id)

        assert len(history) == 2
        assert history[0].id == v1.id
        assert history[1].id == v2.id

    def test_isolated_per_memory(self):
        mid_a = uuid.uuid4()
        mid_b = uuid.uuid4()

        create_version(mid_a, {"title": "a"}, {"title": "A"})
        create_version(mid_b, {"title": "b"}, {"title": "B"})
        create_version(mid_a, {"title": "A"}, {"title": "A2"})

        assert len(get_history(mid_a)) == 2
        assert len(get_history(mid_b)) == 1


class TestDiff:
    def test_added_fields(self):
        mem_id = uuid.uuid4()
        old = {"title": "test"}
        new = {"title": "test", "content": "new field"}
        v_a = create_version(mem_id, old, old)
        v_b = create_version(mem_id, old, new)

        d = diff(v_a, v_b)

        assert d.added == {"content": "new field"}
        assert d.removed == {}
        assert d.modified == {}

    def test_removed_fields(self):
        mem_id = uuid.uuid4()
        old = {"title": "test", "content": "gone"}
        new = {"title": "test"}
        v_a = create_version(mem_id, old, old)
        v_b = create_version(mem_id, old, new)

        d = diff(v_a, v_b)

        assert d.removed.get("content") == "gone"
        assert d.added == {}
        assert d.modified == {}

    def test_modified_fields(self):
        mem_id = uuid.uuid4()
        old = {"title": "before", "content": "same"}
        new = {"title": "after", "content": "same"}
        v_a = create_version(mem_id, old, old)
        v_b = create_version(mem_id, old, new)

        d = diff(v_a, v_b)

        assert d.modified == {"title": ("before", "after")}
        assert d.added == {}
        assert d.removed == {}

    def test_identical_snapshots(self):
        mem_id = uuid.uuid4()
        state = {"title": "same", "status": "active"}
        v_a = create_version(mem_id, state, state)
        v_b = create_version(mem_id, state, state)

        d = diff(v_a, v_b)

        assert d.added == {}
        assert d.removed == {}
        assert d.modified == {}

    def test_all_diff_types(self):
        mem_id = uuid.uuid4()
        old = {"title": "old", "color": "red"}
        new = {"title": "new", "size": "large", "color": "blue"}
        v_a = create_version(mem_id, old, old)
        v_b = create_version(mem_id, old, new)

        d = diff(v_a, v_b)

        assert d.modified == {"title": ("old", "new"), "color": ("red", "blue")}
        assert d.added == {"size": "large"}

    def test_version_diff_model(self):
        d = VersionDiff(added={"key": "val"}, removed={}, modified={})
        assert d.added["key"] == "val"
        assert d.removed == {}
        assert d.modified == {}
