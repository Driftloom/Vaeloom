from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any


class ActionType(StrEnum):
    DOCUMENT_DELETE = "document_delete"
    MEMORY_UPDATE = "memory_update"
    SETTINGS_CHANGE = "settings_change"


class UndoRedoAction:
    def __init__(
        self,
        action_id: str,
        action_type: ActionType,
        resource_type: str,
        resource_id: str,
        user_id: str,
        old_state: dict[str, Any] | None,
        new_state: dict[str, Any] | None,
        timestamp: datetime | None = None,
    ):
        self.action_id = action_id
        self.action_type = action_type
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.user_id = user_id
        self.old_state = old_state
        self.new_state = new_state
        self.timestamp = timestamp or datetime.now(UTC)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action_id": self.action_id,
            "action_type": self.action_type.value,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "user_id": self.user_id,
            "old_state": self.old_state,
            "new_state": self.new_state,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> UndoRedoAction:
        return cls(
            action_id=data["action_id"],
            action_type=ActionType(data["action_type"]),
            resource_type=data["resource_type"],
            resource_id=data["resource_id"],
            user_id=data["user_id"],
            old_state=data.get("old_state"),
            new_state=data.get("new_state"),
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


class UndoRedoManager:
    MAX_ACTIONS_PER_USER = 50

    def __init__(self) -> None:
        self._undo_stacks: dict[str, list[UndoRedoAction]] = {}
        self._redo_stacks: dict[str, list[UndoRedoAction]] = {}

    def push_action(
        self,
        action_type: ActionType | str,
        resource_type: str,
        resource_id: str,
        old_state: dict[str, Any] | None,
        new_state: dict[str, Any] | None,
        user_id: str,
    ) -> UndoRedoAction:
        if isinstance(action_type, str):
            action_type = ActionType(action_type)

        action = UndoRedoAction(
            action_id=str(uuid.uuid4()),
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            old_state=old_state,
            new_state=new_state,
        )

        if user_id not in self._undo_stacks:
            self._undo_stacks[user_id] = []
            self._redo_stacks[user_id] = []

        stack = self._undo_stacks[user_id]
        stack.append(action)
        if len(stack) > self.MAX_ACTIONS_PER_USER:
            stack.pop(0)

        self._redo_stacks[user_id].clear()

        return action

    def undo(self, user_id: str, action_id: str | None = None) -> UndoRedoAction | None:
        stack = self._undo_stacks.get(user_id)
        if not stack:
            return None

        if action_id is not None:
            idx = -1
            for i, a in enumerate(reversed(stack)):
                if a.action_id == action_id:
                    idx = len(stack) - 1 - i
                    break
            if idx < 0:
                return None
            action = stack.pop(idx)
        else:
            action = stack.pop()

        redo_stack = self._redo_stacks.setdefault(user_id, [])
        redo_stack.append(action)
        if len(redo_stack) > self.MAX_ACTIONS_PER_USER:
            redo_stack.pop(0)

        return action

    def redo(self, user_id: str, action_id: str | None = None) -> UndoRedoAction | None:
        stack = self._redo_stacks.get(user_id)
        if not stack:
            return None

        if action_id is not None:
            idx = -1
            for i, a in enumerate(reversed(stack)):
                if a.action_id == action_id:
                    idx = len(stack) - 1 - i
                    break
            if idx < 0:
                return None
            action = stack.pop(idx)
        else:
            action = stack.pop()

        undo_stack = self._undo_stacks.setdefault(user_id, [])
        undo_stack.append(action)
        if len(undo_stack) > self.MAX_ACTIONS_PER_USER:
            undo_stack.pop(0)

        return action

    def can_undo(self, user_id: str) -> bool:
        return bool(self._undo_stacks.get(user_id))

    def can_redo(self, user_id: str) -> bool:
        return bool(self._redo_stacks.get(user_id))

    def clear_user(self, user_id: str) -> None:
        self._undo_stacks.pop(user_id, None)
        self._redo_stacks.pop(user_id, None)

    def get_undo_history(self, user_id: str) -> list[UndoRedoAction]:
        return list(reversed(self._undo_stacks.get(user_id, [])))

    def get_redo_history(self, user_id: str) -> list[UndoRedoAction]:
        return list(reversed(self._redo_stacks.get(user_id, [])))


undo_redo_manager = UndoRedoManager()
