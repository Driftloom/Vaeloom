import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from httpx import ASGITransport

from api.middleware.body_size_limit import BodySizeLimitMiddleware

pytestmark = pytest.mark.asyncio


class TestBodySizeLimitMiddleware:
    def _create_test_app(self, max_bytes: int = 1024):
        app = FastAPI()
        app.add_middleware(BodySizeLimitMiddleware, max_bytes=max_bytes)

        @app.post("/test-upload")
        async def upload_endpoint(payload: dict):
            return {"received_keys": list(payload.keys())}

        return app

    async def test_body_under_limit_passes(self):
        app = self._create_test_app(max_bytes=1024)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post("/test-upload", json={"hello": "world"})
            assert res.status_code == 200
            assert res.json() == {"received_keys": ["hello"]}

    async def test_body_over_content_length_limit_returns_413(self):
        app = self._create_test_app(max_bytes=100)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            large_payload = {"data": "x" * 200}
            res = await client.post("/test-upload", json=large_payload)
            assert res.status_code == 413
            assert res.json()["detail"] == "Payload too large"

    async def test_streamed_body_over_limit_returns_413(self):
        app = self._create_test_app(max_bytes=100)
        transport = ASGITransport(app=app)

        async def stream_generator():
            yield b'{"chunk": "'
            yield b"a" * 150
            yield b'"}'

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/test-upload",
                content=stream_generator(),
                headers={"Content-Type": "application/json"},
            )
            assert res.status_code == 413
            assert res.json()["detail"] == "Payload too large"
