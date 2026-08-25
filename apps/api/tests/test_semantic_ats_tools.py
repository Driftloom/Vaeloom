"""Tests for semantic ATS executor tools: score, missing skills, formatting audit."""
import pytest

from api.tools.executor import (
    _execute_audit_ats_formatting,
    _execute_calculate_semantic_ats_score,
    _execute_extract_missing_hard_skills,
    _extract_jd_keywords,
)

pytestmark = pytest.mark.asyncio

RESUME = (
    "Software engineer with Python, Docker, Kubernetes, PostgreSQL experience. "
    "Built CI/CD pipelines with GitHub Actions. Led migration to microservices."
)
JD = (
    "Seeking an engineer skilled in Python, Kubernetes, Terraform, AWS, and GraphQL. "
    "Requirements: Docker, CI/CD experience, Kafka. AWS certified preferred."
)


class TestSemanticAtsScore:
    async def test_scores_with_mocked_embeddings(self, monkeypatch):
        import api.services.llm_service as lsm

        async def fake_emb(self, text, *a, **k):
            t = text.lower()
            return [1.0 if w in t else 0.0 for w in ("python", "kubernetes", "terraform")]

        # Patch class AND singleton — other tests may leak instance attributes.
        # NOTE: instance attrs are unbound, so the singleton patch needs no `self`.
        async def fake_emb_unbound(text, *a, **k):
            return await fake_emb(None, text, *a, **k)

        monkeypatch.setattr(lsm.LLMService, "generate_embedding", fake_emb)
        monkeypatch.setattr(lsm.llm_service, "generate_embedding", fake_emb_unbound)
        r = await _execute_calculate_semantic_ats_score(
            {"resume_text": RESUME, "job_description": JD}, "ws"
        )
        assert r["status"] == "success"
        res = r["result"]
        assert res["mode"] == "semantic+keyword"
        assert 0 <= res["score"] <= 100
        assert res["keyword_match_pct"] > 0
        assert "python" in res["matched_keywords"]
        assert isinstance(res["missing_keywords"], list)

    async def test_keyword_fallback_when_embeddings_fail(self, monkeypatch):
        import api.services.llm_service as lsm

        async def boom(self, text, *a, **k):
            raise RuntimeError("no api key")

        # Patch class AND singleton so no leaked instance attribute can shadow us.
        async def boom_unbound(text, *a, **k):
            raise RuntimeError("no api key")

        monkeypatch.setattr(lsm.LLMService, "generate_embedding", boom)
        monkeypatch.setattr(lsm.llm_service, "generate_embedding", boom_unbound)
        r = await _execute_calculate_semantic_ats_score(
            {"resume_text": RESUME, "job_description": JD}, "ws"
        )
        res = r["result"]
        assert res["mode"] == "keyword-fallback"
        assert res["semantic_similarity"] is None
        assert res["score"] > 0

    async def test_missing_params_error(self):
        r = await _execute_calculate_semantic_ats_score({"resume_text": "x"}, "ws")
        assert r["status"] == "error"

    async def test_identical_texts_score_high(self):
        r = await _execute_calculate_semantic_ats_score(
            {"resume_text": JD, "job_description": JD}, "ws"
        )
        # keyword-only fallback (no key in test env) still yields high match
        if r["result"]["mode"] == "keyword-fallback":
            assert r["result"]["score"] >= 70


