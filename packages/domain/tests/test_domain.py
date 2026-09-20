import pytest
from vaeloom_domain import (
    calculate_deterministic_ats_score,
    estimate_salary_benchmark,
)


def test_calculate_ats_score():
    job = "We are seeking a Python engineer experienced with FastAPI, PostgreSQL, Docker, and Kubernetes."
    resume = "Senior developer with extensive Python, FastAPI, and PostgreSQL database expertise."

    result = calculate_deterministic_ats_score(resume, job)
    assert result.overall_score > 0.0
    assert "python" in result.matched_keywords
    assert "fastapi" in result.matched_keywords
    assert "kubernetes" in result.missing_keywords


def test_salary_benchmarks():
    res = estimate_salary_benchmark("Senior Software Engineer")
    assert res.median == 185000
    assert res.p75 == 225000
    assert res.currency == "USD"
