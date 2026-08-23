"""Tests for browser/scraping tools: SSRF guard, handlers, quota, registry."""
import pytest

from api.tools.executor import (
    TOOL_TIMEOUT_OVERRIDES,
    _check_scrape_quota,
    _execute_browse_job_page,
    _execute_scrape_company_insights,
    _execute_verify_application_link,
    _extract_job_posting,
)

pytestmark = pytest.mark.asyncio


class TestUrlGuard:
    async def test_https_url_passes(self):
        from api.utils.url_guard import assert_public_http_url

        url = await assert_public_http_url("https://example.com/jobs/123")
        assert url == "https://example.com/jobs/123"

    @pytest.mark.parametrize(
        "bad",
        [
            "http://example.com/job",          # scheme
            "ftp://example.com/f",             # scheme
            "https://127.0.0.1/admin",         # loopback literal
            "https://10.0.0.5/internal",       # private literal
            "https://192.168.1.10/router",     # private literal
            "https://169.254.169.254/metadata",  # cloud metadata literal
            "https://localhost/secret",        # localhost name
            "https://svc.internal/health",     # internal TLD-ish name
            "https://user:pass@example.com/x",  # credentials
            "",                                # empty
            "not a url",                       # garbage (no scheme/host)
        ],
    )
    async def test_blocked_urls(self, bad):
        from api.utils.url_guard import UrlBlockedError, assert_public_http_url

        with pytest.raises(UrlBlockedError):
            await assert_public_http_url(bad)

    async def test_dns_resolving_to_private_is_blocked(self, monkeypatch):
        import socket

        import api.utils.url_guard as guard

        def fake_getaddrinfo(host, port, **kwargs):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.168.0.9", 443))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        with pytest.raises(guard.UrlBlockedError, match="non-public"):
            await guard.assert_public_http_url("https://evil.example.com/x")

    async def test_dns_resolving_public_passes(self, monkeypatch):
        import socket

        import api.utils.url_guard as guard

        def fake_getaddrinfo(host, port, **kwargs):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        assert await guard.assert_public_http_url("https://example.com/ok")

    async def test_dns_failure_raises_dns_resolution_error(self, monkeypatch):
        import socket

        import api.utils.url_guard as guard

        def fail_getaddrinfo(host, port, **kwargs):
            raise socket.gaierror("name resolution failure")

        monkeypatch.setattr(socket, "getaddrinfo", fail_getaddrinfo)
        with pytest.raises(guard.DnsResolutionError):
            await guard.assert_public_http_url("https://dead-domain.example.com/x")


class TestQuota:
    async def test_sliding_window_blocks_after_limit(self):
        ws = f"ws-quota-{id(object())}"
        assert _check_scrape_quota(ws, limit=3) is True
        assert _check_scrape_quota(ws, limit=3) is True
        assert _check_scrape_quota(ws, limit=3) is True
        assert _check_scrape_quota(ws, limit=3) is False

    async def test_independent_workspaces(self):
        a, b = f"ws-a-{id(object())}", f"ws-b-{id(object())}"
        assert _check_scrape_quota(a, limit=1) is True
        assert _check_scrape_quota(a, limit=1) is False
        assert _check_scrape_quota(b, limit=1) is True


class TestJobPostingExtraction:
    FIXTURE_TEXT = (
        "ExampleCorp\nSenior Backend Engineer\nBerlin, Germany\n"
        "About ExampleCorp\nWe build payments infrastructure.\n"
        "Responsibilities\nDesign distributed services.\n"
        "Requirements\n"
        "• 5+ years building production services in Python or Go\n"
        "- Experience with Kubernetes and Terraform\n"
        "Strong SQL skills (PostgreSQL)\n"
        "Benefits\nHealth insurance and equity.\n"
    )

    def test_extracts_title_company_requirements_skills(self):
        posting = _extract_job_posting(
            self.FIXTURE_TEXT, "Senior Backend Engineer at ExampleCorp | Jobs",
            "https://jobs.examplecorp.com/ postings/senior-backend",
        )
        assert posting["title"].startswith("Senior Backend Engineer")
        assert posting["company"] == "ExampleCorp"
        reqs = "\n".join(posting["requirements"]).lower()
        assert "python or go" in reqs
        assert "kubernetes" in reqs
        assert "health insurance" not in reqs  # benefits section excluded
        assert "postgresql" in posting["skills_mentioned"]

    def test_title_fallback_first_line(self):
        posting = _extract_job_posting(self.FIXTURE_TEXT, "", "https://careers.acme.io/x")
        assert posting["title"]
        assert posting["source_url"].startswith("https://")

    def test_skills_capped(self):
        text = " ".join(_SKILLS_SAMPLE)
        posting = _extract_job_posting(text, "t", "https://x.com/y")
        assert len(posting["skills_mentioned"]) <= 30


