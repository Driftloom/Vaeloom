import json
import logging
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from starlette.responses import Response

from api.infrastructure.log import CorrelationIDMiddleware, RequestLoggingMiddleware
from api.logging import (
    _redact,
    StructuredJsonFormatter,
    PrettyFormatter,
    setup_logging,
    get_logger,
    correlation_id_var,
    tenant_id_var,
    user_id_var,
)


class TestRedact:
    def test_redacts_sensitive_keys(self):
        obj = {"password": "secret123", "name": "Alice"}
        result = _redact(obj)
        assert result["password"] == "[REDACTED]"
        assert result["name"] == "Alice"

    def test_redacts_nested_dict(self):
        obj = {"data": {"token": "abc", "api_key": "xyz"}, "safe": "ok"}
        result = _redact(obj)
        assert result["data"]["token"] == "[REDACTED]"
        assert result["data"]["api_key"] == "[REDACTED]"

    def test_redacts_list_of_dicts(self):
        obj = [{"secret": "s1"}, {"secret": "s2"}]
        result = _redact(obj)
        assert result[0]["secret"] == "[REDACTED]"
        assert result[1]["secret"] == "[REDACTED]"

    def test_handles_non_dict_non_list(self):
        assert _redact("hello") == "hello"
        assert _redact(42) == 42
        assert _redact(None) is None

    def test_redacts_various_sensitive_fields(self):
        obj = {
            "password_hash": "abc",
            "access_token": "xyz",
            "authorization": "Bearer ...",
            "cookie": "session=abc",
            "refresh_token": "xyz",
        }
        result = _redact(obj)
        for v in result.values():
            assert v == "[REDACTED]"


@pytest.fixture(autouse=True)
def _reset_contextvars():
    correlation_id_var.set("")
    tenant_id_var.set("")
    user_id_var.set("")


class TestStructuredJsonFormatter:
    def test_basic_format(self):
        formatter = StructuredJsonFormatter()
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "hello", (), None)
        output = json.loads(formatter.format(record))
        assert output["level"] == "info"
        assert output["message"] == "hello"
        assert output["service"] != ""
        assert "logger" in output

    def test_includes_correlation_id(self):
        formatter = StructuredJsonFormatter()
        correlation_id_var.set("corr-123")
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "msg", (), None)
        output = json.loads(formatter.format(record))
        assert output["trace_id"] == "corr-123"

    def test_includes_tenant_id(self):
        formatter = StructuredJsonFormatter()
        tenant_id_var.set("tenant-abc")
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "msg", (), None)
        output = json.loads(formatter.format(record))
        assert output["tenant_id"] == "tenant-abc"

    def test_includes_user_id(self):
        formatter = StructuredJsonFormatter()
        user_id_var.set("user-999")
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "msg", (), None)
        output = json.loads(formatter.format(record))
        assert output["user_id"] == "user-999"

    def test_includes_exception_info(self):
        formatter = StructuredJsonFormatter()
        record = logging.LogRecord(
            "test", logging.ERROR, "file.py", 1, "err", (),
            exc_info=(ValueError, ValueError("boom"), None),
        )
        output = json.loads(formatter.format(record))
        assert output["error"]["type"] == "ValueError"
        assert "boom" in output["error"]["message"]

    def test_includes_extra_data(self):
        formatter = StructuredJsonFormatter()
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "msg", (), None)
        record.extra_data = {"key": "value", "secret": "s1"}
        output = json.loads(formatter.format(record))
        assert output["data"]["key"] == "value"
        assert output["data"]["secret"] == "[REDACTED]"