class TestExtractMissingHardSkills:
    async def test_gazetteer_fallback_detection(self, monkeypatch):
        import api.config as config_mod

        monkeypatch.setattr(config_mod.settings, "llm_api_key", "", raising=False)
        r = await _execute_extract_missing_hard_skills(
            {"resume_text": RESUME, "job_description": JD}, "ws"
        )
        res = r["result"]
        assert res["source"] == "gazetteer-fallback"
        assert "python" in res["present_skills"]
        for expected in ("terraform", "aws", "graphql", "kafka"):
            assert expected in res["missing_skills"]

    async def test_llm_refinement_path(self, monkeypatch):
        import api.services.llm_service as lsm

        async def fake_llm(self, messages, **kwargs):
            return {"content": '{"missing_skills": ["Rust internals"], '
                              '"present_skills": ["Python"], "certifications": ["AWS SA"]}'}

        async def fake_llm_unbound(messages, **kwargs):
            return await fake_llm(None, messages, **kwargs)

        monkeypatch.setattr(lsm.LLMService, "generate_completion", fake_llm)
        monkeypatch.setattr(lsm.llm_service, "generate_completion", fake_llm_unbound)
        r = await _execute_extract_missing_hard_skills(
            {"resume_text": RESUME, "job_description": JD}, "ws"
        )
        res = r["result"]
        assert res["source"] == "llm+gazetteer"
        assert "rust internals" in [s.lower() for s in res["missing_skills"]]
        assert any("aws" in c.lower() for c in res["certifications"])

    async def test_missing_params_error(self):
        r = await _execute_extract_missing_hard_skills({"resume_text": ""}, "ws")
        assert r["status"] == "error"


class TestAuditAtsFormatting:
    async def test_flags_tables_and_graphics(self):
        bad = (
            "# Resume\n"
            "| Skill | Years |\n|---|---|\n| Python | 5 |\n"
            "EXPERIENCE    Engineer     Jan 2020 - Mar 2023\n"
            "![photo](me.jpg)\n"
        )
        r = await _execute_audit_ats_formatting({"resume_markdown": bad}, "ws")
        types = {i["type"] for i in r["result"]["issues"]}
        assert "table_detected" in types
        assert "graphics_detected" in types
        assert r["result"]["passed"] is False
        for issue in r["result"]["issues"]:
            assert {"type", "severity", "detail", "suggestion"} <= set(issue.keys())

    async def test_clean_resume_passes(self):
        clean = (
            "jane@example.com | +1 555\n\n"
            "PROFESSIONAL SUMMARY\nHardworking engineer.\n\n"
            "EXPERIENCE\nEngineer, Acme — Jan 2020 - Mar 2023\nBuilt services.\n\n"
            "SKILLS\nPython, Go\n\nEDUCATION\nBSc, TU Berlin Jan 2012 - Jun 2015\n"
        )
        r = await _execute_audit_ats_formatting({"resume_markdown": clean}, "ws")
        assert r["result"]["passed"] is True, r["result"]["issues"]

    async def test_missing_contact_flagged(self):
        r = await _execute_audit_ats_formatting(
            {"resume_markdown": "EXPERIENCE\nEngineer Jan 2020 - Jan 2023"}, "ws"
        )
        types = {i["type"] for i in r["result"]["issues"]}
        assert "contact_info_missing" in types

    async def test_empty_input_error(self):
        r = await _execute_audit_ats_formatting({"resume_markdown": ""}, "ws")
        assert r["status"] == "error"


class TestJdKeywordExtraction:
    def test_gazetteer_skills_ranked_first(self):
        kws = _extract_jd_keywords(JD)
        lower = [k.lower() for k in kws]
        assert "python" in lower and "kubernetes" in lower and "terraform" in lower

    def test_stopwords_excluded(self):
        kws = _extract_jd_keywords("The candidate will join our team of teams. Experience required.")
        assert not ({"the", "candidate", "will", "our", "team", "teams"} & set(kws))

    def test_dedup_no_substrings(self):
        kws = _extract_jd_keywords("aws aws aws amazon web services aws certified python python")
        assert kws.count("aws") == 1


class TestToolDefinitions:
    def test_new_tools_registered_in_all_tools(self):
        from api.tools.definitions import ALL_TOOLS

        for name in ("calculate_semantic_ats_score", "extract_missing_hard_skills",
                     "audit_ats_formatting"):
            assert name in ALL_TOOLS
            assert ALL_TOOLS[name].required_scope == "memory.read"

    def test_get_tools_for_agent_includes_new_tools(self):
        from api.tools.definitions import get_tools_for_agent

        tools = get_tools_for_agent(["calculate_semantic_ats_score", "audit_ats_formatting"])
        assert len(tools) == 2
