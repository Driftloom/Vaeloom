import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

VALID_KEY = "sk-test-1234567890abcdef"


async def _auth(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"byok-{uuid.uuid4().hex[:10]}@test.com", "password": "Test1234!",
    })
    assert res.status_code in (200, 201), res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


class TestProviderKeysRouter:
    async def test_requires_auth(self, client):
        res = await client.get("/api/v1/provider-keys")
        assert res.status_code == 401

    async def test_create_and_list(self, client):
        headers = await _auth(client)
        res = await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["key_hint"] == "...cdef"
        assert "api_key" not in body
        assert "encrypted_key" not in body
        assert "sk-test-1234567890" not in str(body)

        res = await client.get("/api/v1/provider-keys", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] == 1

    async def test_create_rejects_short_key(self, client):
        headers = await _auth(client)
        res = await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": "short",
        }, headers=headers)
        assert res.status_code in (400, 422)

    async def test_create_rejects_unknown_provider(self, client):
        headers = await _auth(client)
        res = await client.post("/api/v1/provider-keys", json={
            "provider": "deepseek", "api_key": VALID_KEY,
        }, headers=headers)
        assert res.status_code == 400

    async def test_effective_system_fallback(self, client, monkeypatch):
        from api.config import settings
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        headers = await _auth(client)
        res = await client.get("/api/v1/provider-keys/effective?provider=openai", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "system"
        assert body["has_custom_key"] is False
        assert body["key_hint"] == "...7890"

    async def test_effective_returns_custom_user_key(self, client):
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "anthropic", "api_key": "sk-ant-test-1234567890",
        }, headers=headers)
        res = await client.get("/api/v1/provider-keys/effective?provider=anthropic", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["source"] == "user"
        assert body["has_custom_key"] is True
        assert body["key_hint"] == "...7890"

    async def test_effective_rejects_unknown_provider(self, client):
        headers = await _auth(client)
        res = await client.get("/api/v1/provider-keys/effective?provider=deepseek", headers=headers)
        assert res.status_code == 400

    async def test_patch_deactivate_key(self, client):
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        kid = (await client.get("/api/v1/provider-keys", headers=headers)).json()["keys"][0]["id"]
        res = await client.patch(f"/api/v1/provider-keys/{kid}", json={"is_active": False}, headers=headers)
        assert res.status_code == 200
        assert res.json()["is_active"] is False

    async def test_patch_rotates_key(self, client):
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        kid = (await client.get("/api/v1/provider-keys", headers=headers)).json()["keys"][0]["id"]
        res = await client.patch(f"/api/v1/provider-keys/{kid}", json={"api_key": "sk-test-999999999999zzzz"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["key_hint"] == "...zzzz"

    async def test_patch_unknown_field_rejected(self, client):
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        kid = (await client.get("/api/v1/provider-keys", headers=headers)).json()["keys"][0]["id"]
        res = await client.patch(f"/api/v1/provider-keys/{kid}", json={"unknown_field": 1}, headers=headers)
        assert res.status_code == 400

    async def test_patch_other_users_key_404(self, client):
        headers = await _auth(client)
        res = await client.patch(
            f"/api/v1/provider-keys/{uuid.uuid4()}", json={"is_active": False}, headers=headers,
        )
        assert res.status_code == 404

    async def test_delete_key(self, client):
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        kid = (await client.get("/api/v1/provider-keys", headers=headers)).json()["keys"][0]["id"]
        res = await client.delete(f"/api/v1/provider-keys/{kid}", headers=headers)
        assert res.status_code == 204
        res = await client.get("/api/v1/provider-keys", headers=headers)
        assert res.json()["total"] == 0

    async def test_validate_endpoint(self, client, monkeypatch):
        import httpx

        class FakeClient:
            def __init__(self, *a, **k):
                self.status_code = 200

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, *a, **k):
                return self

            async def post(self, *a, **k):
                return self

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        headers = await _auth(client)
        await client.post("/api/v1/provider-keys", json={
            "provider": "openai", "api_key": VALID_KEY,
        }, headers=headers)
        kid = (await client.get("/api/v1/provider-keys", headers=headers)).json()["keys"][0]["id"]
        res = await client.post(f"/api/v1/provider-keys/{kid}/validate", headers=headers)
        assert res.status_code == 200
        assert res.json()["is_valid"] is True
        assert res.json()["provider"] == "openai"

    async def test_validate_missing_key_404(self, client):
        headers = await _auth(client)
        res = await client.post(
            f"/api/v1/provider-keys/{uuid.uuid4()}/validate", headers=headers,
        )
        assert res.status_code == 404