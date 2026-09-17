import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from api.database import RLSGuardedAsyncSession
from api.middleware.tenant import TenantContext


@pytest.mark.asyncio
async def test_rls_guarded_session_reapplies_on_commit():
    """G-34: Ensure that when commit() is called, set_rls_session_vars is invoked to restore PostgreSQL SET LOCAL GUCs."""
    TenantContext.set(tenant_id="tenant-g34-123", workspace_id="ws-g34-456")
    try:
        session = RLSGuardedAsyncSession(bind=None)
        
        with patch.object(AsyncSession, "commit", new_callable=AsyncMock) as mock_super_commit, \
             patch("api.middleware.tenant.set_rls_session_vars", new_callable=AsyncMock) as mock_set_rls:
            
            await session.commit()
            
            mock_super_commit.assert_awaited_once()
            mock_set_rls.assert_awaited_once_with(session)
    finally:
        TenantContext.clear()


@pytest.mark.asyncio
async def test_rls_guarded_session_skips_when_no_tenant():
    """G-34: If TenantContext has no tenant_id, commit should not invoke set_rls_session_vars."""
    TenantContext.clear()
    session = RLSGuardedAsyncSession(bind=None)
    with patch.object(AsyncSession, "commit", new_callable=AsyncMock) as mock_super_commit, \
         patch("api.middleware.tenant.set_rls_session_vars", new_callable=AsyncMock) as mock_set_rls:
        await session.commit()
        mock_super_commit.assert_awaited_once()
        mock_set_rls.assert_not_called()
