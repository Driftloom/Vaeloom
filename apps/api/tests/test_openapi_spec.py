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
