from __future__ import annotations

import pytest

from backend.services.undo_redo import (
    ActionType,
    UndoRedoAction,
    UndoRedoManager,
    undo_redo_manager,
)


class TestUndoRedoAction:
    def test_create_action(self):
        action = UndoRedoAction(
            action_id="act-1",
            action_type=ActionType.MEMORY_UPDATE,
            resource_type="memory",
            resource_id="mem-1",
            user_id="user-1",
            old_state={"title": "Old"},
            new_state={"title": "New"},
        )
        assert action.action_id == "act-1"
        assert action.action_type == ActionType.MEMORY_UPDATE
        assert action.old_state == {"title": "Old"}

    def test_to_dict_and_from_dict_roundtrip(self):
        original = UndoRedoAction(
            action_id="act-2",
            action_type=ActionType.DOCUMENT_DELETE,
            resource_type="document",
            resource_id="doc-1",
            user_id="user-1",
            old_state={"content": "abc"},
            new_state=None,
        )
        d = original.to_dict()
        restored = UndoRedoAction.from_dict(d)
        assert restored.action_id == original.action_id
        assert restored.action_type == original.action_type
        assert restored.old_state == original.old_state
        assert restored.new_state == original.new_state


class TestUndoRedoManager:
    def setup_method(self):
        self.manager = UndoRedoManager()

    def test_push_action_stores_and_returns_action(self):
        action = self.manager.push_action(
            action_type=ActionType.SETTINGS_CHANGE,
            resource_type="settings",
            resource_id="ws-1",
            old_state={"theme": "light"},
            new_state={"theme": "dark"},
            user_id="user-1",
        )
        assert action.user_id == "user-1"
        assert self.manager.can_undo("user-1") is True
        assert self.manager.can_redo("user-1") is False

    def test_undo_returns_most_recent_action(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m2", {"b": 1}, {"b": 2}, "user-1")

        action = self.manager.undo("user-1")
        assert action is not None
        assert action.resource_id == "m2"

        action2 = self.manager.undo("user-1")
        assert action2 is not None
        assert action2.resource_id == "m1"

    def test_undo_by_action_id(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        a2 = self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m2", {"b": 1}, {"b": 2}, "user-1")
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m3", {"c": 1}, {"c": 2}, "user-1")

        action = self.manager.undo("user-1", a2.action_id)
        assert action is not None
        assert action.resource_id == "m2"

    def test_redo_restores_action(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        undone = self.manager.undo("user-1")
        assert undone is not None

        redone = self.manager.redo("user-1")
        assert redone is not None
        assert redone.resource_id == "m1"

    def test_redo_by_action_id(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        a2 = self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m2", {"b": 1}, {"b": 2}, "user-1")
        _ = self.manager.undo("user-1", a2.action_id)

        redone = self.manager.redo("user-1", a2.action_id)
        assert redone is not None
        assert redone.resource_id == "m2"

    def test_redo_cleared_when_new_action_pushed(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.undo("user-1")
        assert self.manager.can_redo("user-1") is True

        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m2", {"b": 1}, {"b": 2}, "user-1")
        assert self.manager.can_redo("user-1") is False

    def test_max_actions_enforced(self):
        for i in range(55):
            self.manager.push_action(
                ActionType.MEMORY_UPDATE, "memory", f"m{i}", {"v": i}, {"v": i + 1}, "user-1",
            )
        assert len(self.manager._undo_stacks["user-1"]) == UndoRedoManager.MAX_ACTIONS_PER_USER

    def test_clear_user(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.undo("user-1")
        self.manager.clear_user("user-1")
        assert self.manager.can_undo("user-1") is False
        assert self.manager.can_redo("user-1") is False

    def test_get_undo_history(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m2", {"b": 1}, {"b": 2}, "user-1")

        history = self.manager.get_undo_history("user-1")
        assert len(history) == 2
        assert history[0].resource_id == "m2"

    def test_get_redo_history(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.undo("user-1")

        history = self.manager.get_redo_history("user-1")
        assert len(history) == 1
        assert history[0].resource_id == "m1"

    def test_undo_empty_stack_returns_none(self):
        assert self.manager.undo("nonexistent") is None

    def test_redo_empty_stack_returns_none(self):
        assert self.manager.redo("nonexistent") is None

    def test_string_action_type(self):
        action = self.manager.push_action(
            action_type="document_delete",
            resource_type="document",
            resource_id="doc-1",
            old_state={"content": "abc"},
            new_state=None,
            user_id="user-1",
        )
        assert action.action_type == ActionType.DOCUMENT_DELETE

    def test_undo_by_nonexistent_action_id_returns_none(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        action = self.manager.undo("user-1", "nonexistent-action-id")
        assert action is None

    def test_redo_by_nonexistent_action_id_returns_none(self):
        self.manager.push_action(ActionType.MEMORY_UPDATE, "memory", "m1", {"a": 1}, {"a": 2}, "user-1")
        self.manager.undo("user-1")
        action = self.manager.redo("user-1", "nonexistent-action-id")
        assert action is None

    def test_singleton_instance(self):
        assert undo_redo_manager is not None
        assert isinstance(undo_redo_manager, UndoRedoManager)
