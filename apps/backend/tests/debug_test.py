import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from backend.database import get_db
from backend.main import app
from tests.conftest import db_path, db_session

@pytest.mark.asyncio
async def test_debug(client):
    from httpx import AsyncClient
    headers = {}
    res = await client.post("/api/v1/auth/signup", json={
        "email": "debug@test.com", "password": "Test1234!",
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    res = await client.get("/api/v1/notifications/templates", headers=headers)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:500]}")
