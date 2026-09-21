"""Verifies the committed static OpenAPI spec (docs/backend/openapi.yaml)
matches the live application schema.

NOTE: path is lowercase to match the git-tracked file exactly — this test
silently skipped on case-sensitive Linux CI when it referenced docs/Backend.
"""
from pathlib import Path

import pytest
import yaml

SPEC_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "backend" / "openapi.yaml"


@pytest.mark.skipif(not SPEC_PATH.exists(), reason="docs/Backend/openapi.yaml not present — run scripts/gen_openapi.py first")
class TestOpenApiSpec:
    def _live_spec(self) -> dict:
        import api.main
        return api.main.app.openapi()

    def test_spec_file_exists(self):
        assert SPEC_PATH.exists(), "docs/Backend/openapi.yaml missing — regenerate with scripts/gen_openapi.py"

    def test_spec_paths_match_live_app(self):
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        live = self._live_spec()

        assert set(committed["paths"]) == set(live["paths"]), (
            f"Path set drifted: only-in-committed={set(committed['paths']) - set(live['paths'])} "
            f"only-in-live={set(live['paths']) - set(committed['paths'])}"
        )

        for path, methods in live["paths"].items():
            committed_methods = committed["paths"][path]
            for method in methods:
                assert method.lower() in committed_methods, (
                    f"Method {method.upper()} missing for {path} in committed spec"
                )

    def test_approval_endpoints_documented(self):
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        paths = committed["paths"]
        assert "/api/v1/approvals" in paths
        assert "/api/v1/approvals/{approval_id}/approve" in paths
        assert "/api/v1/approvals/{approval_id}/reject" in paths
        assert "/api/v1/consent/grant" in paths
        assert "/api/v1/gdpr/delete" in paths

    def test_versions_match(self):
        from api.config import settings
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        assert committed["info"]["version"] == settings.service_version

    # ── Contract hardening (spec-only; mirrors middleware/rate_limit.py) ──
    # RateLimitMiddleware returns 429 + Retry-After for every rate-limited
    # request; only SKIP_PATHS (/health, /health/ready, /docs, /openapi.json,
    # /redoc) are exempt. Auth is custom middleware (Bearer JWT), so the
    # generator declares components/securitySchemes/BearerAuth explicitly.
    _RATE_LIMIT_SKIP_PATHS = frozenset(
        {"/health", "/health/ready", "/docs", "/openapi.json", "/redoc"}
    )
    _HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}

    def _operations(self, committed: dict):
        for path, path_item in committed["paths"].items():
            if not isinstance(path_item, dict):
                continue
            for method, operation in path_item.items():
                if method.lower() in self._HTTP_METHODS and isinstance(operation, dict):
                    yield path, method, operation

    def test_bearer_security_scheme_declared(self):
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        schemes = committed.get("components", {}).get("securitySchemes", {})
        assert "BearerAuth" in schemes, "components/securitySchemes/BearerAuth missing"
        assert schemes["BearerAuth"]["type"] == "http"
        assert schemes["BearerAuth"]["scheme"] == "bearer"

    def test_rate_limited_operations_document_429(self):
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        missing = [
            f"{method.upper()} {path}"
            for path, method, op in self._operations(committed)
            if path not in self._RATE_LIMIT_SKIP_PATHS
            and "429" not in (op.get("responses") or {})
        ]
        assert not missing, f"Operations missing 429 response: {missing[:10]}"

    def test_429_responses_carry_retry_after(self):
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        bad = [
            f"{method.upper()} {path}"
            for path, method, op in self._operations(committed)
            if "429" in (op.get("responses") or {})
            and "Retry-After"
            not in ((op["responses"]["429"].get("headers") or {}))
        ]
        assert not bad, f"429 responses missing Retry-After header: {bad[:10]}"

    def test_rate_limit_skip_paths_have_no_429(self):
        # Guards parity with RateLimitMiddleware.SKIP_PATHS: exempt probes
        # must not advertise a 429 they can never emit.
        committed = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
        unexpected = [
            f"{method.upper()} {path}"
            for path, method, op in self._operations(committed)
            if path in self._RATE_LIMIT_SKIP_PATHS
            and "429" in (op.get("responses") or {})
        ]
        assert not unexpected, f"Exempt paths must not document 429: {unexpected}"
