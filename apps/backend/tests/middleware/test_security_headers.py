import ast
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.middleware.security_headers import SecurityHeadersMiddleware


class TestSecurityHeadersMiddleware:
    def test_returns_security_headers(self):
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)

        @app.get("/test")
        async def test_route():
            return {"ok": True}

        client = TestClient(app)
        response = client.get("/test")
        assert response.status_code == 200
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("Content-Security-Policy") == "default-src 'self'"
        assert response.headers.get("Strict-Transport-Security") == "max-age=31536000; includeSubDomains"

    def test_headers_on_error_response(self):
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)

        @app.get("/error")
        async def error_route():
            raise ValueError("test error")

        @app.exception_handler(ValueError)
        async def handler(_, __):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=500, content={"detail": "error"})

        client = TestClient(app)
        response = client.get("/error")
        assert response.status_code == 500
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_headers_static_file_path(self):
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)

        @app.get("/static/style.css")
        async def static_route():
            return {"file": "css"}

        client = TestClient(app)
        response = client.get("/static/style.css")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"


class TestCORSConfiguration:
    def test_cors_allows_configured_origins(self):
        from backend.config import settings
        assert "http://localhost:3000" in settings.allowed_origins
        assert "http://localhost:5173" in settings.allowed_origins

    @staticmethod
    def _find_cors_middleware_call():
        import ast
        import os

        main_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "src", "backend", "main.py"
        )
        with open(main_path) as f:
            tree = ast.parse(f.read())

        def _is_cors(node):
            if isinstance(node, ast.Name) and node.id == "CORSMiddleware":
                return True
            if isinstance(node, ast.Attribute) and node.attr == "CORSMiddleware":
                return True
            return False

        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "add_middleware"
                and node.args
                and _is_cors(node.args[0])
            ):
                return node
        return None

    def test_cors_restricted_methods_in_main(self):
        node = self._find_cors_middleware_call()
        assert node is not None, "CORSMiddleware add_middleware call not found"

        kwargs = {kw.arg: kw.value for kw in node.keywords}
        methods_kw = kwargs.get("allow_methods")
        headers_kw = kwargs.get("allow_headers")
        assert methods_kw is not None, "allow_methods not found"
        assert headers_kw is not None, "allow_headers not found"

        if isinstance(methods_kw, ast.List):
            methods = [elt.value for elt in methods_kw.elts if isinstance(elt, ast.Constant)]
            assert "GET" in methods
            assert "POST" in methods
            assert "DELETE" in methods
            assert "*" not in methods

        if isinstance(headers_kw, ast.List):
            headers = [elt.value for elt in headers_kw.elts if isinstance(elt, ast.Constant)]
            assert "Authorization" in headers
            assert "Content-Type" in headers
            assert "*" not in headers

    def test_cors_allow_credentials_true(self):
        node = self._find_cors_middleware_call()
        assert node is not None, "CORSMiddleware add_middleware call not found"

        kwargs = {kw.arg: kw.value for kw in node.keywords}
        credentials = kwargs.get("allow_credentials")
        assert credentials is not None
        if isinstance(credentials, ast.Constant):
            assert credentials.value is True