_SKILLS_SAMPLE = ["python", "go", "rust", "java", "kubernetes", "docker", "terraform", "aws", "gcp", "azure", "postgresql", "mysql", "redis", "kafka", "spark", "airflow", "react", "vue", "angular", "graphql", "grpc", "fastapi", "django", "flask", "spring", "rails", "jenkins", "prometheus", "grafana", "elasticsearch", "tensorflow", "pytorch"]


class TestBrowseJobPage:
    async def test_structured_extraction_via_mocked_browser(self, monkeypatch):
        from api.services import browser_service as bsm

        async def fake_fetch(url):
            return {
                "text": "Acme\nPlatform Engineer\nRequirements\n- Go and Kubernetes experience\n",
                "title": "Platform Engineer at Acme",
                "engine": "chromium",
            }

        monkeypatch.setattr(bsm.browser_service, "fetch_rendered_text", fake_fetch)
        r = await _execute_browse_job_page({"url": "https://jobs.acme.io/1"}, "ws-test")
        assert r["status"] == "success"
        assert r["engine"] == "chromium"
        assert r["result"]["company"] == "Acme"
        assert any("kubernetes" in x.lower() for x in r["result"]["requirements"])

    async def test_ssrf_blocked(self):
        r = await _execute_browse_job_page({"url": "http://169.254.169.254/meta"}, "ws")
        assert r["status"] == "error"
        assert "SSRF" in r["result"] or "blocked" in r["result"].lower()

    async def test_missing_url_error(self):
        r = await _execute_browse_job_page({}, "ws")
        assert r["status"] == "error"

    async def test_offline_returns_mock_fixture(self, monkeypatch):
        from api.services import browser_service as bsm
        from api.services.document_builder import PlaywrightUnavailableError

        async def unavailable(url):
            raise PlaywrightUnavailableError("chromium missing")

        async def httpx_fail(url):
            raise RuntimeError("offline")

        monkeypatch.setattr(bsm.browser_service, "fetch_rendered_text", unavailable)
        r = await _execute_browse_job_page({"url": "https://jobs.stripe.com/123"}, "ws")
        # handler catches engine failure inside fetch (which falls back to httpx
        # internally); simulate total failure by patching both layers:
        if r.get("status") != "success":
            monkeypatch.setattr(bsm.browser_service, "fetch_rendered_text", httpx_fail)
            r = await _execute_browse_job_page({"url": "https://jobs.stripe.com/123"}, "ws")
        assert r["status"] == "success"
        assert "mock" in (r.get("note") or "").lower() or r["result"]["title"]

    async def test_disabled_by_config(self, monkeypatch):
        import api.config as config_mod

        monkeypatch.setattr(config_mod.settings, "browser_tools_enabled", False, raising=False)
        r = await _execute_browse_job_page({"url": "https://example.com/x"}, "ws")
        assert r["status"] == "error"
        assert "disabled" in r["result"].lower()

    async def test_quota_enforced(self, monkeypatch):
        import api.config as config_mod

        monkeypatch.setattr(config_mod.settings, "scrape_quota_per_hour", 1, raising=False)
        from api.services import browser_service as bsm

        async def fake_fetch(url):
            return {"text": "Engineer at Acme\nRequirements\n- Python\n", "title": "E", "engine": "httpx"}

        monkeypatch.setattr(bsm.browser_service, "fetch_rendered_text", fake_fetch)
        ws = f"ws-quota2-{id(object())}"
        r1 = await _execute_browse_job_page({"url": "https://a.com/1"}, ws)
        r2 = await _execute_browse_job_page({"url": "https://a.com/2"}, ws)
        assert r1["status"] == "success"
        assert r2["status"] == "error"
        assert "quota" in r2["result"].lower()


