import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.services.permission_service import PermissionService


@pytest.fixture
def permission_service():
    return PermissionService()


@pytest.mark.asyncio
async def test_check_workspace_owner_allows(permission_service):
    user_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = MagicMock()
    db.execute.return_value = result_mock
    result = await permission_service.check(
        user_id=user_id, workspace_id=workspace_id, db=db
    )
    assert result is True


@pytest.mark.asyncio
async def test_check_workspace_not_found_denies(permission_service):
    user_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    db.execute.return_value = result_mock
    result = await permission_service.check(
        user_id=user_id, workspace_id=workspace_id, db=db
    )
    assert result is False


@pytest.mark.asyncio
async def test_check_with_agent_permission_allows(permission_service):
    user_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    db = AsyncMock()

    workspace_result = MagicMock()
    workspace_result.scalar_one_or_none.return_value = MagicMock()

    permission_result = MagicMock()
    permission_result.scalar_one_or_none.return_value = MagicMock()

    db.execute.side_effect = [workspace_result, permission_result]

    result = await permission_service.check(
        user_id=user_id,
        workspace_id=workspace_id,
        action="read",
        agent_name="test_agent",
        db=db,
    )
    assert result is True


@pytest.mark.asyncio
async def test_check_with_agent_permission_denies(permission_service):
    user_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    db = AsyncMock()

    workspace_result = MagicMock()
    workspace_result.scalar_one_or_none.return_value = MagicMock()

    permission_result = MagicMock()
    permission_result.scalar_one_or_none.return_value = None

    db.execute.side_effect = [workspace_result, permission_result]

    result = await permission_service.check(
        user_id=user_id,
        workspace_id=workspace_id,
        action="read",
        agent_name="unauthorized_agent",
        db=db,
    )
    assert result is False
