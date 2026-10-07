"""Subsystem tests for Composio Enterprise Catalog, Dynamic Tool Bridging, and Purpose Resolution."""
import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from api.services.composio_catalog import COMPOSIO_SUPPORTED_APPS
from api.services.composio_service import ComposioService, composio_service
from api.tools.executor import DYNAMIC_TOOL_DEFS, approval_gated_tools, unregister_dynamic_tools

pytestmark = pytest.mark.asyncio


class TestComposioEnterpriseCatalog:
    """Verify catalog size, tier categorization, and unauthenticated API route access."""

    async def test_catalog_size_and_tiers(self):
        """Catalog must have 300+ apps categorized into Vaeloom's 5 Enterprise Tiers."""
        assert len(COMPOSIO_SUPPORTED_APPS) >= 300
        ids = [a["id"] for a in COMPOSIO_SUPPORTED_APPS]
        assert len(ids) == len(set(ids)), "All app IDs in catalog must be unique"

        tiers = {a["category"] for a in COMPOSIO_SUPPORTED_APPS}
        expected_tiers = {
            "Career & ATS",
            "Startup & Business",
            "Productivity & Study",
            "Engineering & Cloud",
            "Communication & Community",
        }
        assert tiers == expected_tiers, f"Unexpected categories in catalog: {tiers}"

        # Check required apps by tier
        career_apps = {a["id"] for a in COMPOSIO_SUPPORTED_APPS if a["category"] == "Career & ATS"}
        for req in ["greenhouse", "lever", "ashby", "workday", "github", "gitlab", "linkedin", "substack"]:
            assert req in career_apps, f"{req} must be in Career & ATS"

        business_apps = {a["id"] for a in COMPOSIO_SUPPORTED_APPS if a["category"] == "Startup & Business"}
        for req in ["stripe", "mercury", "brex", "ramp", "hubspot", "salesforce", "linear", "apollo"]:
            assert req in business_apps, f"{req} must be in Startup & Business"

        study_apps = {a["id"] for a in COMPOSIO_SUPPORTED_APPS if a["category"] == "Productivity & Study"}
        for req in ["notion", "obsidian", "google-docs", "airtable", "coda", "miro", "canvas-lms", "coursera"]:
            assert req in study_apps, f"{req} must be in Productivity & Study"

        cloud_apps = {a["id"] for a in COMPOSIO_SUPPORTED_APPS if a["category"] == "Engineering & Cloud"}
        for req in ["aws", "gcp", "azure", "vercel", "supabase", "neon", "postman", "sentry", "datadog"]:
            assert req in cloud_apps, f"{req} must be in Engineering & Cloud"

        comm_apps = {a["id"] for a in COMPOSIO_SUPPORTED_APPS if a["category"] == "Communication & Community"}
        for req in ["slack", "discord", "zoom", "gmail", "resend", "sendgrid"]:
            assert req in comm_apps, f"{req} must be in Communication & Community"

    async def test_get_composio_apps_unauthenticated_200(self, client: AsyncClient):
        """GET /connectors/composio/apps must succeed without auth (preview / initial page load)."""
        res = await client.get("/api/v1/connectors/composio/apps")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["total"] >= 300
        assert len(data["apps"]) > 0
        assert "Career & ATS" in data["categories"]
        assert "Startup & Business" in data["categories"]

    async def test_get_composio_apps_category_filter(self, client: AsyncClient):
        """Category filter returns only apps within that tier, supporting aliases."""
        res_career = await client.get("/api/v1/connectors/composio/apps?category=Career & ATS")
        assert res_career.status_code == 200
        data_career = res_career.json()
        assert all(a["category"] == "Career & ATS" for a in data_career["apps"])

        # Alias filter "career"
        res_alias = await client.get("/api/v1/connectors/composio/apps?category=career")
        assert res_alias.status_code == 200
        assert len(res_alias.json()["apps"]) == len(data_career["apps"])


class TestComposioPurposeResolution:
    """Verify high-precision regex/token boundary resolution in _resolve_purpose."""

    async def test_precision_boundaries(self):
        resolve = ComposioService._resolve_purpose

        # Target enterprise platforms
        assert resolve([], "Google BigQuery", "bigquery", "Enterprise data warehouse") == "Data & Analytics"
        assert resolve([], "Snowflake", "snowflake", "Cloud analytical platform") == "Data & Analytics"
        assert resolve([], "Databricks", "databricks", "Lakehouse Spark platform") == "Data & Analytics"

        assert resolve([], "OpenAI", "openai", "GPT-4 and DALL-E models") == "AI & ML"
        assert resolve([], "Anthropic Claude", "anthropic", "Claude 3.5 Sonnet API") == "AI & ML"

        assert resolve([], "Workday HCM", "workday", "Human capital management") == "Career & ATS"
        assert resolve([], "Lever ATS", "lever", "Applicant tracking system") == "Career & ATS"
        assert resolve([], "Greenhouse", "greenhouse", "Recruiting pipeline software") == "Career & ATS"

        # Word boundary tests (avoid false-positive substrings)
        # "discourse" should NOT trigger "course" (Education/Productivity)
        assert resolve([], "Discourse", "discourse", "Community discussion forums") == "Communication & Community"
        # "datadog" should NOT trigger "data" (Data & Analytics)
        assert resolve([], "Datadog", "datadog", "Observability and telemetry APM") == "Engineering & Cloud"


class TestDynamicComposioToolRegistration:
    """Verify dynamic bridging of active connected accounts in bridge_workspace_tools."""

    async def test_bridge_dynamic_tools_for_active_accounts(self):
        unregister_dynamic_tools("composio__")
        svc = ComposioService(api_key="mock_key")
        wid = str(uuid.uuid4())

        # Mock connected accounts containing active Stripe, Greenhouse, and Linear accounts
        mock_client = MagicMock()
        mock_acc_stripe = {"status": "ACTIVE", "app_name": "stripe", "auth_config_id": "stripe"}
        mock_acc_greenhouse = {"status": "ACTIVE", "app_name": "greenhouse", "auth_config_id": "greenhouse"}
        mock_acc_linear = {"status": "ACTIVE", "app_name": "linear", "auth_config_id": "linear"}
        mock_acc_inactive = {"status": "EXPIRED", "app_name": "salesforce", "auth_config_id": "salesforce"}

        mock_client.connected_accounts.list.return_value = [
            mock_acc_stripe,
            mock_acc_greenhouse,
            mock_acc_linear,
            mock_acc_inactive,
        ]
        # Live tool query returns empty or throws, triggering template fallback
        mock_client.tools.get.side_effect = Exception("offline")

        with patch("composio.Composio", return_value=mock_client):
            registered = svc.bridge_workspace_tools(wid)

        # Baseline tools registered
        assert "composio__slack__send_message" in registered
        assert "composio__github__create_issue" in registered

        # Dynamically bridged tools from active connected accounts
        assert "composio__stripe__get_customer" in registered
        assert "composio__stripe__create_payment_link" in registered
        assert "composio__greenhouse__list_candidates" in registered
        assert "composio__greenhouse__add_scorecard" in registered
        assert "composio__linear__create_issue" in registered

        # Inactive app (Salesforce) must NOT have been dynamically bridged
        assert not any(t.startswith("composio__salesforce__") for t in registered)

        # Mutation tools must be approval-gated
        gated = approval_gated_tools()
        assert "composio__stripe__create_payment_link" in gated
        assert "composio__greenhouse__add_scorecard" in gated
        assert "composio__stripe__get_customer" not in gated  # Read tool not gated