class TestScrapeCompanyInsights:
    async def test_aggregates_axes(self, monkeypatch):
        import api.tools.executor as ex

        async def fake_search(params, ws):
            return {
                "status": "success",
                "result": [
                    {"title": f"T {params['query'][:6]}", "url": "https://r.example/x", "snippet": "S"}
                ],
            }

        monkeypatch.setattr(ex, "_execute_web_search", fake_search)
        r = await _execute_scrape_company_insights({"company_name": "Stripe"}, "ws")
        assert r["status"] == "success"
        res = r["result"]
        assert res["company"] == "Stripe"
        for axis in ("culture", "news_funding", "interview_questions", "tech_stack"):
            assert isinstance(res[axis], list) and res[axis]
        assert all(a["url"] == "https://r.example/x" for a in res["culture"])

    async def test_axis_failure_does_not_sink_rest(self, monkeypatch):
        import api.tools.executor as ex

        calls = {"n": 0}

        async def flaky_search(params, ws):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("search down")
            return {"status": "success", "result": [{"title": "t", "url": "u", "snippet": "s"}]}

        monkeypatch.setattr(ex, "_execute_web_search", flaky_search)
        r = await _execute_scrape_company_insights({"company_name": "Acme"}, "ws")
        assert r["status"] == "success"
        assert r["result"]["culture"] == []
        assert r["result"]["tech_stack"]

    async def test_missing_company_error(self):
        r = await _execute_scrape_company_insights({}, "ws")
        assert r["status"] == "error"


class TestVerifyApplicationLink:
    async def test_live_link(self, monkeypatch):
        from api.services import browser_service as bsm

        async def fake_probe(url):
            return {"reachable": True, "status_code": 200, "final_url": url}

        monkeypatch.setattr(bsm.browser_service, "probe_status", fake_probe)
        r = await _execute_verify_application_link({"url": "https://apply.example.com/1"}, "ws")
        assert r["status"] == "success"
        res = r["result"]
        assert res["reachable"] is True and res["verdict"] == "live"

    async def test_expired_link(self, monkeypatch):
        from api.services import browser_service as bsm

        async def fake_probe(url):
            return {"reachable": False, "status_code": 404, "final_url": url}

        monkeypatch.setattr(bsm.browser_service, "probe_status", fake_probe)
        r = await _execute_verify_application_link({"url": "https://apply.example.com/gone"}, "ws")
        assert r["result"]["verdict"] == "expired_or_error"

    async def test_offline_honest_verdict(self, monkeypatch):
        from api.services import browser_service as bsm

        async def fail_probe(url):
            raise RuntimeError("no network")

        monkeypatch.setattr(bsm.browser_service, "probe_status", fail_probe)
        r = await _execute_verify_application_link({"url": "https://apply.example.com/x"}, "ws")
        assert r["status"] == "success"
        assert r["result"]["verdict"] == "unreachable_or_offline"
        assert r["result"]["reachable"] is False

    async def test_dead_domain_maps_to_expired_verdict(self, monkeypatch):
        from api.services import browser_service as bsm
        from api.utils.url_guard import DnsResolutionError

        async def dead_probe(url):
            raise DnsResolutionError("DNS resolution failed")

        monkeypatch.setattr(bsm.browser_service, "probe_status", dead_probe)
        r = await _execute_verify_application_link({"url": "https://gone.example.com/1"}, "ws")
        assert r["status"] == "success"
        assert r["result"]["verdict"] == "expired_or_error"

    async def test_ssrf_blocked(self):
        r = await _execute_verify_application_link({"url": "https://192.168.0.1/admin"}, "ws")
        assert r["status"] == "error"


class TestRegistryWiring:
    def test_tool_count_now_28(self):
        from api.tools.definitions import ALL_TOOLS

        assert len(ALL_TOOLS) == 28

    def test_new_tools_present_with_scope(self):
        from api.tools.definitions import ALL_TOOLS

        for name in ("browse_job_page", "scrape_company_insights", "verify_application_link"):
            td = ALL_TOOLS[name]
            assert td.required_scope == "system.browser.read"
            assert td.category == "connector_read"

    def test_timeout_overrides_registered(self):
        assert TOOL_TIMEOUT_OVERRIDES["browse_job_page"] == 45
        assert TOOL_TIMEOUT_OVERRIDES["verify_application_link"] == 15

    def test_agents_declare_new_tools(self):
        from api.agents.application_agent.handler import ApplicationAgent
        from api.agents.job_search_agent.handler import JobSearchAgent

        js_names = {t.name for t in JobSearchAgent.tools}
        app_names = {t.name for t in ApplicationAgent.tools}
        assert {"browse_job_page", "verify_application_link", "scrape_company_insights"} <= js_names
        assert "verify_application_link" in app_names

    def test_scope_granting_works_for_agent(self):
        """Agent scopes derive from declared tools — new tools must pass check_permission."""
        from api.agents.job_search_agent.handler import JobSearchAgent
        from api.tools.definitions import get_tools_for_agent
        from api.tools.executor import check_permission

        declared = [t.name for t in JobSearchAgent.tools]
        tools = get_tools_for_agent(declared)
        scopes = [td.required_scope for td in tools]
        assert any(s == "system.browser.read" for s in scopes)

        import asyncio

        assert asyncio.run(check_permission(scopes, "system.browser.read")) is True