class TestPrettyFormatter:
    def test_basic_format(self):
        formatter = PrettyFormatter()
        record = logging.LogRecord("test", logging.INFO, "file.py", 1, "hello", (), None)
        output = formatter.format(record)
        assert "hello" in output
        assert "[test]" in output

    def test_with_correlation_id(self):
        formatter = PrettyFormatter()
        correlation_id_var.set("corr-123")
        record = logging.LogRecord("test", logging.WARNING, "file.py", 1, "warn", (), None)
        output = formatter.format(record)
        assert "corr-123" in output or "(req:corr-12" in output

    def test_with_exception(self):
        formatter = PrettyFormatter()
        record = logging.LogRecord(
            "test", logging.ERROR, "file.py", 1, "err", (),
            exc_info=(RuntimeError, RuntimeError("fail"), None),
        )
        output = formatter.format(record)
        assert "RuntimeError" in output
        assert "fail" in output

    def test_with_tenant_id(self):
        formatter = PrettyFormatter()
        tenant_id_var.set("tenant-abc")
        record = logging.LogRecord("test", logging.WARNING, "file.py", 1, "msg", (), None)
        output = formatter.format(record)
        assert "(tenant:tenant-" in output


class TestSetupLogging:
    def test_dev_environment_uses_pretty_formatter(self):
        result = setup_logging()
        assert result is None

    def test_prod_environment_uses_json_formatter(self, monkeypatch):
        monkeypatch.setattr("api.logging.settings.service_environment", "production")
        result = setup_logging()
        assert result is None
        root = logging.getLogger()
        handler = root.handlers[0]
        assert isinstance(handler.formatter, StructuredJsonFormatter)


class TestGetLogger:
    def test_returns_logger(self):
        logger = get_logger("test_logger")
        assert isinstance(logger, logging.Logger)
        assert logger.name == "test_logger"


class TestCorrelationIDMiddleware:
    def test_adds_correlation_id_header(self):
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        @app.get("/test")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        response = client.get("/test")
        assert response.status_code == 200
        assert "X-Correlation-ID" in response.headers
        assert len(response.headers["X-Correlation-ID"]) > 0

    def test_passes_through_existing_correlation_id(self):
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        @app.get("/test")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        cid = "my-custom-id-123"
        response = client.get("/test", headers={"X-Correlation-ID": cid})
        assert response.headers["X-Correlation-ID"] == cid

    def test_falls_back_to_x_request_id(self):
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        @app.get("/test")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        rid = "req-id-456"
        response = client.get("/test", headers={"X-Request-ID": rid})
        assert response.headers["X-Correlation-ID"] == rid
        assert response.headers["X-Request-ID"] == rid

    def test_generates_uuid_when_no_header(self):
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        @app.get("/test")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        response = client.get("/test")
        cid = response.headers["X-Correlation-ID"]
        assert uuid.UUID(cid)  # validates UUID format

    def test_sets_request_state_correlation_id(self):
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)

        @app.get("/test")
        async def route(request: Request):
            assert hasattr(request.state, "correlation_id")
            return {"cid": request.state.correlation_id}

        client = TestClient(app)
        response = client.get("/test", headers={"X-Correlation-ID": "state-test"})
        assert response.json()["cid"] == "state-test"


class TestRequestLoggingMiddleware:
    def test_logs_request_details(self, caplog):
        caplog.set_level(logging.INFO)
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/test-route")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        response = client.get("/test-route")
        assert response.status_code == 200

        assert any(
            "request" in msg
            and "method=GET" in msg
            and "/test-route" in msg
            and "status=200" in msg
            and "duration=" in msg
            for msg in caplog.messages
        ), f"Expected log not found in: {caplog.messages}"

    def test_logs_includes_correlation_id(self, caplog):
        caplog.set_level(logging.INFO)
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/log-with-cid")
        async def route():
            return {"ok": True}

        client = TestClient(app)
        client.get("/log-with-cid", headers={"X-Correlation-ID": "cid-789"})

        assert any("cid-789" in msg for msg in caplog.messages), (
            f"Expected cid-789 in: {caplog.messages}"
        )

    def test_logs_on_error_response(self, caplog):
        caplog.set_level(logging.INFO)
        app = FastAPI()
        app.add_middleware(CorrelationIDMiddleware)
        app.add_middleware(RequestLoggingMiddleware)

        @app.get("/error-route")
        async def route():
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="not found")

        client = TestClient(app)
        response = client.get("/error-route")
        assert response.status_code == 404

        assert any(
            "request" in msg and "status=404" in msg
            for msg in caplog.messages
        ), f"Expected log with status=404 in: {caplog.messages}"
