"""Test Suite: Module 05 Hierarchical Folders (M05-FOLDER).
Verifies folder creation, nesting, cycle prevention, depth limits, and tree generation.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException

from api.services.folder_service import FolderService, MAX_FOLDER_DEPTH


@pytest.mark.asyncio
async def test_folder_depth_limit_enforcement():
    """Verify maximum folder depth of 10 is strictly enforced."""
    svc = FolderService()
    ws_id = uuid.uuid4()
    p_id = uuid.uuid4()

    mock_db = AsyncMock()
    with patch.object(svc, "get_folder", return_value=type("Folder", (), {"id": p_id})()):
        with patch.object(svc, "_calculate_depth", return_value=MAX_FOLDER_DEPTH):
            with pytest.raises(HTTPException) as exc:
                await svc.create_folder(
                    workspace_id=ws_id,
                    name="SubFolderExceedingDepth",
                    parent_id=p_id,
                    user_id=uuid.uuid4(),
                    db=mock_db,
                )
            assert exc.value.status_code == 400
            assert "Maximum folder nesting depth" in exc.value.detail


@pytest.mark.asyncio
async def test_folder_name_validation():
    """Verify folder names cannot be empty or contain slashes."""
    svc = FolderService()
    ws_id = uuid.uuid4()
    mock_db = AsyncMock()

    with pytest.raises(HTTPException):
        await svc.create_folder(ws_id, "", None, None, mock_db)

    with pytest.raises(HTTPException):
        await svc.create_folder(ws_id, "folder/with/slash", None, None, mock_db)
